import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useCallback, useEffect } from "react";
import {
  roasColor, statusDot, BudgetSlider, CharInput,
  RevenueAttribution, AIConfidenceScore, SpendTimeline,
  KeywordSuggestions, DangerZone, HeadlineABTest,
  CompetitorIntelligence, SearchTermsReport, QualityScoreCard,
  CompetitorAdCopy, NegativeKeywords, CampaignSettings,
  ProductsPerformance, AdExtensionsEditor, UrlEditor,
  CampaignStatusBar, AICreditsBar, AISuggestButton,
  AIOptimizeAllButton, DateRangeSelector, PerformanceGraph,
  CampaignAlerts, ExportButton
} from "../components/campaigns/shared";
import { GoogleAdsPreview } from "../components/campaigns/GoogleAdsPreview";
import CampaignWizard, { CampaignCreatingAnimation, CampaignSuccessScreen } from "../components/campaigns/CampaignWizard";

export const loader = async ({ request }) => {
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
      headlines: ["Premium Bedding \u2014 Shop Now","Luxury Cotton Sheets & Covers","Free Shipping on All Orders","Soft Duvet Covers From $49","Top-Rated Bedding Store","Transform Your Bedroom Today"],
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
      id: "camp_002", name: "Winter Pillows \u2014 Manual", type: "manual", status: "ENABLED",
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
      headlines: ["Best Pillows for Deep Sleep","Memory Foam King Pillows","Free US Shipping Over $50","Cooling Gel Pillows \u2014 New","Wake Up Pain-Free","Doctor Recommended Pillows"],
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
}


/* ── Launch Dialog ── */
function LaunchDialog({ onClose, onAutoLaunch, onManualBuild }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,10,26,.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"#1a1a2e",borderRadius:24,padding:36,maxWidth:500,width:"90%",boxShadow:"0 24px 80px rgba(0,0,0,.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:48,height:48,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16 }}>{"\u{1F680}"}</div>
        <h2 style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:6,marginTop:0 }}>Create New Campaign</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24 }}>Choose how you want to build your next campaign:</p>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid #6366f1",background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.08))",cursor:"pointer" }} onClick={() => { onClose(); onAutoLaunch && onAutoLaunch(); }}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{"⚡"}</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#fff",marginBottom:2 }}>Auto Launch</div><div style={{ fontSize:13,color:"rgba(255,255,255,.5)" }}>AI scans, builds and launches campaigns instantly</div></div>
            <div style={{ marginLeft:"auto",color:"#6366f1",fontSize:18 }}>{"→"}</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.04)",cursor:"pointer" }} onClick={() => { onClose(); onManualBuild && onManualBuild(); }}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#0891b2,#0284c7)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{"🔍"}</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#fff",marginBottom:2 }}>Review & Edit</div><div style={{ fontSize:13,color:"rgba(255,255,255,.5)" }}>Check keywords, headlines & images before launching</div></div>
            <div style={{ marginLeft:"auto",color:"rgba(255,255,255,.4)",fontSize:18 }}>{"→"}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop:16,width:"100%",padding:"11px",background:"none",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,color:"rgba(255,255,255,.4)",fontSize:14,cursor:"pointer",fontFamily:"inherit" }}>Cancel</button>
      </div>
    </div>
  );
}


