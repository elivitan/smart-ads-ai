import { authenticate } from "../shopify.server";

/**
 * Campaign Management API
 * Actions: list, pause, enable, remove, diagnose (auto-error detection)
 */

const GOOGLE_ADS_API = "https://googleads.googleapis.com/v17";

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

function gadsHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
}

async function gadsQuery(token, customerId, query) {
  const url = `${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: "POST",
    headers: gadsHeaders(token),
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Query failed: ${res.status}`);
  return data;
}

async function gadsMutate(token, customerId, endpoint, operations) {
  const url = `${GOOGLE_ADS_API}/customers/${customerId}/${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: gadsHeaders(token),
    body: JSON.stringify({ operations }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Mutate failed: ${res.status}`);
  return data;
}

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const action = formData.get("action"); // list, pause, enable, remove, diagnose

  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN || !process.env.GOOGLE_ADS_REFRESH_TOKEN) {
    // Simulated mode
    return Response.json(getSimulatedResponse(action, formData));
  }

  try {
    const token = await getAccessToken();
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, "");

    switch (action) {
      case "list": return Response.json(await listCampaigns(token, customerId));
      case "pause": return Response.json(await updateCampaignStatus(token, customerId, formData.get("campaignId"), "PAUSED"));
      case "enable": return Response.json(await updateCampaignStatus(token, customerId, formData.get("campaignId"), "ENABLED"));
      case "remove": return Response.json(await updateCampaignStatus(token, customerId, formData.get("campaignId"), "REMOVED"));
      case "diagnose": return Response.json(await diagnoseCampaigns(token, customerId));
      default: return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Campaign management error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};

/**
 * List all Smart Ads campaigns with metrics
 */
