// Engine 6: Buyer Psychology
// Emotional trigger analysis and buyer motivation matching
// NOTE: The main analyzeEmotionalTriggers and generatePsychologyOptimizedCopy
// functions live in ai-brain.server.ts. This file contains the
// matchBuyerMotivation function that queries existing BuyerPsychology records.

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MotivationMatch {
  productId: string;
  title: string;
  motivation: string;
  currentAdMatch: number; // 0-100 score
  suggestedChange: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  "urgency",
  "social_proof",
  "fear_of_missing",
  "aspiration",
  "trust",
  "value",
] as const;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── 1. Match Buyer Motivation ───────────────────────────────────────────────

/**
 * For each analyzed product, assess whether the current ad copy matches
 * the dominant buyer motivation. Returns an array of products with their
 * dominant motivation, match score, and suggested copy changes.
 */
export async function matchBuyerMotivation(shop: string): Promise<MotivationMatch[]> {
  try {
    logger.info("buyer-psychology", `Matching buyer motivations for shop ${shop}`);

    // Fetch all products with their AI analysis (ad copy data)
    const products = await prisma.product.findMany({
      where: { shop },
      include: { aiAnalysis: true },
    });

    if (products.length === 0) {
      logger.info("buyer-psychology", `No products found for shop ${shop}`);
      return [];
    }

    // Fetch all buyer psychology records for this shop
    const psychologyRecords = await prisma.buyerPsychology.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });

    if (psychologyRecords.length === 0) {
      logger.info("buyer-psychology", `No psychology records found for shop ${shop}. Run analyzeEmotionalTriggers first.`);
      return [];
    }

    // Group psychology records by productId
    const psychologyByProduct = new Map<string, typeof psychologyRecords>();
    const globalRecords: typeof psychologyRecords = [];

    for (const record of psychologyRecords) {
      if (record.productId) {
        const existing = psychologyByProduct.get(record.productId) || [];
        existing.push(record);
        psychologyByProduct.set(record.productId, existing);
      } else {
        globalRecords.push(record);
      }
    }

    const results: MotivationMatch[] = [];

    for (const product of products) {
      // Get psychology records for this specific product, or fall back to global ones
      const productPsychology = psychologyByProduct.get(product.id) || globalRecords;

      if (productPsychology.length === 0) continue;

      // Determine the dominant motivation (highest effectiveness trigger)
      const dominantTrigger = productPsychology.reduce((best, current) => {
        const currentEff = current.effectiveness ?? 0;
        const bestEff = best.effectiveness ?? 0;
        return currentEff > bestEff ? current : best;
      }, productPsychology[0]);

      const motivation = dominantTrigger.triggerType;
      const bestPhrase = dominantTrigger.triggerPhrase;

      // Assess how well the current ad copy matches this motivation
      const adCopy = buildAdCopyText(product);
      const matchScore = assessMotivationMatch(adCopy, motivation, bestPhrase);

      // Generate suggestion based on the gap
      const suggestedChange = generateSuggestion(
        motivation,
        matchScore,
        bestPhrase,
        product.title,
      );

      results.push({
        productId: product.id,
        title: product.title,
        motivation,
        currentAdMatch: matchScore,
        suggestedChange,
      });
    }

    // Sort by match score ascending (worst matches first — most opportunity)
    results.sort((a, b) => a.currentAdMatch - b.currentAdMatch);

    logger.info(
      "buyer-psychology",
      `Matched buyer motivations for ${results.length} products in shop ${shop}`,
    );

    return results;
  } catch (error) {
    logger.error("buyer-psychology", `Failed to match buyer motivations for shop ${shop}: ${error}`);
    throw error;
  }
}

// ─── 2. Analyze Emotional Triggers ──────────────────────────────────────────

/**
 * Analyze emotional triggers for a product using AI.
 */
export async function analyzeEmotionalTriggers(shop: string, productId: string): Promise<Array<{ type: string; phrase: string; effectiveness: number }>> {
  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, shop },
      include: { aiAnalysis: true },
    });

    if (!product) return [];

    const adCopy = product.aiAnalysis
      ? `${product.aiAnalysis.headlines || ""} ${product.aiAnalysis.descriptions || ""}`
      : product.title;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: `Analyze emotional buying triggers for this product ad.

Product: "${product.title}"
Ad copy: "${adCopy}"
Price: $${product.price || "N/A"}

For each trigger type (urgency, social_proof, fear_of_missing, aspiration, trust, value), provide a specific phrase and effectiveness score (0-1).

Return JSON: { "triggers": [{ "type": "...", "phrase": "...", "effectiveness": 0.0-1.0 }] }` }],
    });

    const text = (response as any).content[0].text;
    let parsed: any;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { triggers: [] };
    } catch { parsed = { triggers: [] }; }

    const triggers = Array.isArray(parsed.triggers) ? parsed.triggers : [];

    // Save to DB
    for (const t of triggers) {
      if (!t.type || !t.phrase) continue;
      await prisma.buyerPsychology.create({
        data: {
          shop,
          productId,
          triggerType: t.type,
          triggerPhrase: t.phrase,
          effectiveness: t.effectiveness ?? null,
          usedInAds: 0,
        },
      });
    }

    return triggers.map((t: any) => ({ type: t.type, phrase: t.phrase, effectiveness: t.effectiveness || 0 }));
  } catch (err: any) {
    logger.error("buyer-psychology", `analyzeEmotionalTriggers failed: ${err.message}`);
    return [];
  }
}

// ─── 3. Generate Psychology-Optimized Copy ──────────────────────────────────

