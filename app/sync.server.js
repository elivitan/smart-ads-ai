/**
 * Product Sync Service
 *
 * Keeps the local DB in sync with Shopify products.
 * - Full sync: fetches all products via GraphQL pagination
 * - Incremental: handles webhook events (create/update/delete)
 * - Detects changes: hashes title+price+description to know if AI re-analysis needed
 */
import prisma from "./db.server.js";
import crypto from "crypto";

// ─── Helpers ───

function productHash(title, price, description, image) {
  const str = `${title}|${price}|${(description || "").slice(0, 200)}|${(image || "").slice(0, 100)}`;
  return crypto.createHash("md5").update(str).digest("hex");
}

function mapGraphQLProduct(node) {
  const totalInventory =
    node.totalInventory != null
      ? node.totalInventory
      : (node.variants?.edges || []).reduce(
          (sum, v) => sum + (v.node?.inventoryQuantity || 0),
          0,
        );

  return {
    id: node.id,
    title: node.title || "",
    description: node.description || "",
    handle: node.handle || "",
    image: node.images?.edges?.[0]?.node?.url || node.featuredImage?.url || "",
    price: node.variants?.edges?.[0]?.node?.price || "0",
    status: node.status || "ACTIVE",
    inventoryTotal: totalInventory,
    inStock: totalInventory > 0,
    productType: node.productType || "",
    vendor: node.vendor || "",
    tags: (node.tags || []).join(","),
    shopifyUpdatedAt: node.updatedAt ? new Date(node.updatedAt) : null,
  };
}

// ─── Full Sync ───

/**
 * Fetch ALL products from Shopify via paginated GraphQL and upsert into DB.
 * Returns { synced, created, updated, deleted, needsAi }
 */
export async function fullSync(admin, shop) {
  const log = await prisma.syncLog.create({
    data: {
      shop,
      type: "full_sync",
      status: "started",
      details: "Starting full product sync...",
    },
  });

  try {
    // Fetch all products via pagination
    const allProducts = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
      const afterClause = cursor ? `, after: "${cursor}"` : "";
      const response = await admin.graphql(`{
        products(first: 50${afterClause}) {
          edges {
            cursor
            node {
              id title description handle status productType vendor tags updatedAt
              totalInventory
              images(first: 1) { edges { node { url } } }
              variants(first: 1) { edges { node { price inventoryQuantity } } }
            }
          }
          pageInfo { hasNextPage }
        }
      }`);

      const { data } = await response.json();
      const edges = data.products.edges || [];
      for (const edge of edges) {
        allProducts.push(mapGraphQLProduct(edge.node));
        cursor = edge.cursor;
      }
      hasNextPage = data.products.pageInfo.hasNextPage;
    }

    // Get existing products from DB
    const existing = await prisma.product.findMany({
      where: { shop },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((p) => p.id));
    const fetchedIds = new Set(allProducts.map((p) => p.id));

    let created = 0,
      updated = 0,
      deleted = 0;
    const needsAi = [];

    // Upsert all fetched products
    for (const product of allProducts) {
      const hash = productHash(
        product.title,
        product.price,
        product.description,
      );

      const dbProduct = await prisma.product.upsert({
        where: { id: product.id },
        create: { ...product, shop, syncedAt: new Date() },
        update: { ...product, syncedAt: new Date() },
        include: { aiAnalysis: { select: { productHash: true } } },
      });

      if (!existingIds.has(product.id)) {
        created++;
        needsAi.push(product.id);
      } else {
        updated++;
        // Check if product changed since last AI analysis
        if (
          !dbProduct.aiAnalysis ||
          dbProduct.aiAnalysis.productHash !== hash
        ) {
          needsAi.push(product.id);
        }
      }
    }

    // Delete products that no longer exist in Shopify
    const toDelete = [...existingIds].filter((id) => !fetchedIds.has(id));
    if (toDelete.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: toDelete } } });
      deleted = toDelete.length;
    }

    // Update log
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        productsAffected: allProducts.length,
        details: `Synced ${allProducts.length} products: ${created} new, ${updated} updated, ${deleted} removed. ${needsAi.length} need AI analysis.`,
        completedAt: new Date(),
      },
    });

    return {
      synced: allProducts.length,
      created,
      updated,
      deleted,
      needsAi: needsAi.length,
      needsAiIds: needsAi,
    };
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "failed", error: err.message, completedAt: new Date() },
    });
    throw err;
  }
}

