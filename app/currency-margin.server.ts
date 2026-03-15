/**
 * Engine 23: Currency & Margin Optimizer
 *
 * Monitors exchange rate fluctuations and calculates their impact on
 * product margins. Suggests price adjustments and detects arbitrage
 * opportunities across different currency markets.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExchangeRateResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

interface RateInfo {
  from: string;
  to: string;
  rate: number;
}

interface MarginImpactResult {
  productId: string;
  title: string;
  currentPrice: number;
  currency: string;
  marginImpactPct: number;
  eventType: "favorable_rate" | "margin_squeeze";
}

interface PriceAdjustmentSuggestion {
  productId: string;
  title: string;
  currentPrice: number;
  suggestedPrice: number;
  reason: string;
  marginImpactPct: number;
}

interface ArbitrageOpportunity {
  targetCurrency: string;
  exchangeRate: number;
  pricingAdvantage: number;
  suggestedAction: string;
  affectedProductCount: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TARGET_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "ILS"];
const SIGNIFICANT_CHANGE_THRESHOLD = 2; // percent
const EXCHANGE_RATE_API_BASE = "https://open.er-api.com/v6/latest";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getBaseCurrency(shop: string): Promise<string> {
  const profile = await prisma.storeProfile.findUnique({
    where: { shop },
    select: { shop: true },
  });
  if (!profile) {
    logger.info("currency-margin", "No store profile found, defaulting to USD", {
      extra: { shop },
    });
  }
  // StoreProfile does not have a currency field yet; default to USD.
  // When the schema adds currency to StoreProfile, read it here.
  return "USD";
}

async function fetchExchangeRates(baseCurrency: string): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(`${EXCHANGE_RATE_API_BASE}/${baseCurrency}`);
    if (!response.ok) {
      logger.warn("currency-margin", "Exchange rate API returned non-OK status", {
        extra: { status: response.status, baseCurrency },
      });
      return null;
    }
    const data = (await response.json()) as ExchangeRateResponse;
    if (data.result !== "success") {
      logger.warn("currency-margin", "Exchange rate API returned failure result", {
        extra: { result: data.result, baseCurrency },
      });
      return null;
    }
    return data.rates;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("currency-margin", "Failed to fetch exchange rates", {
      extra: { error: message, baseCurrency },
    });
    return null;
  }
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── 1. Check Exchange Rates ─────────────────────────────────────────────────

/**
 * Fetch current exchange rates for the store's base currency
 * against all target currencies.
 */
export async function checkExchangeRates(
  shop: string,
): Promise<{ baseCurrency: string; rates: RateInfo[] }> {
  const baseCurrency = await getBaseCurrency(shop);

  logger.info("currency-margin", "Checking exchange rates", {
    extra: { shop, baseCurrency },
  });

  const allRates = await fetchExchangeRates(baseCurrency);
  if (!allRates) {
    return { baseCurrency, rates: [] };
  }

  const relevantRates: RateInfo[] = TARGET_CURRENCIES
    .filter((c) => c !== baseCurrency && allRates[c] !== undefined)
    .map((c) => ({
      from: baseCurrency,
      to: c,
      rate: allRates[c],
    }));

  logger.info("currency-margin", "Exchange rates retrieved", {
    extra: { shop, pairsCount: relevantRates.length },
  });

  return { baseCurrency, rates: relevantRates };
}

// ─── 2. Calculate Margin Impact ──────────────────────────────────────────────

/**
 * Compare current exchange rates to the most recent CurrencyMarginEvent records.
 * Create new events when changes exceed the significance threshold.
 */