/**
 * Generate ad copy optimized for buyer psychology triggers.
 */
export async function generatePsychologyOptimizedCopy(shop: string, productId: string): Promise<{ headlines: string[]; descriptions: string[] }> {
  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, shop },
    });

    if (!product) return { headlines: [], descriptions: [] };

    // Get top triggers for this product
    const triggers = await prisma.buyerPsychology.findMany({
      where: { shop, productId },
      orderBy: { effectiveness: "desc" },
      take: 3,
    });

    const triggerContext = triggers.length > 0
      ? triggers.map(t => `${t.triggerType}: "${t.triggerPhrase}" (effectiveness: ${t.effectiveness})`).join("\n")
      : "No trigger data available — use general best practices";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: `You are a Google Ads copywriter who uses buyer psychology. Create ad copy for this product using the proven emotional triggers.

Product: "${product.title}"
Price: $${product.price || "N/A"}

TOP EMOTIONAL TRIGGERS:
${triggerContext}

Return JSON:
{
  "headlines": ["h1", "h2", "h3"],    // max 30 chars each
  "descriptions": ["d1", "d2"]         // max 90 chars each
}

Each headline/description MUST leverage at least one emotional trigger.` }],
    });

    const text = (response as any).content[0].text;
    let parsed: any;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { headlines: [], descriptions: [] };
    } catch { parsed = { headlines: [], descriptions: [] }; }

    return {
      headlines: (parsed.headlines || []).map((h: string) => h.slice(0, 30)),
      descriptions: (parsed.descriptions || []).map((d: string) => d.slice(0, 90)),
    };
  } catch (err: any) {
    logger.error("buyer-psychology", `generatePsychologyOptimizedCopy failed: ${err.message}`);
    return { headlines: [], descriptions: [] };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a concatenated string of all ad copy elements for a product.
 */
function buildAdCopyText(product: {
  title: string;
  description: string;
  aiAnalysis?: {
    headlines?: string | null;
    descriptions?: string | null;
    adCopy?: string | null;
  } | null;
}): string {
  const parts: string[] = [product.title, product.description];

  if (product.aiAnalysis) {
    if (product.aiAnalysis.headlines) parts.push(product.aiAnalysis.headlines);
    if (product.aiAnalysis.descriptions) parts.push(product.aiAnalysis.descriptions);
    if (product.aiAnalysis.adCopy) parts.push(product.aiAnalysis.adCopy);
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

/**
 * Assess how well ad copy matches a given buyer motivation using keyword analysis.
 * Returns a score from 0-100.
 */
function assessMotivationMatch(
  adCopy: string,
  motivation: string,
  triggerPhrase: string,
): number {
  const lowerCopy = adCopy.toLowerCase();
  const lowerPhrase = triggerPhrase.toLowerCase();

  // Base score: does the ad copy contain the trigger phrase directly?
  let score = 0;

  if (lowerCopy.includes(lowerPhrase)) {
    score += 40;
  }

  // Check for motivation-specific keywords
  const motivationKeywords: Record<string, string[]> = {
    urgency: ["limited", "hurry", "now", "today", "last chance", "ending soon", "don't wait", "act fast", "only"],
    social_proof: ["trusted", "reviews", "customers", "bestseller", "popular", "rated", "#1", "thousands", "loved by"],
    fear_of_missing: ["exclusive", "rare", "selling fast", "almost gone", "few left", "don't miss", "limited edition"],
    aspiration: ["transform", "dream", "premium", "luxury", "elevate", "upgrade", "best", "ultimate", "perfect"],
    trust: ["guaranteed", "certified", "secure", "proven", "warranty", "money-back", "risk-free", "authentic"],
    value: ["save", "deal", "discount", "affordable", "free shipping", "bonus", "bundle", "best price", "cheap"],
  };

  const keywords = motivationKeywords[motivation] || [];
  let keywordMatches = 0;

  for (const keyword of keywords) {
    if (lowerCopy.includes(keyword)) {
      keywordMatches++;
    }
  }

  // Each keyword match adds up to 8 points (max 5 keywords = 40 points)
  score += Math.min(40, keywordMatches * 8);

  // Bonus for having the trigger type mentioned in any form
  if (lowerCopy.includes(motivation.replace(/_/g, " "))) {
    score += 10;
  }

  // Bonus for ad copy length (longer copy has more opportunity to match)
  if (adCopy.length > 200) score += 5;
  if (adCopy.length > 500) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * Generate a human-readable suggestion for improving the ad copy based on
 * the motivation gap.
 */
function generateSuggestion(
  motivation: string,
  matchScore: number,
  triggerPhrase: string,
  productTitle: string,
): string {
  const motivationLabel = motivation.replace(/_/g, " ");

  if (matchScore >= 80) {
    return `Ad copy for "${productTitle}" already aligns well with ${motivationLabel} motivation. Keep using phrases like "${triggerPhrase}".`;
  }

  if (matchScore >= 50) {
    return `Ad copy for "${productTitle}" partially matches ${motivationLabel} motivation. Strengthen by incorporating: "${triggerPhrase}" more prominently in headlines.`;
  }

  if (matchScore >= 20) {
    return `Ad copy for "${productTitle}" weakly matches the dominant ${motivationLabel} motivation. Rewrite headlines to lead with: "${triggerPhrase}" and add supporting ${motivationLabel} elements.`;
  }

  return `Ad copy for "${productTitle}" does not leverage the ${motivationLabel} motivation at all. The most effective trigger is: "${triggerPhrase}". Consider a complete ad copy refresh centered on this emotional driver.`;
}
