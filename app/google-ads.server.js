import { GoogleAdsApi, enums } from "google-ads-api";

const client = new GoogleAdsApi({
  client_id: process.env.GOOGLE_ADS_CLIENT_ID,
  client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

function getCustomer() {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, "");
  return client.Customer({
    customer_id: customerId,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });
}

// ── Budget (shared by all campaign types) ────────────────────────────────
async function createBudget(customer, productTitle, dailyBudget) {
  const budget = {
    name: `Smart Ads Budget - ${productTitle} - ${Date.now()}`,
    amount_micros: dailyBudget * 1_000_000,
    delivery_method: enums.BudgetDeliveryMethod.STANDARD,
  };
  const { results } = await customer.campaignBudgets.create([budget]);
  return results[0];
}

// ── Search Campaign ──────────────────────────────────────────────────────
async function createSearchCampaign(customer, {
  productTitle, headlines, descriptions, keywords, finalUrl, budgetResourceName, bidding,
}) {
  // Campaign
  const biddingConfig = buildBiddingConfig(bidding, "search");
  const campaign = {
    name: `Smart Ads - ${productTitle} - ${new Date().toLocaleDateString()}`,
    campaign_budget: budgetResourceName,
    advertising_channel_type: enums.AdvertisingChannelType.SEARCH,
    status: enums.CampaignStatus.PAUSED,
    ...biddingConfig,
  };
  const { results: campaignResults } = await customer.campaigns.create([campaign]);
  const campaignResourceName = campaignResults[0];

  // Ad Group
  const adGroup = {
    name: `${productTitle} - Main`,
    campaign: campaignResourceName,
    status: enums.AdGroupStatus.ENABLED,
    cpc_bid_micros: 1_000_000,
  };
  const { results: adGroupResults } = await customer.adGroups.create([adGroup]);
  const adGroupResourceName = adGroupResults[0];

  // Keywords
  const keywordCriteria = keywords.slice(0, 20).map((kw) => {
    const text = typeof kw === "string" ? kw : kw.text || kw;
    const matchType = typeof kw === "object" && kw.match_type
      ? enums.KeywordMatchType[kw.match_type] || enums.KeywordMatchType.BROAD
      : enums.KeywordMatchType.BROAD;
    return {
      ad_group: adGroupResourceName,
      status: enums.AdGroupCriterionStatus.ENABLED,
      keyword: { text, match_type: matchType },
    };
  });
  if (keywordCriteria.length > 0) {
    await customer.adGroupCriteria.create(keywordCriteria);
  }

  // Responsive Search Ad
  const adHeadlines = headlines.slice(0, 15).map((h) => ({ text: String(h).slice(0, 30) }));
  const adDescriptions = descriptions.slice(0, 4).map((d) => ({ text: String(d).slice(0, 90) }));
  while (adHeadlines.length < 3) adHeadlines.push({ text: productTitle.slice(0, 30) });
  while (adDescriptions.length < 2) adDescriptions.push({ text: `Shop ${productTitle} today.` });

  await customer.adGroupAds.create([{
    ad_group: adGroupResourceName,
    status: enums.AdGroupAdStatus.ENABLED,
    ad: {
      responsive_search_ad: { headlines: adHeadlines, descriptions: adDescriptions },
      final_urls: [finalUrl],
    },
  }]);

  return campaignResourceName;
}

// ── Performance Max Campaign ─────────────────────────────────────────────
async function createPMaxCampaign(customer, {
  productTitle, headlines, descriptions, finalUrl, budgetResourceName, imageUrls, videoUrls,
}) {
  // PMax campaign
  const campaign = {
    name: `Smart Ads PMax - ${productTitle} - ${new Date().toLocaleDateString()}`,
    campaign_budget: budgetResourceName,
    advertising_channel_type: enums.AdvertisingChannelType.PERFORMANCE_MAX,
    status: enums.CampaignStatus.PAUSED,
    bidding_strategy_type: enums.BiddingStrategyType.MAXIMIZE_CONVERSIONS,
    maximize_conversions: {},
  };
  const { results: campaignResults } = await customer.campaigns.create([campaign]);
  const campaignResourceName = campaignResults[0];

  // Asset Group (required for PMax)
  const assetGroup = {
    name: `${productTitle} - Assets`,
    campaign: campaignResourceName,
    status: enums.AssetGroupStatus.ENABLED,
    final_urls: [finalUrl],
  };
  const { results: assetGroupResults } = await customer.assetGroups.create([assetGroup]);
  const assetGroupResourceName = assetGroupResults[0];

  // Text assets (headlines + descriptions)
  const textAssets = [];
  for (const h of headlines.slice(0, 15)) {
    textAssets.push({
      asset_group: assetGroupResourceName,
      field_type: enums.AssetFieldType.HEADLINE,
      asset: { text_asset: { text: String(h).slice(0, 30) } },
    });
  }
  for (const d of descriptions.slice(0, 5)) {
    textAssets.push({
      asset_group: assetGroupResourceName,
      field_type: enums.AssetFieldType.DESCRIPTION,
      asset: { text_asset: { text: String(d).slice(0, 90) } },
    });
  }
  // Long headline (required for PMax)
  textAssets.push({
    asset_group: assetGroupResourceName,
    field_type: enums.AssetFieldType.LONG_HEADLINE,
    asset: { text_asset: { text: `${productTitle} - Shop Now`.slice(0, 90) } },
  });
  // Business name
  textAssets.push({
    asset_group: assetGroupResourceName,
    field_type: enums.AssetFieldType.BUSINESS_NAME,
    asset: { text_asset: { text: "Smart Ads Store" } },
  });

  if (textAssets.length > 0) {
    await customer.assetGroupAssets.create(textAssets);
  }

  // ?? Image Assets (if provided) ??????????????????????????????????
  if (imageUrls && imageUrls.length > 0) {
    const imageAssets = [];
    for (const url of imageUrls.slice(0, 5)) {
      try {
        const imgRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!imgRes.ok) continue;
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        const { results: assetResults } = await customer.assets.create([{
          name: `SmartAds_Image_${Date.now()}`,
          type: enums.AssetType.IMAGE,
          image_asset: { data: base64 },
        }]);
        if (assetResults?.[0]) {
          imageAssets.push({
            asset: assetResults[0],
            asset_group: assetGroupResourceName,
            field_type: enums.AssetFieldType.MARKETING_IMAGE,
          });
        }
      } catch (err) {
        console.warn("[SmartAds] Image upload failed:", url, err.message);
      }
    }
    if (imageAssets.length > 0) {
      await customer.assetGroupAssets.create(imageAssets);
    }
  }


  // ?? Video Assets (if provided) ??????????????????????????????????
  if (videoUrls && videoUrls.length > 0) {
    const videoAssets = [];
    for (const ytUrl of videoUrls.slice(0, 3)) {
      try {
        const { results: vResults } = await customer.assets.create([{
          name: `SmartAds_Video_${Date.now()}`,
          type: enums.AssetType.YOUTUBE_VIDEO,
          youtube_video_asset: { youtube_video_id: ytUrl.split("v=")[1]?.split("&")[0] || ytUrl },
        }]);
        if (vResults?.[0]) {
          videoAssets.push({
            asset: vResults[0],
            asset_group: assetGroupResourceName,
            field_type: enums.AssetFieldType.YOUTUBE_VIDEO,
          });
        }
      } catch (err) {
        console.warn("[SmartAds] Video upload failed:", ytUrl, err.message);
      }
    }
    if (videoAssets.length > 0) {
      await customer.assetGroupAssets.create(videoAssets);
    }
  }
  return campaignResourceName;
}

