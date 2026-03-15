// Engine 10: Full Funnel Orchestrator
// Zero-click funnel setup, budget rebalancing, campaign priority queue

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { getCampaignPerformanceByDate } from "./google-ads.server.js";

// Types
interface FunnelConfig {
  productId?: string;
  funnelType: "single_product" | "category" | "full_store";
  totalDailyBudget: number;
}

interface BudgetAllocation {
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  suggestedBudget: number;
  reason: string;
  priority: number;
}

interface PerfEntry {
  campaignId: string;
  campaignName: string;
  clicks: number;
  cost: number;
  conversions: number;
  roas: number;
  conversionRate?: number;
}

// Create a full funnel from scratch
export async function createFullFunnel(shop: string, config: FunnelConfig): Promise<{ funnelId: string; campaignCount: number; budgetAllocation: BudgetAllocation[] }> {
  // Get recent campaign performance from Google Ads
  let campaigns: PerfEntry[] = [];
  try {
    const perfData = await getCampaignPerformanceByDate(shop, 30);
    // Deduplicate by campaignId (keep latest)
    const seen = new Map<string, PerfEntry>();
    for (const p of perfData) {
      if (!seen.has(p.campaignId)) {
        seen.set(p.campaignId, {
          campaignId: p.campaignId,
          campaignName: p.campaignName || p.campaignId,
          clicks: p.clicks || 0,
          cost: p.cost || 0,
          conversions: p.conversions || 0,
          roas: p.roas || 0,
        });
      }
    }
    campaigns = Array.from(seen.values());
  } catch {
    // No Google Ads data available
  }

  if (campaigns.length === 0) {
    const funnel = await prisma.funnelOrchestration.create({
      data: {
        shop,
        productId: config.productId,
        funnelType: config.funnelType,
        status: "draft",
        campaignIds: JSON.stringify([]),
        budgetAllocation: JSON.stringify([]),
        priorityQueue: JSON.stringify([]),
        totalDailyBudget: config.totalDailyBudget,
      },
    });
    return { funnelId: funnel.id, campaignCount: 0, budgetAllocation: [] };
  }

  const allocations = allocateBudgets(campaigns, config.totalDailyBudget);

  const funnel = await prisma.funnelOrchestration.create({
    data: {
      shop,
      productId: config.productId,
      funnelType: config.funnelType,
      status: "draft",
      campaignIds: JSON.stringify(campaigns.map(c => c.campaignId)),
      budgetAllocation: JSON.stringify(allocations),
      priorityQueue: JSON.stringify(allocations.sort((a, b) => b.priority - a.priority).map(a => a.campaignId)),
      totalDailyBudget: config.totalDailyBudget,
    },
  });

  logger.info("funnel", "Funnel created", { extra: { shop, funnelId: funnel.id, campaigns: campaigns.length } });
  return { funnelId: funnel.id, campaignCount: campaigns.length, budgetAllocation: allocations };
}

// Rebalance budgets across all active funnels
export async function rebalanceBudgets(shop: string): Promise<{ rebalanced: number; changes: Array<{ campaignId: string; oldBudget: number; newBudget: number }> }> {
  const funnels = await prisma.funnelOrchestration.findMany({
    where: { shop, status: "active" },
  });

  if (funnels.length === 0) return { rebalanced: 0, changes: [] };

  const allChanges: Array<{ campaignId: string; oldBudget: number; newBudget: number }> = [];

  // Get recent performance data
  let perfData: any[] = [];
  try {
    perfData = await getCampaignPerformanceByDate(shop, 14);
  } catch { /* no data */ }

  for (const funnel of funnels) {
    const campaignIds = JSON.parse(funnel.campaignIds || "[]") as string[];
    if (campaignIds.length === 0) continue;

    // Filter performance data for this funnel's campaigns
    const funnelPerf = perfData.filter((p: any) => campaignIds.includes(p.campaignId));

    // Group by campaign
    const perfMap = new Map<string, Array<{ roas: number; conversions: number; campaignName: string }>>();
    for (const p of funnelPerf) {
      if (!perfMap.has(p.campaignId)) perfMap.set(p.campaignId, []);
      perfMap.get(p.campaignId)!.push({ roas: p.roas || 0, conversions: p.conversions || 0, campaignName: p.campaignName || p.campaignId });
    }

    const oldAllocations = JSON.parse(funnel.budgetAllocation || "[]") as BudgetAllocation[];
    const newAllocations: Array<{ campaignId: string; campaignName: string; score: number; oldBudget: number }> = [];

    for (const [campaignId, perfs] of perfMap) {
      const avgRoas = perfs.reduce((s, p) => s + p.roas, 0) / perfs.length;
      const avgConv = perfs.reduce((s, p) => s + p.conversions, 0) / perfs.length;
      const score = avgRoas * 0.6 + avgConv * 0.4;

      const oldAlloc = oldAllocations.find(a => a.campaignId === campaignId);
      newAllocations.push({
        campaignId,
        campaignName: perfs[0]?.campaignName || campaignId,
        score,
        oldBudget: oldAlloc?.suggestedBudget || 0,
      });
    }

    // Distribute budget proportionally by score
    const totalScore = newAllocations.reduce((s, a) => s + Math.max(a.score, 0.1), 0);
    for (const alloc of newAllocations) {
      const share = Math.max(alloc.score, 0.1) / totalScore;
      const newBudget = Math.round(funnel.totalDailyBudget * share * 100) / 100;
      if (Math.abs(newBudget - alloc.oldBudget) > 0.5) {
        allChanges.push({ campaignId: alloc.campaignId, oldBudget: alloc.oldBudget, newBudget });
      }
    }

    await prisma.funnelOrchestration.update({
      where: { id: funnel.id },
      data: {
        budgetAllocation: JSON.stringify(newAllocations),
        lastRebalancedAt: new Date(),
      },
    });
  }

  logger.info("funnel", "Budget rebalance complete", { extra: { shop, changes: allChanges.length } });
  return { rebalanced: funnels.length, changes: allChanges };
}

