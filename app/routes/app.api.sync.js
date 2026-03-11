/**
 * /app/api/sync - Product Sync & AI Analysis API
 * 
 * POST actions:
 *   step=full_sync     → Fetch all products from Shopify → DB
 *   step=status        → Get sync status (counts, last sync)
 *   step=products      → Get all products from DB (with AI if available)
 *   step=analyze_all   → Run AI on ALL products needing it (batched, returns progress)
 *   step=analyze_batch → Run AI on one batch (called repeatedly by frontend)
 */
import { authenticate } from "../shopify.server.js";
import { fullSync, getShopProducts, getSyncStatus, saveAiAnalysis } from "../sync.server.js";
import { analyzeBatch } from "../ai.server.js";
import prisma from "../db.server.js";
import crypto from "crypto";
import { z } from "zod";
import { logger } from "../utils/logger.js";

function productHash(title, price, description) {
  return crypto.createHash("md5").update(`${title}|${price}|${(description || "").slice(0, 200)}`).digest("hex");
}

export const action = async ({ request }) => {
  let admin, session;
  try {
    ({ admin, session } = await authenticate.admin(request));
  } catch (authErr) {
    console.error("[SmartAds] Auth failed:", authErr.message);
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;
  const formData = await request.formData();
  const step = formData.get("step");

  try {
    // ─── Full Sync: Shopify → DB ───
    if (step === "full_sync") {
      const result = await fullSync(admin, shop);
      return Response.json({ success: true, ...result });
    }

    // ─── Status ───
    if (step === "status") {
      const status = await getSyncStatus(shop);
      return Response.json({ success: true, ...status });
    }

    // ─── Products from DB ───
    if (step === "products") {
      const inStockOnly = formData.get("inStockOnly") === "true";
      const withAiOnly = formData.get("withAiOnly") === "true";
      const products = await getShopProducts(shop, { inStockOnly, withAiOnly });

      const storeRes = await admin.graphql(`{ shop { name myshopifyDomain primaryDomain { host } currencyCode } }`);
      const { data } = await storeRes.json();
      const storeInfo = {
        name: data.shop?.name || "",
        url: data.shop?.primaryDomain?.host || data.shop?.myshopifyDomain || "",
        currency: data.shop?.currencyCode || "USD",
      };

      return Response.json({ success: true, products, storeInfo });
    }

    // ─── Analyze Batch: one batch of products ───
    // Frontend calls this repeatedly until remaining=0
    if (step === "analyze_batch") {
      const batchSize = parseInt(formData.get("batchSize") || "10", 10);
      const force = formData.get("force") === "true";

      // Get store domain
      const storeRes = await admin.graphql(`{ shop { primaryDomain { host } myshopifyDomain } }`);
      const { data: shopData } = await storeRes.json();
      const storeDomain = shopData.shop?.primaryDomain?.host || shopData.shop?.myshopifyDomain || "";

      // Find products needing analysis
      const allProducts = await prisma.product.findMany({
        where: { shop },
        include: { aiAnalysis: { select: { productHash: true } } },
      });

      const needsAnalysis = allProducts.filter(p => {
        if (force) return true;
        if (!p.aiAnalysis) return true;
        const hash = productHash(p.title, p.price, p.description);
        return p.aiAnalysis.productHash !== hash;
      });

      if (needsAnalysis.length === 0) {
        return Response.json({
          success: true,
          analyzed: 0,
          remaining: 0,
          total: allProducts.length,
          message: "All products up to date",
        });
      }

      // Take one batch
      const batch = needsAnalysis.slice(0, Math.min(batchSize, 10));
      const batchForAi = batch.map(p => ({
        id: p.id, title: p.title, description: p.description,
        price: p.price, handle: p.handle, image: p.image,
      }));

      const result = await analyzeBatch(batchForAi, storeDomain);
      const aiProducts = result.products || [];

      // Save to DB
      for (let i = 0; i < aiProducts.length; i++) {
        const productId = batch[i]?.id;
        if (productId && aiProducts[i]) {
          await saveAiAnalysis(productId, shop, aiProducts[i]);
        }
      }

      return Response.json({
        success: true,
        analyzed: aiProducts.length,
        remaining: needsAnalysis.length - batch.length,
        total: allProducts.length,
      });
    }

    // ─── Analyze Parallel: 3 batches at once ───
    // For large stores: sends 3 batches in parallel
    if (step === "analyze_parallel") {
      const batchSize = parseInt(formData.get("batchSize") || "5", 10);
      const parallelCount = parseInt(formData.get("parallel") || "3", 10);
      const force = formData.get("force") === "true";

      const storeRes = await admin.graphql(`{ shop { primaryDomain { host } myshopifyDomain } }`);
      const { data: shopData } = await storeRes.json();
      const storeDomain = shopData.shop?.primaryDomain?.host || shopData.shop?.myshopifyDomain || "";

      const allProducts = await prisma.product.findMany({
        where: { shop },
        include: { aiAnalysis: { select: { productHash: true } } },
      });

      const needsAnalysis = allProducts.filter(p => {
        if (force) return true;
        if (!p.aiAnalysis) return true;
        const hash = productHash(p.title, p.price, p.description);
        return p.aiAnalysis.productHash !== hash;
      });

      if (needsAnalysis.length === 0) {
        return Response.json({
          success: true,
          analyzed: 0,
          remaining: 0,
          total: allProducts.length,
          message: "All products up to date",
        });
      }

      // Split into parallel batches
      const toProcess = needsAnalysis.slice(0, batchSize * parallelCount);
      const batches = [];
      for (let i = 0; i < toProcess.length; i += batchSize) {
        batches.push(toProcess.slice(i, i + batchSize));
      }

      // Run all batches in parallel
      const results = await Promise.allSettled(
        batches.map(batch => {
          const batchForAi = batch.map(p => ({
            id: p.id, title: p.title, description: p.description,
            price: p.price, handle: p.handle, image: p.image,
          }));
          return analyzeBatch(batchForAi, storeDomain);
        })
      );

      // Save all successful results
      let totalAnalyzed = 0;
      for (let bIdx = 0; bIdx < results.length; bIdx++) {
        const res = results[bIdx];
        if (res.status === "fulfilled") {
          const aiProducts = res.value.products || [];
          const batch = batches[bIdx];
          for (let i = 0; i < aiProducts.length; i++) {
            const productId = batch[i]?.id;
            if (productId && aiProducts[i]) {
              await saveAiAnalysis(productId, shop, aiProducts[i]);
              totalAnalyzed++;
            }
          }
        } else {
          console.error("Parallel batch failed:", res.reason?.message);
        }
      }

      return Response.json({
        success: true,
        analyzed: totalAnalyzed,
        remaining: needsAnalysis.length - toProcess.length,
        total: allProducts.length,
      });
    }

    return Response.json({ success: false, error: "Unknown step" }, { status: 400 });

  } catch (err) {
    console.error("Sync API error:", err);
    return Response.json({ success: false, error: err.message || "Sync failed" }, { status: 500 });
  }
};