async function listCampaigns(token, customerId) {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      campaign.campaign_budget
    FROM campaign
    WHERE campaign.name LIKE 'Smart Ads%'
    AND campaign.status != 'REMOVED'
    ORDER BY campaign.id DESC
    LIMIT 50
  `;

  const result = await gadsQuery(token, customerId, query);
  const campaigns = [];

  if (result && result[0]?.results) {
    for (const row of result[0].results) {
      const c = row.campaign;
      const m = row.metrics;
      const b = row.campaignBudget;
      campaigns.push({
        id: c.id,
        name: c.name,
        status: c.status,
        type: c.advertisingChannelType,
        biddingStrategy: c.biddingStrategyType,
        dailyBudget: b?.amountMicros ? (parseInt(b.amountMicros) / 1000000).toFixed(2) : "0",
        impressions: parseInt(m?.impressions || 0),
        clicks: parseInt(m?.clicks || 0),
        cost: m?.costMicros ? (parseInt(m.costMicros) / 1000000).toFixed(2) : "0",
        conversions: parseFloat(m?.conversions || 0).toFixed(1),
        conversionValue: parseFloat(m?.conversionsValue || 0).toFixed(2),
        ctr: (parseFloat(m?.ctr || 0) * 100).toFixed(2),
        avgCpc: m?.averageCpc ? (parseInt(m.averageCpc) / 1000000).toFixed(2) : "0",
        resourceName: `customers/${customerId}/campaigns/${c.id}`,
      });
    }
  }

  return { success: true, campaigns };
}

/**
 * Update campaign status (PAUSE, ENABLE, REMOVE)
 */
async function updateCampaignStatus(token, customerId, campaignId, newStatus) {
  if (!campaignId) throw new Error("Campaign ID required");

  const resourceName = campaignId.includes("/") ? campaignId : `customers/${customerId}/campaigns/${campaignId}`;

  await gadsMutate(token, customerId, "campaigns:mutate", [{
    update: {
      resourceName,
      status: newStatus,
    },
    updateMask: "status",
  }]);

  return {
    success: true,
    message: `Campaign ${newStatus === "PAUSED" ? "paused" : newStatus === "ENABLED" ? "enabled" : "removed"} successfully`,
    campaignId,
    newStatus,
  };
}

/**
 * Auto-diagnose campaigns — detect issues and suggest/apply fixes
 */
async function diagnoseCampaigns(token, customerId) {
  // 1. Get campaign issues via recommendations
  const recQuery = `
    SELECT
      recommendation.type,
      recommendation.campaign,
      recommendation.impact,
      recommendation.ad_text_asset_recommendation,
      recommendation.keyword_recommendation,
      recommendation.responsive_search_ad_recommendation
    FROM recommendation
    WHERE recommendation.campaign.name LIKE 'Smart Ads%'
    LIMIT 50
  `;

  // 2. Get ad group ad policy status
  const adQuery = `
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.policy_summary.approval_status,
      ad_group_ad.policy_summary.policy_topic_entries,
      ad_group_ad.status,
      campaign.name,
      campaign.id
    FROM ad_group_ad
    WHERE campaign.name LIKE 'Smart Ads%'
    AND ad_group_ad.status != 'REMOVED'
    LIMIT 50
  `;

  let recommendations = [];
  let adIssues = [];

  try {
    const recResult = await gadsQuery(token, customerId, recQuery);
    if (recResult?.[0]?.results) {
      recommendations = recResult[0].results.map(r => ({
        type: r.recommendation.type,
        campaign: r.recommendation.campaign,
        impact: r.recommendation.impact,
      }));
    }
  } catch (e) {
    console.log("Recommendations query failed (may be empty):", e.message);
  }

  try {
    const adResult = await gadsQuery(token, customerId, adQuery);
    if (adResult?.[0]?.results) {
      for (const row of adResult[0].results) {
        const policy = row.adGroupAd?.policySummary;
        if (policy?.approvalStatus !== "APPROVED" && policy?.approvalStatus !== "APPROVED_LIMITED") {
          adIssues.push({
            campaignId: row.campaign.id,
            campaignName: row.campaign.name,
            adId: row.adGroupAd.ad.id,
            approvalStatus: policy.approvalStatus,
            policyTopics: (policy.policyTopicEntries || []).map(p => ({
              topic: p.topic,
              type: p.type,
            })),
          });
        }
      }
    }
  } catch (e) {
    console.log("Ad policy query failed:", e.message);
  }

  // Build diagnosis report
  const issues = [];
  const fixes = [];

  // Check ad disapprovals
  for (const ad of adIssues) {
    issues.push({
      severity: "HIGH",
      type: "AD_DISAPPROVED",
      campaign: ad.campaignName,
      message: `Ad ${ad.adId} is ${ad.approvalStatus}`,
      details: ad.policyTopics.map(p => `${p.topic} (${p.type})`).join(", "),
      autoFixable: false,
    });
  }

  // Check recommendations and suggest fixes
  const recTypes = {};
  for (const rec of recommendations) {
    recTypes[rec.type] = (recTypes[rec.type] || 0) + 1;
  }

  if (recTypes["KEYWORD"]) {
    issues.push({
      severity: "MEDIUM",
      type: "KEYWORD_SUGGESTION",
      message: `${recTypes["KEYWORD"]} keyword recommendations available`,
      autoFixable: true,
      fixAction: "Apply Google's keyword suggestions to improve reach",
    });
  }

  if (recTypes["RESPONSIVE_SEARCH_AD"]) {
    issues.push({
      severity: "MEDIUM",
      type: "RSA_IMPROVEMENT",
      message: `${recTypes["RESPONSIVE_SEARCH_AD"]} ad copy improvements suggested`,
      autoFixable: true,
      fixAction: "Update headlines/descriptions per Google's recommendations",
    });
  }

  if (recTypes["TEXT_AD"]) {
    issues.push({
      severity: "LOW",
      type: "AD_TEXT_SUGGESTION",
      message: `${recTypes["TEXT_AD"]} text asset improvements available`,
      autoFixable: true,
    });
  }

  return {
    success: true,
    diagnosis: {
      totalIssues: issues.length,
      highSeverity: issues.filter(i => i.severity === "HIGH").length,
      mediumSeverity: issues.filter(i => i.severity === "MEDIUM").length,
      lowSeverity: issues.filter(i => i.severity === "LOW").length,
      issues,
      autoFixableCount: issues.filter(i => i.autoFixable).length,
      lastChecked: new Date().toISOString(),
    },
  };
}

/**
 * Simulated responses when Google Ads is not connected
 */
function getSimulatedResponse(action, formData) {
  switch (action) {
    case "list":
      return {
        success: true,
        simulated: true,
        campaigns: [
          {
            id: "sim_001",
            name: "Smart Ads - Gift Card - 2026-02-26",
            status: "ENABLED",
            type: "PERFORMANCE_MAX",
            biddingStrategy: "MAXIMIZE_CONVERSIONS",
            dailyBudget: "43.87",
            impressions: 470,
            clicks: 23,
            cost: "8.50",
            conversions: "0.0",
            conversionValue: "0.00",
            ctr: "4.45",
            avgCpc: "0.36",
          },
          {
            id: "sim_002",
            name: "Smart Ads - Bedding Set - 2026-02-25",
            status: "PAUSED",
            type: "SEARCH",
            biddingStrategy: "MAXIMIZE_CLICKS",
            dailyBudget: "30.00",
            impressions: 1250,
            clicks: 45,
            cost: "22.50",
            conversions: "2.0",
            conversionValue: "156.00",
            ctr: "3.60",
            avgCpc: "0.50",
          },
        ],
      };
    case "pause":
    case "enable":
    case "remove":
      return {
        success: true,
        simulated: true,
        message: `Campaign ${action}d successfully (simulated)`,
        campaignId: formData.get("campaignId"),
        newStatus: action === "pause" ? "PAUSED" : action === "enable" ? "ENABLED" : "REMOVED",
      };
    case "diagnose":
      return {
        success: true,
        simulated: true,
        diagnosis: {
          totalIssues: 2,
          highSeverity: 0,
          mediumSeverity: 1,
          lowSeverity: 1,
          issues: [
            { severity: "MEDIUM", type: "KEYWORD_SUGGESTION", message: "3 keyword recommendations available", autoFixable: true, fixAction: "Add suggested keywords to improve reach" },
            { severity: "LOW", type: "AD_TEXT_SUGGESTION", message: "Consider adding more headline variations", autoFixable: true },
          ],
          autoFixableCount: 2,
          lastChecked: new Date().toISOString(),
        },
      };
    default:
      return { success: false, error: "Unknown action" };
  }
}
