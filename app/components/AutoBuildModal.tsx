/**
 * AutoBuildModal — AI builds a complete campaign
 *
 * Two modes:
 * - Auto: AI picks products, researches, writes ads, sets budget → "Approve & Launch"
 * - Manual: AI shows analysis + recommendations → user picks, edits, confirms
 */

import { useState, useCallback } from "react";
import {
  Modal,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Banner,
  ProgressBar,
  Spinner,
  Box,
} from "@shopify/polaris";

interface AutoBuildProduct {
  id: string;
  title: string;
  price: string;
  score: number;
  reason: string;
}

interface AutoBuildResult {
  products: AutoBuildProduct[];
  strategy: {
    approach: string;
    budgetRecommended: number;
    budgetMin: number;
    keywords: Array<{ text: string; matchType: string }>;
    headlines: string[];
    descriptions: string[];
  };
  estimatedResults: {
    monthlyClicks: string;
    monthlyCost: string;
    estimatedRoas: string;
  };
}

interface AutoBuildModalProps {
  open: boolean;
  onClose: () => void;
  mode: "auto" | "manual";
  onBuild: () => Promise<AutoBuildResult>;
  onLaunch: (result: AutoBuildResult) => Promise<void>;
}

const STEPS = [
  { label: "בוחר מוצרים מתאימים", emoji: "🔍" },
  { label: "חוקר מתחרים ושוק", emoji: "📊" },
  { label: "כותב מודעות ממירות", emoji: "✍️" },
  { label: "מחשב תקציב אופטימלי", emoji: "💰" },
];

export function AutoBuildModal({ open, onClose, mode, onBuild, onLaunch }: AutoBuildModalProps) {
  const [phase, setPhase] = useState<"idle" | "building" | "review" | "launching" | "done">("idle");
  const [buildStep, setBuildStep] = useState(0);
  const [result, setResult] = useState<AutoBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStart = useCallback(async () => {
    setPhase("building");
    setBuildStep(0);
    setError(null);

    // Simulate step progress
    const stepInterval = setInterval(() => {
      setBuildStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 3000);

    try {
      const data = await onBuild();
      clearInterval(stepInterval);
      setBuildStep(STEPS.length);
      setResult(data);
      setPhase("review");
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "שגיאה בבניית הקמפיין");
      setPhase("idle");
    }
  }, [onBuild]);

  const handleLaunch = useCallback(async () => {
    if (!result) return;
    setPhase("launching");
    try {
      await onLaunch(result);
      setPhase("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "שגיאה בהפעלת הקמפיין");
      setPhase("review");
    }
  }, [result, onLaunch]);

  const handleClose = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
    setBuildStep(0);
    onClose();
  }, [onClose]);

  const isAuto = mode === "auto";
  const title = isAuto
    ? "AI בונה קמפיין אוטומטי"
    : "AI ממליץ על קמפיין";

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <Modal.Section>
        <BlockStack gap="400">
          {/* Error */}
          {error && (
            <Banner title="שגיאה" tone="critical" onDismiss={() => setError(null)}>
              <Text as="p" variant="bodySm">{error}</Text>
            </Banner>
          )}

          {/* Idle — start button */}
          {phase === "idle" && (
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                {isAuto
                  ? "הסוכנות תבחר את המוצרים הטובים ביותר, תחקור מתחרים, תכתוב מודעות ותגדיר תקציב — הכל אוטומטי."
                  : "הסוכנות תנתח את המוצרים שלך ותציע קמפיין מותאם. אתה תבחר ותאשר כל שלב."}
              </Text>
              <Button variant="primary" onClick={handleStart} fullWidth>
                {isAuto ? "התחל בנייה אוטומטית" : "התחל ניתוח"}
              </Button>
            </BlockStack>
          )}

          {/* Building — animated steps */}
          {phase === "building" && (
            <BlockStack gap="300">
              <ProgressBar progress={(buildStep / STEPS.length) * 100} size="small" tone="primary" />
              {STEPS.map((step, i) => (
                <InlineStack key={i} gap="200" blockAlign="center">
                  <Text as="span" variant="bodyMd">
                    {i < buildStep ? "✅" : i === buildStep ? step.emoji : "⏳"}
                  </Text>
                  <Text
                    as="span"
                    variant="bodySm"
                    fontWeight={i === buildStep ? "semibold" : "regular"}
                    tone={i < buildStep ? "subdued" : undefined}
                  >
                    {step.label}
                  </Text>
                  {i === buildStep && <Spinner size="small" />}
                </InlineStack>
              ))}
            </BlockStack>
          )}

          {/* Review — show results */}
          {phase === "review" && result && (
            <BlockStack gap="400">
              {/* Selected products */}
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  {`מוצרים שנבחרו (${result.products.length})`}
                </Text>
                {result.products.map((p) => (
                  <Box key={p.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="0">
                        <Text as="span" variant="bodySm" fontWeight="semibold">{p.title}</Text>
                        <Text as="span" variant="bodySm" tone="subdued">{p.reason}</Text>
                      </BlockStack>
                      <Badge tone="success">{`${p.score}/100`}</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>

              {/* Strategy summary */}
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">אסטרטגיה</Text>
                <InlineStack gap="200">
                  <Badge>{result.strategy.approach}</Badge>
                  <Badge tone="info">{`$${result.strategy.budgetRecommended}/יום`}</Badge>
                  <Badge>{`${result.strategy.keywords.length} מילות מפתח`}</Badge>
                </InlineStack>
              </BlockStack>

              {/* Estimated results */}
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">תוצאות צפויות</Text>
                <InlineStack gap="300">
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">קליקים/חודש</Text>
                    <Text as="span" variant="bodyMd" fontWeight="bold">{result.estimatedResults.monthlyClicks}</Text>
                  </BlockStack>
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">עלות/חודש</Text>
                    <Text as="span" variant="bodyMd" fontWeight="bold">{result.estimatedResults.monthlyCost}</Text>
                  </BlockStack>
                  <BlockStack gap="0">
                    <Text as="span" variant="bodySm" tone="subdued">ROAS צפוי</Text>
                    <Text as="span" variant="bodyMd" fontWeight="bold">{result.estimatedResults.estimatedRoas}</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>

              {/* Actions */}
              <InlineStack gap="200" align="end">
                <Button onClick={handleClose}>ביטול</Button>
                <Button variant="primary" onClick={handleLaunch}>
                  {isAuto ? "אשר והפעל" : "אשר ובנה קמפיין"}
                </Button>
              </InlineStack>
            </BlockStack>
          )}

          {/* Launching */}
          {phase === "launching" && (
            <InlineStack gap="200" blockAlign="center" align="center">
              <Spinner size="large" />
              <Text as="p" variant="bodyMd">מפעיל את הקמפיין...</Text>
            </InlineStack>
          )}

          {/* Done */}
          {phase === "done" && (
            <BlockStack gap="300">
              <Banner title="הקמפיין הופעל בהצלחה!" tone="success" />
              <Text as="p" variant="bodyMd">
                הסוכנות תעקוב אחרי הביצועים ותבצע אופטימיזציות {isAuto ? "אוטומטית" : "ותציע המלצות"}.
              </Text>
              <Button variant="primary" onClick={handleClose}>סגור</Button>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