export async function calculateMarginImpact(
  shop: string,
): Promise<MarginImpactResult[]> {
  const baseCurrency = await getBaseCurrency(shop);

  logger.info("currency-margin", "Calculating margin impact", {
    extra: { shop, baseCurrency },
  });

  const allRates = await fetchExchangeRates(baseCurrency);
  if (!allRates) {
    return [];
  }

  // Get products to evaluate
  const products = await prisma.product.findMany({
    where: { shop, status: "ACTIVE" },
    select: { id: true, title: true, price: true },
    take: 200,
  });

  if (products.length === 0) {
    logger.info("currency-margin", "No active products found", { extra: { shop } });
    return [];
  }

  const results: MarginImpactResult[] = [];

  for (const targetCurrency of TARGET_CURRENCIES) {
    if (targetCurrency === baseCurrency || allRates[targetCurrency] === undefined) {
      continue;
    }

    const currentRate = allRates[targetCurrency];

    // Find the most recent event for this currency pair
    const previousEvent = await prisma.currencyMarginEvent.findFirst({
      where: {
        shop,
        fromCurrency: baseCurrency,
        toCurrency: targetCurrency,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!previousEvent) {
      // No history — record the baseline rate
      await prisma.currencyMarginEvent.create({
        data: {
          shop,
          eventType: "favorable_rate",
          fromCurrency: baseCurrency,
          toCurrency: targetCurrency,
          exchangeRate: currentRate,
          marginImpactPct: 0,
          actionTaken: "Baseline rate recorded",
        },
      });
      continue;
    }

    const previousRate = previousEvent.exchangeRate;
    const impactPct = roundTo(((currentRate - previousRate) / previousRate) * 100, 2);

    if (Math.abs(impactPct) < SIGNIFICANT_CHANGE_THRESHOLD) {
      continue;
    }

    // Positive impactPct means base currency weakened relative to target
    // (you get more target currency per base unit) — margin_squeeze for importers
    // Negative impactPct means base currency strengthened — favorable for importers
    const eventType: "favorable_rate" | "margin_squeeze" =
      impactPct > 0 ? "margin_squeeze" : "favorable_rate";

    const affectedProducts = products.map((p) => ({
      productId: p.id,
      title: p.title,
      currentPrice: parseFloat(p.price) || 0,
      currency: targetCurrency,
      marginImpactPct: impactPct,
      eventType,
    }));

    results.push(...affectedProducts);

    const productIds = products.map((p) => p.id);

    await prisma.currencyMarginEvent.create({
      data: {
        shop,
        eventType,
        fromCurrency: baseCurrency,
        toCurrency: targetCurrency,
        exchangeRate: currentRate,
        previousRate,
        marginImpactPct: impactPct,
        actionTaken: `Detected ${eventType}: ${baseCurrency}/${targetCurrency} changed ${impactPct}%`,
        productsAffected: JSON.stringify(productIds),
      },
    });

    logger.info("currency-margin", "Significant rate change detected", {
      extra: {
        shop,
        pair: `${baseCurrency}/${targetCurrency}`,
        impactPct,
        eventType,
        productsAffected: products.length,
      },
    });
  }

  return results;
}

// ─── 3. Suggest Price Adjustments ────────────────────────────────────────────

/**
 * For products affected by margin squeeze, calculate a suggested new price
 * to maintain the original margin. Factor in competitor pricing if available.
 */
export async function suggestPriceAdjustments(
  shop: string,
): Promise<PriceAdjustmentSuggestion[]> {
  const baseCurrency = await getBaseCurrency(shop);

  logger.info("currency-margin", "Generating price adjustment suggestions", {
    extra: { shop },
  });

  // Get recent margin-squeeze events
  const squeezeEvents = await prisma.currencyMarginEvent.findMany({
    where: {
      shop,
      eventType: "margin_squeeze",
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (squeezeEvents.length === 0) {
    logger.info("currency-margin", "No recent margin squeeze events", {
      extra: { shop },
    });
    return [];
  }

  const products = await prisma.product.findMany({
    where: { shop, status: "ACTIVE" },
    select: { id: true, title: true, price: true },
    take: 200,
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Get competitor pricing for context
  const competitorSnapshots = await prisma.competitorSnapshot.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const avgCompetitorPrice =
    competitorSnapshots.length > 0
      ? competitorSnapshots.reduce((sum, s) => sum + (s.avgPrice ?? 0), 0) /
        competitorSnapshots.filter((s) => s.avgPrice != null).length || null
      : null;

  const suggestions: PriceAdjustmentSuggestion[] = [];
  const seenProducts = new Set<string>();

  for (const event of squeezeEvents) {
    const impactPct = event.marginImpactPct ?? 0;
    if (Math.abs(impactPct) < SIGNIFICANT_CHANGE_THRESHOLD) continue;

    let affectedIds: string[] = [];
    if (event.productsAffected) {
      try {
        affectedIds = JSON.parse(event.productsAffected) as string[];
      } catch {
        // If parsing fails, use all products
        affectedIds = products.map((p) => p.id);
      }
    }

    for (const pid of affectedIds) {
      if (seenProducts.has(pid)) continue;
      seenProducts.add(pid);

      const product = productMap.get(pid);
      if (!product) continue;

      const currentPrice = parseFloat(product.price) || 0;
      if (currentPrice <= 0) continue;

      // Adjust price upward to compensate for margin squeeze
      const adjustmentFactor = 1 + Math.abs(impactPct) / 100;
      let suggestedPrice = roundTo(currentPrice * adjustmentFactor, 2);

      let reason = `${baseCurrency}/${event.toCurrency} rate changed ${impactPct}% — price increase needed to maintain margin`;

      // Cap the suggestion if competitor data indicates it would be uncompetitive
      if (avgCompetitorPrice != null && suggestedPrice > avgCompetitorPrice * 1.15) {
        suggestedPrice = roundTo(avgCompetitorPrice * 1.1, 2);
        reason += ` (capped near competitor avg price ${avgCompetitorPrice.toFixed(2)})`;
      }

      suggestions.push({
        productId: pid,
        title: product.title,
        currentPrice,
        suggestedPrice,
        reason,
        marginImpactPct: impactPct,
      });
    }
  }

  logger.info("currency-margin", "Price adjustment suggestions generated", {
    extra: { shop, suggestionCount: suggestions.length },
  });

  return suggestions;
}

// ─── 4. Detect Arbitrage Opportunities ───────────────────────────────────────

/**
 * Find markets/currencies where the exchange rate gives the store
 * a pricing advantage. Suggest targeting those markets.
 */
export async function detectArbitrageOpportunity(
  shop: string,
): Promise<ArbitrageOpportunity[]> {
  const baseCurrency = await getBaseCurrency(shop);

  logger.info("currency-margin", "Detecting arbitrage opportunities", {
    extra: { shop, baseCurrency },
  });

  const allRates = await fetchExchangeRates(baseCurrency);
  if (!allRates) {
    return [];
  }

  const productCount = await prisma.product.count({
    where: { shop, status: "ACTIVE" },
  });

  const opportunities: ArbitrageOpportunity[] = [];

  for (const targetCurrency of TARGET_CURRENCIES) {
    if (targetCurrency === baseCurrency || allRates[targetCurrency] === undefined) {
      continue;
    }

    const currentRate = allRates[targetCurrency];

    // Find the most recent event for this pair
    const previousEvent = await prisma.currencyMarginEvent.findFirst({
      where: {
        shop,
        fromCurrency: baseCurrency,
        toCurrency: targetCurrency,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!previousEvent) continue;

    const previousRate = previousEvent.exchangeRate;
    const changePct = ((currentRate - previousRate) / previousRate) * 100;

    // Arbitrage: if our base currency strengthened significantly against a target,
    // our products are effectively cheaper in that market
    if (changePct < -SIGNIFICANT_CHANGE_THRESHOLD) {
      const advantage = roundTo(Math.abs(changePct), 2);

      opportunities.push({
        targetCurrency,
        exchangeRate: currentRate,
        pricingAdvantage: advantage,
        suggestedAction:
          `${baseCurrency} strengthened ${advantage}% vs ${targetCurrency}. ` +
          `Products are effectively ${advantage}% cheaper for ${targetCurrency} buyers. ` +
          `Consider increasing ad spend targeting ${targetCurrency} markets.`,
        affectedProductCount: productCount,
      });

      await prisma.currencyMarginEvent.create({
        data: {
          shop,
          eventType: "arbitrage_opportunity",
          fromCurrency: baseCurrency,
          toCurrency: targetCurrency,
          exchangeRate: currentRate,
          previousRate,
          marginImpactPct: changePct,
          actionTaken: `Arbitrage detected: ${advantage}% pricing advantage in ${targetCurrency} market`,
          productsAffected: JSON.stringify({ affectedCount: productCount }),
        },
      });

      logger.info("currency-margin", "Arbitrage opportunity detected", {
        extra: {
          shop,
          pair: `${baseCurrency}/${targetCurrency}`,
          advantage,
          productCount,
        },
      });
    }
  }

  return opportunities;
}

// ─── 5. Get Currency Events ──────────────────────────────────────────────────

/**
 * Retrieve recent currency margin events for the store.
 */
export async function getCurrencyEvents(shop: string) {
  return prisma.currencyMarginEvent.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
