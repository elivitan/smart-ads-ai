/**
 * ProactiveAlerts — Smart AI alerts like a real ad agency
 *
 * Shows proactive recommendations:
 * - Seasonal opportunities (Black Friday, holidays)
 * - Demand changes
 * - Competitor movements
 * - Budget optimization suggestions
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
  type: "opportunity" | "warning" | "milestone" | "seasonal" | "competitor" | "health" | "detective" | "creative_fatigue" | "portfolio";
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
};

const URGENCY_LABELS: Record<string, string> = {
  now: "דחוף",
  today: "היום",
  this_week: "השבוע",
};

export function ProactiveAlerts({ alerts }: ProactiveAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            התראות חכמות מהסוכנות
          </Text>
          <Badge tone="info">{`${alerts.length} התראות`}</Badge>
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
          title: `${h.name} בעוד ${h.daysUntil} ימים`,
          message: h.daysUntil <= 7
            ? `זמן לפעול עכשיו! ה-CPC יעלה בקרוב. מומלץ להגדיל תקציב ולהכין מודעות ייעודיות.`
            : `הזמן להתחיל להתכונן. תכנן תקציב גבוה יותר ומודעות מותאמות ל${h.name}.`,
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
      title: `הביקוש עלה ב-${data.trendChange}%`,
      message: "מגמת חיפוש עולה — זמן טוב להגדיל תקציב ולתפוס נתח שוק לפני שהמתחרים מגיבים.",
      urgency: "today",
    });
  } else if (data.trendDirection === "falling" && (data.trendChange || 0) < -20) {
    alerts.push({
      id: `trend-falling-${now}`,
      type: "warning",
      title: "ירידה בביקוש",
      message: `הביקוש ירד ב-${Math.abs(data.trendChange || 0)}%. מומלץ להקטין תקציב ולהתמקד במילות מפתח ממירות.`,
      urgency: "today",
    });
  }

  // ROAS alerts with margin context
  if (data.campaigns) {
    for (const c of data.campaigns) {
      if (c.roas != null && c.roas < 1.0 && (c.spend || 0) > 10) {
        const marginNote = data.profitMargin
          ? ` עם מרווח של ${data.profitMargin}%, אתה צריך ROAS של לפחות ${(100 / data.profitMargin).toFixed(1)}.`
          : "";
        alerts.push({
          id: `roas-low-${c.name}-${now}`,
          type: "warning",
          title: `ROAS נמוך: ${c.name}`,
          message: `ROAS ${c.roas.toFixed(2)} אחרי $${(c.spend || 0).toFixed(0)} הוצאה.${marginNote} שקול להשהות או לשנות אסטרטגיה.`,
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
      title: "תחרות גבוהה",
      message: `${data.competitorCount} מתחרים מפרסמים על מילות המפתח שלך. כדאי להתמקד בחיפושים יותר ספציפיים שבהם פחות תחרות.`,
      urgency: "this_week",
    });
  }

  // Competitor trend alerts
  if (data.competitorTrends) {
    for (const ct of data.competitorTrends) {
      alerts.push({
        id: `competitor-${ct.type}-${ct.domain}-${now}`,
        type: "competitor",
        title: ct.type === "new_competitor" ? "מתחרה חדש" :
               ct.type === "competitor_left" ? "מתחרה עזב" :
               ct.type === "spend_increase" ? "מתחרה מגדיל פרסום" :
               "מתחרה הוריד מחירים",
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
          title: "התקציב נשרף מהר",
          message: `כבר הוצאת $${spentToday.toFixed(0)} מתוך $${dailyBudget} יומי. בקצב הזה התקציב ייגמר לפני סוף היום ולא תופיע בחיפושים אחה"צ/ערב.`,
          urgency: "now",
        });
      } else if (hoursElapsed > 12 && projectedDaily < dailyBudget * 0.5) {
        alerts.push({
          id: `pacing-slow-${now}`,
          type: "health",
          title: "התקציב לא מנוצל",
          message: `רק $${spentToday.toFixed(0)} מתוך $${dailyBudget} נוצלו היום. ייתכן שמילות המפתח צרות מדי או שההצעות נמוכות.`,
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
        title: "אין מכירות מהפרסום",
        message: `${daysWithoutConversions} ימים בלי אף מכירה למרות שאנשים רואים את המודעות. ייתכן שמעקב ההמרות לא מוגדר נכון — כדאי לבדוק.`,
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
        title: "פחות אנשים לוחצים",
        message: `ירידה של ${Math.abs(Math.round(ctrChange))}% בכמות הלחיצות בשבוע האחרון. כדאי לרענן את טקסט המודעות או לבדוק שמתחרה חדש לא נכנס.`,
        urgency: "today",
      });
    } else if (ctrChange > 50) {
      alerts.push({
        id: `ctr-boost-${now}`,
        type: "opportunity",
        title: "יותר אנשים לוחצים!",
        message: `עלייה של ${Math.round(ctrChange)}% בלחיצות על המודעות! זה הזמן להגדיל תקציב ולנצל את המומנטום.`,
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
        title: "המודעות מתישנות",
        message: `"${fatigue.campaignName}" — ${fatigue.weeksOfDecline} שבועות רצופים של ירידה (${Math.round(fatigue.declinePercent)}%). הגיע הזמן לרענן את הטקסטים.`,
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
        title: "קמפיינים מתחרים זה בזה",
        message: `${cannibalizationCount} מילות מפתח מופיעות ביותר מקמפיין אחד — $${Math.round(totalWastedSpend)} בזבוז. כדאי לחלק מילים או לאחד קמפיינים.`,
        urgency: totalWastedSpend > 50 ? "now" : "this_week",
      });
    }
    if (rebalanceCount > 0) {
      alerts.push({
        id: `portfolio-rebalance-${now}`,
        type: "portfolio",
        title: "הזדמנות לאיזון תקציב",
        message: `זיהינו שכדאי להעביר כסף מקמפיין חלש לחזק — ${rebalanceCount} העברות מומלצות.`,
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
        title: `חקירה: ${report.campaignName}`,
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
      title: "המערכת לומדת ומשתפרת",
      message: `המערכת ביצעה ${data.learningInsights.totalActionsLearned} פעולות ולמדה מהתוצאות. שיעור הצלחה: ${successPct}%.`,
      urgency: "this_week",
    });
  }

  return alerts;
}
