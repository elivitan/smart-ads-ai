import re, sys

# Patch app.campaigns.jsx — replace mock loader with real data loader
filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app.campaigns.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Replace the loader ──
# Find from "export const loader" to "return { campaigns: mockCampaigns };\n};"
old_loader_pattern = r'export const loader = async \(\{ request \}\) => \{.*?return \{ campaigns: mockCampaigns \};\n\};'
match = re.search(old_loader_pattern, content, re.DOTALL)

if not match:
    print("ERROR: Could not find mock loader pattern!")
    print("Looking for 'export const loader' ...")
    if "export const loader" in content:
        print("Found 'export const loader' but pattern didn't match")
        # Show what's around it
        idx = content.index("export const loader")
        print(content[idx:idx+200])
    sys.exit(1)

new_loader = '''export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Try to get real campaigns from Google Ads API
  let campaigns = [];
  let isSimulated = false;

  try {
    // Call our campaign-manage API internally
    const hasGoogleAds = process.env.GOOGLE_ADS_DEVELOPER_TOKEN && process.env.GOOGLE_ADS_REFRESH_TOKEN;

    if (hasGoogleAds) {
      // Import and use Google Ads functions directly
      const token = await getGoogleAccessToken();
      const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");

      if (token && customerId) {
        const query = `
          SELECT
            campaign.id, campaign.name, campaign.status,
            campaign.advertising_channel_type, campaign.bidding_strategy_type,
            campaign_budget.amount_micros,
            metrics.impressions, metrics.clicks, metrics.cost_micros,
            metrics.conversions, metrics.conversions_value,
            metrics.ctr, metrics.average_cpc
          FROM campaign
          WHERE campaign.name LIKE 'Smart Ads%'
          AND campaign.status != 'REMOVED'
          ORDER BY campaign.id DESC
          LIMIT 50
        `;

        const url = `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data?.[0]?.results) {
            campaigns = data[0].results.map(row => {
              const c = row.campaign;
              const m = row.metrics || {};
              const b = row.campaignBudget;
              const costNum = m.costMicros ? parseInt(m.costMicros) / 1000000 : 0;
              const revenueNum = parseFloat(m.conversionsValue || 0);
              return {
                id: c.id,
                name: c.name,
                type: c.advertisingChannelType === "SEARCH" ? "manual" : "auto",
                status: c.status,
                createdAt: new Date().toISOString(),
                budget: b?.amountMicros ? parseInt(b.amountMicros) / 1000000 : 30,
                products: [], // will be enriched client-side
                keywords: [],
                headlines: [],
                descriptions: [],
                finalUrl: "",
                displayPath: [],
                performance: {
                  impressions: parseInt(m.impressions || 0),
                  clicks: parseInt(m.clicks || 0),
                  roas: costNum > 0 ? parseFloat((revenueNum / costNum).toFixed(2)) : 0,
                  spend: parseFloat(costNum.toFixed(2)),
                  today_clicks: 0,
                  today_spend: 0,
                  conversions: parseFloat(m.conversions || 0),
                  revenue: parseFloat(revenueNum.toFixed(2)),
                  ctr: parseFloat((parseFloat(m.ctr || 0) * 100).toFixed(2)),
                  avgCpc: m.averageCpc ? parseInt(m.averageCpc) / 1000000 : 0,
                  qualityScore: 7,
                },
              };
            });
          }
        }
      }
    }

    // If no real campaigns, use simulated data
    if (campaigns.length === 0) {
      isSimulated = true;
      campaigns = getSimulatedCampaigns();
    }
  } catch (err) {
    console.error("[Campaigns Loader] Error loading real data:", err.message);
    isSimulated = true;
    campaigns = getSimulatedCampaigns();
  }

  // Get quick market signal (no API cost)
  let marketSignal = null;
  try {
    const { getQuickMarketSignal } = await import("../market-intel.server.js");
    marketSignal = await getQuickMarketSignal({
      regions: ["US"],
      productCategory: "bedding",
    });
  } catch (e) {
    console.warn("[Campaigns Loader] Market signal failed:", e.message);
  }

  return { campaigns, isSimulated, marketSignal };
};

// Helper: Get Google Ads access token
async function getGoogleAccessToken() {
  try {
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
  } catch { return null; }
}

// Simulated campaigns for demo/development
function getSimulatedCampaigns() {
  return [
    {
      id: "camp_001", name: "Summer Bedding Collection", type: "auto", status: "ENABLED",
      createdAt: "2026-03-05T10:00:00Z", budget: 25,
      products: [
        { id:"p1", title:"Luxury Cotton Duvet Cover", image:null, clicks:82, spend:142, revenue:280, roas:1.97 },
        { id:"p2", title:"Bamboo Pillow Set", image:null, clicks:58, spend:98, revenue:180, roas:1.84 },
        { id:"p3", title:"Microfiber Sheet Set", image:null, clicks:40, spend:72, revenue:100, roas:1.39 }
      ],
      keywords: [
        { text:"luxury bedding sets", bid:1.20 },
        { text:"cotton duvet cover queen", bid:0.95 },
        { text:"bamboo pillow case", bid:0.80 },
        { text:"microfiber sheets king", bid:0.75 },
        { text:"soft bedding online", bid:0.60 }
      ],
      headlines: ["Premium Bedding \\u2014 Shop Now","Luxury Cotton Sheets & Covers","Free Shipping on All Orders","Soft Duvet Covers From $49","Top-Rated Bedding Store","Transform Your Bedroom Today"],
      descriptions: [
        "Transform your bedroom with our luxury bedding collection. Soft, durable, and beautiful.",
        "Shop premium cotton duvets, bamboo pillows & more. Fast US shipping.",
        "Join 10,000+ happy customers. 30-day returns. Free shipping over $75.",
        "Hotel-quality bedding at home prices. Egyptian cotton, bamboo & microfiber."
      ],
      finalUrl: "https://textilura.com/collections/bedding",
      displayPath: ["shop","bedding"],
      performance: { impressions:4200, clicks:180, roas:2.8, spend:312, today_clicks:12, today_spend:18, conversions:8, revenue:560, ctr:4.3, avgCpc:1.73, qualityScore:8 },
    },
    {
      id: "camp_002", name: "Winter Pillows \\u2014 Manual", type: "manual", status: "ENABLED",
      createdAt: "2026-03-01T08:00:00Z", budget: 40,
      products: [
        { id:"p4", title:"Memory Foam Pillow King", image:null, clicks:245, spend:312, revenue:560, roas:1.79 },
        { id:"p5", title:"Down Alternative Pillow", image:null, clicks:165, spend:208, revenue:280, roas:1.35 }
      ],
      keywords: [
        { text:"memory foam pillow", bid:1.50 },
        { text:"best pillow for neck pain", bid:1.10 },
        { text:"king size pillow set", bid:0.90 },
        { text:"down alternative pillow", bid:0.70 }
      ],
      headlines: ["Best Pillows for Deep Sleep","Memory Foam King Pillows","Free US Shipping Over $50","Cooling Gel Pillows \\u2014 New","Wake Up Pain-Free","Doctor Recommended Pillows"],
      descriptions: [
        "Wake up refreshed with our premium memory foam pillows. Designed for all sleep positions.",
        "Shop our full pillow collection. Trusted by 10,000+ sleepers. Fast delivery.",
        "Cooling gel technology meets luxury comfort. Try risk-free for 30 nights.",
        "Memory foam, down alternative & cooling pillows. Find your perfect match."
      ],
      finalUrl: "https://textilura.com/collections/pillows",
      displayPath: ["shop","pillows"],
      performance: { impressions:8900, clicks:410, roas:3.4, spend:520, today_clicks:28, today_spend:31, conversions:12, revenue:840, ctr:4.6, avgCpc:1.27, qualityScore:9 },
    },
  ];
}'''

content = content[:match.start()] + new_loader + content[match.end():]

# ── 2. Verify the change ──
if "getSimulatedCampaigns" in content and "getGoogleAccessToken" in content:
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Loader patched!")
    print("  - Real Google Ads API data when credentials exist")
    print("  - Simulated fallback when no credentials")
    print("  - Market signal included in loader data")
else:
    print("ERROR: Patch content verification failed!")
    sys.exit(1)
