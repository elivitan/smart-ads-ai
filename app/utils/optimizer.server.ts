/**
 * Smart Ads AI — Agency-Grade Optimization Engine
 *
 * 12 optimization rules that work like a real ad agency:
 * - Margin-adjusted ROAS thresholds (not break-even!)
 * - Learning period protection for new campaigns
 * - Statistical significance checks
 * - Search term analysis → negative keywords
 * - Graduated responses (warn → reduce → pause)
 * - Quality Score awareness
 * - Budget pacing monitoring
 * - Conversion health checks
 * - Day-of-week pattern detection
 * - Performance feedback loop
 *
 * Supports AUTO (PMax → execute) and MANUAL (Search → recommend).
 * All messages in plain Hebrew — no jargon.
 */

import Anthropic from "@anthropic-ai/sdk";
import prisma from "../db.server.js";
import {
  listSmartAdsCampaigns,
  updateCampaignStatus,
  updateCampaignBudget,
  getKeywordPerformance,
  pauseKeyword,
  getSearchTermReport,
  addNegativeKeywords,
  getCampaignPerformanceByDate,
} from "../google-ads.server.js";
import { getDailyAdvice } from "../ai-brain.server.js";
import { getStoreProfile } from "../store-context.server.js";
import { getCompetitorTrends } from "../competitor-intel.server.js";
import { logger } from "./logger.js";

const narrativeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Optimization Rules (tunable) ─────────────────────────────────────────

