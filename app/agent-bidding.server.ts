/**
 * Engine 12: Multi-Agent Bidding Syndicate
 *
 * Virtual war room — 3 AI agents (Conservative, Aggressive, Retention)
 * debate budget allocation, then a CEO agent makes the final decision.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { extractJsonFromText } from "./utils/ai-safety.server.js";
import { getCampaignPerformanceByDate, listSmartAdsCampaigns } from "./google-ads.server.js";
import { scanInventoryLevels } from "./inventory-ads.server.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentVote {
  agent: string;
  recommendation: "increase" | "decrease" | "maintain" | "pause";
  budgetSuggestion: number;
  reasoning: string;
  confidence: number;
}

interface ConsensusDecision {
  action: "increase" | "decrease" | "maintain" | "pause";
  budget: number;
  reasoning: string;
}

interface BiddingSessionResult {
  sessionId: string;
  agentVotes: AgentVote[];
  consensus: ConsensusDecision;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_MODEL = "claude-haiku-4-5-20251001";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseAgentResponse(text: string): Omit<AgentVote, "agent"> {
  try {
    const match = extractJsonFromText(text);
    if (match) {
      const parsed = JSON.parse(match);
      return {
        recommendation: parsed.recommendation || "maintain",
        budgetSuggestion: parsed.budgetSuggestion || 0,
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: clamp(parsed.confidence || 0.5, 0, 1),
      };
    }
  } catch {
    // fallback
  }
  return {
    recommendation: "maintain",
    budgetSuggestion: 0,
    reasoning: "Failed to parse agent response",
    confidence: 0.3,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── 1. Run Bidding Session ─────────────────────────────────────────────────

/**
 * Full multi-agent debate session. Three specialized agents analyze campaign
 * performance data, then a CEO agent synthesizes their input into a final decision.
 */
