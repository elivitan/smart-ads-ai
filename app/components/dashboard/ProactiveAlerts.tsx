/**
 * ProactiveAlerts — Smart AI alerts like a real ad agency
 *
 * Shows proactive recommendations:
 * - Seasonal opportunities (Black Friday, holidays)
 * - Demand changes
 * - Competitor movements
 * - Budget optimization suggestions
 * - Inventory alerts, profit warnings, forecasts, funnel status
 */

import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Icon,
  Box,
} from "@shopify/polaris";
import { AlertCircleIcon, ArrowUpIcon, TargetIcon } from "@shopify/polaris-icons";

interface Alert {
  id: string;
  type: "opportunity" | "warning" | "milestone" | "seasonal" | "competitor" | "health" | "detective" | "creative_fatigue" | "portfolio" | "deep_intel" | "keyword_gap" | "ab_test" | "weekly_report" | "inventory_low" | "inventory_overstock" | "stockout_predicted" | "profit_negative" | "competitor_spend_surge" | "competitor_spend_drop" | "forecast_revenue_up" | "forecast_revenue_down" | "landing_mismatch" | "funnel_rebalanced" | "competitor_weakness_found" | "strike_completed" | "ghost_opportunity" | "ghost_validated" | "ghost_rejected" | "life_moment_upcoming" | "life_moment_launched" | "arbitrage_window_found" | "arbitrage_savings" | "currency_favorable" | "currency_margin_squeeze";
  title: string;
  message: string;
  urgency: "now" | "today" | "this_week";
  actionLabel?: string;
  onAction?: () => void;
}

interface ProactiveAlertsProps {
  alerts: Alert[];
}

const ALERT_CONFIG: Record<string, { tone: "success" | "warning" | "critical" | "info"; icon: typeof AlertCircleIcon }> = {
  opportunity: { tone: "success", icon: ArrowUpIcon },
  warning: { tone: "warning", icon: AlertCircleIcon },
  milestone: { tone: "info", icon: TargetIcon },
  seasonal: { tone: "info", icon: ArrowUpIcon },
  competitor: { tone: "warning", icon: AlertCircleIcon },
  health: { tone: "critical", icon: AlertCircleIcon },
  detective: { tone: "warning", icon: AlertCircleIcon },
  creative_fatigue: { tone: "warning", icon: ArrowUpIcon },
  portfolio: { tone: "info", icon: TargetIcon },
  deep_intel: { tone: "warning", icon: AlertCircleIcon },
  keyword_gap: { tone: "success", icon: ArrowUpIcon },
  ab_test: { tone: "success", icon: TargetIcon },
  weekly_report: { tone: "info", icon: TargetIcon },
  // 10 new engine alert types
  inventory_low: { tone: "critical", icon: AlertCircleIcon },
  inventory_overstock: { tone: "info", icon: ArrowUpIcon },
  stockout_predicted: { tone: "warning", icon: AlertCircleIcon },
  profit_negative: { tone: "critical", icon: AlertCircleIcon },
  competitor_spend_surge: { tone: "warning", icon: AlertCircleIcon },
  competitor_spend_drop: { tone: "success", icon: ArrowUpIcon },
  forecast_revenue_up: { tone: "success", icon: ArrowUpIcon },
  forecast_revenue_down: { tone: "warning", icon: AlertCircleIcon },
  landing_mismatch: { tone: "warning", icon: AlertCircleIcon },
  funnel_rebalanced: { tone: "info", icon: TargetIcon },
  // 8 advanced engine alert types (engines 11-18)
  digital_twin_risk: { tone: "warning", icon: AlertCircleIcon },
  digital_twin_opportunity: { tone: "success", icon: ArrowUpIcon },
  agent_consensus_change: { tone: "info", icon: TargetIcon },
  weather_trigger: { tone: "info", icon: ArrowUpIcon },
  flash_sale_active: { tone: "success", icon: ArrowUpIcon },
  flash_sale_ended: { tone: "info", icon: TargetIcon },
  search_waste_detected: { tone: "critical", icon: AlertCircleIcon },
  performance_guard_pause: { tone: "critical", icon: AlertCircleIcon },
  performance_guard_save: { tone: "success", icon: ArrowUpIcon },
  supply_chain_arriving: { tone: "info", icon: ArrowUpIcon },
  supply_chain_delay: { tone: "warning", icon: AlertCircleIcon },
  review_insight_found: { tone: "success", icon: TargetIcon },
  // 11 revolutionary engine alert types (engines 19-23)
  competitor_weakness_found: { tone: "success", icon: ArrowUpIcon },
  strike_completed: { tone: "info", icon: TargetIcon },
  ghost_opportunity: { tone: "success", icon: ArrowUpIcon },
  ghost_validated: { tone: "success", icon: TargetIcon },
  ghost_rejected: { tone: "info", icon: AlertCircleIcon },
  life_moment_upcoming: { tone: "warning", icon: ArrowUpIcon },
  life_moment_launched: { tone: "info", icon: TargetIcon },
  arbitrage_window_found: { tone: "success", icon: ArrowUpIcon },
  arbitrage_savings: { tone: "info", icon: TargetIcon },
  currency_favorable: { tone: "success", icon: ArrowUpIcon },
  currency_margin_squeeze: { tone: "warning", icon: AlertCircleIcon },
};

