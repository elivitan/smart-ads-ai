/**
 * Store Context — Business profile for personalized AI advice
 *
 * Provides store-level context (margins, audience, positioning)
 * to all AI prompts so recommendations are business-aware.
 */

import prisma from "./db.server.js";

// ── Types ────────────────────────────────────────────────────────────────

export interface StoreProfileData {
  profitMargin?: number | null;
  targetAgeMin?: number | null;
  targetAgeMax?: number | null;
  targetGender?: string | null;
  brandPositioning?: string | null;
  avgOrderValue?: number | null;
  shippingSpeed?: string | null;
  uniqueSellingPoints?: string | null;
  competitiveEdge?: string | null;
  businessGoal?: string | null;
}

export interface StoreContext {
  hasProfile: boolean;
  profitMargin: number | null;
  audience: string;
  positioning: string;
  avgOrderValue: number | null;
  shippingSpeed: string | null;
  uniqueSellingPoints: string | null;
  competitiveEdge: string | null;
  businessGoal: string | null;
}

// ── Get / Save ───────────────────────────────────────────────────────────

export async function getStoreProfile(shop: string) {
  return prisma.storeProfile.findUnique({ where: { shop } });
}

export async function saveStoreProfile(shop: string, data: StoreProfileData) {
  return prisma.storeProfile.upsert({
    where: { shop },
    create: {
      shop,
      ...data,
      completedAt: new Date(),
    },
    update: {
      ...data,
      completedAt: new Date(),
    },
  });
}

// ── Build context block for AI prompts ───────────────────────────────────

export async function buildStoreContext(shop: string): Promise<StoreContext> {
  const profile = await getStoreProfile(shop);

  if (!profile || !profile.completedAt) {
    return {
      hasProfile: false,
      profitMargin: null,
      audience: "unknown",
      positioning: "unknown",
      avgOrderValue: null,
      shippingSpeed: null,
      uniqueSellingPoints: null,
      competitiveEdge: null,
      businessGoal: null,
    };
  }

  const ageRange =
    profile.targetAgeMin && profile.targetAgeMax
      ? `${profile.targetAgeMin}-${profile.targetAgeMax}`
      : "all ages";
  const gender = profile.targetGender || "all";
  const audience = `${gender}, ${ageRange}`;

  return {
    hasProfile: true,
    profitMargin: profile.profitMargin,
    audience,
    positioning: profile.brandPositioning || "unknown",
    avgOrderValue: profile.avgOrderValue,
    shippingSpeed: profile.shippingSpeed,
    uniqueSellingPoints: profile.uniqueSellingPoints,
    competitiveEdge: profile.competitiveEdge,
    businessGoal: profile.businessGoal,
  };
}

/**
 * Generates a text block to inject into AI prompts.
 * Returns empty string if no profile exists.
 */
export function formatContextForPrompt(ctx: StoreContext): string {
  if (!ctx.hasProfile) return "";

  const lines: string[] = [
    "=== STORE BUSINESS CONTEXT ===",
  ];

  if (ctx.profitMargin != null) {
    lines.push(`Profit margin: ${ctx.profitMargin}%`);
    if (ctx.avgOrderValue) {
      const profitPerSale = (ctx.avgOrderValue * ctx.profitMargin) / 100;
      lines.push(
        `Profit per sale: $${profitPerSale.toFixed(2)} (AOV $${ctx.avgOrderValue} × ${ctx.profitMargin}%)`
      );
    }
  }

  if (ctx.audience !== "unknown") {
    lines.push(`Target audience: ${ctx.audience}`);
  }

  if (ctx.positioning !== "unknown") {
    const posLabels: Record<string, string> = {
      premium: "Premium / luxury positioning",
      value: "Value / affordable positioning",
      eco: "Eco-friendly / sustainable positioning",
      specialty: "Specialty / niche positioning",
    };
    lines.push(`Brand positioning: ${posLabels[ctx.positioning] || ctx.positioning}`);
  }

  if (ctx.shippingSpeed) {
    const speedLabels: Record<string, string> = {
      fast: "Fast shipping (1-2 days)",
      standard: "Standard shipping (3-5 days)",
      slow: "Economy shipping (5+ days)",
    };
    lines.push(`Shipping: ${speedLabels[ctx.shippingSpeed] || ctx.shippingSpeed}`);
  }

  if (ctx.uniqueSellingPoints) {
    lines.push(`Unique selling points: ${ctx.uniqueSellingPoints}`);
  }

  if (ctx.competitiveEdge) {
    lines.push(`Competitive edge: ${ctx.competitiveEdge}`);
  }

  if (ctx.businessGoal) {
    const goalLabels: Record<string, string> = {
      grow_sales: "Primary goal: Grow sales volume",
      build_brand: "Primary goal: Build brand awareness",
      clear_inventory: "Primary goal: Clear excess inventory",
    };
    lines.push(goalLabels[ctx.businessGoal] || `Goal: ${ctx.businessGoal}`);
  }

  lines.push("=== END STORE CONTEXT ===");
  return lines.join("\n");
}