// Get prioritized campaign queue
export async function getCampaignPriorityQueue(shop: string): Promise<Array<{ campaignId: string; campaignName: string; priority: number; roas: number; suggestedBudget: number }>> {
  let perfData: any[] = [];
  try {
    perfData = await getCampaignPerformanceByDate(shop, 30);
  } catch { return []; }

  const campaignMap = new Map<string, { name: string; roas: number[]; conversions: number[]; cost: number[] }>();
  for (const p of perfData) {
    if (!campaignMap.has(p.campaignId)) {
      campaignMap.set(p.campaignId, { name: p.campaignName || p.campaignId, roas: [], conversions: [], cost: [] });
    }
    const entry = campaignMap.get(p.campaignId)!;
    entry.roas.push(p.roas || 0);
    entry.conversions.push(p.conversions || 0);
    entry.cost.push(p.cost || 0);
  }

  const queue: Array<{ campaignId: string; campaignName: string; priority: number; roas: number; suggestedBudget: number }> = [];
  for (const [id, data] of campaignMap) {
    const avgRoas = data.roas.reduce((a, b) => a + b, 0) / data.roas.length;
    const avgConv = data.conversions.reduce((a, b) => a + b, 0) / data.conversions.length;
    const totalCost = data.cost.reduce((a, b) => a + b, 0);
    const priority = Math.round((avgRoas * 40 + avgConv * 30 + (totalCost > 0 ? 30 : 0)) * 100) / 100;

    queue.push({
      campaignId: id,
      campaignName: data.name,
      priority,
      roas: Math.round(avgRoas * 100) / 100,
      suggestedBudget: Math.round(totalCost / Math.max(data.cost.length, 1) * 100) / 100,
    });
  }

  return queue.sort((a, b) => b.priority - a.priority);
}

// Auto-allocate budget optimally
export async function autoAllocateBudget(shop: string, totalDailyBudget: number): Promise<BudgetAllocation[]> {
  const queue = await getCampaignPriorityQueue(shop);
  if (queue.length === 0) return [];

  const totalPriority = queue.reduce((s, q) => s + Math.max(q.priority, 1), 0);

  return queue.map(q => {
    const share = Math.max(q.priority, 1) / totalPriority;
    const budget = Math.round(totalDailyBudget * share * 100) / 100;
    const reason = q.roas > 3 ? "High ROAS performer — increased allocation"
      : q.roas > 1 ? "Profitable — standard allocation"
      : "Below target ROAS — reduced allocation, monitor closely";

    return {
      campaignId: q.campaignId,
      campaignName: q.campaignName,
      currentBudget: q.suggestedBudget,
      suggestedBudget: budget,
      reason,
      priority: q.priority,
    };
  });
}

// Helper: allocate budgets based on campaign performance scores
function allocateBudgets(campaigns: PerfEntry[], totalBudget: number): BudgetAllocation[] {
  const scored = campaigns.map(c => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName || c.campaignId,
    roas: c.roas || 0,
    cost: c.cost || 0,
    score: (c.roas || 0) * 0.5 + (c.clicks > 10 ? 20 : 0),
  }));

  const totalScore = scored.reduce((s, c) => s + Math.max(c.score, 1), 0);

  return scored.map(c => {
    const share = Math.max(c.score, 1) / totalScore;
    const budget = Math.round(totalBudget * share * 100) / 100;

    return {
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      currentBudget: c.cost,
      suggestedBudget: budget,
      reason: c.roas > 3 ? "Top performer" : c.roas > 1 ? "Profitable" : "Needs optimization",
      priority: Math.round(c.score),
    };
  }).sort((a, b) => b.priority - a.priority);
}
