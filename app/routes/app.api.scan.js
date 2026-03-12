// app/routes/app.api.scan.js
// ══════════════════════════════════════════════
// PROTECTED: Requires scan credits or paid plan
// SAVES: AI results to AiAnalysis table in DB
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { analyzeBatch } from "../ai.server";
import { checkLicense, useScanCredit } from "../license.server.js";
import prisma from "../db.server.js";
import crypto from "crypto";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { withDbRetry } from "../utils/db-health";
import { cache, TTL } from "../utils/redis";
import { addScanJob } from "../utils/queue";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server.js";

// Zod schemas
const ScanStepSchema = z.enum(["fetch", "analyze-batch", "analyze"]);
const MAX_BODY_SIZE = 102400; // 100KB

// Helper: create a hash of product data to detect changes
function productHash(product) {
  const str = `${product.title}|${product.price}|${product.description || ""}`;
  return crypto.createHash("md5").update(str).digest("hex");
}

// Helper: save AI analysis results to database
async function saveAiResultsToDB(shop, products, aiProducts) {
  logger.info("scan.saveDB", "saveAiResultsToDB called", { extra: { productCount: products.length, aiCount: aiProducts.length } });
  logger.info("scan.saveDB", "Product IDs sample", { extra: { ids: products.map(p => p.id).slice(0,3) } });
  logger.info("scan.saveDB", "AI titles sample", { extra: { titles: aiProducts.map(p => p.title).slice(0,3) } });
  let saved = 0;
  for (const aiProduct of aiProducts) {
    // Find the matching source product
    const sourceProduct = products.find(p =>
      p.title === aiProduct.title || (p.id && String(p.id) === String(aiProduct.id))
    );
    logger.info("scan.saveDB", "Match attempt", { extra: { aiTitle: aiProduct.title, matched: sourceProduct?.title, id: sourceProduct?.id } });
    if (!sourceProduct?.id) continue;

    const productId = sourceProduct.id;
    const hash = productHash(sourceProduct);

    try {
      await withDbRetry(`scan-save-ai-${productId}`, () => prisma.aiAnalysis.upsert({
        where: { productId },
        create: {
          productId,
          shop,
          adScore: aiProduct.ad_score || 0,
          adStrength: aiProduct.ad_strength || "AVERAGE",
          headlines: JSON.stringify(aiProduct.headlines || []),
          longHeadlines: JSON.stringify(aiProduct.long_headlines || []),
          descriptions: JSON.stringify(aiProduct.descriptions || []),
          keywords: JSON.stringify(aiProduct.keywords || []),
          negativeKeywords: JSON.stringify(aiProduct.negative_keywords || []),
          path1: aiProduct.path1 || "Shop",
          path2: aiProduct.path2 || "",
          recommendedBid: aiProduct.recommended_bid || 1.0,
          targetDemographics: aiProduct.target_demographics || "",
          sitelinks: JSON.stringify(aiProduct.sitelinks || []),
          competitorIntel: JSON.stringify(aiProduct.competitor_intel || {}),
          productHash: hash,
        },
        update: {
          adScore: aiProduct.ad_score || 0,
          adStrength: aiProduct.ad_strength || "AVERAGE",
          headlines: JSON.stringify(aiProduct.headlines || []),
          longHeadlines: JSON.stringify(aiProduct.long_headlines || []),
          descriptions: JSON.stringify(aiProduct.descriptions || []),
          keywords: JSON.stringify(aiProduct.keywords || []),
          negativeKeywords: JSON.stringify(aiProduct.negative_keywords || []),
          path1: aiProduct.path1 || "Shop",
          path2: aiProduct.path2 || "",
          recommendedBid: aiProduct.recommended_bid || 1.0,
          targetDemographics: aiProduct.target_demographics || "",
          sitelinks: JSON.stringify(aiProduct.sitelinks || []),
          competitorIntel: JSON.stringify(aiProduct.competitor_intel || {}),
          analyzedAt: new Date(),
          productHash: hash,
        },
      }));
      saved++;
    } catch (err) {
      logger.error("scan.saveDB", `Failed to save AI analysis for ${productId}`, { error: err.message });
    }
  }
  return saved;
}