const URGENCY_LABELS: Record<string, string> = {
  now: "Urgent",
  today: "Today",
  this_week: "This Week",
};

export function ProactiveAlerts({ alerts }: ProactiveAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Smart Agency Alerts
          </Text>
          <Badge tone="info">{`${alerts.length} alerts`}</Badge>
        </InlineStack>

        {alerts.map((alert) => {
          const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.opportunity;
          return (
            <Box
              key={alert.id}
              padding="300"
              borderRadius="200"
              background="bg-surface-secondary"
            >
              <InlineStack gap="300" blockAlign="start" wrap={false}>
                <Box>
                  <Icon source={config.icon} tone={config.tone} />
                </Box>
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {alert.title}
                    </Text>
                    <Badge tone={alert.urgency === "now" ? "critical" : "info"} size="small">
                      {URGENCY_LABELS[alert.urgency] || alert.urgency}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {alert.message}
                  </Text>
                </BlockStack>
              </InlineStack>
            </Box>
          );
        })}
      </BlockStack>
    </Card>
  );
}

/**
 * Generate alerts based on market data, seasonality, and campaign performance.
 */
export function generateAlerts(data: {
  marketSignal?: string;
  trendDirection?: string;
  trendChange?: number;
  competitorCount?: number;
  holidays?: Array<{ name: string; daysUntil: number; impact: string }>;
  campaigns?: Array<{ name: string; roas?: number; spend?: number }>;
  profitMargin?: number | null;
  competitorTrends?: Array<{ type: string; domain: string; message: string; urgency: string }>;
  budgetPacing?: { dailyBudget: number; spentToday: number; hoursElapsed: number };
  conversionHealth?: { daysWithoutConversions: number; hasImpressions: boolean };
  performanceChanges?: { ctrChange: number; period: string };
  creativeFatigue?: Array<{ campaignName: string; weeksOfDecline: number; declinePercent: number }>;
  portfolioHealth?: { cannibalizationCount: number; totalWastedSpend: number; rebalanceCount: number };
  detectiveReports?: Array<{ campaignName: string; narrative: string }>;
  learningInsights?: { overallSuccessRate: number; totalActionsLearned: number };
  deepIntelAlerts?: Array<{ domain: string; message: string; urgency: string }>;
  keywordGaps?: Array<{ keyword: string; opportunityScore: number; source: string }>;
  abTestResults?: Array<{ campaignName: string; improvement: number }>;
  weeklyReportReady?: boolean;
  // New engine data inputs
  inventoryAlerts?: Array<{ productTitle: string; alertType: string; currentStock: number; daysUntilOut?: number }>;
  profitAlerts?: Array<{ campaignName: string; netProfit: number; roas: number }>;
  competitorSpendChanges?: Array<{ domain: string; direction: string; changePct: number }>;
  forecastAlerts?: Array<{ type: string; predicted: number; trend: string }>;
  landingMismatches?: Array<{ productId: string; pageUrl: string; score: number }>;
  funnelRebalanced?: { changesCount: number; totalBudget: number };
  // Revolutionary engine inputs (19-23)
  competitorWeaknesses?: Array<{ domain: string; weakness: string; score: number }>;
  strikeResults?: Array<{ competitorDomain: string; strikeType: string; saved: number }>;
  ghostOpportunities?: Array<{ keyword: string; score: number; type: string }>;
  ghostValidated?: Array<{ keyword: string; roas: number }>;
  ghostRejected?: Array<{ keyword: string; reason: string }>;
  lifeMomentsUpcoming?: Array<{ momentType: string; daysUntil: number; products: number }>;
  lifeMomentsLaunched?: Array<{ momentType: string; campaigns: number }>;
  arbitrageWindows?: Array<{ day: string; hour: number; savings: number }>;
  arbitrageSavings?: { totalSaved: number; windowsUsed: number };
  currencyFavorable?: Array<{ pair: string; changePct: number }>;
  currencyMarginSqueeze?: Array<{ pair: string; impactPct: number; productsAffected: number }>;
}): Alert[] {
  const alerts: Alert[] = [];
  const now = Date.now();

  // Seasonal alerts
  if (data.holidays) {
    for (const h of data.holidays) {
      if (h.daysUntil <= 21 && h.impact !== "low") {
        alerts.push({
          id: `seasonal-${h.name}-${now}`,
          type: "seasonal",
          title: `${h.name} in ${h.daysUntil} days`,
          message: h.daysUntil <= 7
            ? `Time to act now! CPC will rise soon. Consider increasing budget and preparing dedicated ads.`
            : `Start preparing now. Plan a higher budget and tailored ads for ${h.name}.`,
          urgency: h.daysUntil <= 7 ? "now" : "this_week",
        });
      }
    }
  }

  // Trend alerts
  if (data.trendDirection === "rising" && (data.trendChange || 0) > 15) {
    alerts.push({
      id: `trend-rising-${now}`,
      type: "opportunity",
      title: `Demand up ${data.trendChange}%`,
      message: "Search trend is rising — great time to increase budget and capture market share before competitors react.",
      urgency: "today",
    });
  } else if (data.trendDirection === "falling" && (data.trendChange || 0) < -20) {
    alerts.push({
      id: `trend-falling-${now}`,
      type: "warning",
      title: "Demand declining",
      message: `Demand dropped ${Math.abs(data.trendChange || 0)}%. Consider reducing budget and focusing on high-converting keywords.`,
      urgency: "today",
    });
  }

  // ROAS alerts with margin context
  if (data.campaigns) {
    for (const c of data.campaigns) {
      if (c.roas != null && c.roas < 1.0 && (c.spend || 0) > 10) {
        const marginNote = data.profitMargin
          ? ` With a ${data.profitMargin}% margin, you need a ROAS of at least ${(100 / data.profitMargin).toFixed(1)}.`
          : "";
        alerts.push({
          id: `roas-low-${c.name}-${now}`,
          type: "warning",
          title: `Low ROAS: ${c.name}`,
          message: `ROAS ${c.roas.toFixed(2)} after $${(c.spend || 0).toFixed(0)} spent.${marginNote} Consider pausing or changing strategy.`,
          urgency: "now",
        });
      }
    }
  }

  // Competition alert
  if ((data.competitorCount || 0) > 8) {
    alerts.push({
      id: `competition-high-${now}`,
      type: "warning",
      title: "High competition",
      message: `${data.competitorCount} competitors are bidding on your keywords. Focus on more specific searches with less competition.`,
      urgency: "this_week",
    });
  }

  // Competitor trend alerts
  if (data.competitorTrends) {
    for (const ct of data.competitorTrends) {
      alerts.push({
        id: `competitor-${ct.type}-${ct.domain}-${now}`,
        type: "competitor",
        title: ct.type === "new_competitor" ? "New competitor detected" :
               ct.type === "competitor_left" ? "Competitor left" :
               ct.type === "spend_increase" ? "Competitor increasing spend" :
               "Competitor cut prices",
        message: ct.message,
        urgency: ct.urgency as "now" | "today" | "this_week",
      });
    }
  }

  // Budget pacing alert
  if (data.budgetPacing) {
    const { dailyBudget, spentToday, hoursElapsed } = data.budgetPacing;
    if (hoursElapsed > 4 && dailyBudget > 0) {
      const projectedDaily = (spentToday / hoursElapsed) * 24;
      if (projectedDaily > dailyBudget * 1.3) {
        alerts.push({
          id: `pacing-fast-${now}`,
          type: "warning",
          title: "Budget burning fast",
          message: `Already spent $${spentToday.toFixed(0)} of $${dailyBudget} daily budget. At this rate, budget will run out before evening and ads won't show.`,
          urgency: "now",
        });
      } else if (hoursElapsed > 12 && projectedDaily < dailyBudget * 0.5) {
        alerts.push({
          id: `pacing-slow-${now}`,
          type: "health",
          title: "Budget underutilized",
          message: `Only $${spentToday.toFixed(0)} of $${dailyBudget} used today. Keywords may be too narrow or bids too low.`,
          urgency: "today",
        });
      }
    }
  }

  // Conversion tracking health
  if (data.conversionHealth) {
    const { daysWithoutConversions, hasImpressions } = data.conversionHealth;
    if (daysWithoutConversions >= 5 && hasImpressions) {
      alerts.push({
        id: `conversion-health-${now}`,
        type: "health",
        title: "No sales from ads",
        message: `${daysWithoutConversions} days without a single sale despite impressions. Conversion tracking may not be set up correctly.`,
        urgency: "now",
      });
    }
  }

  // Performance changes
  if (data.performanceChanges) {
    const { ctrChange } = data.performanceChanges;
    if (ctrChange < -50) {
      alerts.push({
        id: `ctr-drop-${now}`,
        type: "warning",
        title: "Click rate dropping",
        message: `CTR dropped ${Math.abs(Math.round(ctrChange))}% this week. Consider refreshing ad copy or checking for new competitors.`,
        urgency: "today",
      });
    } else if (ctrChange > 50) {
      alerts.push({
        id: `ctr-boost-${now}`,
        type: "opportunity",
        title: "Click rate surging!",
        message: `CTR up ${Math.round(ctrChange)}%! Great time to increase budget and capitalize on this momentum.`,
        urgency: "today",
      });
    }
  }

  // Creative fatigue alerts
  if (data.creativeFatigue) {
    for (const fatigue of data.creativeFatigue) {
      alerts.push({
        id: `fatigue-${fatigue.campaignName}-${now}`,
        type: "creative_fatigue",
        title: "Ad fatigue detected",
        message: `"${fatigue.campaignName}" — ${fatigue.weeksOfDecline} weeks of decline (${Math.round(fatigue.declinePercent)}%). Time to refresh ad copy.`,
        urgency: fatigue.declinePercent > 40 ? "now" : "today",
      });
    }
  }

  // Portfolio health alerts
  if (data.portfolioHealth) {
    const { cannibalizationCount, totalWastedSpend, rebalanceCount } = data.portfolioHealth;
    if (cannibalizationCount > 0) {
      alerts.push({
        id: `portfolio-cannibal-${now}`,
        type: "portfolio",
        title: "Campaigns competing with each other",
        message: `${cannibalizationCount} keywords appear in multiple campaigns — $${Math.round(totalWastedSpend)} wasted. Consider splitting keywords or merging campaigns.`,
        urgency: totalWastedSpend > 50 ? "now" : "this_week",
      });
    }
    if (rebalanceCount > 0) {
      alerts.push({
        id: `portfolio-rebalance-${now}`,
        type: "portfolio",
        title: "Budget rebalance opportunity",
        message: `Found ${rebalanceCount} recommended budget transfers from weak to strong campaigns.`,
        urgency: "today",
      });
    }
  }

  // Detective reports
  if (data.detectiveReports) {
    for (const report of data.detectiveReports) {
      alerts.push({
        id: `detective-${report.campaignName}-${now}`,
        type: "detective",
        title: `Investigation: ${report.campaignName}`,
        message: report.narrative,
        urgency: "today",
      });
    }
  }

  // Self-learning milestone
  if (data.learningInsights && data.learningInsights.totalActionsLearned >= 10) {
    const successPct = Math.round(data.learningInsights.overallSuccessRate * 100);
    alerts.push({
      id: `learning-milestone-${now}`,
      type: "milestone",
      title: "System learning and improving",
      message: `The system has performed ${data.learningInsights.totalActionsLearned} actions and learned from the results. Success rate: ${successPct}%.`,
      urgency: "this_week",
    });
  }

  // Deep intelligence alerts
  if (data.deepIntelAlerts) {
    for (const intel of data.deepIntelAlerts) {
      alerts.push({
        id: `deep-intel-${intel.domain}-${now}`,
        type: "deep_intel",
        title: `Intel: ${intel.domain}`,
        message: intel.message,
        urgency: intel.urgency as "now" | "today" | "this_week",
      });
    }
  }

  // Keyword gap alerts
  if (data.keywordGaps) {
    const topGaps = data.keywordGaps.filter((g) => g.opportunityScore >= 70).slice(0, 3);
    for (const gap of topGaps) {
      alerts.push({
        id: `keyword-gap-${gap.keyword}-${now}`,
        type: "keyword_gap",
        title: "Opportunity competitors already found",
        message: `Competitors (${gap.source}) are advertising on "${gap.keyword}" and you're not — you're missing this opportunity.`,
        urgency: "today",
      });
    }
  }

  // A/B test results
  if (data.abTestResults) {
    for (const result of data.abTestResults) {
      alerts.push({
        id: `ab-test-${result.campaignName}-${now}`,
        type: "ab_test",
        title: "A/B test winner found!",
        message: `Tested different ad versions for "${result.campaignName}". The winning version gets ${result.improvement}% more clicks!`,
        urgency: "today",
      });
    }
  }

  // Weekly report ready
  if (data.weeklyReportReady) {
    alerts.push({
      id: `weekly-report-${now}`,
      type: "weekly_report",
      title: "Weekly report ready",
      message: "Summary of this week — what was done, what changed, and what's planned next.",
      urgency: "this_week",
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 10 NEW ENGINE ALERT TYPES
  // ═══════════════════════════════════════════════════════════

  // Inventory alerts
  if (data.inventoryAlerts) {
    for (const inv of data.inventoryAlerts) {
      if (inv.alertType === "low_stock" || inv.alertType === "stockout_predicted") {
        alerts.push({
          id: `inventory-${inv.alertType}-${inv.productTitle}-${now}`,
          type: inv.alertType === "low_stock" ? "inventory_low" : "stockout_predicted",
          title: inv.alertType === "low_stock" ? `Low stock: ${inv.productTitle}` : `Stockout predicted: ${inv.productTitle}`,
          message: inv.daysUntilOut != null
            ? `Only ${inv.currentStock} units left. Estimated stockout in ${inv.daysUntilOut} days. Campaign budget reduced to prevent overselling.`
            : `Stock is critically low (${inv.currentStock} units). Ad spend has been throttled automatically.`,
          urgency: (inv.daysUntilOut != null && inv.daysUntilOut <= 3) ? "now" : "today",
        });
      } else if (inv.alertType === "overstock") {
        alerts.push({
          id: `inventory-overstock-${inv.productTitle}-${now}`,
          type: "inventory_overstock",
          title: `Overstocked: ${inv.productTitle}`,
          message: `${inv.currentStock} units in stock — well above sales rate. Ad spend boosted to move inventory faster.`,
          urgency: "this_week",
        });
      }
    }
  }

  // Profit alerts
  if (data.profitAlerts) {
    for (const p of data.profitAlerts) {
      if (p.netProfit < 0) {
        alerts.push({
          id: `profit-negative-${p.campaignName}-${now}`,
          type: "profit_negative",
          title: `Losing money: ${p.campaignName}`,
          message: `This campaign is losing $${Math.abs(p.netProfit).toFixed(2)} per conversion after COGS. ROAS is ${p.roas.toFixed(2)} but true profit is negative.`,
          urgency: "now",
        });
      }
    }
  }

  // Competitor spend changes
  if (data.competitorSpendChanges) {
    for (const cs of data.competitorSpendChanges) {
      if (cs.direction === "increasing" && cs.changePct > 50) {
        alerts.push({
          id: `comp-spend-surge-${cs.domain}-${now}`,
          type: "competitor_spend_surge",
          title: `${cs.domain} ramping up spend`,
          message: `Competitor increased ad spend by ${cs.changePct.toFixed(0)}%. Expect higher CPCs — consider adjusting bids or targeting.`,
          urgency: "today",
        });
      } else if (cs.direction === "decreasing" && cs.changePct > 30) {
        alerts.push({
          id: `comp-spend-drop-${cs.domain}-${now}`,
          type: "competitor_spend_drop",
          title: `${cs.domain} cutting spend`,
          message: `Competitor reduced spend by ${cs.changePct.toFixed(0)}%. Opportunity to capture their market share at lower CPC.`,
          urgency: "today",
        });
      }
    }
  }

  // Forecast alerts
  if (data.forecastAlerts) {
    for (const f of data.forecastAlerts) {
      const fIdx = data.forecastAlerts!.indexOf(f);
      if (f.trend === "growing") {
        alerts.push({
          id: `forecast-up-${fIdx}-${now}`,
          type: "forecast_revenue_up",
          title: "Revenue growth predicted",
          message: `Forecast shows $${f.predicted.toFixed(0)} predicted revenue — trend is upward. Good time to scale campaigns.`,
          urgency: "this_week",
        });
      } else if (f.trend === "declining") {
        alerts.push({
          id: `forecast-down-${fIdx}-${now}`,
          type: "forecast_revenue_down",
          title: "Revenue decline predicted",
          message: `Forecast shows $${f.predicted.toFixed(0)} predicted revenue — declining trend detected. Review campaigns and tighten targeting.`,
          urgency: "today",
        });
      }
    }
  }

  // Landing page mismatch alerts
  if (data.landingMismatches) {
    for (const lm of data.landingMismatches) {
      if (lm.score < 50) {
        alerts.push({
          id: `landing-mismatch-${lm.productId}-${now}`,
          type: "landing_mismatch",
          title: "Ad-to-page mismatch",
          message: `Landing page alignment score is only ${lm.score}/100. Ad promises don't match page content — this hurts Quality Score and conversions.`,
          urgency: lm.score < 30 ? "now" : "today",
        });
      }
    }
  }

  // Funnel rebalanced
  if (data.funnelRebalanced && data.funnelRebalanced.changesCount > 0) {
    alerts.push({
      id: `funnel-rebalanced-${now}`,
      type: "funnel_rebalanced",
      title: "Budget auto-rebalanced",
      message: `Redistributed $${data.funnelRebalanced.totalBudget.toFixed(0)} daily budget across ${data.funnelRebalanced.changesCount} campaigns based on performance.`,
      urgency: "this_week",
    });
  }

  // ── Revolutionary Engine Alerts (19-23) ──

  // Competitor weakness found (Engine 19)
  if (data.competitorWeaknesses) {
    for (const cw of data.competitorWeaknesses) {
      alerts.push({
        id: `comp-weakness-${cw.domain}-${now}`,
        type: "competitor_weakness_found",
        title: `Weakness found: ${cw.domain}`,
        message: `Detected exploitable gap: ${cw.weakness}. Opportunity score: ${cw.score}/100.`,
        urgency: cw.score >= 80 ? "now" : "today",
      });
    }
  }

  // Strike completed (Engine 19)
  if (data.strikeResults) {
    for (const sr of data.strikeResults) {
      alerts.push({
        id: `strike-done-${sr.competitorDomain}-${now}`,
        type: "strike_completed",
        title: `Strike on ${sr.competitorDomain} completed`,
        message: `${sr.strikeType} strike finished. Estimated savings: $${sr.saved.toFixed(0)}.`,
        urgency: "this_week",
      });
    }
  }

  // Ghost opportunity (Engine 20)
  if (data.ghostOpportunities) {
    for (const go of data.ghostOpportunities) {
      if (go.score >= 60) {
        alerts.push({
          id: `ghost-opp-${go.keyword}-${now}`,
          type: "ghost_opportunity",
          title: `Untapped niche: "${go.keyword}"`,
          message: `${go.type} opportunity with score ${go.score}/100. Low competition, high potential.`,
          urgency: go.score >= 80 ? "now" : "today",
        });
      }
    }
  }

  // Ghost validated (Engine 20)
  if (data.ghostValidated) {
    for (const gv of data.ghostValidated) {
      alerts.push({
        id: `ghost-valid-${gv.keyword}-${now}`,
        type: "ghost_validated",
        title: `Ghost campaign validated: "${gv.keyword}"`,
        message: `Test campaign achieved ${gv.roas.toFixed(1)}x ROAS. Ready to scale.`,
        urgency: "today",
      });
    }
  }

  // Ghost rejected (Engine 20)
  if (data.ghostRejected) {
    for (const gr of data.ghostRejected) {
      alerts.push({
        id: `ghost-reject-${gr.keyword}-${now}`,
        type: "ghost_rejected",
        title: `Ghost campaign rejected: "${gr.keyword}"`,
        message: `Test didn't meet thresholds. Reason: ${gr.reason}. Campaign stopped.`,
        urgency: "this_week",
      });
    }
  }

  // Life moment upcoming (Engine 21)
  if (data.lifeMomentsUpcoming) {
    for (const lm of data.lifeMomentsUpcoming) {
      alerts.push({
        id: `moment-upcoming-${lm.momentType}-${now}`,
        type: "life_moment_upcoming",
        title: `${lm.momentType} season in ${lm.daysUntil} days`,
        message: `${lm.products} products match this life moment. Create targeted campaigns now for maximum impact.`,
        urgency: lm.daysUntil <= 7 ? "now" : "today",
      });
    }
  }

  // Life moment launched (Engine 21)
  if (data.lifeMomentsLaunched) {
    for (const ll of data.lifeMomentsLaunched) {
      alerts.push({
        id: `moment-launched-${ll.momentType}-${now}`,
        type: "life_moment_launched",
        title: `${ll.momentType} campaigns launched`,
        message: `${ll.campaigns} targeted campaigns are now live for this life moment.`,
        urgency: "this_week",
      });
    }
  }

  // Arbitrage window found (Engine 22)
  if (data.arbitrageWindows) {
    for (const aw of data.arbitrageWindows.slice(0, 3)) {
      alerts.push({
        id: `arb-window-${aw.day}-${aw.hour}-${now}`,
        type: "arbitrage_window_found",
        title: `Low-CPC window: ${aw.day} ${aw.hour}:00`,
        message: `CPC drops significantly during this hour. Estimated savings: $${aw.savings.toFixed(0)}/month by shifting budget here.`,
        urgency: "this_week",
      });
    }
  }

  // Arbitrage savings report (Engine 22)
  if (data.arbitrageSavings && data.arbitrageSavings.totalSaved > 0) {
    alerts.push({
      id: `arb-savings-${now}`,
      type: "arbitrage_savings",
      title: "Bid arbitrage savings report",
      message: `Saved $${data.arbitrageSavings.totalSaved.toFixed(0)} this week using ${data.arbitrageSavings.windowsUsed} time-optimized windows.`,
      urgency: "this_week",
    });
  }

  // Currency favorable (Engine 23)
  if (data.currencyFavorable) {
    for (const cf of data.currencyFavorable) {
      alerts.push({
        id: `currency-fav-${cf.pair}-${now}`,
        type: "currency_favorable",
        title: `Favorable rate: ${cf.pair}`,
        message: `Exchange rate improved by ${cf.changePct.toFixed(1)}%. Your margins just got better — consider aggressive pricing.`,
        urgency: "today",
      });
    }
  }

  // Currency margin squeeze (Engine 23)
  if (data.currencyMarginSqueeze) {
    for (const cms of data.currencyMarginSqueeze) {
      alerts.push({
        id: `currency-squeeze-${cms.pair}-${now}`,
        type: "currency_margin_squeeze",
        title: `Margin squeeze: ${cms.pair}`,
        message: `Exchange rate hurting margins by ${cms.impactPct.toFixed(1)}% across ${cms.productsAffected} products. Consider price adjustments.`,
        urgency: cms.impactPct > 10 ? "now" : "today",
      });
    }
  }

  return alerts;
}
