/**
 * OptimizationFeed — Shows auto-optimization activity
 *
 * Displays what the AI "agency" has been doing:
 * - Recent actions (paused campaign, adjusted budget, etc.)
 * - Stats summary
 * - Manual trigger button
 */

import { useState, useCallback } from "react";
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Banner,
  SkeletonBodyText,
} from "@shopify/polaris";

interface OptAction {
  id: string;
  action: string;
  campaignName: string;
  reason: string;
  narrative?: string | null;
  previousValue?: string;
  newValue?: string;
  aiGrade?: string;
  success: boolean;
  createdAt: string;
}

interface OptStats {
  totalAllTime: number;
  last7Days: number;
  byAction: Array<{ action: string; count: number }>;
}

interface OptimizationFeedProps {
  history: OptAction[];
  stats: OptStats;
  onRunOptimization?: () => Promise<any>;
}

const ACTION_LABELS: Record<string, { label: string; tone: "success" | "warning" | "critical" | "info" }> = {
  pause_campaign: { label: "השהיית קמפיין", tone: "warning" as const },
  enable_campaign: { label: "הפעלת קמפיין", tone: "success" as const },
  adjust_budget: { label: "התאמת תקציב", tone: "info" as const },
  pause_keyword: { label: "השהיית מילת מפתח", tone: "warning" as const },
};

export function OptimizationFeed({ history, stats, onRunOptimization }: OptimizationFeedProps) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  const handleRun = useCallback(async () => {
    if (!onRunOptimization || running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const result = await onRunOptimization();
      setRunResult(result);
    } catch {
      setRunResult({ error: true });
    } finally {
      setRunning(false);
    }
  }, [onRunOptimization, running]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            סוכנות AI — פעולות אוטומטיות
          </Text>
          <InlineStack gap="200">
            <Badge tone="info">{`${stats.last7Days} פעולות ב-7 ימים`}</Badge>
            {onRunOptimization && (
              <Button
                onClick={handleRun}
                loading={running}
                size="slim"
              >
                הרץ אופטימיזציה
              </Button>
            )}
          </InlineStack>
        </InlineStack>

        {runResult && !runResult.error && (
          <Banner
            title={`אופטימיזציה הושלמה — ${runResult.actionsExecuted || 0} פעולות בוצעו`}
            tone="success"
            onDismiss={() => setRunResult(null)}
          />
        )}

        {runResult?.error && (
          <Banner
            title="שגיאה בהרצת אופטימיזציה"
            tone="critical"
            onDismiss={() => setRunResult(null)}
          />
        )}

        {running && <SkeletonBodyText lines={3} />}

        {!running && history.length === 0 && (
          <Text as="p" tone="subdued">
            עדיין לא בוצעו פעולות אוטומטיות. המערכת בודקת כל 6 שעות.
          </Text>
        )}

        {!running && history.length > 0 && (
          <BlockStack gap="200">
            {history.slice(0, 10).map((item) => {
              const actionInfo = ACTION_LABELS[item.action] || {
                label: item.action,
                tone: "info" as const,
              };
              const timeAgo = getTimeAgo(item.createdAt);

              return (
                <InlineStack key={item.id} align="space-between" blockAlign="center" wrap={false}>
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone={item.success ? actionInfo.tone : "critical"}>
                      {actionInfo.label}
                    </Badge>
                    <BlockStack gap="0">
                      <Text as="span" variant="bodySm" fontWeight="semibold">
                        {item.campaignName}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {(item.narrative || item.reason).length > 100
                          ? (item.narrative || item.reason).substring(0, 100) + "..."
                          : (item.narrative || item.reason)}
                      </Text>
                    </BlockStack>
                  </InlineStack>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {timeAgo}
                  </Text>
                </InlineStack>
              );
            })}
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "עכשיו";
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  const diffDays = Math.floor(diffHours / 24);
  return `לפני ${diffDays} ימים`;
}
