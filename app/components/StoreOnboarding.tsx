/**
 * StoreOnboarding — 6-question business questionnaire
 *
 * Shown as a banner in the dashboard when profile is incomplete.
 * Collects: margins, audience, positioning, AOV, USP, goal.
 */

import { useState, useCallback } from "react";
import {
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  RangeSlider,
  Banner,
  ProgressBar,
  Box,
} from "@shopify/polaris";

interface StoreOnboardingProps {
  onComplete: (data: StoreProfileForm) => Promise<void>;
  initialData?: Partial<StoreProfileForm>;
}

export interface StoreProfileForm {
  profitMargin: number;
  targetAgeMin: number;
  targetAgeMax: number;
  targetGender: string;
  brandPositioning: string;
  avgOrderValue: number;
  shippingSpeed: string;
  uniqueSellingPoints: string;
  competitiveEdge: string;
  businessGoal: string;
}

const STEPS = [
  { title: "רווחיות", desc: "מה אחוז הרווח הממוצע שלך?" },
  { title: "קהל יעד", desc: "מי הלקוחות שלך?" },
  { title: "מיצוב", desc: "איך המותג שלך ממוצב?" },
  { title: "הזמנה ממוצעת", desc: "מה ערך ההזמנה הממוצע ומהירות המשלוח?" },
  { title: "יתרונות", desc: "מה מייחד אותך מהמתחרים?" },
  { title: "מטרה", desc: "מה המטרה העיקרית שלך כרגע?" },
];

