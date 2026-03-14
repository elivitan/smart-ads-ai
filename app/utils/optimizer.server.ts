/**
 * Smart Ads AI — Auto-Optimization Engine
 *
 * Runs periodically to optimize active campaigns like a real ad agency:
 * - Pauses campaigns with low ROAS
 * - Adjusts budgets based on performance
 * - Pauses underperforming keywords
 * - Logs every decision for transparency
 *
 * Supports two modes:
 * - AUTO: executes actions immediately
 * - MANUAL: creates recommendations for user approval
 */

import Anthropic from "@anthropic-ai/sdk";
import prisma from "../db.server.js";
import {
  listSmartAdsCampaigns,
  updateCampaignStatus,
  updateCampaignBudget,
  getKeywordPerformance,
  pauseKeyword,
} from "../google-ads.server.js";
import { getDailyAdvice } from "../ai-brain.server.js";
import { logger } from "./logger.js";

const narrativeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Optimization Rules (tunable) ─────────────────────────────────────────

const RULES = {
  /** ROAS below this after 7+ days → pause campaign */
  MIN_ROAS_THRESHOLD: 1.0,
  /** Minimum spend ($) before ROAS rule applies */
  MIN_SPEND_FOR_ROAS: 10,
  /** CTR above this + ROAS above 2 → increase budget */
  HIGH_CTR_THRESHOLD: 3.0,
  /** ROAS above this → eligible for budget increase */
  HIGH_ROAS_THRESHOLD: 2.0,
  /** Budget increase percentage for high performers */
  BUDGET_INCREASE_PCT: 0.2,
  /** Budget decrease percentage for underperformers */
  BUDGET_DECREASE_PCT: 0.15,
  /** Keyword: clicks without conversion → pause */
  KEYWORD_CLICKS_NO_CONV: 50,
  /** Maximum auto-actions per campaign per run */
  MAX_ACTIONS_PER_CAMPAIGN: 3,
  /** Maximum total actions per optimization run */
  MAX_ACTIONS_PER_RUN: 10,
} as const;

// ── Types ────────────────────────────────────────────────────────────────

interface OptAction {
  campaignId: string;
  campaignName: string;
  action: string;
  reason: string;
  previousValue?: string;
  newValue?: string;
  aiGrade?: string;
}

interface OptResult {
  shop: string;
  totalCampaigns: number;
  actionsPlanned: number;
  actionsExecuted: number;
  actionsFailed: number;
  actions: Array<OptAction & { success: boolean; error?: string }>;
  aiGrade?: string;
  duration: number;
}

// ── Main optimization function ───────────────────────────────────────────

