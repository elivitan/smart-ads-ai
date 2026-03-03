// app/license.server.js
// ══════════════════════════════════════════════
// LICENSE CHECK MIDDLEWARE
// Every API route calls this to verify the shop
// has permission to use the requested feature.
// ══════════════════════════════════════════════

import prisma from "./db.server.js";

// Plan limits configuration
const PLAN_LIMITS = {
  free:    { maxProducts: 3,  maxCampaigns: 0,  aiCreditsMonthly: 0,   scanCreditsMonthly: 0,   dailyApiCalls: 20,  canPublish: false },
  starter: { maxProducts: 25, maxCampaigns: 5,  aiCreditsMonthly: 10,  scanCreditsMonthly: 50,  dailyApiCalls: 200, canPublish: true },
  pro:     { maxProducts: 9999, maxCampaigns: 9999, aiCreditsMonthly: 200, scanCreditsMonthly: 9999, dailyApiCalls: 1000, canPublish: true },
  premium: { maxProducts: 9999, maxCampaigns: 9999, aiCreditsMonthly: 1000, scanCreditsMonthly: 9999, dailyApiCalls: 5000, canPublish: true },
};

// ──────────────────────────────────────────────
// Get or create shop subscription
// ──────────────────────────────────────────────
export async function getShopSubscription(shop) {
  if (!shop) throw new Error("Shop domain is required");

  let sub = await prisma.shopSubscription.findUnique({ where: { shop } });

  if (!sub) {
    // First time — create free plan
    sub = await prisma.shopSubscription.create({
      data: {
        shop,
        plan: "free",
        status: "active",
        scanCredits: 3, // free welcome credits
        aiCredits: 0,
        maxProducts: 3,
        maxCampaigns: 0,
      },
    });
  }

  // Reset daily counters if needed
  const now = new Date();
  if (sub.rateLimitReset < now) {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    sub = await prisma.shopSubscription.update({
      where: { shop },
      data: {
        scanCountToday: 0,
        apiCallsToday: 0,
        rateLimitReset: tomorrow,
      },
    });
  }

  return sub;
}

// ──────────────────────────────────────────────
// Check if shop can perform an action
// Returns { allowed: true/false, reason, sub }
// ──────────────────────────────────────────────
export async function checkLicense(shop, action) {
  const sub = await getShopSubscription(shop);
  const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.free;

  // Check trial expiration
  if (sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt < new Date()) {
    await prisma.shopSubscription.update({
      where: { shop },
      data: { status: "expired", plan: "free" },
    });
    sub.plan = "free";
    sub.status = "expired";
  }

  // Daily rate limit check
  if (sub.apiCallsToday >= limits.dailyApiCalls) {
    return { allowed: false, reason: "Daily API limit reached. Try again tomorrow.", sub };
  }

  // Increment API call counter
  await prisma.shopSubscription.update({
    where: { shop },
    data: { apiCallsToday: { increment: 1 } },
  });

  switch (action) {
    case "scan": {
      // Paid plans get unlimited scans; free/credits users need credits
      if (sub.plan !== "free") {
        // Check daily scan limit for paid plans
        if (sub.scanCountToday >= limits.dailyApiCalls) {
          return { allowed: false, reason: "Daily scan limit reached.", sub };
        }
        return { allowed: true, sub };
      }
      // Free plan — check scan credits
      if (sub.scanCredits <= 0) {
        return { allowed: false, reason: "No scan credits remaining. Buy credits or subscribe.", sub };
      }
      return { allowed: true, sub };
    }

    case "campaign": {
      if (!limits.canPublish) {
        return { allowed: false, reason: "Subscribe to publish campaigns to Google Ads.", sub };
      }
      return { allowed: true, sub };
    }

    case "ai-improve": {
      if (sub.aiCredits <= 0) {
        return { allowed: false, reason: "No AI credits remaining. Buy more credits.", sub };
      }
      return { allowed: true, sub };
    }

    case "competitor-intel": {
      if (sub.plan === "free" && sub.scanCredits <= 0) {
        return { allowed: false, reason: "Subscribe or buy credits for competitor intelligence.", sub };
      }
      return { allowed: true, sub };
    }

    default:
      return { allowed: true, sub };
  }
}

// ──────────────────────────────────────────────
// Use a scan credit (call AFTER successful scan)
// ──────────────────────────────────────────────
export async function useScanCredit(shop) {
  const sub = await getShopSubscription(shop);

  if (sub.plan === "free") {
    // Deduct from purchased credits
    if (sub.scanCredits > 0) {
      await prisma.shopSubscription.update({
        where: { shop },
        data: {
          scanCredits: { decrement: 1 },
          scanCountToday: { increment: 1 },
          lastScanAt: new Date(),
        },
      });
    }
  } else {
    // Paid plan — just track usage
    await prisma.shopSubscription.update({
      where: { shop },
      data: {
        scanCountToday: { increment: 1 },
        lastScanAt: new Date(),
      },
    });
  }
}

// ──────────────────────────────────────────────
// Use an AI credit (call AFTER successful improvement)
// ──────────────────────────────────────────────
export async function useAiCredit(shop) {
  await prisma.shopSubscription.update({
    where: { shop },
    data: { aiCredits: { decrement: 1 } },
  });
}

// ──────────────────────────────────────────────
// Add credits (after purchase)
// ──────────────────────────────────────────────
export async function addCredits(shop, type, amount) {
  const field = type === "scan" ? "scanCredits" : "aiCredits";
  await prisma.shopSubscription.update({
    where: { shop },
    data: { [field]: { increment: amount } },
  });
}

// ──────────────────────────────────────────────
// Update plan (after subscription change)
// ──────────────────────────────────────────────
export async function updatePlan(shop, plan, options = {}) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const data = {
    plan,
    status: options.trial ? "trial" : "active",
    maxProducts: limits.maxProducts,
    maxCampaigns: limits.maxCampaigns,
    aiCredits: limits.aiCreditsMonthly,
    updatedAt: new Date(),
  };

  if (options.trial && options.trialDays) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + options.trialDays);
    data.trialEndsAt = trialEnd;
  }

  if (!options.trial) {
    data.billingStartedAt = new Date();
  }

  return prisma.shopSubscription.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

// ──────────────────────────────────────────────
// Get subscription info for frontend
// ──────────────────────────────────────────────
export async function getSubscriptionInfo(shop) {
  const sub = await getShopSubscription(shop);
  const limits = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.free;
  return {
    plan: sub.plan,
    status: sub.status,
    scanCredits: sub.scanCredits,
    aiCredits: sub.aiCredits,
    canPublish: limits.canPublish,
    maxProducts: limits.maxProducts,
    maxCampaigns: limits.maxCampaigns,
    trialEndsAt: sub.trialEndsAt,
    apiCallsToday: sub.apiCallsToday,
    dailyLimit: limits.dailyApiCalls,
  };
}
