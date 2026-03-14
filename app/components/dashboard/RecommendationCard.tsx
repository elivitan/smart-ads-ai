/**
 * RecommendationCard — Shows pending optimization recommendations
 *
 * Displayed for manual campaigns only.
 * User can approve or dismiss each recommendation.
 */

import { useState, useCallback } from "react";
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Box,
} from "@shopify/polaris";

interface Recommendation {
  id: string;
  campaignName: string;
  action: string;
  reason: string;
  narrative?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  aiGrade?: string | null;
  createdAt: string;
}

interface RecommendationCardProps {
  recommendations: Recommendation[];
  onApprove: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

const ACTION_LABELS: Record<string, string> = {
  pause_campaign: "השהיית קמפיין",
  enable_campaign: "הפעלת קמפיין",
  adjust_budget: "התאמת תקציב",
  pause_keyword: "השהיית מילת מפתח",
};

export function RecommendationCard({ recommendations, onApprove, onDismiss }: RecommendationCardProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleApprove = useCallback(async (id: string) => {
    setLoadingId(id);
    try {
      await onApprove(id);
    } finally {
      setLoadingId(null);
    }
  }, [onApprove]);

  const handleDismiss = useCallback(async (id: string) => {
    setLoadingId(id);
    try {
      await onDismiss(id);
    } finally {
      setLoadingId(null);
    }
  }, [onDismiss]);

  if (recommendations.length === 0) return null;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            המלצות ממתינות לאישור
          </Text>
          <Badge tone="attention">{`${recommendations.length} המלצות`}</Badge>
        </InlineStack>

        {recommendations.map((rec) => {
          const isLoading = loadingId === rec.id;
          return (
            <Box
              key={rec.id}
              padding="300"
              borderRadius="200"
              background="bg-surface-secondary"
            >
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Badge tone="warning">
                      {ACTION_LABELS[rec.action] || rec.action}
                    </Badge>
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      {rec.campaignName}
                    </Text>
                  </InlineStack>
                  {rec.aiGrade && (
                    <Badge tone="info">{`ציון: ${rec.aiGrade}`}</Badge>
                  )}
                </InlineStack>

                {/* Narrative — human-like explanation */}
                <Text as="p" variant="bodyMd">
                  {rec.narrative || rec.reason}
                </Text>

                {/* Values */}
                {(rec.previousValue || rec.newValue) && (
                  <InlineStack gap="200">
                    {rec.previousValue && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {`נוכחי: ${rec.previousValue}`}
                      </Text>
                    )}
                    {rec.newValue && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        {`מוצע: ${rec.newValue}`}
                      </Text>
                    )}
                  </InlineStack>
                )}

                {/* Action buttons */}
                <InlineStack gap="200" align="end">
                  <Button
                    onClick={() => handleDismiss(rec.id)}
                    loading={isLoading}
                    size="slim"
                  >
                    דחה
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleApprove(rec.id)}
                    loading={isLoading}
                    size="slim"
                  >
                    אשר ובצע
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          );
        })}
      </BlockStack>
    </Card>
  );
}
