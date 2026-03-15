/**
 * Engine 15: Algorithmic Price-Drop & Bid Spiking
 *
 * Synchronized flash sales: auto-detect slow inventory,
 * drop price, spike bids, generate urgent ad copy.
 */

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGH_INVENTORY_THRESHOLD = 100;
const TOP_CANDIDATES = 10;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlashSaleCandidate {
  productId: string;
  title: string;
  currentPrice: number;
  suggestedDiscount: number;
  reason: string;
}

interface FlashSaleAdCopy {
  headlines: string[];
  descriptions: string[];
}

interface FlashSaleResult {
  eventId: string;
  salePrice: number;
  adCopy: FlashSaleAdCopy;
  startsAt: Date;
  endsAt: Date;
}

interface ExpiredSalesResult {
  expired: number;
  totalRevenue: number;
}

// ─── 1. Detect Flash Sale Candidates ──────────────────────────────────────────

/**
 * Find products needing flash sales based on high inventory,
 * low recent sales, and overstock alerts.
 */
export async function detectFlashSaleCandidates(
  shop: string,
): Promise<FlashSaleCandidate[]> {
  try {
    logger.info("flash-sale", "Detecting flash sale candidates", { shop });

    // Get products with high inventory
    const products = await prisma.product.findMany({
      where: {
        shop,
        inventoryTotal: { gt: HIGH_INVENTORY_THRESHOLD },
        inStock: true,
      },
    });

    if (products.length === 0) {
      logger.info("flash-sale", "No high-inventory products found", { shop });
      return [];
    }

    // Cross-reference with overstock inventory alerts
    const overstockAlerts = await prisma.inventoryAlert.findMany({
      where: {
        shop,
        alertType: "overstock",
        resolved: false,
      },
    });

    const overstockProductIds = new Set(
      overstockAlerts.map((a) => a.productId),
    );

    // Check for completed campaign jobs to estimate recent sales
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentJobs = await prisma.campaignJob.findMany({
      where: {
        shop,
        state: "DONE",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Build a map of product -> recent job count (proxy for sales)
    const productJobCounts = new Map<string, number>();
    for (const job of recentJobs) {
      try {
        const payload = JSON.parse(job.payload || "{}");
        if (payload.productId) {
          productJobCounts.set(
            payload.productId,
            (productJobCounts.get(payload.productId) || 0) + 1,
          );
        }
      } catch {
        // skip malformed payloads
      }
    }

    // Score each product
    const scored: Array<FlashSaleCandidate & { score: number }> = [];

    for (const product of products) {
      const price = parseFloat(product.price) || 0;
      if (price <= 0) continue;

      const isOverstock = overstockProductIds.has(product.id);
      const recentSales = productJobCounts.get(product.id) || 0;
      const daysSinceLastSale = recentSales === 0 ? 30 : Math.max(1, 30 / recentSales);

      // Score: overstock severity + days since last sale + margin room
      let score = 0;
      const overstockSeverity = Math.min(50, (product.inventoryTotal - HIGH_INVENTORY_THRESHOLD) / 10);
      score += overstockSeverity;
      score += Math.min(30, daysSinceLastSale);
      if (isOverstock) score += 20;

      // Suggest discount based on score
      let suggestedDiscount: number;
      let reason: string;

      if (score > 60) {
        suggestedDiscount = 30;
        reason = `Critical overstock: ${product.inventoryTotal} units, ${recentSales} sales in 30 days`;
      } else if (score > 40) {
        suggestedDiscount = 20;
        reason = `High inventory: ${product.inventoryTotal} units with slow movement`;
      } else {
        suggestedDiscount = 15;
        reason = `Moderate overstock: ${product.inventoryTotal} units, consider promotional push`;
      }

      scored.push({
        productId: product.id,
        title: product.title,
        currentPrice: price,
        suggestedDiscount,
        reason,
        score,
      });
    }

    // Sort by score descending and take top candidates
    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, TOP_CANDIDATES).map(({ score: _score, ...rest }) => rest);

    logger.info("flash-sale", `Found ${candidates.length} flash sale candidates`, {
      shop,
      extra: { total: products.length, candidates: candidates.length },
    });

    return candidates;
  } catch (err) {
    logger.error("flash-sale", "Failed to detect flash sale candidates", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 2. Create Flash Sale ─────────────────────────────────────────────────────

/**
 * Launch a flash sale for a product: calculate sale price,
 * generate urgent ad copy via Claude, save event.
 */
export async function createFlashSale(
  shop: string,
  productId: string,
  discountPct: number,
  durationHours: number,
): Promise<FlashSaleResult> {
  try {
    logger.info("flash-sale", "Creating flash sale", {
      shop,
      extra: { productId, discountPct, durationHours },
    });

    const product = await prisma.product.findFirst({
      where: { id: productId, shop },
    });

    if (!product) {
      throw new Error(`Product ${productId} not found for shop ${shop}`);
    }

    const originalPrice = parseFloat(product.price) || 0;
    if (originalPrice <= 0) {
      throw new Error(`Product ${productId} has invalid price`);
    }

    const salePrice = Math.round(originalPrice * (1 - discountPct / 100) * 100) / 100;

    // Generate urgent ad copy via Claude
    const prompt = `Product: ${product.title}, Original: $${originalPrice.toFixed(2)}, Now: $${salePrice.toFixed(2)}. Create 3 flash sale headlines (max 30 chars) and 2 descriptions (max 90 chars) with urgency triggers. Return JSON: {headlines[], descriptions[]}`;

    let adCopy: FlashSaleAdCopy = { headlines: [], descriptions: [] };

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        adCopy = JSON.parse(match[0]) as FlashSaleAdCopy;
      }
    } catch (aiErr) {
      logger.error("flash-sale", "AI ad copy generation failed, using defaults", {
        shop,
        error: aiErr,
        extra: { productId },
      });
      adCopy = {
        headlines: [
          `${discountPct}% OFF - Limited Time!`,
          `Flash Sale: ${product.title.slice(0, 15)}`,
          "Sale Ends Soon!",
        ],
        descriptions: [
          `Save ${discountPct}% on ${product.title.slice(0, 40)}. Limited time flash sale!`,
          `Was $${originalPrice.toFixed(2)}, now $${salePrice.toFixed(2)}. Don't miss out!`,
        ],
      };
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000);

    // Save to FlashSaleEvent
    const event = await prisma.flashSaleEvent.create({
      data: {
        shop,
        productId,
        productTitle: product.title,
        triggerReason: "slow_moving",
        originalPrice,
        salePrice,
        discountPct,
        budgetMultiplier: 2.0,
        adCopyOverride: JSON.stringify(adCopy),
        status: "active",
        startsAt,
        endsAt,
      },
    });

    logger.info("flash-sale", `Flash sale created: ${event.id}`, {
      shop,
      extra: {
        productId,
        originalPrice,
        salePrice,
        discountPct,
        durationHours,
      },
    });

    return {
      eventId: event.id,
      salePrice,
      adCopy,
      startsAt,
      endsAt,
    };
  } catch (err) {
    logger.error("flash-sale", "Failed to create flash sale", {
      shop,
      error: err,
      extra: { productId },
    });
    throw err;
  }
}

// ─── 3. Check Expired Flash Sales ────────────────────────────────────────────

/**
 * End expired flash sales and restore prices.
 * Returns how many expired and total revenue generated.
 */
export async function checkExpiredFlashSales(
  shop: string,
): Promise<ExpiredSalesResult> {
  try {
    logger.info("flash-sale", "Checking expired flash sales", { shop });

    const now = new Date();

    const expiredEvents = await prisma.flashSaleEvent.findMany({
      where: {
        shop,
        status: "active",
        endsAt: { lt: now },
      },
    });

    if (expiredEvents.length === 0) {
      logger.info("flash-sale", "No expired flash sales found", { shop });
      return { expired: 0, totalRevenue: 0 };
    }

    let totalRevenue = 0;

    for (const event of expiredEvents) {
      await prisma.flashSaleEvent.update({
        where: { id: event.id },
        data: { status: "completed" },
      });

      totalRevenue += event.revenueGenerated;
    }

    logger.info("flash-sale", `Completed ${expiredEvents.length} expired flash sales`, {
      shop,
      extra: { expired: expiredEvents.length, totalRevenue },
    });

    return { expired: expiredEvents.length, totalRevenue };
  } catch (err) {
    logger.error("flash-sale", "Failed to check expired flash sales", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 4. Get Active Flash Sales ───────────────────────────────────────────────

/**
 * Get all currently running flash sales for the shop.
 */
export async function getActiveFlashSales(shop: string) {
  try {
    logger.info("flash-sale", "Fetching active flash sales", { shop });

    const activeSales = await prisma.flashSaleEvent.findMany({
      where: {
        shop,
        status: "active",
      },
      orderBy: { endsAt: "asc" },
    });

    logger.info("flash-sale", `Found ${activeSales.length} active flash sales`, {
      shop,
    });

    return activeSales;
  } catch (err) {
    logger.error("flash-sale", "Failed to fetch active flash sales", {
      shop,
      error: err,
    });
    throw err;
  }
}
