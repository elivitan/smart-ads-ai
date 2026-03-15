/**
 * Engine 14: Review-to-Creative Pipeline
 *
 * Extract golden phrases from product data and customer voice,
 * then inject them into ad copy. Uses AI to generate realistic
 * review-style quotes based on product features.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { extractJsonFromText } from "./utils/ai-safety.server.js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtractedPhrase {
  phrase: string;
  sentiment: string;
  frequency: number;
  keyBenefit: string;
}

interface ReviewInsightsResult {
  totalInsights: number;
  topPhrases: Array<{ phrase: string; productTitle: string; sentiment: string }>;
}

interface GeneratedAdCopy {
  headlines: string[];
  descriptions: string[];
}

interface TopPhrase {
  id: string;
  phrase: string;
  productId: string | null;
  sentiment: string;
  frequency: number;
  usedInAds: number;
  ctrWhenUsed: number | null;
  createdAt: Date;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_MODEL = "claude-haiku-4-5-20251001";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── 1. Extract Review Insights ─────────────────────────────────────────────

/**
 * Analyze top products by inventory and use AI to generate realistic
 * customer review phrases that highlight key selling points.
 * Saves extracted phrases to ReviewCreativeInsight model.
 */
export async function extractReviewInsights(shop: string): Promise<ReviewInsightsResult> {
  try {
    logger.info("review-creative", `Extracting review insights for shop ${shop}`);

    // Get top 20 products by inventory (most stocked = most important)
    const products = await prisma.product.findMany({
      where: { shop, inStock: true },
      orderBy: { inventoryTotal: "desc" },
      take: 20,
    });

    if (products.length === 0) {
      logger.info("review-creative", `No in-stock products found for shop ${shop}`);
      return { totalInsights: 0, topPhrases: [] };
    }

    let totalInsights = 0;
    const allTopPhrases: Array<{ phrase: string; productTitle: string; sentiment: string }> = [];

    // Process products in batches to avoid rate limits
    for (const product of products) {
      try {
        const prompt = `Given this product:
Title: ${product.title}
Description: ${product.description || "No description"}
Price: $${product.price}
Type: ${product.productType || "General"}
Tags: ${product.tags || "None"}

Generate 5 realistic customer review quotes that highlight key selling points. These should sound like real customer testimonials — authentic, specific, and emotional.

Return JSON only: {"phrases": [{"phrase": "<the customer quote>", "sentiment": "positive"|"neutral", "frequency": <1-5 how common this type of feedback would be>, "keyBenefit": "<the main benefit highlighted>"}]}`;

        const response = await client.messages.create({
          model: AI_MODEL,
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        });

        const responseText = response.content[0].type === "text" ? response.content[0].text : "";
        const match = extractJsonFromText(responseText);

        if (!match) {
          logger.warn("review-creative", `Failed to parse AI response for product ${product.id}`);
          continue;
        }

        const parsed = JSON.parse(match);
        const phrases: ExtractedPhrase[] = parsed.phrases || [];

        // Save each phrase to database
        for (const phraseData of phrases) {
          await prisma.reviewCreativeInsight.create({
            data: {
              shop,
              productId: product.id,
              extractedPhrase: phraseData.phrase,
              sentiment: phraseData.sentiment || "positive",
              frequency: phraseData.frequency || 1,
            },
          });

          totalInsights++;
          allTopPhrases.push({
            phrase: phraseData.phrase,
            productTitle: product.title,
            sentiment: phraseData.sentiment || "positive",
          });
        }
      } catch (err) {
        logger.warn("review-creative", `Failed to process product ${product.id}`, { extra: { error: err instanceof Error ? err.message : String(err) } });
      }
    }

    // Sort by most relevant (positive sentiment first)
    const topPhrases = allTopPhrases
      .filter((p) => p.sentiment === "positive")
      .slice(0, 20);

    logger.info("review-creative", `Extracted ${totalInsights} insights from ${products.length} products`, { extra: { shop } });

    return {
      totalInsights,
      topPhrases,
    };
  } catch (error) {
    logger.error("review-creative", "Review insight extraction failed", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 2. Generate Review-Based Ad Copy ───────────────────────────────────────

/**
 * Create ad copy for a specific product using previously extracted
 * review phrases. Incorporates authentic customer voice into headlines
 * and descriptions.
 */
export async function generateReviewBasedCopy(
  shop: string,
  productId: string,
): Promise<GeneratedAdCopy> {
  try {
    logger.info("review-creative", `Generating review-based copy for product ${productId}`, { extra: { shop } });

    // Get top phrases for this product
    const insights = await prisma.reviewCreativeInsight.findMany({
      where: { shop, productId },
      orderBy: { frequency: "desc" },
      take: 10,
    });

    if (insights.length === 0) {
      logger.info("review-creative", `No insights found for product ${productId} — generating fresh`);
      // Return basic copy if no insights exist
      return {
        headlines: ["Customers Love This Product", "Top-Rated Quality", "See Why Shoppers Choose Us"],
        descriptions: ["Join thousands of satisfied customers. Shop now and see the difference."],
      };
    }

    // Get product data
    const product = await prisma.product.findFirst({
      where: { id: productId, shop },
    });

    const productTitle = product?.title || "Product";
    const productPrice = product?.price || "0";

    // Build prompt with review phrases
    const phraseList = insights.map((i) => `"${i.extractedPhrase}" (sentiment: ${i.sentiment})`).join("\n");

    const prompt = `Create Google Ads copy for this product using authentic customer voice.

Product: ${productTitle} ($${productPrice})
${product?.description ? `Description: ${product.description}` : ""}

Customer review phrases to incorporate:
${phraseList}

Rules:
- Headlines: max 30 characters each, use customer language
- Descriptions: max 90 characters each, include social proof
- Sound authentic, not salesy
- Include at least one phrase directly from reviews

Return JSON only: {"headlines": ["<headline1>", "<headline2>", "<headline3>", "<headline4>", "<headline5>"], "descriptions": ["<desc1>", "<desc2>", "<desc3>"]}`;

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content[0].type === "text" ? response.content[0].text : "";
    const match = extractJsonFromText(responseText);

    if (!match) {
      logger.warn("review-creative", "Failed to parse ad copy response");
      return {
        headlines: ["Customers Love It", "Top Rated", "Shop Now"],
        descriptions: ["See why customers rate this product so highly. Order today."],
      };
    }

    const parsed = JSON.parse(match);
    const result: GeneratedAdCopy = {
      headlines: parsed.headlines || [],
      descriptions: parsed.descriptions || [],
    };

    // Save generated copy back to the insights
    for (const insight of insights) {
      await prisma.reviewCreativeInsight.update({
        where: { id: insight.id },
        data: {
          adCopyGenerated: JSON.stringify(result),
          usedInAds: insight.usedInAds + 1,
        },
      });
    }

    logger.info("review-creative", `Generated ${result.headlines.length} headlines, ${result.descriptions.length} descriptions`, {
      extra: { shop, productId },
    });

    return result;
  } catch (error) {
    logger.error("review-creative", "Ad copy generation failed", { extra: { shop, productId, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 3. Get Top Review Phrases ──────────────────────────────────────────────

/**
 * Get the most frequent and effective review phrases across all products.
 * Sorted by frequency and CTR performance when used in ads.
 */
export async function getTopReviewPhrases(shop: string): Promise<TopPhrase[]> {
  try {
    const phrases = await prisma.reviewCreativeInsight.findMany({
      where: {
        shop,
        sentiment: "positive",
      },
      orderBy: [
        { frequency: "desc" },
        { usedInAds: "desc" },
      ],
      take: 50,
    });

    return phrases.map((p) => ({
      id: p.id,
      phrase: p.extractedPhrase,
      productId: p.productId,
      sentiment: p.sentiment,
      frequency: p.frequency,
      usedInAds: p.usedInAds,
      ctrWhenUsed: p.ctrWhenUsed,
      createdAt: p.createdAt,
    }));
  } catch (error) {
    logger.error("review-creative", "Failed to fetch top phrases", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}
