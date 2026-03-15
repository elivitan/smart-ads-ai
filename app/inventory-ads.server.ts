/**
 * Inventory-Aware Ads Engine
 *
 * Automatically adjusts Google Ads campaign budgets based on
 * real-time inventory levels and sales velocity.
 *
 * - Low stock products: throttle campaign spend by 50%
 * - Overstocked products: boost campaign spend by 30%
 * - Stockout prediction: estimate days until out-of-stock
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { updateCampaignBudget, listSmartAdsCampaigns } from "./google-ads.server.js";

// ── Thresholds ───────────────────────────────────────────────────────────
const LOW_STOCK_THRESHOLD = 10;
const OVERSTOCK_THRESHOLD = 100;
const OVERSTOCK_MAX_DAILY_SALES_RATE = 2;
const THROTTLE_FACTOR = 0.7; // reduce budget by 30% (matches updateCampaignBudget min allowed)
const BOOST_FACTOR = 1.3;    // increase budget by 30%
const DEFAULT_LOOKBACK_DAYS = 30;

// ── Types ────────────────────────────────────────────────────────────────
interface ProductInventoryInfo {
  id: string;
  shop: string;
  title: string;
  shopifyProductId?: string;
  price: string;
  inventoryTotal: number;
  inStock: boolean;
  dailySalesRate: number;
}

interface InventoryScanResult {
  lowStock: ProductInventoryInfo[];
  overstock: ProductInventoryInfo[];
  healthy: ProductInventoryInfo[];
  scannedAt: string;
  totalProducts: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Estimate daily sales rate for a product.
 * Uses order history from the past 30 days if available,
 * otherwise falls back to a price-based heuristic.
 */