export function StoreOnboarding({ onComplete, initialData }: StoreOnboardingProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<StoreProfileForm>({
    profitMargin: initialData?.profitMargin ?? 30,
    targetAgeMin: initialData?.targetAgeMin ?? 25,
    targetAgeMax: initialData?.targetAgeMax ?? 45,
    targetGender: initialData?.targetGender ?? "all",
    brandPositioning: initialData?.brandPositioning ?? "value",
    avgOrderValue: initialData?.avgOrderValue ?? 50,
    shippingSpeed: initialData?.shippingSpeed ?? "standard",
    uniqueSellingPoints: initialData?.uniqueSellingPoints ?? "",
    competitiveEdge: initialData?.competitiveEdge ?? "",
    businessGoal: initialData?.businessGoal ?? "grow_sales",
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) setStep(step + 1);
  }, [step]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    try {
      await onComplete(form);
    } finally {
      setSaving(false);
    }
  }, [form, onComplete]);

  const updateField = useCallback(
    <K extends keyof StoreProfileForm>(field: K, value: StoreProfileForm[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            הגדרת פרופיל העסק — שלב {step + 1} מתוך {STEPS.length}
          </Text>
          <Text as="span" variant="bodySm" tone="subdued">
            {STEPS[step].title}
          </Text>
        </InlineStack>

        <ProgressBar progress={progress} size="small" tone="primary" />

        <Text as="p" variant="bodyMd">
          {STEPS[step].desc}
        </Text>

        <Box paddingBlockStart="200" paddingBlockEnd="200">
          {step === 0 && (
            <BlockStack gap="300">
              <RangeSlider
                label={`אחוז רווח: ${form.profitMargin}%`}
                value={form.profitMargin}
                min={5}
                max={80}
                step={5}
                output
                onChange={(v) => updateField("profitMargin", v as number)}
              />
              <Text as="p" variant="bodySm" tone="subdued">
                זה עוזר לנו לחשב כמה אתה יכול לשלם עבור כל קליק ולהמליץ על תקציב ריאלי.
              </Text>
            </BlockStack>
          )}

          {step === 1 && (
            <BlockStack gap="300">
              <InlineStack gap="300">
                <TextField
                  label="גיל מינימלי"
                  type="number"
                  value={String(form.targetAgeMin)}
                  onChange={(v) => updateField("targetAgeMin", Number(v))}
                  autoComplete="off"
                />
                <TextField
                  label="גיל מקסימלי"
                  type="number"
                  value={String(form.targetAgeMax)}
                  onChange={(v) => updateField("targetAgeMax", Number(v))}
                  autoComplete="off"
                />
              </InlineStack>
              <Select
                label="מגדר קהל היעד"
                options={[
                  { label: "כולם", value: "all" },
                  { label: "גברים", value: "male" },
                  { label: "נשים", value: "female" },
                ]}
                value={form.targetGender}
                onChange={(v) => updateField("targetGender", v)}
              />
            </BlockStack>
          )}

          {step === 2 && (
            <Select
              label="מיצוב המותג"
              options={[
                { label: "פרימיום / יוקרה", value: "premium" },
                { label: "תמורה למחיר / משתלם", value: "value" },
                { label: "ירוק / אקולוגי", value: "eco" },
                { label: "נישה / מומחיות", value: "specialty" },
              ]}
              value={form.brandPositioning}
              onChange={(v) => updateField("brandPositioning", v)}
            />
          )}

          {step === 3 && (
            <BlockStack gap="300">
              <TextField
                label="ערך הזמנה ממוצע ($)"
                type="number"
                value={String(form.avgOrderValue)}
                onChange={(v) => updateField("avgOrderValue", Number(v))}
                autoComplete="off"
              />
              <Select
                label="מהירות משלוח"
                options={[
                  { label: "מהיר (1-2 ימים)", value: "fast" },
                  { label: "רגיל (3-5 ימים)", value: "standard" },
                  { label: "חסכוני (5+ ימים)", value: "slow" },
                ]}
                value={form.shippingSpeed}
                onChange={(v) => updateField("shippingSpeed", v)}
              />
            </BlockStack>
          )}

          {step === 4 && (
            <BlockStack gap="300">
              <TextField
                label="מה מייחד אותך? (USPs)"
                value={form.uniqueSellingPoints}
                onChange={(v) => updateField("uniqueSellingPoints", v)}
                multiline={3}
                placeholder="לדוגמה: מוצרים עבודת יד, משלוח חינם, אחריות לכל החיים..."
                autoComplete="off"
              />
              <TextField
                label="מה היתרון שלך על המתחרים?"
                value={form.competitiveEdge}
                onChange={(v) => updateField("competitiveEdge", v)}
                multiline={2}
                placeholder="לדוגמה: מחיר נמוך ב-30%, שירות לקוחות 24/7..."
                autoComplete="off"
              />
            </BlockStack>
          )}

          {step === 5 && (
            <BlockStack gap="300">
              <Select
                label="המטרה העיקרית שלך"
                options={[
                  { label: "להגדיל מכירות", value: "grow_sales" },
                  { label: "לבנות מודעות למותג", value: "build_brand" },
                  { label: "לפנות מלאי", value: "clear_inventory" },
                ]}
                value={form.businessGoal}
                onChange={(v) => updateField("businessGoal", v)}
              />
              <Banner tone="info">
                <Text as="p" variant="bodySm">
                  לאחר השלמת הפרופיל, כל ההמלצות של ה-AI יותאמו לעסק שלך — תקציבים, מילות מפתח, טקסטים, ואסטרטגיה.
                </Text>
              </Banner>
            </BlockStack>
          )}
        </Box>

        <InlineStack align="end" gap="200">
          {step > 0 && (
            <Button onClick={handleBack}>חזרה</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={handleNext}>
              הבא
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit} loading={saving}>
              שמור פרופיל
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

/**
 * Small banner prompting user to complete their profile.
 */
export function StoreOnboardingBanner({ onStart }: { onStart: () => void }) {
  return (
    <Banner
      title="השלם את פרופיל העסק שלך"
      tone="warning"
      action={{ content: "התחל עכשיו", onAction: onStart }}
    >
      <Text as="p" variant="bodySm">
        כדי שנוכל לתפקד כסוכנות פרסום אמיתית, אנחנו צריכים להכיר את העסק שלך — מרווחי רווח, קהל יעד, ומיצוב.
      </Text>
    </Banner>
  );
}