const RULES = {
  /** Default min ROAS when no profit margin data (conservative) */
  DEFAULT_MIN_ROAS: 1.5,
  /** Safety buffer multiplied on top of breakeven ROAS */
  ROAS_SAFETY_BUFFER: 1.2,
  /** ROAS below 50% of profitable threshold → pause */
  ROAS_CRITICAL_FACTOR: 0.5,
  /** Minimum spend ($) before ROAS rules apply */
  MIN_SPEND_FOR_ROAS: 10,
  /** Minimum impressions for statistical significance */
  MIN_IMPRESSIONS_FOR_DECISION: 100,
  /** Minimum clicks for statistical significance */
  MIN_CLICKS_FOR_DECISION: 20,
  /** Campaign learning period — don't optimize before this */
  CAMPAIGN_LEARNING_DAYS: 7,
  /** CTR above this + ROAS above profitable → budget increase candidate */
  HIGH_CTR_THRESHOLD: 3.0,
  /** Max budget increase in a single action */
  MAX_BUDGET_INCREASE_PCT: 0.30,
  /** Budget decrease for underperformers */
  BUDGET_DECREASE_PCT: 0.15,
  /** Budget pacing — spending too fast threshold */
  BUDGET_PACING_FAST: 1.3,
  /** Budget pacing — spending too slow threshold */
  BUDGET_PACING_SLOW: 0.5,
  /** Keyword graduated response thresholds */
  KEYWORD_WARN_CLICKS: 25,
  KEYWORD_REDUCE_CLICKS: 35,
  KEYWORD_PAUSE_CLICKS: 50,
  /** Search term — minimum cost to flag as wasteful */
  SEARCH_TERM_MIN_WASTE: 5,
  /** Conversion drought — days without conversions to alert */
  CONVERSION_DROUGHT_DAYS: 5,
  /** Conversion drought — minimum impressions to trigger alert */
  CONVERSION_DROUGHT_MIN_IMPRESSIONS: 500,
  /** Quality Score thresholds */
  QS_BONUS_THRESHOLD: 7,
  QS_PENALTY_THRESHOLD: 4,
  QS_BUDGET_ADJUSTMENT: 0.10,
  /** CTR sudden change threshold */
  CTR_CHANGE_ALERT_PCT: 50,
  /** Day-of-week — minimum weeks of data for pattern */
  DOW_MIN_WEEKS: 2,
  /** Maximum auto-actions per campaign per run */
  MAX_ACTIONS_PER_CAMPAIGN: 3,
  /** Maximum total actions per optimization run */
  MAX_ACTIONS_PER_RUN: 15,
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

// ── Helper: Calculate profitable ROAS from margin ─────────────────────

function getMinProfitableRoas(profitMargin: number | null | undefined): number {
  if (!profitMargin || profitMargin <= 0 || profitMargin >= 100) {
    return RULES.DEFAULT_MIN_ROAS;
  }
  // margin 40% → breakeven ROAS = 100/40 = 2.5, with buffer: 2.5 * 1.2 = 3.0
  return (100 / profitMargin) * RULES.ROAS_SAFETY_BUFFER;
}

// ── Helper: Campaign age in days ─────────────────────────────────────

async function getCampaignAgeDays(campaignId: string): Promise<number> {
  try {
    const job = await prisma.campaignJob.findFirst({
      where: { googleCampaignId: campaignId },
      select: { createdAt: true },
    });
    if (job?.createdAt) {
      return Math.floor((Date.now() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }
  } catch {
    // ignore
  }
  return 999; // Unknown age — treat as mature
}

// ── Helper: Statistical significance check ───────────────────────────

function hasStatisticalSignificance(impressions: number, clicks: number, cost: number): boolean {
  return (
    impressions >= RULES.MIN_IMPRESSIONS_FOR_DECISION &&
    clicks >= RULES.MIN_CLICKS_FOR_DECISION &&
    cost >= RULES.MIN_SPEND_FOR_ROAS
  );
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
    // Load store profile for margin-based decisions
    const storeProfile = await getStoreProfile(shop);
    const profitMargin = storeProfile?.profitMargin ?? null;
    const minRoas = getMinProfitableRoas(profitMargin);

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

    // 2.5 Load self-learning insights to adjust thresholds
    const learning = await getLearningInsights(shop);
    const effectiveRules = { ...RULES };
    const kwLearning = learning.byActionType["pause_keyword"];
    if (kwLearning?.adjustedThreshold != null) {
      (effectiveRules as any).KEYWORD_PAUSE_CLICKS = kwLearning.adjustedThreshold;
    }

    // 3. Apply optimization rules to each campaign
    const plannedActions: OptAction[] = [];

    // 2.6 Portfolio Brain — cross-campaign intelligence
    if (enabledCampaigns.length >= 2) {
      try {
        const portfolio = await analyzeCampaignPortfolio(enabledCampaigns, minRoas);
        if (portfolio.cannibalization.length > 0) {
          const topCannibal = portfolio.cannibalization[0];
          const campaignNames = topCannibal.campaigns.map((c) => `"${c.name}"`).join(" ו-");
          logger.info("optimizer", `Portfolio: cannibalization detected on "${topCannibal.keyword}"`, { extra: { campaigns: campaignNames } });
        }
        // Inject portfolio rebalancing as planned actions
        for (const rebalance of portfolio.budgetRebalancing) {
          plannedActions.push({
            campaignId: rebalance.fromCampaign.id,
            campaignName: rebalance.fromCampaign.name,
            action: "adjust_budget",
            reason: rebalance.reason,
            previousValue: `budget:${rebalance.fromCampaign.currentBudget}`,
            newValue: `budget:${Math.max(1, rebalance.fromCampaign.currentBudget - rebalance.amount)}`,
            aiGrade: result.aiGrade,
          });
          plannedActions.push({
            campaignId: rebalance.toCampaign.id,
            campaignName: rebalance.toCampaign.name,
            action: "adjust_budget",
            reason: rebalance.reason,
            previousValue: `budget:${rebalance.toCampaign.currentBudget}`,
            newValue: `budget:${rebalance.toCampaign.currentBudget + rebalance.amount}`,
            aiGrade: result.aiGrade,
          });
        }
        // Cannibalization alerts
        for (const cannibal of portfolio.cannibalization.slice(0, 2)) {
          const names = cannibal.campaigns.map((c) => `"${c.name}"`).join(" ו-");
          plannedActions.push({
            campaignId: cannibal.campaigns[0].id,
            campaignName: cannibal.campaigns[0].name,
            action: "alert_cannibalization",
            reason: `הקמפיינים ${names} מתחרים על מילת המפתח "${cannibal.keyword}" — אתה משלם פעמיים על אותם לקוחות ($${cannibal.wastedSpend.toFixed(0)} בזבוז). כדאי לאחד או לחלק מילות מפתח.`,
            aiGrade: result.aiGrade,
          });
        }
      } catch (err: unknown) {
        logger.warn("optimizer", "Portfolio analysis failed, continuing", {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }

    for (const campaign of enabledCampaigns) {
      const cost = parseFloat(campaign.cost);
      const conversions = parseFloat(campaign.conversions);
      const conversionValue = parseFloat(campaign.conversionValue || "0");
      const roas = cost > 0 ? conversionValue / cost : 0;
      const ctr = parseFloat(campaign.ctr);
      const dailyBudget = parseFloat(campaign.dailyBudget || "0");
      const impressions = campaign.impressions;
      const clicks = campaign.clicks;

      const campaignActions = () => plannedActions.filter((a) => a.campaignId === campaign.id);
      const canAddAction = () =>
        campaignActions().length < RULES.MAX_ACTIONS_PER_CAMPAIGN &&
        plannedActions.length < RULES.MAX_ACTIONS_PER_RUN;

      // ── Rule 0: Learning period protection ───────────────────────
      const ageDays = await getCampaignAgeDays(campaign.id);
      if (ageDays < RULES.CAMPAIGN_LEARNING_DAYS) {
        logger.info("optimizer", `Campaign "${campaign.name}" is ${ageDays} days old — in learning period, skipping`, {
          extra: { campaignId: campaign.id },
        });
        continue;
      }

      // ── Rule 1: Margin-adjusted ROAS → pause (critical only) ─────
      if (
        hasStatisticalSignificance(impressions, clicks, cost) &&
        roas < minRoas * RULES.ROAS_CRITICAL_FACTOR &&
        campaign.status === "ENABLED" &&
        canAddAction()
      ) {
        const roasPercent = Math.round(roas * 100);
        const minRoasPercent = Math.round(minRoas * 100);
        plannedActions.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          action: "pause_campaign",
          reason: `מכל 100₪ פרסום חוזרים רק ${roasPercent}₪, אבל עם המרווח שלך צריך לפחות ${minRoasPercent}₪. הפסד משמעותי — משהה קמפיין.`,
          previousValue: `status:ENABLED`,
          newValue: `status:PAUSED`,
          aiGrade: result.aiGrade,
        });
        continue;
      }

      // ── Rule 2: Graduated budget reduction (ROAS below target but not critical) ─
      if (
        hasStatisticalSignificance(impressions, clicks, cost) &&
        roas < minRoas &&
        roas >= minRoas * RULES.ROAS_CRITICAL_FACTOR &&
        campaign.status === "ENABLED" &&
        dailyBudget > 1 &&
        canAddAction()
      ) {
        const newBudget = Math.max(1, Math.round(dailyBudget * (1 - RULES.BUDGET_DECREASE_PCT)));
        if (newBudget < dailyBudget) {
          plannedActions.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            action: "adjust_budget",
            reason: `הקמפיין עדיין לא מכניס מספיק ביחס להוצאה. מקטין תקציב ב-${Math.round(RULES.BUDGET_DECREASE_PCT * 100)}% כדי להפחית הפסד.`,
            previousValue: `budget:${dailyBudget}`,
            newValue: `budget:${newBudget}`,
            aiGrade: result.aiGrade,
          });
        }
      }

      // ── Rule 3: Smart budget increase for high performers ─────────
      if (
        hasStatisticalSignificance(impressions, clicks, cost) &&
        ctr >= RULES.HIGH_CTR_THRESHOLD &&
        roas >= minRoas &&
        campaign.status === "ENABLED" &&
        dailyBudget > 0 &&
        canAddAction()
      ) {
        // Scale increase proportionally to how much ROAS exceeds min
        const roasExcess = (roas - minRoas) / minRoas;
        const increasePct = Math.min(RULES.MAX_BUDGET_INCREASE_PCT, Math.max(0.1, roasExcess * 0.1));
        const newBudget = Math.round(dailyBudget * (1 + increasePct));
        const pctLabel = Math.round(increasePct * 100);

        plannedActions.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          action: "adjust_budget",
          reason: `הקמפיין מרוויח יפה! הרבה אנשים לוחצים וקונים. מעלה תקציב ב-${pctLabel}% כדי להגיע ליותר לקוחות.`,
          previousValue: `budget:${dailyBudget}`,
          newValue: `budget:${newBudget}`,
          aiGrade: result.aiGrade,
        });
      }

      // ── Rule 4: Budget pacing check ──────────────────────────────
      if (campaign.status === "ENABLED" && dailyBudget > 0 && canAddAction()) {
        try {
          const dailyData = await getCampaignPerformanceByDate(campaign.id, 7);
          if (dailyData.length >= 3) {
            const recentDays = dailyData.slice(0, 3);
            const avgDailySpend = recentDays.reduce((s, d) => s + d.cost, 0) / recentDays.length;

            if (avgDailySpend > dailyBudget * RULES.BUDGET_PACING_FAST) {
              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "alert_budget_pacing",
                reason: `התקציב נשרף מהר מדי — ממוצע יומי $${avgDailySpend.toFixed(0)} מתוך תקציב $${dailyBudget}. כדאי לבדוק שהתקציב מתפרס על כל היום.`,
                aiGrade: result.aiGrade,
              });
            }

            // ── Rule 9: Day-of-week pattern ───────────────────────
            if (dailyData.length >= 14) {
              const dayStats: Record<string, { cost: number; conversions: number; count: number }> = {};
              for (const d of dailyData) {
                if (!dayStats[d.dayOfWeek]) dayStats[d.dayOfWeek] = { cost: 0, conversions: 0, count: 0 };
                dayStats[d.dayOfWeek].cost += d.cost;
                dayStats[d.dayOfWeek].conversions += d.conversions;
                dayStats[d.dayOfWeek].count++;
              }

              const weakDays: string[] = [];
              const dayNames: Record<string, string> = {
                MONDAY: "שני", TUESDAY: "שלישי", WEDNESDAY: "רביעי",
                THURSDAY: "חמישי", FRIDAY: "שישי", SATURDAY: "שבת", SUNDAY: "ראשון",
              };

              for (const [day, stats] of Object.entries(dayStats)) {
                if (stats.count >= RULES.DOW_MIN_WEEKS && stats.cost > 5) {
                  const dayRoas = stats.conversions > 0 ? (stats.conversions / stats.cost) : 0;
                  if (dayRoas < minRoas * 0.5) {
                    weakDays.push(dayNames[day] || day);
                  }
                }
              }

              if (weakDays.length > 0 && weakDays.length <= 3 && canAddAction()) {
                plannedActions.push({
                  campaignId: campaign.id,
                  campaignName: campaign.name,
                  action: "alert_day_pattern",
                  reason: `ימים ${weakDays.join(", ")} חלשים בעקביות — מומלץ להפחית תקציב בימים האלה ולהגדיל בימים הטובים.`,
                  aiGrade: result.aiGrade,
                });
              }
            }
          }
        } catch {
          // Daily data may not be available
        }
      }

      // ── Rule 5+6+8+11: Keyword & search term optimization ────────
      if (campaign.status === "ENABLED" && canAddAction()) {
        try {
          const keywords = await getKeywordPerformance(campaign.id);

          // Rule 8: Quality Score awareness
          const kwsWithQs = keywords.filter((kw: any) => kw.qualityScore != null);
          if (kwsWithQs.length >= 3) {
            const avgQs = kwsWithQs.reduce((s: number, kw: any) => s + kw.qualityScore, 0) / kwsWithQs.length;

            if (avgQs >= RULES.QS_BONUS_THRESHOLD && dailyBudget > 0 && canAddAction()) {
              const newBudget = Math.round(dailyBudget * (1 + RULES.QS_BUDGET_ADJUSTMENT));
              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "adjust_budget",
                reason: `גוגל נותן ציון גבוה למודעות שלך (${avgQs.toFixed(1)}/10) — זה מוזיל קליקים. מעלה תקציב 10% כדי לנצל את היתרון.`,
                previousValue: `budget:${dailyBudget}`,
                newValue: `budget:${newBudget}`,
                aiGrade: result.aiGrade,
              });
            } else if (avgQs < RULES.QS_PENALTY_THRESHOLD && dailyBudget > 1 && canAddAction()) {
              const newBudget = Math.max(1, Math.round(dailyBudget * (1 - RULES.QS_BUDGET_ADJUSTMENT)));
              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "adjust_budget",
                reason: `גוגל נותן ציון נמוך למודעות (${avgQs.toFixed(1)}/10) — זה מייקר כל קליק. מפחית תקציב 10% עד שנשפר את המודעות.`,
                previousValue: `budget:${dailyBudget}`,
                newValue: `budget:${newBudget}`,
                aiGrade: result.aiGrade,
              });
            }
          }

          // Rule 5: Graduated keyword response
          for (const kw of keywords) {
            if (kw.conversions > 0 || kw.status !== "ENABLED") continue;
            if (!canAddAction()) break;

            if (kw.clicks >= RULES.KEYWORD_PAUSE_CLICKS) {
              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "pause_keyword",
                reason: `מילת המפתח "${kw.text}" קיבלה ${kw.clicks} קליקים בלי אף מכירה — $${kw.cost.toFixed(0)} בזבוז. משהה אותה.`,
                previousValue: `keyword:${kw.text}:ENABLED:${kw.adGroupId}:${kw.keywordId}`,
                newValue: `keyword:${kw.text}:PAUSED`,
                aiGrade: result.aiGrade,
              });
            } else if (kw.clicks >= RULES.KEYWORD_REDUCE_CLICKS && canAddAction()) {
              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "warn_keyword",
                reason: `מילת המפתח "${kw.text}" — ${kw.clicks} קליקים, 0 מכירות, $${kw.cost.toFixed(0)} הוצאה. אם המצב לא ישתפר בקרוב, נשהה אותה.`,
                previousValue: `keyword:${kw.text}:watching`,
                aiGrade: result.aiGrade,
              });
            }
          }

          // Rule 6+11: Search term analysis
          try {
            const searchTerms = await getSearchTermReport(campaign.id);

            // Rule 6: Wasteful search terms → suggest negative keywords
            const wastefulTerms = searchTerms.filter(
              (st) => st.cost >= RULES.SEARCH_TERM_MIN_WASTE && st.conversions === 0 && st.clicks >= 3
            );
            if (wastefulTerms.length > 0 && canAddAction()) {
              const topWasteful = wastefulTerms.slice(0, 5);
              const totalWaste = topWasteful.reduce((s, t) => s + t.cost, 0);
              const termList = topWasteful.map((t) => `"${t.searchTerm}" ($${t.cost.toFixed(0)})`).join(", ");

              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "add_negative_keyword",
                reason: `אנשים חיפשו דברים לא קשורים ולחצו על המודעות שלך — ${termList}. סה"כ $${totalWaste.toFixed(0)} בזבוז. חוסם את החיפושים האלה.`,
                newValue: `negatives:${topWasteful.map((t) => t.searchTerm).join(",")}`,
                aiGrade: result.aiGrade,
              });
            }

            // Rule 11: Winning search terms → suggest as keywords
            const winningTerms = searchTerms.filter(
              (st) => st.conversions >= 2 && st.status !== "ADDED"
            );
            if (winningTerms.length > 0 && canAddAction()) {
              const topWinners = winningTerms.slice(0, 3);
              const termList = topWinners.map((t) =>
                `"${t.searchTerm}" (${t.conversions} מכירות)`
              ).join(", ");

              plannedActions.push({
                campaignId: campaign.id,
                campaignName: campaign.name,
                action: "suggest_keyword",
                reason: `חיפושים שמביאים מכירות אבל לא במילות המפתח שלך: ${termList}. כדאי להוסיף אותם כמילות מפתח.`,
                newValue: `keywords:${topWinners.map((t) => t.searchTerm).join(",")}`,
                aiGrade: result.aiGrade,
              });
            }
          } catch {
            // Search term report may fail for PMax campaigns
          }
        } catch {
          // Keyword data may not be available
        }
      }

      // ── Rule 7: Conversion tracking health ─────────────────────
      if (
        campaign.status === "ENABLED" &&
        impressions >= RULES.CONVERSION_DROUGHT_MIN_IMPRESSIONS &&
        conversions === 0 &&
        canAddAction()
      ) {
        try {
          const dailyData = await getCampaignPerformanceByDate(campaign.id, RULES.CONVERSION_DROUGHT_DAYS);
          const daysWithImpressions = dailyData.filter((d) => d.impressions > 10).length;
          const totalConversions = dailyData.reduce((s, d) => s + d.conversions, 0);

          if (daysWithImpressions >= RULES.CONVERSION_DROUGHT_DAYS && totalConversions === 0) {
            plannedActions.push({
              campaignId: campaign.id,
              campaignName: campaign.name,
              action: "alert_conversion_tracking",
              reason: `${RULES.CONVERSION_DROUGHT_DAYS} ימים עם חשיפות ואף מכירה אחת. ייתכן שמעקב ההמרות לא מוגדר נכון — כדאי לבדוק.`,
              aiGrade: result.aiGrade,
            });
          }
        } catch {
          // ignore
        }
      }

      // ── Rule 10: Sudden performance change ─────────────────────
      if (campaign.status === "ENABLED" && canAddAction()) {
        try {
          const dailyData = await getCampaignPerformanceByDate(campaign.id, 14);
          if (dailyData.length >= 10) {
            const recent7 = dailyData.slice(0, 7);
            const previous7 = dailyData.slice(7, 14);

            const recentCtr = recent7.reduce((s, d) => s + d.ctr, 0) / recent7.length;
            const previousCtr = previous7.reduce((s, d) => s + d.ctr, 0) / previous7.length;

            if (previousCtr > 0) {
              const ctrChangePct = ((recentCtr - previousCtr) / previousCtr) * 100;

              if (ctrChangePct < -RULES.CTR_CHANGE_ALERT_PCT) {
                // Performance Detective — investigate WHY
                let detectiveReason = `פחות אנשים לוחצים על המודעות — ירידה של ${Math.abs(Math.round(ctrChangePct))}% בשבוע האחרון.`;
                try {
                  const report = await diagnosePerformanceChange(shop, campaign.id, campaign.name, "ctr_drop");
                  if (report.rootCauses.length > 0) {
                    detectiveReason = report.hebrewNarrative;
                  }
                } catch { /* use default reason */ }

                plannedActions.push({
                  campaignId: campaign.id,
                  campaignName: campaign.name,
                  action: "alert_performance_drop",
                  reason: detectiveReason,
                  aiGrade: result.aiGrade,
                });
              } else if (ctrChangePct > RULES.CTR_CHANGE_ALERT_PCT && canAddAction()) {
                plannedActions.push({
                  campaignId: campaign.id,
                  campaignName: campaign.name,
                  action: "alert_performance_boost",
                  reason: `יותר אנשים לוחצים על המודעות — עלייה של ${Math.round(ctrChangePct)}% בשבוע האחרון! זה הזמן להגדיל תקציב ולנצל את המומנטום.`,
                  aiGrade: result.aiGrade,
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // ── Creative Fatigue Detection ──────────────────────────────
      if (campaign.status === "ENABLED" && canAddAction()) {
        const fatigue = await detectCreativeFatigue(campaign.id, campaign.name);
        if (fatigue && fatigue.fatigueLevel !== "mild") {
          plannedActions.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            action: "alert_creative_fatigue",
            reason: `המודעות שלך מתחילות "להתיש" את הקהל — ${fatigue.weeksOfDecline} שבועות רצופים של ירידה בלחיצות (מ-${fatigue.peakCtr.toFixed(1)}% ל-${fatigue.currentCtr.toFixed(1)}%). הגיע הזמן לרענן את הטקסטים.`,
            aiGrade: result.aiGrade,
          });
        }
      }

      if (plannedActions.length >= RULES.MAX_ACTIONS_PER_RUN) break;
    }

    result.actionsPlanned = plannedActions.length;

    // 4. Determine campaign mode and execute/recommend
    for (const action of plannedActions) {
      const campaignMode = await getCampaignMode(action.campaignId);
      const narrative = await generateNarrative(action, campaignMode);

      // Alert-type actions are always logged, never executed
      const isAlert = action.action.startsWith("alert_") ||
                       action.action === "warn_keyword" ||
                       action.action === "suggest_keyword" ||
                       action.action === "feedback_check";

      if (isAlert) {
        await logAction(shop, action, true, undefined, narrative);
        result.actions.push({ ...action, success: true });
        result.actionsExecuted++;
        continue;
      }

      if (campaignMode === "manual") {
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
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          result.actionsFailed++;
          result.actions.push({ ...action, success: false, error: errorMsg });
        }
      } else {
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
      // Format: keyword:text:ENABLED:adGroupId:keywordId
      const parts = action.previousValue?.split(":");
      if (parts && parts.length >= 5) {
        const adGroupId = parts[3];
        const keywordId = parts[4];
        await pauseKeyword(adGroupId, keywordId);
      }
      break;
    }

    case "add_negative_keyword": {
      // Format: negatives:term1,term2,term3
      const negStr = action.newValue?.replace("negatives:", "") || "";
      const keywords = negStr.split(",").filter(Boolean);
      if (keywords.length > 0) {
        await addNegativeKeywords(action.campaignId, keywords);
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
  narrative?: string
): Promise<void> {
  try {
    await prisma.optimizationLog.create({
      data: {
        shop,
        campaignId: action.campaignId,
        campaignName: action.campaignName,
        action: action.action,
        reason: narrative || action.reason,
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
      add_negative_keyword: "לחסום חיפושים לא רלוונטיים",
      suggest_keyword: "להוסיף מילת מפתח חדשה",
      warn_keyword: "לשים לב למילת מפתח בעייתית",
      alert_budget_pacing: "לבדוק את קצב ההוצאה",
      alert_conversion_tracking: "לבדוק מעקב המרות",
      alert_performance_drop: "ירידה בביצועים",
      alert_performance_boost: "עלייה בביצועים",
      alert_day_pattern: "דפוס יומי בביצועים",
      alert_creative_fatigue: "המודעות מתישנות — צריך רענון",
      alert_cannibalization: "קמפיינים מתחרים אחד בשני",
      feedback_check: "בדיקת תוצאות המלצה קודמת",
    };

    const response = await narrativeClient.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `כתוב משפט-שניים בעברית פשוטה, כאילו אתה מסביר לחבר שיש לו חנות אונליין.
אל תשתמש במונחים מקצועיים כמו ROAS, CTR, Quality Score.
${mode === "auto" ? "הפעולה כבר בוצעה." : "זו המלצה בלבד."}

פעולה: ${actionLabels[action.action] || action.action}
קמפיין: ${action.campaignName}
סיבה: ${action.reason}

כתוב תשובה קצרה וברורה. התחל עם "${verb}". אל תוסיף סימני markdown.`,
      }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    return text;
  } catch {
    return action.reason; // Fallback to the reason itself (already in plain Hebrew)
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

  await executeAction({
    campaignId: rec.campaignId,
    campaignName: rec.campaignName,
    action: rec.action,
    reason: rec.reason,
    previousValue: rec.previousValue || undefined,
    newValue: rec.newValue || undefined,
    aiGrade: rec.aiGrade || undefined,
  });

  await prisma.optimizationRecommendation.update({
    where: { id: recommendationId },
    data: { status: "approved", resolvedAt: new Date() },
  });

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

// ── Performance feedback loop ───────────────────────────────────────────

export async function checkRecommendationOutcomes(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

  try {
    const recs = await prisma.optimizationRecommendation.findMany({
      where: {
        status: "approved",
        outcomeChecked: false,
        resolvedAt: { gte: eightDaysAgo, lte: sevenDaysAgo },
      },
    });

    // Load campaigns once for all recs
    let allCampaigns: any[] = [];
    try {
      allCampaigns = await listSmartAdsCampaigns();
    } catch { /* ignore */ }

    for (const rec of recs) {
      try {
        const campaign = allCampaigns.find((c: any) => c.id === rec.campaignId);
        if (!campaign) continue;

        const currentRoas = parseFloat(campaign.cost) > 0
          ? parseFloat(campaign.conversionValue) / parseFloat(campaign.cost)
          : 0;

        // Estimate previous ROAS from log history
        let previousRoas = currentRoas;
        try {
          const prevLog = await prisma.optimizationLog.findFirst({
            where: { shop: rec.shop, campaignId: rec.campaignId, createdAt: { lt: rec.resolvedAt || rec.createdAt } },
            orderBy: { createdAt: "desc" },
          });
          if (prevLog?.reason) {
            const match = prevLog.reason.match(/(\d+\.?\d*)x/);
            if (match) previousRoas = parseFloat(match[1]);
          }
        } catch { /* ignore */ }

        // Classify outcome and feed Self-Learning
        const { outcome, roasImpact } = classifyOutcome(rec.action, rec.previousValue, currentRoas, previousRoas);
        await updateLearningFromOutcome(rec.shop, rec.action, outcome, roasImpact);

        const outcomeEmoji = outcome === "success" ? "✅" : outcome === "failure" ? "⚠️" : "➖";
        let feedbackMsg: string;
        if (rec.action === "adjust_budget" && rec.previousValue) {
          const prevBudget = parseFloat(rec.previousValue.replace("budget:", ""));
          const currBudget = parseFloat(campaign.dailyBudget);
          const budgetDir = currBudget > prevBudget ? "הועלה" : "הופחת";
          feedbackMsg = `${outcomeEmoji} תקציב ${budgetDir}. תשואה: ${currentRoas.toFixed(1)}x (${roasImpact >= 0 ? "+" : ""}${roasImpact.toFixed(1)}).`;
        } else if (rec.action === "pause_keyword") {
          feedbackMsg = `${outcomeEmoji} מילת מפתח הושהתה. ${outcome === "success" ? "ביצועים השתפרו!" : "לא ראינו שינוי משמעותי."}`;
        } else if (rec.action === "add_negative_keyword") {
          feedbackMsg = `${outcomeEmoji} חיפושים לא רלוונטיים נחסמו. ${outcome === "success" ? "פחות בזבוז!" : "ההשפעה מינימלית."}`;
        } else {
          feedbackMsg = `${outcomeEmoji} ${outcome === "success" ? "הפעולה הצליחה" : "תוצאות לא חד-משמעיות"}.`;
        }

        await logAction(rec.shop, {
          campaignId: rec.campaignId,
          campaignName: rec.campaignName,
          action: "feedback_check",
          reason: feedbackMsg,
          aiGrade: rec.aiGrade || undefined,
        }, true);

        await prisma.optimizationRecommendation.update({
          where: { id: rec.id },
          data: { outcomeChecked: true },
        });
      } catch {
        // Skip individual failures
      }
    }

    logger.info("optimizer", `Feedback check complete: ${recs.length} recommendations reviewed`);
  } catch (err: unknown) {
    logger.error("optimizer", "Feedback check failed", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// INNOVATION ENGINE — Features that make agencies raise an eyebrow
// ══════════════════════════════════════════════════════════════════════════

// ── Self-Learning: Track what works and adapt ───────────────────────────

interface LearningInsights {
  byActionType: Record<string, ActionLearning>;
  overallSuccessRate: number;
  totalActionsLearned: number;
}

interface ActionLearning {
  actionType: string;
  successRate: number;
  totalAttempts: number;
  confidenceLevel: "learning" | "low" | "medium" | "high";
  avgRoasImpact: number | null;
  adjustedThreshold: number | null;
}

export async function getLearningInsights(shop: string): Promise<LearningInsights> {
  const learnings = await prisma.optimizerLearning.findMany({ where: { shop } });

  const byActionType: Record<string, ActionLearning> = {};
  let totalSuccess = 0;
  let totalAttempts = 0;

  for (const l of learnings) {
    byActionType[l.actionType] = {
      actionType: l.actionType,
      successRate: l.successRate,
      totalAttempts: l.totalAttempts,
      confidenceLevel: l.confidenceLevel as ActionLearning["confidenceLevel"],
      avgRoasImpact: l.avgImpactRoas,
      adjustedThreshold: calculateAdjustedThreshold(l.actionType, l.successRate, l.confidenceLevel),
    };
    totalSuccess += l.successCount;
    totalAttempts += l.totalAttempts;
  }

  return {
    byActionType,
    overallSuccessRate: totalAttempts > 0 ? totalSuccess / totalAttempts : 0.5,
    totalActionsLearned: totalAttempts,
  };
}

function calculateAdjustedThreshold(
  actionType: string,
  successRate: number,
  confidence: string,
): number | null {
  if (confidence === "learning" || confidence === "low") return null;

  // High success → lower threshold (act faster). Low success → raise threshold (be cautious)
  if (actionType === "pause_keyword") {
    const base = RULES.KEYWORD_PAUSE_CLICKS;
    if (successRate > 0.8) return Math.round(base * 0.8);
    if (successRate < 0.4) return Math.round(base * 1.3);
  }
  if (actionType === "adjust_budget") {
    if (successRate > 0.8) return Math.round(RULES.MAX_BUDGET_INCREASE_PCT * 100 * 1.2);
    if (successRate < 0.4) return Math.round(RULES.MAX_BUDGET_INCREASE_PCT * 100 * 0.7);
  }
  return null;
}

async function updateLearningFromOutcome(
  shop: string,
  actionType: string,
  outcome: "success" | "failure" | "neutral",
  roasImpact: number | null,
): Promise<void> {
  try {
    const existing = await prisma.optimizerLearning.findUnique({
      where: { shop_actionType: { shop, actionType } },
    });

    const prev = existing || { totalAttempts: 0, successCount: 0, failureCount: 0, neutralCount: 0, successRate: 0.5, avgImpactRoas: null };
    const newTotal = prev.totalAttempts + 1;
    const newSuccess = prev.successCount + (outcome === "success" ? 1 : 0);
    const newFailure = prev.failureCount + (outcome === "failure" ? 1 : 0);
    const newNeutral = prev.neutralCount + (outcome === "neutral" ? 1 : 0);

    // Exponential moving average — recent outcomes weigh more
    const newRate = prev.successRate * 0.8 + (outcome === "success" ? 1 : 0) * 0.2;

    // Update average ROAS impact
    const newAvgRoas = roasImpact != null
      ? (prev.avgImpactRoas != null ? prev.avgImpactRoas * 0.7 + roasImpact * 0.3 : roasImpact)
      : prev.avgImpactRoas;

    const confidence =
      newTotal < 5 ? "learning" :
      newTotal < 15 ? "low" :
      newTotal < 30 ? "medium" : "high";

    await prisma.optimizerLearning.upsert({
      where: { shop_actionType: { shop, actionType } },
      create: {
        shop, actionType,
        totalAttempts: newTotal, successCount: newSuccess, failureCount: newFailure, neutralCount: newNeutral,
        successRate: newRate, confidenceLevel: confidence, avgImpactRoas: newAvgRoas,
      },
      update: {
        totalAttempts: newTotal, successCount: newSuccess, failureCount: newFailure, neutralCount: newNeutral,
        successRate: newRate, confidenceLevel: confidence, avgImpactRoas: newAvgRoas,
      },
    });
  } catch (err: unknown) {
    logger.warn("optimizer", "Failed to update learning", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

function classifyOutcome(
  action: string,
  previousValue: string | null,
  currentRoas: number,
  previousRoas: number,
): { outcome: "success" | "failure" | "neutral"; roasImpact: number } {
  const roasImpact = currentRoas - previousRoas;

  if (action === "pause_campaign") {
    // Success = we stopped bleeding money (no further loss)
    return { outcome: "success", roasImpact: 0 };
  }
  if (action === "adjust_budget") {
    const prevBudget = parseFloat((previousValue || "").replace("budget:", "") || "0");
    const wasIncrease = prevBudget > 0 && currentRoas >= previousRoas * 0.9;
    if (wasIncrease && roasImpact >= -0.2) return { outcome: "success", roasImpact };
    if (roasImpact < -0.5) return { outcome: "failure", roasImpact };
    return { outcome: "neutral", roasImpact };
  }
  if (action === "pause_keyword") {
    return { outcome: roasImpact > 0 ? "success" : roasImpact < -0.3 ? "failure" : "neutral", roasImpact };
  }
  if (action === "add_negative_keyword") {
    return { outcome: roasImpact >= 0 ? "success" : "neutral", roasImpact };
  }
  return { outcome: "neutral", roasImpact };
}

// ── Creative Fatigue Detection ──────────────────────────────────────────

interface FatigueReport {
  campaignId: string;
  campaignName: string;
  weeksOfDecline: number;
  ctrTrend: number[];
  peakCtr: number;
  currentCtr: number;
  declinePercent: number;
  fatigueLevel: "mild" | "moderate" | "severe";
}

async function detectCreativeFatigue(
  campaignId: string,
  campaignName: string,
): Promise<FatigueReport | null> {
  try {
    const dailyData = await getCampaignPerformanceByDate(campaignId, 28);
    if (dailyData.length < 14) return null; // Need at least 2 weeks

    // Group by week (most recent first)
    const weeks: number[][] = [[], [], [], []];
    for (let i = 0; i < dailyData.length; i++) {
      const weekIdx = Math.floor(i / 7);
      if (weekIdx < 4) weeks[weekIdx].push(dailyData[i].ctr);
    }

    const weeklyCtr = weeks
      .filter((w) => w.length >= 3) // Need at least 3 days per week
      .map((w) => w.reduce((s, v) => s + v, 0) / w.length);

    if (weeklyCtr.length < 3) return null;

    // Check for consecutive decline (week 0 is most recent)
    let weeksOfDecline = 0;
    for (let i = 0; i < weeklyCtr.length - 1; i++) {
      if (weeklyCtr[i] < weeklyCtr[i + 1]) weeksOfDecline++;
      else break;
    }

    if (weeksOfDecline < 2) return null;

    const peakCtr = Math.max(...weeklyCtr);
    const currentCtr = weeklyCtr[0];
    const declinePercent = peakCtr > 0 ? ((peakCtr - currentCtr) / peakCtr) * 100 : 0;

    const fatigueLevel: FatigueReport["fatigueLevel"] =
      weeksOfDecline >= 3 && declinePercent > 40 ? "severe" :
      weeksOfDecline >= 3 || declinePercent > 20 ? "moderate" : "mild";

    return {
      campaignId, campaignName,
      weeksOfDecline, ctrTrend: weeklyCtr,
      peakCtr, currentCtr, declinePercent, fatigueLevel,
    };
  } catch {
    return null;
  }
}

// ── Portfolio Brain: Cross-Campaign Intelligence ────────────────────────

interface CannibalizationReport {
  keyword: string;
  campaigns: Array<{ id: string; name: string; cost: number; conversions: number }>;
  wastedSpend: number;
}

interface BudgetRebalance {
  fromCampaign: { id: string; name: string; currentBudget: number; roas: number };
  toCampaign: { id: string; name: string; currentBudget: number; roas: number };
  amount: number;
  reason: string;
}

interface PortfolioAnalysis {
  cannibalization: CannibalizationReport[];
  budgetRebalancing: BudgetRebalance[];
  portfolioHealth: "healthy" | "fragmented" | "cannibalized";
  totalWastedSpend: number;
}

async function analyzeCampaignPortfolio(
  campaigns: any[],
  minRoas: number,
): Promise<PortfolioAnalysis> {
  const result: PortfolioAnalysis = {
    cannibalization: [],
    budgetRebalancing: [],
    portfolioHealth: "healthy",
    totalWastedSpend: 0,
  };

  if (campaigns.length < 2) return result;

  // 1. Keyword cannibalization — find same keywords across campaigns
  const keywordMap = new Map<string, Array<{ id: string; name: string; cost: number; conversions: number }>>();

  for (const c of campaigns) {
    if (c.status !== "ENABLED") continue;
    try {
      const keywords = await getKeywordPerformance(c.id);
      for (const kw of keywords) {
        const key = kw.text.toLowerCase().trim();
        if (kw.cost < 1) continue; // Skip low-spend keywords
        if (!keywordMap.has(key)) keywordMap.set(key, []);
        keywordMap.get(key)!.push({
          id: c.id, name: c.name,
          cost: kw.cost, conversions: kw.conversions,
        });
      }
    } catch {
      continue;
    }
  }

  // Find keywords appearing in 2+ campaigns with meaningful spend
  for (const [keyword, entries] of keywordMap) {
    if (entries.length < 2) continue;
    const totalSpend = entries.reduce((s, e) => s + e.cost, 0);
    if (totalSpend < 5) continue;

    // The campaign with worse performance is "wasting" money
    const sorted = [...entries].sort((a, b) => {
      const roasA = a.conversions > 0 ? a.conversions / a.cost : 0;
      const roasB = b.conversions > 0 ? b.conversions / b.cost : 0;
      return roasB - roasA;
    });
    const wastedSpend = sorted.slice(1).reduce((s, e) => s + e.cost, 0);

    result.cannibalization.push({ keyword, campaigns: entries, wastedSpend });
    result.totalWastedSpend += wastedSpend;
  }

  // Sort by wasted spend, keep top 5
  result.cannibalization.sort((a, b) => b.wastedSpend - a.wastedSpend);
  result.cannibalization = result.cannibalization.slice(0, 5);

  // 2. Budget rebalancing — shift money from weak to strong
  const campaignPerformance = campaigns
    .filter((c: any) => c.status === "ENABLED" && parseFloat(c.cost) > 5)
    .map((c: any) => ({
      id: c.id, name: c.name,
      budget: parseFloat(c.dailyBudget || "0"),
      cost: parseFloat(c.cost),
      roas: parseFloat(c.cost) > 0 ? parseFloat(c.conversionValue || "0") / parseFloat(c.cost) : 0,
    }));

  if (campaignPerformance.length >= 2) {
    const stars = campaignPerformance.filter((c) => c.roas >= minRoas * 1.5);
    const drains = campaignPerformance.filter((c) => c.roas < minRoas * 0.8 && c.roas > 0);

    for (const drain of drains.slice(0, 2)) {
      const bestStar = stars[0];
      if (!bestStar || bestStar.id === drain.id) continue;

      const shiftAmount = Math.round(drain.budget * RULES.BUDGET_DECREASE_PCT);
      if (shiftAmount < 1) continue;

      result.budgetRebalancing.push({
        fromCampaign: { id: drain.id, name: drain.name, currentBudget: drain.budget, roas: drain.roas },
        toCampaign: { id: bestStar.id, name: bestStar.name, currentBudget: bestStar.budget, roas: bestStar.roas },
        amount: shiftAmount,
        reason: `"${drain.name}" מחזיר רק ${(drain.roas * 100).toFixed(0)}₪ על כל 100₪, אבל "${bestStar.name}" מחזיר ${(bestStar.roas * 100).toFixed(0)}₪. מעביר $${shiftAmount} מהחלש לחזק.`,
      });
    }
  }

  // Health assessment
  if (result.cannibalization.length >= 3 || result.totalWastedSpend > 50) {
    result.portfolioHealth = "cannibalized";
  } else if (result.cannibalization.length >= 1 || result.budgetRebalancing.length > 0) {
    result.portfolioHealth = "fragmented";
  }

  return result;
}

// ── Performance Detective: Root Cause Analysis ──────────────────────────

interface RootCause {
  factor: string;
  likelihood: "high" | "medium" | "low";
  evidence: string;
}

interface DetectiveReport {
  rootCauses: RootCause[];
  hebrewNarrative: string;
}

async function diagnosePerformanceChange(
  shop: string,
  campaignId: string,
  campaignName: string,
  changeType: "ctr_drop" | "ctr_spike" | "conversion_drop" | "spend_spike",
): Promise<DetectiveReport> {
  const rootCauses: RootCause[] = [];

  // Investigation 1: Quality Score changes
  try {
    const keywords = await getKeywordPerformance(campaignId);
    const kwsWithQs = keywords.filter((kw: any) => kw.qualityScore != null);
    if (kwsWithQs.length >= 3) {
      const avgQs = kwsWithQs.reduce((s: number, kw: any) => s + kw.qualityScore, 0) / kwsWithQs.length;
      if (avgQs < 5) {
        rootCauses.push({
          factor: "quality_score",
          likelihood: changeType === "ctr_drop" ? "high" : "medium",
          evidence: `גוגל נותן ציון נמוך למודעות (${avgQs.toFixed(1)}/10) — כל קליק עולה יותר ופחות אנשים רואים את המודעות`,
        });
      }
    }
  } catch { /* ignore */ }

  // Investigation 2: Competitor changes
  try {
    const trends = await getCompetitorTrends(shop);
    const newCompetitors = trends.filter((t) => t.isNew);
    const spendIncreases = trends.filter((t) => t.spendChange >= 30);

    if (newCompetitors.length > 0) {
      rootCauses.push({
        factor: "new_competitor",
        likelihood: "high",
        evidence: `מתחרה חדש נכנס לתחרות: ${newCompetitors.map((c) => c.domain).join(", ")} — דוחף את המחירים למעלה`,
      });
    }
    if (spendIncreases.length > 0) {
      rootCauses.push({
        factor: "competitor_spend",
        likelihood: "medium",
        evidence: `מתחרים הגדילו פרסום: ${spendIncreases.map((c) => `${c.domain} (+${Math.round(c.spendChange)}%)`).join(", ")}`,
      });
    }
  } catch { /* ignore */ }

  // Investigation 3: Search term pollution
  try {
    const searchTerms = await getSearchTermReport(campaignId);
    const wasteful = searchTerms.filter((st) => st.cost >= 3 && st.conversions === 0 && st.clicks >= 2);
    if (wasteful.length >= 3) {
      const totalWaste = wasteful.reduce((s, t) => s + t.cost, 0);
      const topTerms = wasteful.slice(0, 3).map((t) => `"${t.searchTerm}"`).join(", ");
      rootCauses.push({
        factor: "search_term_pollution",
        likelihood: "high",
        evidence: `חיפושים לא רלוונטיים שורפים כסף: ${topTerms} — סך בזבוז $${totalWaste.toFixed(0)}`,
      });
    }
  } catch { /* ignore */ }

  // Investigation 4: Budget pacing
  try {
    const dailyData = await getCampaignPerformanceByDate(campaignId, 7);
    if (dailyData.length >= 3) {
      const recentSpend = dailyData.slice(0, 3).reduce((s, d) => s + d.cost, 0) / 3;
      const previousSpend = dailyData.length >= 7
        ? dailyData.slice(3, 7).reduce((s, d) => s + d.cost, 0) / Math.min(4, dailyData.length - 3)
        : recentSpend;
      if (recentSpend > previousSpend * 1.5 && changeType === "spend_spike") {
        rootCauses.push({
          factor: "budget_spike",
          likelihood: "high",
          evidence: `הוצאה יומית קפצה מ-$${previousSpend.toFixed(0)} ל-$${recentSpend.toFixed(0)} — ייתכן שגוגל העלה הצעות אוטומטית`,
        });
      }
    }
  } catch { /* ignore */ }

  // Investigation 5: Creative fatigue
  const fatigue = await detectCreativeFatigue(campaignId, campaignName);
  if (fatigue && fatigue.fatigueLevel !== "mild" && changeType === "ctr_drop") {
    rootCauses.push({
      factor: "creative_fatigue",
      likelihood: "medium",
      evidence: `${fatigue.weeksOfDecline} שבועות רצופים של ירידה בלחיצות (מ-${fatigue.peakCtr.toFixed(1)}% ל-${fatigue.currentCtr.toFixed(1)}%) — הקהל התעייף מהמודעות`,
    });
  }

  // Sort by likelihood
  const likelihoodOrder = { high: 0, medium: 1, low: 2 };
  rootCauses.sort((a, b) => likelihoodOrder[a.likelihood] - likelihoodOrder[b.likelihood]);

  // Build Hebrew narrative
  let narrative: string;
  if (rootCauses.length === 0) {
    narrative = `בדקנו את "${campaignName}" לעומק ולא מצאנו סיבה ברורה לשינוי. ייתכן שזו תנודה טבעית — נמשיך לעקוב.`;
  } else {
    const mainCause = rootCauses[0];
    narrative = `חקרנו למה "${campaignName}" השתנה. `;
    if (rootCauses.length === 1) {
      narrative += `הסיבה הסבירה: ${mainCause.evidence}.`;
    } else {
      narrative += `הסיבה העיקרית: ${mainCause.evidence}. `;
      narrative += `גם: ${rootCauses[1].evidence}.`;
    }
  }

  return { rootCauses, hebrewNarrative: narrative };
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