// ── Bidding config builder ───────────────────────────────────────────────
function buildBiddingConfig(bidding, campaignType) {
  if (campaignType === "pmax") {
    return { maximize_conversions: {} };
  }
  switch (bidding) {
    case "max_conversions":
      return { maximize_conversions: {} };
    case "max_conv_value":
      return { maximize_conversion_value: {} };
    case "max_clicks":
      return { maximize_clicks: {} };
    case "target_cpa":
      return { maximize_conversions: { target_cpa_micros: (bidding.target || 15) * 1_000_000 } };
    case "target_roas":
      return { maximize_conversion_value: { target_roas: (bidding.target || 300) / 100 } };
    default:
      return { manual_cpc: { enhanced_cpc_enabled: true } };
  }
}

// ── Main entry point ─────────────────────────────────────────────────────
export async function createCampaign({
  productTitle,
  headlines,
  descriptions,
  keywords = [],
  finalUrl,
  dailyBudget = 50,
  campaignType = "search",,
bidding = "max_conversions",
imageUrls = [],
videoUrls = [],
})
}) {
  const customer = getCustomer();
  const budgetResourceName = await createBudget(customer, productTitle, dailyBudget);

  let campaignResourceName;

  switch (campaignType) {
    case "pmax":
      campaignResourceName = await createPMaxCampaign(customer, {
        productTitle, headlines, descriptions, finalUrl, budgetResourceName, imageUrls, videoUrls,
      });
      break;

    case "shopping":
      // Shopping requires Merchant Center — fall back to search with note
      console.warn("[SmartAds] Shopping campaigns require Merchant Center. Creating Search instead.");
      campaignResourceName = await createSearchCampaign(customer, {
        productTitle, headlines, descriptions, keywords, finalUrl, budgetResourceName, bidding,
      });
      break;

    case "display":
    case "video":
      // Display/Video need creative assets — fall back to search with note
      console.warn(`[SmartAds] ${campaignType} campaigns not yet supported. Creating Search instead.`);
      campaignResourceName = await createSearchCampaign(customer, {
        productTitle, headlines, descriptions, keywords, finalUrl, budgetResourceName, bidding,
      });
      break;

    case "search":
    default:
      campaignResourceName = await createSearchCampaign(customer, {
        productTitle, headlines, descriptions, keywords, finalUrl, budgetResourceName, bidding,
      });
      break;
  }

  return {
    success: true,
    campaignId: campaignResourceName,
    campaignType,
    status: "PAUSED",
    message: `Campaign created for "${productTitle}" — paused and ready to review in Google Ads.`,
  };
}

// ── Test connection ──────────────────────────────────────────────────────
export async function testConnection() {
  try {
    const customer = getCustomer();
    const campaigns = await customer.query(
      `SELECT campaign.id, campaign.name FROM campaign LIMIT 1`
    );
    return { connected: true, campaigns: campaigns.length };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}



