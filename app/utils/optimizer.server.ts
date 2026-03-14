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

    // 3. Apply optimization rules to each campaign
    const plannedActions: OptAction[] = [];

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
                plannedActions.push({
                  campaignId: campaign.id,
                  campaignName: campaign.name,
                  action: "alert_performance_drop",
                  reason: `פחות אנשים לוחצים על המודעות — ירידה של ${Math.abs(Math.round(ctrChangePct))}% בשבוע האחרון. כדאי לרענן את טקסט המודעות או לבדוק שמתחרה חדש לא נכנס.`,
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
                       action.action === "suggest_keyword";

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

    for (const rec of recs) {
      try {
        const campaigns = await listSmartAdsCampaigns();
        const campaign = campaigns.find((c: any) => c.id === rec.campaignId);
        if (!campaign) continue;

        const currentRoas = parseFloat(campaign.cost) > 0
          ? parseFloat(campaign.conversionValue) / parseFloat(campaign.cost)
          : 0;

        let outcome = "לא ניתן לבדוק";
        if (rec.action === "adjust_budget" && rec.previousValue) {
          const prevBudget = parseFloat(rec.previousValue.replace("budget:", ""));
          const currBudget = parseFloat(campaign.dailyBudget);
          const budgetDir = currBudget > prevBudget ? "הועלה" : "הופחת";
          outcome = `תקציב ${budgetDir}. תשואה נוכחית: ${currentRoas.toFixed(1)}x.`;
        } else if (rec.action === "pause_keyword") {
          outcome = `מילת מפתח הושהתה. חיסכון מאז האישור.`;
        } else if (rec.action === "add_negative_keyword") {
          outcome = `חיפושים לא רלוונטיים נחסמו.`;
        }

        await logAction(rec.shop, {
          campaignId: rec.campaignId,
          campaignName: rec.campaignName,
          action: "feedback_check",
          reason: outcome,
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