// ─── Webhook Handlers ───

/**
 * Handle product create/update webhook from Shopify.
 * Shopify sends the REST product object, not GraphQL.
 */
export async function handleProductWebhook(shop, shopifyProduct, eventType) {
  const log = await prisma.syncLog.create({
    data: {
      shop,
      type: `webhook_${eventType}`,
      status: "started",
      details: `Product: ${shopifyProduct.title}`,
    },
  });

  try {
    const productId = `gid://shopify/Product/${shopifyProduct.id}`;
    const totalInventory = (shopifyProduct.variants || []).reduce(
      (sum, v) => sum + (v.inventory_quantity || 0),
      0,
    );

    const productData = {
      title: shopifyProduct.title || "",
      description: shopifyProduct.body_html?.replace(/<[^>]*>/g, "") || "",
      handle: shopifyProduct.handle || "",
      image: shopifyProduct.image?.src || shopifyProduct.images?.[0]?.src || "",
      price: shopifyProduct.variants?.[0]?.price || "0",
      status: (shopifyProduct.status || "active").toUpperCase(),
      inventoryTotal: totalInventory,
      inStock: totalInventory > 0,
      productType: shopifyProduct.product_type || "",
      vendor: shopifyProduct.vendor || "",
      tags: shopifyProduct.tags || "",
      shopifyUpdatedAt: shopifyProduct.updated_at
        ? new Date(shopifyProduct.updated_at)
        : new Date(),
      syncedAt: new Date(),
    };

    const hash = productHash(
      productData.title,
      productData.price,
      productData.description,
    );

    await prisma.product.upsert({
      where: { id: productId },
      create: { id: productId, shop, ...productData },
      update: productData,
    });

    // Check if AI re-analysis needed
    const existing = await prisma.aiAnalysis.findUnique({
      where: { productId },
      select: { productHash: true },
    });

    const needsAi = !existing || existing.productHash !== hash;

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        productsAffected: 1,
        details: `${eventType}: "${productData.title}" ${needsAi ? "(needs AI re-analysis)" : "(unchanged)"}`,
        completedAt: new Date(),
      },
    });

    return { productId, needsAi };
  } catch (err) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { status: "failed", error: err.message, completedAt: new Date() },
    });
    throw err;
  }
}

/**
 * Handle product delete webhook.
 */
export async function handleProductDelete(shop, shopifyProductId) {
  const productId = `gid://shopify/Product/${shopifyProductId}`;

  await prisma.syncLog.create({
    data: {
      shop,
      type: "webhook_delete",
      status: "completed",
      details: `Deleted product ${productId}`,
      productsAffected: 1,
      completedAt: new Date(),
    },
  });

  // Cascade delete will remove AiAnalysis too
  await prisma.product.delete({ where: { id: productId } }).catch(() => {});

  return { deleted: productId };
}

// ─── AI Analysis Storage ───

/**
 * Save AI analysis results for a product.
 */
export async function saveAiAnalysis(productId, shop, aiResult) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true, price: true, description: true },
  });

  const hash = product
    ? productHash(product.title, product.price, product.description)
    : "";

  return prisma.aiAnalysis.upsert({
    where: { productId },
    create: {
      productId,
      shop,
      adScore: aiResult.ad_score || 0,
      adStrength: aiResult.ad_strength || "AVERAGE",
      headlines: JSON.stringify(aiResult.headlines || []),
      descriptions: JSON.stringify(aiResult.descriptions || []),
      keywords: JSON.stringify(aiResult.keywords || []),
      negativeKeywords: JSON.stringify(aiResult.negative_keywords || []),
      path1: aiResult.path1 || "Shop",
      path2: aiResult.path2 || "",
      recommendedBid: aiResult.recommended_bid || 1.0,
      targetDemographics: aiResult.target_demographics || "",
      sitelinks: JSON.stringify(aiResult.sitelinks || []),
      competitorIntel: JSON.stringify(aiResult.competitor_intel || {}),
      productHash: hash,
      analyzedAt: new Date(),
    },
    update: {
      adScore: aiResult.ad_score || 0,
      adStrength: aiResult.ad_strength || "AVERAGE",
      headlines: JSON.stringify(aiResult.headlines || []),
      descriptions: JSON.stringify(aiResult.descriptions || []),
      keywords: JSON.stringify(aiResult.keywords || []),
      negativeKeywords: JSON.stringify(aiResult.negative_keywords || []),
      path1: aiResult.path1 || "Shop",
      path2: aiResult.path2 || "",
      recommendedBid: aiResult.recommended_bid || 1.0,
      targetDemographics: aiResult.target_demographics || "",
      sitelinks: JSON.stringify(aiResult.sitelinks || []),
      competitorIntel: JSON.stringify(aiResult.competitor_intel || {}),
      productHash: hash,
      analyzedAt: new Date(),
    },
  });
}

