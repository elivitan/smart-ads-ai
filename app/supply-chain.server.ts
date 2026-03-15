/**
 * Engine 18: Supply Chain Ads
 *
 * Track shipments, pre-warm audiences with teaser ads,
 * and auto-launch campaigns on product arrival.
 */

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { extractJsonFromText } from "./utils/ai-safety.server.js";
import Anthropic from "@anthropic-ai/sdk";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRE_WARM_WINDOW_DAYS = 14;
const LAUNCH_WINDOW_DAYS = 3;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterShipmentParams {
  productId: string;
  quantity: number;
  estimatedArrival: Date;
  source?: string;
}

interface RegisterShipmentResult {
  signalId: string;
  productTitle: string;
  estimatedArrival: Date;
  suggestedAction: string;
}

interface ShipmentStatusUpdate {
  signalId: string;
  productTitle: string;
  status: string;
  suggestedAction: string;
}

interface PreWarmCandidate {
  productId: string;
  title: string;
  arrivalDate: Date;
  teaserCopy: { headlines: string[]; descriptions: string[] };
}

// ─── 1. Register Shipment ─────────────────────────────────────────────────────

/**
 * Register an incoming shipment for a product.
 * Suggests pre_warm or launch_campaign based on arrival timing.
 */
export async function registerShipment(
  shop: string,
  params: RegisterShipmentParams,
): Promise<RegisterShipmentResult> {
  try {
    logger.info("supply-chain", "Registering shipment", {
      shop,
      extra: { productId: params.productId, quantity: params.quantity },
    });

    const product = await prisma.product.findFirst({
      where: { id: params.productId, shop },
    });

    if (!product) {
      throw new Error(`Product ${params.productId} not found for shop ${shop}`);
    }

    // Determine suggested action based on arrival date
    const now = new Date();
    const daysUntilArrival = Math.ceil(
      (params.estimatedArrival.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    let suggestedAction: string;
    if (daysUntilArrival > 7) {
      suggestedAction = "pre_warm";
    } else if (daysUntilArrival <= LAUNCH_WINDOW_DAYS) {
      suggestedAction = "launch_campaign";
    } else {
      suggestedAction = "pre_warm";
    }

    const signal = await prisma.supplyChainSignal.create({
      data: {
        shop,
        productId: params.productId,
        productTitle: product.title,
        signalType: "shipment_incoming",
        estimatedArrival: params.estimatedArrival,
        quantity: params.quantity,
        adAction: suggestedAction,
        status: "pending",
        preWarmStarted: false,
      },
    });

    logger.info("supply-chain", `Shipment registered: ${signal.id}`, {
      shop,
      extra: {
        productId: params.productId,
        daysUntilArrival,
        suggestedAction,
      },
    });

    return {
      signalId: signal.id,
      productTitle: product.title,
      estimatedArrival: params.estimatedArrival,
      suggestedAction,
    };
  } catch (err) {
    logger.error("supply-chain", "Failed to register shipment", {
      shop,
      error: err,
      extra: { productId: params.productId },
    });
    throw err;
  }
}

// ─── 2. Check Shipment Status ────────────────────────────────────────────────

/**
 * Update all pending shipments. If estimated arrival is today or past,
 * mark as "arrived" and suggest "boost_on_arrival".
 */
export async function checkShipmentStatus(
  shop: string,
): Promise<ShipmentStatusUpdate[]> {
  try {
    logger.info("supply-chain", "Checking shipment statuses", { shop });

    const pendingSignals = await prisma.supplyChainSignal.findMany({
      where: {
        shop,
        status: { in: ["pending", "in_transit"] },
      },
    });

    if (pendingSignals.length === 0) {
      logger.info("supply-chain", "No pending shipments found", { shop });
      return [];
    }

    const now = new Date();
    const updates: ShipmentStatusUpdate[] = [];

    for (const signal of pendingSignals) {
      try {
        let newStatus = signal.status;
        let suggestedAction = signal.adAction || "monitor";

        if (signal.estimatedArrival && signal.estimatedArrival <= now) {
          newStatus = "arrived";
          suggestedAction = "boost_on_arrival";

          await prisma.supplyChainSignal.update({
            where: { id: signal.id },
            data: {
              status: "arrived",
              actualArrival: now,
              adAction: "boost_on_arrival",
            },
          });
        }

        updates.push({
          signalId: signal.id,
          productTitle: signal.productTitle,
          status: newStatus,
          suggestedAction,
        });
      } catch (updateErr) {
        logger.error("supply-chain", "Failed to update shipment status", {
          shop,
          error: updateErr,
          extra: { signalId: signal.id },
        });
      }
    }

    logger.info("supply-chain", `Checked ${pendingSignals.length} shipments`, {
      shop,
      extra: {
        total: pendingSignals.length,
        arrived: updates.filter((u) => u.status === "arrived").length,
      },
    });

    return updates;
  } catch (err) {
    logger.error("supply-chain", "Failed to check shipment statuses", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 3. Get Pre-Warm Candidates ──────────────────────────────────────────────

/**
 * Find products needing pre-warming: arrival within 14 days, not yet started.
 * Uses Claude to generate teaser "Coming Soon" ad copy.
 */
export async function getPreWarmCandidates(
  shop: string,
): Promise<PreWarmCandidate[]> {
  try {
    logger.info("supply-chain", "Finding pre-warm candidates", { shop });

    const now = new Date();
    const windowEnd = new Date(now.getTime() + PRE_WARM_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const signals = await prisma.supplyChainSignal.findMany({
      where: {
        shop,
        preWarmStarted: false,
        estimatedArrival: {
          gte: now,
          lte: windowEnd,
        },
        status: { in: ["pending", "in_transit"] },
      },
    });

    if (signals.length === 0) {
      logger.info("supply-chain", "No pre-warm candidates found", { shop });
      return [];
    }

    const candidates: PreWarmCandidate[] = [];

    for (const signal of signals) {
      const daysUntil = Math.ceil(
        ((signal.estimatedArrival?.getTime() || 0) - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      let teaserCopy: { headlines: string[]; descriptions: string[] } = {
        headlines: [],
        descriptions: [],
      };

      try {
        const prompt = `Product: ${signal.productTitle}, arriving in ${daysUntil} days. Create 3 "Coming Soon" teaser headlines (max 30 chars) and 2 descriptions (max 90 chars) to build anticipation. Return JSON: {headlines[], descriptions[]}`;

        const response = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const match = extractJsonFromText(text);
        if (match) {
          teaserCopy = JSON.parse(match);
        }
      } catch (aiErr) {
        logger.error("supply-chain", "AI teaser generation failed, using defaults", {
          shop,
          error: aiErr,
          extra: { productId: signal.productId },
        });
        teaserCopy = {
          headlines: [
            `Coming Soon: ${signal.productTitle.slice(0, 14)}`,
            `${daysUntil} Days Away!`,
            "Be the First to Know",
          ],
          descriptions: [
            `${signal.productTitle.slice(0, 50)} is arriving soon. Stay tuned!`,
            `Get ready! Available in just ${daysUntil} days. Don't miss the launch.`,
          ],
        };
      }

      candidates.push({
        productId: signal.productId,
        title: signal.productTitle,
        arrivalDate: signal.estimatedArrival || new Date(),
        teaserCopy,
      });
    }

    logger.info("supply-chain", `Found ${candidates.length} pre-warm candidates`, {
      shop,
    });

    return candidates;
  } catch (err) {
    logger.error("supply-chain", "Failed to find pre-warm candidates", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 4. Get Active Shipments ─────────────────────────────────────────────────

/**
 * Get all tracked shipments for the shop.
 */
export async function getActiveShipments(shop: string) {
  try {
    logger.info("supply-chain", "Fetching active shipments", { shop });

    const shipments = await prisma.supplyChainSignal.findMany({
      where: {
        shop,
        status: { in: ["pending", "in_transit"] },
      },
      orderBy: { estimatedArrival: "asc" },
    });

    logger.info("supply-chain", `Found ${shipments.length} active shipments`, {
      shop,
    });

    return shipments;
  } catch (err) {
    logger.error("supply-chain", "Failed to fetch active shipments", {
      shop,
      error: err,
    });
    throw err;
  }
}
