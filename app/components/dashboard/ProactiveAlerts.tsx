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
  type: "opportunity" | "warning" | "milestone" | "seasonal";
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
      message: `${data.competitorCount} מתחרים מפרסמים על מילות המפתח שלך. מומלץ להתמקד ב-long-tail keywords.`,
      urgency: "this_week",
    });
  }

  return alerts;
}