// ─── Query Helpers ───

/**
 * Get all products for a shop with their AI analysis status.
 */
export async function getShopProducts(
  shop,
  { inStockOnly = false, withAiOnly = false } = {},
) {
  const where = { shop };
  if (inStockOnly) where.inStock = true;

  const products = await prisma.product.findMany({
    where,
    include: { aiAnalysis: true },
    orderBy: { title: "asc" },
  });

  return products
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      handle: p.handle,
      image: p.image,
      price: p.price,
      status: p.status,
      inventoryTotal: p.inventoryTotal,
      inStock: p.inStock,
      productType: p.productType,
      vendor: p.vendor,
      tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
      syncedAt: p.syncedAt,
      hasAiAnalysis: !!p.aiAnalysis,
      aiAnalysis: p.aiAnalysis
        ? {
            ad_score: p.aiAnalysis.adScore,
            ad_strength: p.aiAnalysis.adStrength,
            headlines: JSON.parse(p.aiAnalysis.headlines),
            descriptions: JSON.parse(p.aiAnalysis.descriptions),
            keywords: JSON.parse(p.aiAnalysis.keywords),
            negative_keywords: JSON.parse(p.aiAnalysis.negativeKeywords),
            path1: p.aiAnalysis.path1,
            path2: p.aiAnalysis.path2,
            recommended_bid: p.aiAnalysis.recommendedBid,
            target_demographics: p.aiAnalysis.targetDemographics,
            sitelinks: JSON.parse(p.aiAnalysis.sitelinks),
            competitor_intel: JSON.parse(p.aiAnalysis.competitorIntel),
            analyzedAt: p.aiAnalysis.analyzedAt,
          }
        : null,
    }))
    .filter((p) => !withAiOnly || p.hasAiAnalysis);
}

/**
 * Get sync status summary for a shop.
 */
export async function getSyncStatus(shop) {
  const [totalProducts, inStockProducts, analyzedProducts, lastSync] =
    await Promise.all([
      prisma.product.count({ where: { shop } }),
      prisma.product.count({ where: { shop, inStock: true } }),
      prisma.aiAnalysis.count({ where: { shop } }),
      prisma.syncLog.findFirst({
        where: { shop, type: "full_sync", status: "completed" },
        orderBy: { completedAt: "desc" },
      }),
    ]);

  return {
    totalProducts,
    inStockProducts,
    outOfStockProducts: totalProducts - inStockProducts,
    analyzedProducts,
    unanalyzedProducts: totalProducts - analyzedProducts,
    lastSyncAt: lastSync?.completedAt || null,
    lastSyncDetails: lastSync?.details || null,
  };
}
// ── Credits ──────────────────────────────────────────────────────────────────

/**
 * Get credit balances for a shop from DB.
 * Used by /app/api/credits to give client the authoritative values.
 */
export async function getShopCredits(shop) {
  try {
    const record = await prisma.shopSubscription.findUnique({
      where: { shop },
      select: { scanCredits: true, aiCredits: true, plan: true },
    });
    return {
      scanCredits: record?.scanCredits ?? 0,
      aiCredits: record?.aiCredits ?? 0,
      plan: record?.plan ?? null,
    };
  } catch {
    return { scanCredits: 0, aiCredits: 0, plan: null };
  }
}

/**
 * Update credit balances for a shop.
 */
export async function updateShopCredits(shop, { scanCredits, aiCredits } = {}) {
  const data = {};
  if (typeof scanCredits === "number") data.scanCredits = scanCredits;
  if (typeof aiCredits === "number") data.aiCredits = aiCredits;
  if (Object.keys(data).length === 0) return;

  await prisma.shopSubscription.upsert({
    where: { shop },
    update: data,
    create: {
      shop,
      scanCredits: scanCredits ?? 0,
      aiCredits: aiCredits ?? 0,
      plan: "free",
      status: "active",
    },
  });
}