const _action = async ({ request }) => {
  let admin, session;
  try {
    ({ admin, session } = await authenticate.admin(request));
  } catch (authErr) {
    logger.error("scan.action", "Auth failed", { error: authErr.message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.scan(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  const formData = await request.formData();
  const step = formData.get("step");

  // Validate step
  const stepCheck = ScanStepSchema.safeParse(step);
  if (!stepCheck.success) {
    return Response.json({ success: false, error: "Invalid step. Must be: fetch, analyze-batch, or analyze" }, { status: 400 });
  }

  try {
    /* ── Fetch all products (allowed for everyone) ── */
    if (step === "fetch") {
      const response = await admin.graphql(`{
        products(first: 50) {
          edges { node {
            id title description handle
            images(first: 1) { edges { node { url } } }
            variants(first: 1) { edges { node { price } } }
          }}
        }
        shop { name url myshopifyDomain currencyCode primaryDomain { host } }
      }`);
      const { data } = await response.json();
      const products = data.products.edges.map(({ node }) => ({
        id: node.id,
        title: node.title,
        description: node.description || "",
        image: node.images.edges[0]?.node?.url || "",
        price: node.variants.edges[0]?.node?.price || "0",
        handle: node.handle || "",
      }));
      const storeInfo = {
        name: data.shop?.name || "",
        url: data.shop?.primaryDomain?.host || data.shop?.myshopifyDomain || "",
        currency: data.shop?.currencyCode || "USD",
      };
      // Save products to DB so AiAnalysis foreign key works
      for (const p of products) {
        try {
          await withDbRetry(`scan-save-product-${p.id}`, () => prisma.product.upsert({
            where: { id: p.id },
            create: { id: p.id, shop, title: p.title, description: p.description, handle: p.handle, image: p.image, price: p.price },
            update: { title: p.title, description: p.description, handle: p.handle, image: p.image, price: p.price, syncedAt: new Date() },
          }));
        } catch (err) { logger.warn("scan.fetch", "Failed to save product", { extra: { id: p.id, error: err.message } }); }
      }
      logger.info("scan.fetch", "Saved products to DB", { shop, extra: { count: products.length } });

      return Response.json({ success: true, products, storeInfo });
    }

    /* ── Analyze a batch — REQUIRES LICENSE ── */
    if (step === "analyze-batch") {
      // LICENSE CHECK
      const license = await checkLicense(shop, "scan");
      if (!license.allowed) {
        return Response.json(
          { success: false, error: license.reason },
          { status: 403 }
        );
      }

      const products = JSON.parse(formData.get("products") || "[]");
      const storeDomain = formData.get("storeDomain") || "";
      if (!products.length) {
        return Response.json({ success: false, error: "No products" }, { status: 400 });
      }

      // Try queue first (if USE_QUEUES=true)
      const queueResult = await addScanJob({ shop, products, storeDomain });
      if (queueResult.queued) {
        return Response.json({ success: true, queued: true, jobId: queueResult.jobId, message: "Scan queued for background processing" });
      }
      // Fallback: run synchronously
      // Cache check: use product IDs + storeDomain as cache key
      const cacheKey = `scan:${shop}:${products.map(p => p.id).sort().join(",")}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.info("scan.cache", "Returning cached scan results", { shop });
        return Response.json({ success: true, result: cached, savedToDb: 0, fromCache: true });
      }

      const result = await analyzeBatch(products, storeDomain);

      // SAVE TO DATABASE
      const aiProducts = result?.products || [];
      const savedCount = await saveAiResultsToDB(shop, products, aiProducts);
      logger.info("scan.analyze-batch", "AI analyses saved to DB", { shop, extra: { saved: savedCount, total: aiProducts.length } });

      // Save to cache for future requests
      await cache.set(cacheKey, result, TTL.AI_ANALYSIS);

      // DEDUCT CREDIT after successful scan
      await useScanCredit(shop);

      return Response.json({ success: true, result, savedToDb: savedCount });
    }

    /* ── Legacy: analyze all ── */
    if (step === "analyze") {
      const license = await checkLicense(shop, "scan");
      if (!license.allowed) {
        return Response.json({ success: false, error: license.reason }, { status: 403 });
      }

      const products = JSON.parse(formData.get("products") || "[]");
      if (!products.length) {
        return Response.json({ success: false, error: "No products" }, { status: 400 });
      }
      const aiResults = await analyzeBatch(products.slice(0, 5));
      
      // SAVE TO DATABASE
      const savedCount = await saveAiResultsToDB(shop, products.slice(0, 5), aiResults?.products || []);
      logger.info("scan.analyze", "AI analyses saved to DB", { shop, extra: { saved: savedCount } });
      
      await useScanCredit(shop);
      return Response.json({ success: true, aiResults, savedToDb: savedCount });
    }

    return Response.json({ success: false, error: "Unknown step" }, { status: 400 });
  } catch (err) {
    logger.error("scan.action", "Scan error", { shop, error: err.message });
    return Response.json({ success: false, error: err.message || "Scan failed" }, { status: 500 });
  }
};



// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.scan", withRequestLogging("api.scan", _action));