async function estimateDailySalesRate(
  shop: string,
  productId: string,
  price: string,
): Promise<number> {
  try {
    // Try to derive rate from campaign job completion history as a proxy
    // for order volume (actual Shopify orders would be ideal but we use
    // what the current schema provides).
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DEFAULT_LOOKBACK_DAYS);

    const completedJobs = await prisma.campaignJob.findMany({
      where: {
        shop,
        state: "DONE",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Count jobs whose payload references this product
    const relevantJobs = completedJobs.filter((job) => {
      try {
        const payload = JSON.parse(job.payload || "{}");
        return payload.productId === productId;
      } catch {
        return false;
      }
    });

    if (relevantJobs.length > 0) {
      // Use job count as a rough proxy for sales volume
      return relevantJobs.length / DEFAULT_LOOKBACK_DAYS;
    }

    // Fallback: estimate from price bracket
    // Higher-priced items generally sell fewer units per day
    const numericPrice = parseFloat(price) || 0;
    if (numericPrice > 200) return 0.3;
    if (numericPrice > 100) return 0.5;
    if (numericPrice > 50) return 1;
    if (numericPrice > 20) return 2;
    return 3;
  } catch (err) {
    logger.error("inventory", "Failed to estimate daily sales rate", {
      shop,
      error: err,
      extra: { productId },
    });
    return 1; // safe default
  }
}

/**
 * Find the Google Ads campaign associated with a given product.
 * Matches by looking at CampaignJob records that link a product
 * to a googleCampaignId, and cross-references active campaigns.
 */
async function findCampaignForProduct(
  shop: string,
  productId: string,
  activeCampaigns: Array<{ id: string; name: string; dailyBudget: string }>,
): Promise<{ campaignId: string; currentBudget: number } | null> {
  try {
    // Find campaign jobs that reference this product and have a Google campaign ID
    const jobs = await prisma.campaignJob.findMany({
      where: {
        shop,
        googleCampaignId: { not: null },
      },
    });

    const matchingJob = jobs.find((job) => {
      try {
        const payload = JSON.parse(job.payload || "{}");
        return payload.productId === productId;
      } catch {
        return false;
      }
    });

    if (!matchingJob || !matchingJob.googleCampaignId) return null;

    // Verify the campaign is still active in Google Ads
    const campaign = activeCampaigns.find(
      (c) => c.id === matchingJob.googleCampaignId,
    );
    if (!campaign) return null;

    return {
      campaignId: campaign.id,
      currentBudget: parseFloat(campaign.dailyBudget) || 0,
    };
  } catch (err) {
    logger.error("inventory", "Failed to find campaign for product", {
      shop,
      error: err,
      extra: { productId },
    });
    return null;
  }
}

// ── Main Functions ───────────────────────────────────────────────────────

/**
 * Scan all products for a shop and categorize them by inventory health.
 */
export async function scanInventoryLevels(
  shop: string,
): Promise<InventoryScanResult> {
  try {
    logger.info("inventory", "Starting inventory scan", { shop });

    const products = await prisma.product.findMany({
      where: { shop },
    });

    const lowStock: ProductInventoryInfo[] = [];
    const overstock: ProductInventoryInfo[] = [];
    const healthy: ProductInventoryInfo[] = [];

    for (const product of products) {
      const dailySalesRate = await estimateDailySalesRate(
        shop,
        product.id,
        product.price,
      );

      const info: ProductInventoryInfo = {
        id: product.id,
        shop: product.shop,
        title: product.title,
        price: product.price,
        inventoryTotal: product.inventoryTotal,
        inStock: product.inStock,
        dailySalesRate,
      };

      if (product.inventoryTotal < LOW_STOCK_THRESHOLD) {
        lowStock.push(info);
      } else if (
        product.inventoryTotal > OVERSTOCK_THRESHOLD &&
        dailySalesRate < OVERSTOCK_MAX_DAILY_SALES_RATE
      ) {
        overstock.push(info);
      } else {
        healthy.push(info);
      }
    }

    logger.info("inventory", "Inventory scan complete", {
      shop,
      extra: {
        total: products.length,
        lowStock: lowStock.length,
        overstock: overstock.length,
        healthy: healthy.length,
      },
    });

    return {
      lowStock,
      overstock,
      healthy,
      scannedAt: new Date().toISOString(),
      totalProducts: products.length,
    };
  } catch (err) {
    logger.error("inventory", "Inventory scan failed", { shop, error: err });
    throw err;
  }
}

/**
 * Find campaigns for low-stock products and reduce their budget by 50%.
 * Creates InventoryAlert records for each throttled campaign.
 */
export async function throttleLowStockCampaigns(
  shop: string,
): Promise<{ throttled: number; alerts: string[] }> {
  try {
    logger.info("inventory", "Throttling low-stock campaigns", { shop });

    const scan = await scanInventoryLevels(shop);
    if (scan.lowStock.length === 0) {
      logger.info("inventory", "No low-stock products found", { shop });
      return { throttled: 0, alerts: [] };
    }

    // Fetch active campaigns from Google Ads
    const campaigns = await listSmartAdsCampaigns();
    const throttledAlerts: string[] = [];
    let throttledCount = 0;

    for (const product of scan.lowStock) {
      const campaignMatch = await findCampaignForProduct(
        shop,
        product.id,
        campaigns,
      );
      if (!campaignMatch) continue;

      const newBudget = Math.max(1, campaignMatch.currentBudget * THROTTLE_FACTOR);

      try {
        await updateCampaignBudget(campaignMatch.campaignId, newBudget);

        const alert = await prisma.inventoryAlert.upsert({
          where: {
            shop_productId_alertType: {
              shop,
              productId: product.id,
              alertType: "low_stock",
            },
          },
          update: {
            productTitle: product.title,
            currentStock: product.inventoryTotal,
            dailySalesRate: product.dailySalesRate,
            daysUntilOut:
              product.dailySalesRate > 0
                ? Math.ceil(product.inventoryTotal / product.dailySalesRate)
                : null,
            actionTaken: "throttled_campaign",
            campaignId: campaignMatch.campaignId,
            resolved: false,
          },
          create: {
            shop,
            productId: product.id,
            productTitle: product.title,
            alertType: "low_stock",
            currentStock: product.inventoryTotal,
            dailySalesRate: product.dailySalesRate,
            daysUntilOut:
              product.dailySalesRate > 0
                ? Math.ceil(product.inventoryTotal / product.dailySalesRate)
                : null,
            actionTaken: "throttled_campaign",
            campaignId: campaignMatch.campaignId,
          },
        });

        throttledAlerts.push(alert.id);
        throttledCount++;

        logger.info("inventory", `Throttled campaign for "${product.title}"`, {
          shop,
          extra: {
            productId: product.id,
            campaignId: campaignMatch.campaignId,
            oldBudget: campaignMatch.currentBudget,
            newBudget,
            stock: product.inventoryTotal,
          },
        });
      } catch (err) {
        logger.error("inventory", `Failed to throttle campaign for "${product.title}"`, {
          shop,
          error: err,
          extra: { productId: product.id, campaignId: campaignMatch.campaignId },
        });
      }
    }

    logger.info("inventory", `Throttling complete: ${throttledCount} campaigns adjusted`, {
      shop,
    });

    return { throttled: throttledCount, alerts: throttledAlerts };
  } catch (err) {
    logger.error("inventory", "Throttle low-stock campaigns failed", {
      shop,
      error: err,
    });
    throw err;
  }
}

/**
 * Find campaigns for overstocked products and increase their budget by 30%.
 * Creates InventoryAlert records for each boosted campaign.
 */
export async function boostOverstockedCampaigns(
  shop: string,
): Promise<{ boosted: number; alerts: string[] }> {
  try {
    logger.info("inventory", "Boosting overstocked campaigns", { shop });

    const scan = await scanInventoryLevels(shop);
    if (scan.overstock.length === 0) {
      logger.info("inventory", "No overstocked products found", { shop });
      return { boosted: 0, alerts: [] };
    }

    // Fetch active campaigns from Google Ads
    const campaigns = await listSmartAdsCampaigns();
    const boostedAlerts: string[] = [];
    let boostedCount = 0;

    for (const product of scan.overstock) {
      const campaignMatch = await findCampaignForProduct(
        shop,
        product.id,
        campaigns,
      );
      if (!campaignMatch) continue;

      const newBudget = campaignMatch.currentBudget * BOOST_FACTOR;

      try {
        await updateCampaignBudget(campaignMatch.campaignId, newBudget);

        const alert = await prisma.inventoryAlert.create({
          data: {
            shop,
            productId: product.id,
            productTitle: product.title,
            alertType: "overstock",
            currentStock: product.inventoryTotal,
            dailySalesRate: product.dailySalesRate,
            daysUntilOut: null, // not relevant for overstock
            actionTaken: "boosted_campaign",
            campaignId: campaignMatch.campaignId,
          },
        });

        boostedAlerts.push(alert.id);
        boostedCount++;

        logger.info("inventory", `Boosted campaign for "${product.title}"`, {
          shop,
          extra: {
            productId: product.id,
            campaignId: campaignMatch.campaignId,
            oldBudget: campaignMatch.currentBudget,
            newBudget,
            stock: product.inventoryTotal,
          },
        });
      } catch (err) {
        logger.error("inventory", `Failed to boost campaign for "${product.title}"`, {
          shop,
          error: err,
          extra: { productId: product.id, campaignId: campaignMatch.campaignId },
        });
      }
    }

    logger.info("inventory", `Boosting complete: ${boostedCount} campaigns adjusted`, {
      shop,
    });

    return { boosted: boostedCount, alerts: boostedAlerts };
  } catch (err) {
    logger.error("inventory", "Boost overstocked campaigns failed", {
      shop,
      error: err,
    });
    throw err;
  }
}

/**
 * Predict the stockout date for a specific product based on sales velocity.
 * Returns the estimated date and days remaining, or null if the product
 * is not at risk (e.g. no sales, or plenty of stock).
 */
export async function predictStockoutDate(
  shop: string,
  productId: string,
): Promise<{
  productId: string;
  productTitle: string;
  currentStock: number;
  dailySalesRate: number;
  daysUntilStockout: number | null;
  estimatedStockoutDate: string | null;
  riskLevel: "critical" | "warning" | "safe";
} | null> {
  try {
    logger.info("inventory", "Predicting stockout date", {
      shop,
      extra: { productId },
    });

    const product = await prisma.product.findFirst({
      where: { id: productId, shop },
    });

    if (!product) {
      logger.error("inventory", "Product not found for stockout prediction", {
        shop,
        extra: { productId },
      });
      return null;
    }

    const dailySalesRate = await estimateDailySalesRate(
      shop,
      product.id,
      product.price,
    );

    // If no sales velocity, stockout is not predictable
    if (dailySalesRate <= 0) {
      return {
        productId: product.id,
        productTitle: product.title,
        currentStock: product.inventoryTotal,
        dailySalesRate: 0,
        daysUntilStockout: null,
        estimatedStockoutDate: null,
        riskLevel: "safe",
      };
    }

    const daysUntilStockout = Math.ceil(product.inventoryTotal / dailySalesRate);
    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + daysUntilStockout);

    // Determine risk level
    let riskLevel: "critical" | "warning" | "safe";
    if (daysUntilStockout <= 3) {
      riskLevel = "critical";
    } else if (daysUntilStockout <= 7) {
      riskLevel = "warning";
    } else {
      riskLevel = "safe";
    }

    // Save an alert for critical/warning products
    if (riskLevel !== "safe") {
      await prisma.inventoryAlert.upsert({
        where: {
          shop_productId_alertType: {
            shop,
            productId: product.id,
            alertType: "stockout_predicted",
          },
        },
        update: {
          productTitle: product.title,
          currentStock: product.inventoryTotal,
          dailySalesRate,
          daysUntilOut: daysUntilStockout,
          resolved: false,
        },
        create: {
          shop,
          productId: product.id,
          productTitle: product.title,
          alertType: "stockout_predicted",
          currentStock: product.inventoryTotal,
          dailySalesRate,
          daysUntilOut: daysUntilStockout,
          actionTaken: null,
          campaignId: null,
        },
      });
    }

    logger.info("inventory", `Stockout prediction for "${product.title}"`, {
      shop,
      extra: {
        productId: product.id,
        currentStock: product.inventoryTotal,
        dailySalesRate,
        daysUntilStockout,
        riskLevel,
      },
    });

    return {
      productId: product.id,
      productTitle: product.title,
      currentStock: product.inventoryTotal,
      dailySalesRate,
      daysUntilStockout,
      estimatedStockoutDate: stockoutDate.toISOString().split("T")[0],
      riskLevel,
    };
  } catch (err) {
    logger.error("inventory", "Stockout prediction failed", {
      shop,
      error: err,
      extra: { productId },
    });
    throw err;
  }
}