export async function runBiddingSession(
  shop: string,
  campaignId?: string,
): Promise<BiddingSessionResult> {
  try {
    logger.info("agent-bidding", `Starting bidding session for shop ${shop}`, { extra: { campaignId } });

    // Gather data for all agents
    const campaigns = await listSmartAdsCampaigns();
    let performanceData: Array<{ date: string; clicks: number; cost: number; conversions: number; conversionValue: number }> = [];

    if (campaignId) {
      try {
        performanceData = await getCampaignPerformanceByDate(campaignId, 14);
      } catch { /* no data */ }
    } else {
      // Aggregate across all campaigns
      for (const c of campaigns.slice(0, 5)) {
        try {
          const perf = await getCampaignPerformanceByDate(c.id, 14);
          performanceData.push(...perf);
        } catch { /* skip */ }
      }
    }

    // Get inventory data for overstock detection
    let inventoryData: { lowStock: any[]; overstock: any[] } = { lowStock: [], overstock: [] };
    try {
      const scan = await scanInventoryLevels(shop);
      inventoryData = { lowStock: scan.lowStock, overstock: scan.overstock };
    } catch { /* no inventory data */ }

    // Summarize performance for agent prompts
    const totalCost = performanceData.reduce((s, d) => s + (d.cost || 0), 0);
    const totalRevenue = performanceData.reduce((s, d) => s + (d.conversionValue || 0), 0);
    const totalClicks = performanceData.reduce((s, d) => s + (d.clicks || 0), 0);
    const totalConversions = performanceData.reduce((s, d) => s + (d.conversions || 0), 0);
    const currentRoas = totalCost > 0 ? totalRevenue / totalCost : 0;
    const avgDailyCost = performanceData.length > 0 ? totalCost / performanceData.length : 0;

    const dataSummary = JSON.stringify({
      days: performanceData.length,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalClicks,
      totalConversions,
      currentRoas: Math.round(currentRoas * 100) / 100,
      avgDailyBudget: Math.round(avgDailyCost * 100) / 100,
      overstockProducts: inventoryData.overstock.length,
      lowStockProducts: inventoryData.lowStock.length,
      activeCampaigns: campaigns.length,
    });

    // Create 3 agent prompts and run in parallel
    const conservativePrompt = `You are the Conservative Budget Agent. Your priority is ROAS safety and capital preservation. Analyze this campaign data and recommend budget action.

Data: ${dataSummary}

Rules:
- Cut spend on anything below 2.0 ROAS
- Never recommend more than 15% budget increase
- If data is insufficient (less than 7 days), recommend "maintain"
- Flag any concerning trends

Return JSON only: {"recommendation": "increase"|"decrease"|"maintain"|"pause", "budgetSuggestion": <daily budget number>, "reasoning": "<brief explanation>", "confidence": <0-1>}`;

    const aggressivePrompt = `You are the Aggressive Growth Agent. Your priority is maximizing revenue and growth opportunities. Analyze this campaign data and recommend budget action.

Data: ${dataSummary}

Rules:
- Scale winners aggressively (up to 40% increase if ROAS > 3)
- Push budget to clear overstock inventory (${inventoryData.overstock.length} overstocked products)
- Look for scale opportunities even at slightly lower ROAS
- Prioritize market share capture

Return JSON only: {"recommendation": "increase"|"decrease"|"maintain"|"pause", "budgetSuggestion": <daily budget number>, "reasoning": "<brief explanation>", "confidence": <0-1>}`;

    const retentionPrompt = `You are the Retention & LTV Agent. Your priority is customer lifetime value and returning customer optimization. Analyze this campaign data and recommend budget action.

Data: ${dataSummary}

Rules:
- Favor campaigns targeting returning customers
- Recommend shifting budget to retention-focused campaigns
- Consider long-term value over short-term ROAS
- If conversion rate is declining, suggest creative refresh before budget increase

Return JSON only: {"recommendation": "increase"|"decrease"|"maintain"|"pause", "budgetSuggestion": <daily budget number>, "reasoning": "<brief explanation>", "confidence": <0-1>}`;

    // Run 3 agent calls in parallel
    const [conservativeRes, aggressiveRes, retentionRes] = await Promise.all([
      client.messages.create({
        model: AI_MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: conservativePrompt }],
      }),
      client.messages.create({
        model: AI_MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: aggressivePrompt }],
      }),
      client.messages.create({
        model: AI_MODEL,
        max_tokens: 500,
        messages: [{ role: "user", content: retentionPrompt }],
      }),
    ]);

    // Parse agent responses
    const conservativeText = conservativeRes.content[0].type === "text" ? conservativeRes.content[0].text : "";
    const aggressiveText = aggressiveRes.content[0].type === "text" ? aggressiveRes.content[0].text : "";
    const retentionText = retentionRes.content[0].type === "text" ? retentionRes.content[0].text : "";

    const agentVotes: AgentVote[] = [
      { agent: "conservative", ...parseAgentResponse(conservativeText) },
      { agent: "aggressive", ...parseAgentResponse(aggressiveText) },
      { agent: "retention", ...parseAgentResponse(retentionText) },
    ];

    // CEO Agent — final decision maker
    const ceoPrompt = `You are the CEO Agent. You have received budget recommendations from 3 specialist agents. Make the final decision.

Campaign Data: ${dataSummary}

Agent Votes:
${agentVotes.map((v) => `- ${v.agent}: ${v.recommendation} (budget: $${v.budgetSuggestion}/day, confidence: ${v.confidence}) — ${v.reasoning}`).join("\n")}

Rules:
- Weight each agent by their confidence score
- If 2+ agents agree, lean toward their recommendation
- Default to conservative if agents disagree significantly
- Your budget suggestion should be realistic based on the data

Return JSON only: {"action": "increase"|"decrease"|"maintain"|"pause", "budget": <daily budget number>, "reasoning": "<explanation of your decision synthesizing all inputs>"}`;

    const ceoRes = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: ceoPrompt }],
    });

    const ceoText = ceoRes.content[0].type === "text" ? ceoRes.content[0].text : "";
    let consensus: ConsensusDecision;

    try {
      const match = extractJsonFromText(ceoText);
      if (match) {
        const parsed = JSON.parse(match);
        consensus = {
          action: parsed.action || "maintain",
          budget: parsed.budget || avgDailyCost,
          reasoning: parsed.reasoning || "No reasoning provided",
        };
      } else {
        throw new Error("No JSON in CEO response");
      }
    } catch {
      consensus = {
        action: "maintain",
        budget: avgDailyCost,
        reasoning: "CEO agent failed to parse — defaulting to maintain current budget.",
      };
    }

    // Save session to database
    const session = await prisma.agentBiddingSession.create({
      data: {
        shop,
        campaignId: campaignId || null,
        sessionType: "daily_rebalance",
        agentVotes: JSON.stringify(agentVotes),
        consensusAction: JSON.stringify(consensus),
        agentsInvolved: 3,
        debateRounds: 1,
      },
    });

    logger.info("agent-bidding", `Session complete: ${session.id}`, {
      extra: { consensus: consensus.action, budget: consensus.budget },
    });

    return {
      sessionId: session.id,
      agentVotes,
      consensus,
    };
  } catch (error) {
    logger.error("agent-bidding", "Bidding session failed", { extra: { shop, campaignId, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 2. Get Recent Sessions ─────────────────────────────────────────────────

/**
 * Retrieve the last 10 bidding sessions for a shop.
 */
export async function getRecentSessions(shop: string) {
  try {
    const sessions = await prisma.agentBiddingSession.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return sessions.map((s) => ({
      id: s.id,
      campaignId: s.campaignId,
      sessionType: s.sessionType,
      agentVotes: JSON.parse(s.agentVotes),
      consensus: s.consensusAction ? JSON.parse(s.consensusAction) : null,
      agentsInvolved: s.agentsInvolved,
      executedAction: s.executedAction,
      outcomeRoas: s.outcomeRoas,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    logger.error("agent-bidding", "Failed to fetch recent sessions", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
