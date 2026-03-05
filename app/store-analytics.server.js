// app/store-analytics.server.js
// ══════════════════════════════════════════════════════════════
// Store Analytics Engine — Pre-campaign intelligence
// Pulls real store data to assess campaign readiness
//
// Sources:
//   1. Shopify Admin API (orders, products, shop info)
//   2. Google Analytics (placeholder — future)
//   3. Google Search Console (placeholder — future)
//   4. Google Merchant Center (placeholder — future)
// ══════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────
// SOURCE 1: Shopify Admin API
// ─────────────────────────────────────────────────

export async function getShopifyAnalytics(admin, shop) {
  try {
    // Query 1: Shop info + orders summary (last 30 days)
    const response = await admin.graphql(`{
      shop {
        name
        email
        primaryDomain { url }
        plan { displayName }
        currencyCode
        billingAddress { country countryCodeV2 }
      }
      orders(first: 50, sortKey: CREATED_AT, reverse: true, query: "created_at:>='${thirtyDaysAgo()}'") {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            subtotalPriceSet { shopMoney { amount } }
            currentTotalDiscountsSet { shopMoney { amount } }
            displayFinancialStatus
            displayFulfillmentStatus
            lineItems(first: 5) {
              edges { node { title quantity originalUnitPriceSet { shopMoney { amount } } } }
            }
          }
        }
      }
    }`);

    const data = await response.json();
    const shopInfo = data.data?.shop || {};
    const orderEdges = data.data?.orders?.edges || [];
    const orders = orderEdges.map(e => e.node);

    // Calculate order metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.totalPriceSet?.shopMoney?.amount || 0), 0);
    const totalDiscounts = orders.reduce((sum, o) => sum + parseFloat(o.currentTotalDiscountsSet?.shopMoney?.amount || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const currency = shopInfo.currencyCode || "USD";

    // Order frequency
    const ordersPerDay = totalOrders / 30;
    const ordersPerWeek = ordersPerDay * 7;

    // Top selling products from orders
    const productCounts = {};
    orders.forEach(o => {
      (o.lineItems?.edges || []).forEach(li => {
        const title = li.node.title;
        productCounts[title] = (productCounts[title] || 0) + li.node.quantity;
      });
    });
    const topSellingProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, qty]) => ({ title, qty }));

    // Fulfillment status breakdown
    const fulfillmentStatus = {};
    orders.forEach(o => {
      const status = o.displayFulfillmentStatus || "UNKNOWN";
      fulfillmentStatus[status] = (fulfillmentStatus[status] || 0) + 1;
    });

    // Financial status breakdown
    const financialStatus = {};
    orders.forEach(o => {
      const status = o.displayFinancialStatus || "UNKNOWN";
      financialStatus[status] = (financialStatus[status] || 0) + 1;
    });

    // Query 2: Product count and inventory
    const prodResponse = await admin.graphql(`{
      productsCount { count }
      products(first: 5, sortKey: TITLE) {
        edges {
          node {
            title
            totalInventory
            status
            onlineStoreUrl
            priceRangeV2 { maxVariantPrice { amount } minVariantPrice { amount } }
          }
        }
      }
    }`);

    const prodData = await prodResponse.json();
    const totalProducts = prodData.data?.productsCount?.count || 0;
    const bestSelling = (prodData.data?.products?.edges || []).map(e => ({
      title: e.node.title,
      inventory: e.node.totalInventory,
      status: e.node.status,
      hasUrl: !!e.node.onlineStoreUrl,
      priceRange: e.node.priceRangeV2 ? {
        min: parseFloat(e.node.priceRangeV2.minVariantPrice?.amount || 0),
        max: parseFloat(e.node.priceRangeV2.maxVariantPrice?.amount || 0),
      } : null,
    }));

    // Determine store country/market
    const country = shopInfo.billingAddress?.countryCodeV2 || "US";

    return {
      source: "shopify",
      shop: {
        name: shopInfo.name,
        domain: shopInfo.primaryDomain?.url || shop,
        plan: shopInfo.plan?.displayName || "unknown",
        country,
        currency,
      },
      orders: {
        total30d: totalOrders,
        revenue30d: Math.round(totalRevenue * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        ordersPerDay: Math.round(ordersPerDay * 10) / 10,
        ordersPerWeek: Math.round(ordersPerWeek * 10) / 10,
        totalDiscounts30d: Math.round(totalDiscounts * 100) / 100,
        fulfillmentStatus,
        financialStatus,
      },
      products: {
        totalProducts,
        topSelling: topSellingProducts,
        bestSelling,
      },
      // Placeholder metrics for future Google integrations
      traffic: {
        source: "estimated",
        sessions30d: estimateSessions(totalOrders),
        conversionRate: totalOrders > 0 ? Math.round((totalOrders / estimateSessions(totalOrders)) * 10000) / 100 : 0,
        note: "Estimated from orders. Connect Google Analytics for real data.",
      },
      search: {
        source: "unavailable",
        note: "Connect Google Search Console for organic search data.",
      },
      googleAds: {
        source: "unavailable",
        note: "Connect Google Ads for campaign performance data.",
      },
      merchantCenter: {
        source: "unavailable",
        note: "Connect Google Merchant Center for product listing data.",
      },
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[StoreAnalytics] Shopify API error:", err.message);
    return { source: "shopify", error: err.message };
  }
}

// Rough estimate: typical Shopify conversion rate is 1-3%
function estimateSessions(orders) {
  if (orders === 0) return 0;
  const estimatedRate = 0.018; // 1.8% average
  return Math.round(orders / estimatedRate);
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────
// AI ANALYSIS: Campaign readiness assessment
// ─────────────────────────────────────────────────

export async function analyzeCampaignReadiness(analyticsData) {
  if (!analyticsData || analyticsData.error) {
    return {
      readiness: "unknown",
      score: 0,
      recommendation: "Could not fetch store data.",
      confidence: 10,
    };
  }

  const prompt = `You are a Google Ads agency strategist reviewing a store BEFORE launching ad campaigns. Analyze this store data and give a campaign readiness assessment.

STORE DATA:
- Store: ${analyticsData.shop?.name || "Unknown"} (${analyticsData.shop?.domain || "unknown"})
- Plan: ${analyticsData.shop?.plan || "unknown"}
- Country: ${analyticsData.shop?.country || "US"}
- Currency: ${analyticsData.shop?.currency || "USD"}

ORDERS (Last 30 days):
- Total orders: ${analyticsData.orders?.total30d || 0}
- Revenue: $${analyticsData.orders?.revenue30d || 0}
- Avg order value: $${analyticsData.orders?.avgOrderValue || 0}
- Orders/day: ${analyticsData.orders?.ordersPerDay || 0}
- Total discounts: $${analyticsData.orders?.totalDiscounts30d || 0}

PRODUCTS:
- Total products: ${analyticsData.products?.totalProducts || 0}
- Top selling: ${analyticsData.products?.topSelling?.map(p => `${p.title} (${p.qty} sold)`).join(", ") || "none"}
- Best selling products inventory: ${analyticsData.products?.bestSelling?.map(p => `${p.title}: ${p.inventory} in stock`).join(", ") || "unknown"}

TRAFFIC (estimated):
- Est. sessions/month: ${analyticsData.traffic?.sessions30d || 0}
- Est. conversion rate: ${analyticsData.traffic?.conversionRate || 0}%

Based on this data, respond ONLY with valid JSON:
{
  "readiness_score": 0-100,
  "readiness_level": "ready" | "almost_ready" | "needs_work" | "not_ready",
  "readiness_label": "2-4 word label",
  "headline": "one line assessment",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "before_campaign": ["action item 1 the store should do before advertising", "action 2"],
  "recommended_daily_budget": number in USD,
  "recommended_campaign_type": "search" | "pmax" | "shopping",
  "expected_roas": number (e.g. 2.5),
  "expected_cpa": number in USD,
  "focus_products": ["product names that should be advertised first"],
  "avoid_products": ["products NOT worth advertising and why"],
  "confidence": 0-100
}

Rules:
- If store has 0 orders and 0 traffic, it's "not_ready" — they need organic traffic first
- If conversion rate < 1%, suggest improving the store before spending on ads
- Low inventory items should not be advertised
- Recommend budget based on AOV and expected ROAS
- Be honest — if it's not worth advertising yet, say so
- focus_products should be the ones with best margin potential and inventory
Respond ONLY with valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.text || "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return {
      ...analysis,
      _dataSource: {
        shopify: true,
        googleAnalytics: false,
        searchConsole: false,
        merchantCenter: false,
      },
    };
  } catch (err) {
    console.error("[StoreAnalytics] AI analysis failed:", err.message);
    return {
      readiness_score: 50,
      readiness_level: "unknown",
      readiness_label: "Analysis failed",
      headline: "Could not analyze store readiness",
      strengths: [],
      weaknesses: [],
      before_campaign: ["Try again later"],
      recommended_daily_budget: 30,
      recommended_campaign_type: "search",
      expected_roas: 2.0,
      expected_cpa: 15,
      focus_products: [],
      avoid_products: [],
      confidence: 10,
    };
  }
}