/* ── Sidebar ── */
function CampaignSidebar({ campaigns, selectedId, onSelect, onNew }) {
  return (
    <div style={{ background:"#0f0f23",borderRight:"1px solid rgba(255,255,255,.06)",padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:2,marginBottom:6,textTransform:"uppercase",paddingLeft:2 }}>Campaigns</div>
      {campaigns.map(c => {
        const sel = c.id === selectedId;
        const rc = roasColor(c.performance.roas);
        return (
          <div key={c.id} onClick={() => onSelect(c.id)} style={{ background:sel?"#1a1a2e":"transparent",border:sel?"1.5px solid rgba(255,255,255,.1)":"1.5px solid transparent",borderRadius:14,padding:"14px",cursor:"pointer",transition:"all .15s",boxShadow:sel?"0 2px 8px rgba(0,0,0,.2)":"none" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <span style={{ width:8,height:8,borderRadius:"50%",background:statusDot(c.status),display:"inline-block",flexShrink:0 }} />
              <span style={{ fontSize:13,fontWeight:700,color:"#fff",flex:1,lineHeight:1.3 }}>{c.name}</span>
              <span style={{ fontSize:10,fontWeight:700,color:c.type==="auto"?"#6366f1":"#0891b2",background:c.type==="auto"?"rgba(99,102,241,.15)":"rgba(8,145,178,.15)",padding:"2px 7px",borderRadius:5 }}>{c.type==="auto"?"AUTO":"MANUAL"}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
              <div style={{ background:rc.bg,borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:rc.color }}>{c.performance.roas>0?(c.performance.roas+"x"):"—"}</div>
                <div style={{ fontSize:9,color:rc.color,fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>ROAS</div>
              </div>
              <div style={{ background:"rgba(255,255,255,.06)",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#fff" }}>{c.performance.clicks>0?c.performance.clicks.toLocaleString():"—"}</div>
                <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Clicks</div>
              </div>
              <div style={{ background:"rgba(255,255,255,.06)",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#fff" }}>{c.performance.spend>0?("$"+c.performance.spend):"—"}</div>
                <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Spend</div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={onNew} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",fontSize:13,color:"#6366f1",fontWeight:600,marginTop:4,padding:"11px",borderRadius:12,border:"2px dashed rgba(99,102,241,.4)",background:"none",cursor:"pointer",fontFamily:"inherit" }}>{"＋"} New campaign</button>
    </div>
  );
}


/* ── Campaign Detail (main panel) ── */
function CampaignDetail({ campaign, onSwitchMode, mode }) {
  const p = campaign.performance;
  const rc = roasColor(p.roas);
  const [paused, setPaused] = useState(campaign.status === "PAUSED");
  const [keywords, setKeywords] = useState(campaign.keywords);
  const [budget, setBudget] = useState(campaign.budget);
  const [showWizard, setShowWizard] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState("7 days");
  const [campaignName, setCampaignName] = useState(campaign.name);
  const [editingName, setEditingName] = useState(false);
  const [newKw, setNewKw] = useState("");
  const [headlines, setHeadlines] = useState(campaign.headlines);
  const [descriptions, setDescriptions] = useState(campaign.descriptions);
  const [aiCredits, setAiCredits] = useState(42);
  const maxCredits = 50;
  const plan = "Starter";

  const useCredit = (cost) => {
    if (aiCredits >= cost) { setAiCredits(c => c - cost); return true; }
    return false;
  };

  const addKeyword = () => {
    const text = newKw.trim();
    if (!text) return;
    setKeywords([...keywords, { text, bid: 0.50 }]);
    setNewKw("");
  };

  const updateBid = (index, newBid) => {
    const updated = [...keywords];
    updated[index] = { ...updated[index], bid: parseFloat(newBid) || 0 };
    setKeywords(updated);
  };

  const removeKeyword = (index) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding:"24px",overflowY:"auto",display:"flex",flexDirection:"column",gap:18,background:"#0a0a1a" }}>

      {/* ── HERO PANEL ── */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",borderRadius:20,padding:"28px 32px",color:"#fff",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(99,102,241,.08)" }} />
        <div style={{ position:"absolute",bottom:-40,right:80,width:120,height:120,borderRadius:"50%",background:"rgba(99,102,241,.05)" }} />

        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,position:"relative",zIndex:1 }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
              {editingName ? (
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  onBlur={() => setEditingName(false)} onKeyDown={e => e.key==="Enter" && setEditingName(false)}
                  autoFocus
                  style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.6)",letterSpacing:2,textTransform:"uppercase",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:6,padding:"4px 8px",fontFamily:"inherit",outline:"none" }} />
              ) : (
                <div onClick={() => setEditingName(true)} style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",cursor:"pointer" }} title="Click to rename">
                  {campaignName}
                  <span style={{ marginLeft:6,fontSize:10,color:"rgba(255,255,255,.2)" }}>{"\u270F\uFE0F"}</span>
                </div>
              )}
            </div>
            <div style={{ display:"flex",alignItems:"baseline",gap:10,marginBottom:6 }}>
              <span style={{ fontSize:42,fontWeight:800,letterSpacing:"-2px",color:rc.color,lineHeight:1 }}>
                {p.roas > 0 ? (p.roas + "x") : "—"}
              </span>
              <span style={{ fontSize:18,fontWeight:700,color:"rgba(255,255,255,.4)" }}>ROAS</span>
              <span style={{
                fontSize:12,fontWeight:700,color:rc.color,background:rc.bg,
                padding:"4px 10px",borderRadius:20,marginLeft:4
              }}>{rc.label}</span>
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,.45)",fontWeight:500 }}>
              {"$"}{p.spend} total spend {"·"} {"$"}{campaign.budget}/day {"·"} {campaign.products.length} products
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <ExportButton />
            <a href="/app" style={{ fontSize:13,fontWeight:700,color:"rgba(255,255,255,.5)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6 }}>
              {"📊"} Dashboard
            </a>
            <button onClick={onSwitchMode} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit" }}>
              {mode === "auto" ? "\u270F\uFE0F Switch to Manual" : "\u{1F916} Switch to Auto"}
            </button>
          </div>
        </div>

        {/* TODAY STATS STRIP */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:24,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.06)" }}>
          {[
            { value: p.today_clicks, label: "Today Clicks" },
            { value: "$" + p.today_spend, label: "Today Spend" },
            { value: p.clicks.toLocaleString(), label: "Total Clicks" },
            { value: p.impressions.toLocaleString(), label: "Impressions" },
            { value: p.clicks > 0 ? (p.clicks / p.impressions * 100).toFixed(1) + "%" : "—", label: "CTR" },
          ].map(m => (
            <div key={m.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:3 }}>{m.value}</div>
              <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Date Range + Performance Graph */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <DateRangeSelector range={dateRange} onChange={setDateRange} />
      </div>
      <PerformanceGraph />

      {/* Alerts */}
      <CampaignAlerts campaign={campaign} />

      {/* Campaign Status Bar */}
      <CampaignStatusBar status={campaign.status} paused={paused}
        onPause={() => setPaused(true)} onResume={() => setPaused(false)}
        onDelete={() => { if(confirm("Delete this campaign? This cannot be undone.")) { /* delete logic */ } }} />

      {/* PENDING REVIEW BANNER */}
      {campaign.status === "PENDING_REVIEW" && (
        <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.06))",border:"1px solid rgba(245,158,11,.3)",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:20 }}>⏳</span>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:"#fbbf24" }}>Pending Google Review</div>
            <div style={{ fontSize:13,color:"rgba(251,191,35,.7)" }}>Awaiting Google Ads approval — usually 1–2 business days.</div>
          </div>
        </div>
      )}

      {/* ═══════════════ MANUAL MODE ═══════════════ */}
      {mode === "manual" && (
        <>
          {/* Manual Control Banner */}
          <div style={{ background:"linear-gradient(135deg,rgba(249,115,22,.12),rgba(249,115,22,.06))",border:"2px solid rgba(249,115,22,.25)",borderRadius:14,padding:"14px 20px",display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:800 }}>✏️</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:700,color:"#fb923c" }}>Manual Control Mode</div>
              <div style={{ fontSize:12,color:"rgba(251,146,60,.7)" }}>You control budget, keywords, bids & ad copy directly</div>
            </div>
            <button onClick={() => setShowWizard(!showWizard)} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(99,102,241,.3)",whiteSpace:"nowrap" }}>
              {showWizard ? "✕ Close Builder" : "✨ Campaign Builder"}
            </button>
          </div>

          {showWizard && (
            <CampaignWizard campaign={campaign} onComplete={() => setShowWizard(false)} onCancel={() => setShowWizard(false)} />
          )}



          {/* Tab Navigation */}
          {!showWizard && (
            <div style={{ display:"flex",gap:4,background:"rgba(255,255,255,.03)",borderRadius:12,padding:4,border:"1px solid rgba(255,255,255,.06)" }}>
              {[
                { id:"overview", label:"Overview" },
                { id:"keywords", label:"Keywords" },
                { id:"adcopy", label:"Ad Copy" },
                { id:"intelligence", label:"Intelligence" },
                { id:"settings", label:"Settings" },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex:1,fontSize:12,fontWeight:activeTab===tab.id?700:500,
                  color:activeTab===tab.id?"#fff":"rgba(255,255,255,.4)",
                  background:activeTab===tab.id?"rgba(99,102,241,.2)":"transparent",
                  border:activeTab===tab.id?"1px solid rgba(99,102,241,.3)":"1px solid transparent",
                  borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"
                }}>{tab.label}</button>
              ))}
            </div>
          )}

          {/* ═══ OVERVIEW TAB ═══ */}
          {(activeTab === "overview" || showWizard) && (<>
          {/* AI Credits */}
          <AICreditsBar credits={aiCredits} maxCredits={maxCredits} plan={plan} />

          {/* Google Ads Live Preview — updates live as you edit */}
          <GoogleAdsPreview headlines={headlines} descriptions={descriptions} />

          {/* 1. DAILY BUDGET */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>💰 Daily Budget</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
              <span style={{ fontSize:20,fontWeight:700,color:"#6366f1" }}>$</span>
              <span style={{ fontSize:48,fontWeight:900,color:"#fff",letterSpacing:"-2px",lineHeight:1 }}>{budget}</span>
              <span style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginLeft:8 }}>/ day</span>
              <span style={{ fontSize:13,color:"rgba(255,255,255,.25)",marginLeft:4 }}>· ~{"$"}{(budget * 30).toLocaleString()}/mo</span>
            </div>
            <BudgetSlider value={budget} onChange={setBudget} />
          </div>

          </>)}

          {/* ═══ KEYWORDS TAB ═══ */}
          {activeTab === "keywords" && (<>
          {/* 2. KEYWORDS */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>🔑 Keywords ({keywords.length})</div>
              <AISuggestButton label="AI Suggest" cost={2} credits={aiCredits} onClick={() => { if(useCredit(2)) setKeywords(kw => [...kw, {text:"ai suggested keyword",bid:0.65}]); }} />
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {keywords.map((kw, i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12 }}>
                  <select value={kw.match||"broad"} onChange={e => { const u=[...keywords]; u[i]={...u[i],match:e.target.value}; setKeywords(u); }}
                    style={{ fontSize:10,fontWeight:700,color:"#6366f1",background:"rgba(99,102,241,.08)",border:"1px solid rgba(99,102,241,.15)",borderRadius:6,padding:"3px 6px",cursor:"pointer",fontFamily:"inherit",outline:"none",textTransform:"uppercase" }}>
                    <option value="broad">Broad</option>
                    <option value="phrase">Phrase</option>
                    <option value="exact">Exact</option>
                  </select>
                  <span style={{ flex:1,fontSize:14,color:"#fff",fontWeight:600 }}>{kw.text}</span>
                  <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"4px 8px" }}>
                    <span style={{ fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600 }}>CPC $</span>
                    <input
                      type="number" step="0.05" min="0.05" max="50"
                      value={kw.bid}
                      onChange={e => updateBid(i, e.target.value)}
                      style={{ width:55,fontSize:14,fontWeight:700,color:"#6366f1",border:"none",background:"transparent",textAlign:"center",fontFamily:"inherit",outline:"none" }}
                    />
                  </div>
                  <button onClick={() => removeKeyword(i)} style={{ width:28,height:28,borderRadius:8,background:"rgba(239,68,68,.15)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:16,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:700 }}>×</button>
                </div>
              ))}
            </div>
            {/* Add keyword */}
            <div style={{ display:"flex",gap:8,marginTop:12 }}>
              <input
                value={newKw}
                onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                placeholder="Add new keyword..."
                style={{ flex:1,fontSize:14,border:"2px dashed rgba(255,255,255,.12)",borderRadius:12,padding:"10px 14px",fontFamily:"inherit",outline:"none",color:"#fff",background:"rgba(255,255,255,.04)" }}
              />
              <button onClick={addKeyword} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>＋ Add</button>
            </div>
          </div>


          {/* Keyword Suggestions */}
          <KeywordSuggestions onAdd={(s) => setKeywords(kw => [...kw, { text: s.text, bid: s.cpc }])} />

          {/* Danger Zone */}
          <DangerZone keywords={keywords} />

          {/* Negative Keywords */}
          <NegativeKeywords />

          </>)}

          {/* ═══ AD COPY TAB ═══ */}
          {activeTab === "adcopy" && (<>
          {/* 3. HEADLINES */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>📢 Headlines ({campaign.headlines.length})</div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <AISuggestButton label="AI Suggest" cost={1} credits={aiCredits} onClick={() => { if(useCredit(1)) setHeadlines(h => [...h, "AI Generated Headline "+(h.length+1)]); }} />
                <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>Max 30 chars</div>
              </div>
            </div>
            {headlines.map((h, i) => (
              <div key={"h"+i} style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
                <div style={{ flex:1 }}><CharInput defaultValue={h} maxLen={30} placeholder={"Headline " + (i+1)} /></div>
                {headlines.length > 3 && <button onClick={() => setHeadlines(headlines.filter((_,j)=>j!==i))} style={{ width:28,height:28,borderRadius:8,background:"rgba(239,68,68,.1)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:8 }}>{"\u00D7"}</button>}
              </div>
            ))}
            {headlines.length < 15 && (
              <button onClick={() => setHeadlines([...headlines, ""])} style={{ fontSize:12,fontWeight:600,color:"#6366f1",background:"rgba(99,102,241,.06)",border:"1px dashed rgba(99,102,241,.2)",borderRadius:10,padding:"10px",cursor:"pointer",fontFamily:"inherit",width:"100%",marginTop:4 }}>
                + Add Headline ({headlines.length}/15)
              </button>
            )}
          </div>


          {/* Headline A/B Testing */}
          <HeadlineABTest headlines={headlines} />

          {/* 4. DESCRIPTIONS */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>📄 Descriptions ({campaign.descriptions.length})</div>
              <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                <AISuggestButton label="AI Suggest" cost={1} credits={aiCredits} onClick={() => { if(useCredit(1)) setDescriptions(d => [...d, "AI generated description for your products."]); }} />
                <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>Max 90 chars</div>
              </div>
            </div>
            {descriptions.map((d, i) => (
              <div key={"d"+i} style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
                <div style={{ flex:1 }}><CharInput defaultValue={d} maxLen={90} tag="textarea" placeholder={"Description " + (i+1)} /></div>
                {descriptions.length > 2 && <button onClick={() => setDescriptions(descriptions.filter((_,j)=>j!==i))} style={{ width:28,height:28,borderRadius:8,background:"rgba(239,68,68,.1)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:8 }}>{"\u00D7"}</button>}
              </div>
            ))}
            {descriptions.length < 4 && (
              <button onClick={() => setDescriptions([...descriptions, ""])} style={{ fontSize:12,fontWeight:600,color:"#6366f1",background:"rgba(99,102,241,.06)",border:"1px dashed rgba(99,102,241,.2)",borderRadius:10,padding:"10px",cursor:"pointer",fontFamily:"inherit",width:"100%",marginTop:4 }}>
                + Add Description ({descriptions.length}/4)
              </button>
            )}
          </div>

          </>)}

          {/* ═══ INTELLIGENCE TAB ═══ */}
          {activeTab === "intelligence" && (<>
          {/* Revenue Attribution */}
          <RevenueAttribution />

          {/* Competitor Ad Copy */}
          <CompetitorAdCopy />

          </>)}

          {/* ═══ SETTINGS TAB ═══ */}
          {activeTab === "settings" && (<>
          {/* URL Settings */}
          <UrlEditor campaign={campaign} />

          {/* Ad Extensions */}
          <AdExtensionsEditor />

          {/* Products Performance */}
          <ProductsPerformance products={campaign.products} />

          {/* Campaign Settings */}
          <CampaignSettings campaign={campaign} />
          </>)}
        </>
      )}

      {/* ═══════════════ AUTO MODE ═══════════════ */}
      {mode === "auto" && (
        <>
          {/* AI Managed Banner */}
          <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.08))",border:"2px solid rgba(99,102,241,.3)",borderRadius:14,padding:"16px 22px",display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",flexShrink:0 }}>🤖</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15,fontWeight:700,color:"#a5b4fc" }}>AI-Managed Campaign</div>
              <div style={{ fontSize:13,color:"rgba(165,180,252,.7)",marginTop:2 }}>Smart Ads AI handles everything automatically for maximum ROAS</div>
            </div>
            <div style={{ background:"#6366f1",color:"#fff",fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:20,whiteSpace:"nowrap" }}>✓ Active</div>
          </div>

          {/* Cost Summary */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"20px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>💰 Ad Spend</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#fff" }}>{"$"}{p.today_spend}</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>Spent today</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"rgba(255,255,255,.7)" }}>{"$"}{p.spend}</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>Total spent</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#6366f1" }}>{"$"}{campaign.budget}</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>Daily budget</div>
              </div>
            </div>
          </div>

          {/* Google Ads Live Preview */}
          <GoogleAdsPreview headlines={campaign.headlines} descriptions={campaign.descriptions} />

          {/* Products Performance */}
          <ProductsPerformance products={campaign.products} />

          {/* View Full Details Button */}
          <button onClick={() => setShowFullDetails(!showFullDetails)} style={{
            width:"100%",fontSize:14,fontWeight:700,
            color:"#6366f1",background:"rgba(99,102,241,.06)",
            border:"1px solid rgba(99,102,241,.15)",borderRadius:14,
            padding:"14px",cursor:"pointer",fontFamily:"inherit",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            transition:"all .2s"
          }}>
            {showFullDetails ? "Hide Details ↑" : "📊 View Full Campaign Details →"}
          </button>

          {/* ── EXPANDED DETAILS (hidden by default) ── */}
          {showFullDetails && (
            <>
              {/* Campaign Assets Summary - 4 cards */}
              <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>📊 Campaign Assets</div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12 }}>
                  <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(99,102,241,.15)" }}>
                    <div style={{ fontSize:28,fontWeight:900,color:"#6366f1",marginBottom:4 }}>{campaign.keywords.length}</div>
                    <div style={{ fontSize:11,fontWeight:600,color:"#8b5cf6",textTransform:"uppercase",letterSpacing:.5 }}>Keywords</div>
                    <div style={{ fontSize:11,color:"#a78bfa",marginTop:4 }}>Auto-optimized</div>
                  </div>
                  <div style={{ background:"linear-gradient(135deg,rgba(59,130,246,.15),rgba(59,130,246,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(59,130,246,.15)" }}>
                    <div style={{ fontSize:28,fontWeight:900,color:"#3b82f6",marginBottom:4 }}>{campaign.headlines.length}</div>
                    <div style={{ fontSize:11,fontWeight:600,color:"#3b82f6",textTransform:"uppercase",letterSpacing:.5 }}>Headlines</div>
                    <div style={{ fontSize:11,color:"#60a5fa",marginTop:4 }}>AI-generated</div>
                  </div>
                  <div style={{ background:"linear-gradient(135deg,rgba(22,163,106,.15),rgba(22,163,106,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(22,163,106,.15)" }}>
                    <div style={{ fontSize:28,fontWeight:900,color:"#16a34a",marginBottom:4 }}>{campaign.descriptions.length}</div>
                    <div style={{ fontSize:11,fontWeight:600,color:"#16a34a",textTransform:"uppercase",letterSpacing:.5 }}>Descriptions</div>
                    <div style={{ fontSize:11,color:"#4ade80",marginTop:4 }}>AI-crafted</div>
                  </div>
                  <div style={{ background:"linear-gradient(135deg,rgba(234,88,12,.15),rgba(234,88,12,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(234,88,12,.15)" }}>
                    <div style={{ fontSize:28,fontWeight:900,color:"#ea580c",marginBottom:4 }}>{"$"}{campaign.budget}</div>
                    <div style={{ fontSize:11,fontWeight:600,color:"#ea580c",textTransform:"uppercase",letterSpacing:.5 }}>Daily Budget</div>
                    <div style={{ fontSize:11,color:"#fb923c",marginTop:4 }}>{"~$"}{(campaign.budget*30).toLocaleString()}/mo</div>
                  </div>
                </div>
              </div>

              <RevenueAttribution />
              <AIConfidenceScore />
              <QualityScoreCard score={campaign.performance.qualityScore} />

              {/* AI Performance Insights */}
              <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>✨ AI Performance Insights</div>
                <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,rgba(16,185,129,.12),rgba(16,185,129,.06))",borderRadius:12,border:"1px solid rgba(16,185,129,.2)" }}>
                    <div style={{ width:32,height:32,borderRadius:8,background:"#16a34a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>🎯</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:"#34d399" }}>Top Performing Keyword</div>
                      <div style={{ fontSize:13,color:"rgba(52,211,153,.7)",marginTop:2 }}>{campaign.keywords[0]?.text || "Analyzing..."} {"—"} {"$"}{campaign.keywords[0]?.bid.toFixed(2)} CPC</div>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,rgba(59,130,246,.12),rgba(59,130,246,.06))",borderRadius:12,border:"1px solid rgba(59,130,246,.2)" }}>
                    <div style={{ width:32,height:32,borderRadius:8,background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>📝</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:"#60a5fa" }}>Best Headline</div>
                      <div style={{ fontSize:13,color:"rgba(96,165,250,.7)",marginTop:2 }}>{campaign.headlines[0] || "Testing variations..."}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,rgba(234,179,8,.12),rgba(234,179,8,.06))",borderRadius:12,border:"1px solid rgba(234,179,8,.2)" }}>
                    <div style={{ width:32,height:32,borderRadius:8,background:"#eab308",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>🕒</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13,fontWeight:700,color:"#fbbf24" }}>Optimization Status</div>
                      <div style={{ fontSize:13,color:"rgba(251,191,35,.7)",marginTop:2 }}>Last optimized: 2 hours ago {"·"} Next review: Tomorrow 9:00 AM</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent AI Actions */}
              <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
                <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>📋 Recent AI Actions</div>
                <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
                  {[
                    { time:"2 hours ago", action:"Adjusted bid for \"luxury bedding sets\" from $1.10 to $1.20", icon:"💰" },
                    { time:"Yesterday", action:"Added new headline: \"Premium Bedding — Shop Now\"", icon:"📝" },
                    { time:"2 days ago", action:"Paused low-performing keyword: \"cheap bedding\"", icon:"⏸️" },
                    { time:"3 days ago", action:"Increased daily budget recommendation to $30/day", icon:"📈" },
                  ].map((item, i) => (
                    <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:12,padding:"12px 0",borderBottom:i < 3 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                      <div style={{ width:28,height:28,borderRadius:7,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:1 }}>{item.icon}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13,color:"rgba(255,255,255,.8)",fontWeight:500 }}>{item.action}</div>
                        <div style={{ fontSize:11,color:"rgba(255,255,255,.3)",marginTop:3 }}>{item.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <SpendTimeline />
              <CompetitorIntelligence keywords={campaign.keywords} />
              <SearchTermsReport />
              <NegativeKeywords />
              <CampaignSettings campaign={campaign} />
            </>
          )}
        </>
      )}

      {/* AI Optimize All (manual only) */}
      {mode === "manual" && (
        <AIOptimizeAllButton credits={aiCredits} onClick={() => { if(useCredit(5)) { /* optimize all */ } }} />
      )}

      {/* SAVE CHANGES + DUPLICATE (manual only) */}
      {mode === "manual" && (
        <div style={{ display:"flex",justifyContent:"flex-end",gap:12,paddingBottom:12 }}>
          <button style={{
            fontSize:14,fontWeight:700,color:"rgba(255,255,255,.7)",
            background:"rgba(255,255,255,.06)",
            border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:"14px 24px",
            cursor:"pointer",fontFamily:"inherit",
            transition:"all .15s"
          }}>
            {"\u{1F4CB}"} Duplicate Campaign
          </button>
          <button style={{
            fontSize:15,fontWeight:700,color:"#fff",
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            border:"none",borderRadius:14,padding:"14px 32px",
            cursor:"pointer",fontFamily:"inherit",
            boxShadow:"0 4px 20px rgba(99,102,241,.3)",
            transition:"transform .1s,box-shadow .1s"
          }}>
            {"\u{1F4BE}"} Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export default function Campaigns() {
  const { campaigns, isSimulated, marketSignal } = useLoaderData();
  const [selectedId, setSelectedId] = useState(campaigns[0]?.id || null);
  const [viewMode, setViewMode] = useState({});
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showStandaloneWizard, setShowStandaloneWizard] = useState(false);
  const [showAutoLaunch, setShowAutoLaunch] = useState(false);
  const [autoLaunchDone, setAutoLaunchDone] = useState(false);

  const selected = campaigns.find(c => c.id === selectedId);
  const currentMode = viewMode[selectedId] !== undefined ? viewMode[selectedId] : (selected?.type || "auto");

  if (!campaigns || campaigns.length === 0) {
    return (
      <div style={{ padding:"40px",maxWidth:600,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",textAlign:"center",background:"#0a0a1a",minHeight:"100vh" }}>
        <div style={{ width:72,height:72,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px" }}>{"🚀"}</div>
        <h1 style={{ fontSize:28,fontWeight:800,color:"#fff",marginBottom:8 }}>No campaigns yet</h1>
        <p style={{ fontSize:15,color:"rgba(255,255,255,.5)",marginBottom:32,lineHeight:1.6 }}>Create your first Google Ads campaign and start driving traffic to your store.</p>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:15,fontWeight:700,padding:"14px 28px",border:"none",borderRadius:12,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(99,102,241,.3)" }}>{"＋"} Create First Campaign</button>
        {showLaunchDialog && <LaunchDialog onClose={() => setShowLaunchDialog(false)} onAutoLaunch={() => setShowAutoLaunch(true)} onManualBuild={() => setShowStandaloneWizard(true)} />}
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif",minHeight:"100vh",height:"auto",display:"flex",flexDirection:"column",background:"#0a0a1a" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        @keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes successPop{0%{transform:scale(0)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
        @keyframes stepFadeIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        .wizard-step{animation:stepFadeIn .3s ease forwards}
        .camp-fade{animation:fadeUp .25s ease forwards}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
        .budget-sim-slider{z-index:9999!important;touch-action:none!important;user-select:none!important}
        .budget-sim-input-row{z-index:9999!important;touch-action:none!important}
      `}</style>

      <div style={{ background:"#0a0a1a",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:14 }}>
          <a href="/app" style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"8px 14px",cursor:"pointer",textDecoration:"none",transition:"all .15s" }}>
            {"←"} Dashboard
          </a>
          <div>
            <h1 style={{ fontSize:20,fontWeight:800,color:"#fff",margin:0,letterSpacing:"-0.5px" }}>Campaigns</h1>
            <p style={{ fontSize:12,color:"rgba(255,255,255,.4)",margin:"2px 0 0",fontWeight:500 }}>{campaigns.length} active {"·"} Google Ads</p>
          </div>
        </div>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(99,102,241,.3)" }}>{"＋"} New Campaign</button>
      </div>

      <div className="camp-fade" style={{ display:"grid",gridTemplateColumns:"280px 1fr",flex:1,minHeight:0,overflow:"auto" }}>
        {isSimulated && (
          <div style={{ background:"rgba(255,180,0,.12)", border:"1px solid rgba(255,180,0,.25)", borderRadius:12, padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>⚡</span>
            <span style={{ fontSize:13, color:"rgba(255,180,0,.9)", fontWeight:500 }}>Demo Mode — Connect Google Ads for real data</span>
          </div>
        )}
        {marketSignal && (
          <div style={{ background: marketSignal.signal === "green" ? "rgba(0,200,100,.08)" : marketSignal.signal === "yellow" ? "rgba(255,200,0,.08)" : "rgba(255,60,60,.08)", border: "1px solid " + (marketSignal.signal === "green" ? "rgba(0,200,100,.2)" : marketSignal.signal === "yellow" ? "rgba(255,200,0,.2)" : "rgba(255,60,60,.2)"), borderRadius:12, padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>{marketSignal.signal === "green" ? "🟢" : marketSignal.signal === "yellow" ? "🟡" : "🔴"}</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,.7)", fontWeight:500 }}>{marketSignal.signal_label}{marketSignal.holiday ? ` — ${marketSignal.holiday.name} in ${marketSignal.holiday.daysUntil} days` : ""}</span>
            {marketSignal.budget_multiplier !== 1.0 && <span style={{ fontSize:12, color:"rgba(168,85,247,.8)", fontWeight:600, marginLeft:"auto" }}>Budget: {marketSignal.budget_multiplier}x</span>}
          </div>
        )}
        <CampaignSidebar campaigns={campaigns} selectedId={selectedId} onSelect={setSelectedId} onNew={() => setShowLaunchDialog(true)} />
        {selected && (
          <CampaignDetail
            key={selectedId}
            campaign={selected}
            mode={currentMode}
            onSwitchMode={() => setViewMode(v => ({...v,[selectedId]:currentMode==="auto"?"manual":"auto"}))}
          />
        )}
      </div>

      {showLaunchDialog && <LaunchDialog onClose={() => setShowLaunchDialog(false)} onAutoLaunch={() => setShowAutoLaunch(true)} onManualBuild={() => setShowStandaloneWizard(true)} />}

      {/* Auto Launch Animation + Success */}
      {showAutoLaunch && (
        <div style={{ position:"fixed",inset:0,background:"#0a0a1a",zIndex:9998,overflowY:"auto",display:"flex",alignItems:"center",justifyContent:"center" }}>
          {!autoLaunchDone ? (
            <CampaignCreatingAnimation onComplete={() => setAutoLaunchDone(true)} />
          ) : (
            <CampaignSuccessScreen onViewCampaign={() => { setShowAutoLaunch(false); setAutoLaunchDone(false); }} />
          )}
        </div>
      )}

      {/* Standalone Wizard (from New Campaign dialog) */}
      {showStandaloneWizard && (
        <div style={{ position:"fixed",inset:0,background:"#0a0a1a",zIndex:9998,overflowY:"auto",padding:"20px" }}>
          <div style={{ maxWidth:760,margin:"0 auto" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
              <h1 style={{ fontSize:20,fontWeight:800,color:"#fff",margin:0 }}>New Campaign Builder</h1>
              <div style={{ display:"flex",gap:8 }}>
                <a href="/app" style={{ fontSize:14,fontWeight:600,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6 }}>{"←"} Dashboard</a>
                <button onClick={() => setShowStandaloneWizard(false)} style={{ fontSize:14,fontWeight:600,color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"8px 16px",cursor:"pointer",fontFamily:"inherit" }}>{"✕"} Close</button>
              </div>
            </div>
            <CampaignWizard campaign={{}} onComplete={() => setShowStandaloneWizard(false)} onCancel={() => setShowStandaloneWizard(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