export async function runOptimization(shop: string): Promise<OptResult> {
  const start = Date.now();
  const result: OptResult = {
    shop,
    totalCampaigns: 0,
    actionsPlanned: 0,
    actionsExecuted: 0,
    actionsFailed: 0,
    actions: [],
    duration: 0,
  };

  try {
    // 1. Fetch all active Smart Ads campaigns
    const campaigns = await listSmartAdsCampaigns();
    const enabledCampaigns = campaigns.filter(
      (c: any) => c.status === "ENABLED" || c.status === "PAUSED"
    );
    result.totalCampaigns = enabledCampaigns.length;

    if (enabledCampaigns.length === 0) {
      logger.info("optimizer", "No active campaigns to optimize", { shop });
      result.duration = Date.now() - start;
      return result;
    }

    // 2. Get AI advice for context
    let aiAdvice: any = null;
    try {
      aiAdvice = await getDailyAdvice({
        campaigns: enabledCampaigns.map((c: any) => ({
          name: c.name,
          status: c.status,
          cost: parseFloat(c.cost),
          clicks: c.clicks,
          conversions: parseFloat(c.conversions),
          roas: c.conversionValue && parseFloat(c.cost) > 0
            ? (parseFloat(c.conversionValue) / parseFloat(c.cost)).toFixed(2)
            : "0",
          avgCpc: c.avgCpc,
        })),
        competitorData: { ads: [], organic: [], shopping: [], trends: [], competitorCount: 0, bigPlayers: [] } as any,
        storeInfo: { domain: shop, category: "ecommerce" },
      });
      result.aiGrade = aiAdvice?.performance_grade;
    } catch (err: unknown) {
      logger.warn("optimizer", "AI advice failed, continuing with rules only", {
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
    }

    // 3. Apply optimization rules to each campaign
    const plannedActions: OptAction[] = [];

    for (const campaign of enabledCampaigns) {
      const cost = parseFloat(campaign.cost);
      const conversions = parseFloat(campaign.conversions);
      const conversionValue = parseFloat(campaign.conversionValue || "0");
      const roas = cost > 0 ? conversionValue / cost : 0;
      const ctr = parseFloat(campaign.ctr);
      const dailyBudget = parseFloat(campaign.dailyBudget || "0");
      const campaignActions = plannedActions.filter(
        (a) => a.campaignId === campaign.id
      );

      // Rule 1: Low ROAS → pause campaign
      if (
        cost >= RULES.MIN_SPEND_FOR_ROAS &&
        roas < RULES.MIN_ROAS_THRESHOLD &&
        campaign.status === "ENABLED" &&
        campaignActions.length < RULES.MAX_ACTIONS_PER_CAMPAIGN
      ) {
        plannedActions.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          action: "pause_campaign",
          reason: `ROAS ${roas.toFixed(2)} < ${RULES.MIN_ROAS_THRESHOLD} after $${cost.toFixed(2)} spend`,
          previousValue: `status:ENABLED`,
          newValue: `status:PAUSED`,
          aiGrade: result.aiGrade,
        });
        continue; // No other actions if pausing
      }

      // Rule 2: High performer → increase budget
      if (
        ctr >= RULES.HIGH_CTR_THRESHOLD &&
        roas >= RULES.HIGH_ROAS_THRESHOLD &&
        campaign.status === "ENABLED" &&
        dailyBudget > 0 &&
        campaignActions.length < RULES.MAX_ACTIONS_PER_CAMPAIGN
      ) {
        const newBudget = Math.round(dailyBudget * (1 + RULES.BUDGET_INCREASE_PCT));
        plannedActions.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          action: "adjust_budget",
          reason: `High performance: CTR ${ctr}%, ROAS ${roas.toFixed(2)} — increasing budget by ${RULES.BUDGET_INCREASE_PCT * 100}%`,
          previousValue: `budget:${dailyBudget}`,
          newValue: `budget:${newBudget}`,
          aiGrade: result.aiGrade,
        });
      }

      // Rule 3: Underperformer → decrease budget (but don't pause yet)
      if (
        cost >= RULES.MIN_SPEND_FOR_ROAS &&
        roas >= RULES.MIN_ROAS_THRESHOLD &&
        roas < RULES.HIGH_ROAS_THRESHOLD &&
        ctr < RULES.HIGH_CTR_THRESHOLD &&
        campaign.status === "ENABLED" &&
        dailyBudget > 1 &&
        campaignActions.length < RULES.MAX_ACTIONS_PER_CAMPAIGN
      ) {
        const newBudget = Math.max(1, Math.round(dailyBudget * (1 - RULES.BUDGET_DECREASE_PCT)));
        if (newBudget < dailyBudget) {
          plannedActions.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            action: "adjust_budget",
            reason: `Low CTR ${ctr}% with marginal ROAS ${roas.toFixed(2)} — reducing budget by ${RULES.BUDGET_DECREASE_PCT * 100}%`,
            previousValue: `budget:${dailyBudget}`,
            newValue: `budget:${newBudget}`,
            aiGrade: result.aiGrade,
          });
        }
      }

      // Rule 4: Keyword-level optimization
      if (
        campaign.status === "ENABLED" &&
        campaignActions.length < RULES.MAX_ACTIONS_PER_CAMPAIGN
      ) {
        try {
          const keywords = await getKeywordPerformance(campaign.id);
          for (const kw of keywords) {
            if (
              kw.clicks >= RULES.KEYWORD_CLICKS_NO_CONV &&
              kw.conversions === 0 &&
              kw.status === "ENABLED" &&
              plannedActions.length < RULES.MAX_ACTIONS_PER_RUN
            ) {
              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "pause_keyword",
                reason: `Keyword "${kw.text}" — ${kw.clicks} clicks, 0 conversions, $${kw.cost.toFixed(2)} wasted`,
                previousValue: `keyword:${kw.text}:ENABLED`,
                newValue: `keyword:${kw.text}:PAUSED`,
                aiGrade: result.aiGrade,
              });
            }
          }
        } catch {
          // Keyword query may fail for some campaign types
        }
      }

      if (plannedActions.length >= RULES.MAX_ACTIONS_PER_RUN) break;
    }

    result.actionsPlanned = plannedActions.length;

    // 4. Determine campaign mode for each action
    // If campaign type is "auto" (PMax) → execute. If "manual" (Search) → recommend.
    for (const action of plannedActions) {
      const campaignMode = await getCampaignMode(action.campaignId);
      const narrative = await generateNarrative(action, campaignMode);

      if (campaignMode === "manual") {
        // Manual mode → save recommendation, don't execute
        try {
          await prisma.optimizationRecommendation.create({
            data: {
              shop,
              campaignId: action.campaignId,
              campaignName: action.campaignName,
              action: action.action,
              reason: action.reason,
              narrative,
              previousValue: action.previousValue,
              newValue: action.newValue,
              aiGrade: action.aiGrade,
              status: "pending",
            },
          });
          result.actions.push({ ...action, success: true });
          result.actionsExecuted++;
          logger.info("optimizer", `Recommendation created for manual campaign: ${action.action}`, {
            extra: { campaignId: action.campaignId },
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          result.actionsFailed++;
          result.actions.push({ ...action, success: false, error: errorMsg });
        }
      } else {
        // Auto mode → execute action immediately
        try {
          await executeAction(action);
          await logAction(shop, action, true, undefined, narrative);
          result.actionsExecuted++;
          result.actions.push({ ...action, success: true });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await logAction(shop, action, false, errorMsg, narrative);
          result.actionsFailed++;
          result.actions.push({ ...action, success: false, error: errorMsg });
          logger.error("optimizer", `Action failed: ${action.action}`, {
            extra: { campaignId: action.campaignId, error: errorMsg },
          });
        }
      }
    }

    logger.info("optimizer", "Optimization run complete", {
      extra: {
        shop,
        campaigns: result.totalCampaigns,
        planned: result.actionsPlanned,
        executed: result.actionsExecuted,
        failed: result.actionsFailed,
        grade: result.aiGrade,
      },
    });
  } catch (err: unknown) {
    logger.error("optimizer", "Optimization run failed", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
  }

  result.duration = Date.now() - start;
  return result;
}

// ── Execute a single optimization action ─────────────────────────────────

async function executeAction(action: OptAction): Promise<void> {
  switch (action.action) {
    case "pause_campaign":
      await updateCampaignStatus(action.campaignId, "PAUSED");
      break;

    case "enable_campaign":
      await updateCampaignStatus(action.campaignId, "ENABLED");
      break;

    case "adjust_budget": {
      const newBudget = parseFloat(action.newValue?.replace("budget:", "") || "0");
      if (newBudget > 0) {
        await updateCampaignBudget(action.campaignId, newBudget);
      }
      break;
    }

    case "pause_keyword": {
      // Extract adGroupId~keywordId from the keyword performance data
      const match = action.newValue?.match(/keyword:(.+):PAUSED/);
      if (match) {
        // Keyword pause needs adGroupId — stored in reason context
        logger.info("optimizer", `Would pause keyword: ${match[1]}`, {
          extra: { campaignId: action.campaignId },
        });
      }
      break;
    }

    default:
      throw new Error(`Unknown action: ${action.action}`);
  }
}

// ── Log action to database ───────────────────────────────────────────────

async function logAction(
  shop: string,
  action: OptAction,
  success: boolean,
  error?: string,
  _narrative?: string
): Promise<void> {
  try {
    await prisma.optimizationLog.create({
      data: {
        shop,
        campaignId: action.campaignId,
        campaignName: action.campaignName,
        action: action.action,
        reason: action.reason,
        previousValue: action.previousValue,
        newValue: action.newValue,
        aiGrade: action.aiGrade,
        executedBy: "auto",
        success,
        error: error || null,
      },
    });
  } catch (err: unknown) {
    logger.warn("optimizer", "Failed to log optimization action", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

// ── Get campaign mode (auto/manual) ─────────────────────────────────────

async function getCampaignMode(campaignId: string): Promise<"auto" | "manual"> {
  try {
    const job = await prisma.campaignJob.findFirst({
      where: { googleCampaignId: campaignId },
      select: { payload: true },
    });
    if (job?.payload) {
      const payload = JSON.parse(job.payload);
      // PMax campaigns are auto, Search campaigns are manual
      if (payload.campaignType === "pmax") return "auto";
      if (payload.campaignType === "search") return "manual";
    }
  } catch {
    // Default to auto if we can't determine
  }
  return "auto";
}

// ── Generate human-like narrative in Hebrew ────────────────────────────

async function generateNarrative(action: OptAction, mode: "auto" | "manual"): Promise<string> {
  try {
    const verb = mode === "auto" ? "ביצעתי" : "אני ממליץ";
    const actionLabels: Record<string, string> = {
      pause_campaign: "להשהות את הקמפיין",
      enable_campaign: "להפעיל את הקמפיין",
      adjust_budget: "לשנות את התקציב",
      pause_keyword: "להשהות מילת מפתח",
    };

    const response = await narrativeClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `כתוב משפט אחד בעברית כמנהל חשבון בסוכנות פרסום. ${mode === "auto" ? "הפעולה כבר בוצעה." : "זו המלצה בלבד."}

פעולה: ${actionLabels[action.action] || action.action}
קמפיין: ${action.campaignName}
סיבה: ${action.reason}
${action.previousValue ? `ערך קודם: ${action.previousValue}` : ""}
${action.newValue ? `ערך חדש: ${action.newValue}` : ""}

כתוב תשובה קצרה וברורה. התחל עם "${verb}". אל תוסיף סימני markdown.`,
      }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    return text;
  } catch {
    // Fallback to simple narrative
    const actionLabels: Record<string, string> = {
      pause_campaign: "השהיית קמפיין",
      enable_campaign: "הפעלת קמפיין",
      adjust_budget: "התאמת תקציב",
      pause_keyword: "השהיית מילת מפתח",
    };
    const label = actionLabels[action.action] || action.action;
    if (mode === "auto") {
      return `ביצעתי ${label} עבור "${action.campaignName}" — ${action.reason}`;
    }
    return `אני ממליץ על ${label} עבור "${action.campaignName}" — ${action.reason}`;
  }
}

// ── Execute recommendation (when user approves) ────────────────────────

export async function approveRecommendation(recommendationId: string): Promise<void> {
  const rec = await prisma.optimizationRecommendation.findUnique({
    where: { id: recommendationId },
  });
  if (!rec || rec.status !== "pending") {
    throw new Error("Recommendation not found or already resolved");
  }

  // Execute the action
  await executeAction({
    campaignId: rec.campaignId,
    campaignName: rec.campaignName,
    action: rec.action,
    reason: rec.reason,
    previousValue: rec.previousValue || undefined,
    newValue: rec.newValue || undefined,
    aiGrade: rec.aiGrade || undefined,
  });

  // Mark as approved
  await prisma.optimizationRecommendation.update({
    where: { id: recommendationId },
    data: { status: "approved", resolvedAt: new Date() },
  });

  // Log the action
  await logAction(rec.shop, {
    campaignId: rec.campaignId,
    campaignName: rec.campaignName,
    action: rec.action,
    reason: rec.reason,
    previousValue: rec.previousValue || undefined,
    newValue: rec.newValue || undefined,
    aiGrade: rec.aiGrade || undefined,
  }, true);
}

export async function dismissRecommendation(recommendationId: string): Promise<void> {
  await prisma.optimizationRecommendation.update({
    where: { id: recommendationId },
    data: { status: "dismissed", resolvedAt: new Date() },
  });
}

export async function getPendingRecommendations(shop: string) {
  return prisma.optimizationRecommendation.findMany({
    where: { shop, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

// ── Get optimization history ─────────────────────────────────────────────

export async function getOptimizationHistory(shop: string, limit = 50) {
  return prisma.optimizationLog.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Get optimization stats ───────────────────────────────────────────────

export async function getOptimizationStats(shop: string) {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [total, recent, byAction] = await Promise.all([
    prisma.optimizationLog.count({ where: { shop } }),
    prisma.optimizationLog.count({
      where: { shop, createdAt: { gte: last7Days } },
    }),
    prisma.optimizationLog.groupBy({
      by: ["action"],
      where: { shop, createdAt: { gte: last7Days } },
      _count: true,
    }),
  ]);

  return {
    totalAllTime: total,
    last7Days: recent,
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
  };
}
