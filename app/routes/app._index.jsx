import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLoaderData, useLocation, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopProducts, getSyncStatus } from "../sync.server.js";
import { getSubscriptionInfo } from "../license.server.js";
import { OnboardModal, BuyCreditsModal } from "../components/Modals.jsx";
import { CSS } from "./styles.index.js";
import { Counter, ScoreRing, Speedometer } from "../components/ui/SmallWidgets.jsx";
import { TipRotator, Confetti, SuccessTicker } from "./SmallComponents.jsx";
import { CollectingDataScreen } from "./CollectingDataScreen.jsx";
import { AdPreviewPanel } from "./AdPreviewPanel.jsx";
import { CompetitorModal } from "../components/CompetitorModal.jsx";
import { CompetitorGapFinder } from "./CompetitorComponents.jsx";
import { StoreHealthScore, TopMissedOpportunity, BudgetSimulator } from "./DashboardWidgets.jsx";
import { LivePulse } from "../components/dashboard/LivePulse.jsx";
import { LandingBudgetTeaser, LandingMissingBlock } from "./LandingComponents.jsx";
import { ProductModal } from "../components/ProductModal.jsx";
import { MarketAlert } from "./MarketAlert.jsx";
import { StoreAnalyticsWidget } from "./StoreAnalytics.jsx";
import { useGoogleAdsData } from "../hooks/useGoogleAdsData.js";

function getPlanFromCookie(request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/sai_plan=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

function StyleTag() { return <style dangerouslySetInnerHTML={{__html: CSS}}/>; }

export const loader = async ({ request }) => {
  try {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const syncStatus = await getSyncStatus(shop);
  const needsInitialSync = syncStatus.totalProducts === 0;
  const dbProducts = await getShopProducts(shop);
  const planFromCookie = getPlanFromCookie(request);

  let subscriptionInfo = null;
  try {
    subscriptionInfo = await getSubscriptionInfo(shop);
  } catch (e) {
    console.error("[SmartAds] Failed to load subscription:", e.message);
  }

  const serverPlan = subscriptionInfo?.plan || planFromCookie || "free";
  const isPaidServer = !!serverPlan && serverPlan !== "free";

  return {
    products: dbProducts,
    syncStatus,
    shop,
    planFromCookie: serverPlan,
    isPaidServer,
    needsInitialSync,
    subscription: subscriptionInfo || { plan: serverPlan, scanCredits: 0, aiCredits: 0, canPublish: isPaidServer },
  };
  } catch (loaderErr) {
    console.error("[SmartAds] Loader error:", loaderErr.message);
    return {
      products: [],
      syncStatus: { totalProducts: 0 },
      shop: "",
      planFromCookie: "free",
      isPaidServer: false,
      needsInitialSync: true,
      subscription: { plan: "free", scanCredits: 0, aiCredits: 0, canPublish: false },
    };
  }
};

const FREE_SCAN_LIMIT = 3;

const REAL_STEPS = [
  { label: "Fetching products from your store", icon: "📦", threshold: 5 },
  { label: "Searching Google for competitors", icon: "🔍", threshold: 20 },
  { label: "Analyzing competitor websites", icon: "🕵️", threshold: 40 },
  { label: "Checking your Google rankings", icon: "📍", threshold: 60 },
  { label: "Generating AI-optimized ad copy", icon: "🤖", threshold: 80 },
  { label: "Building your competitive strategy", icon: "📊", threshold: 98 },
];
const INTRO_PHASES = [
  { label: "Connecting to your Shopify store", icon: "🔗", duration: 1400 },
  { label: "Reading your product catalog", icon: "📦", duration: 1200 },
  { label: "Connecting AI analysis engine", icon: "🤖", duration: 1200 },
];

export default function Index() {
  const { products: dbProducts, planFromCookie, isPaidServer, shop: shopDomain, needsInitialSync, subscription: serverSubscription } = useLoaderData();
  const storeUrl = shopDomain ? `https://${shopDomain}` : "https://your-store.myshopify.com";

  // Enterprise: trigger initial sync on client side (never block server render)
  useEffect(() => {
    if (needsInitialSync) {
      fetch("/app/api/sync", { method: "POST" })
        .catch(() => {}); // silent — UI will update via webhook
    }
  }, [needsInitialSync]);

  const location = useLocation();
  useEffect(() => {
    if (location.hash === "#launch") {
      setShowLaunchChoice(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location.hash]);

  const revalidator = useRevalidator();

  // Build product-specific URL for campaigns
  function getProductUrl(product) {
    const base = storeUrl;
    if (product?.handle) return `${base}/products/${product.handle}`;
    if (product?.title) {
      const handle = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return `${base}/products/${handle}`;
    }
    return base;
  }
  const allDbProducts = dbProducts || [];
  const analyzedDbProducts = allDbProducts.filter(p => p.hasAiAnalysis);
  const totalDbProducts = allDbProducts.length;

  // Enterprise: O(1) lookup maps instead of O(n) find() on every render
  const productById = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach(p => { if (p.id) map.set(p.id, p); });
    return map;
  }, [allDbProducts]);

  const productByTitle = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach(p => { if (p.title) map.set(p.title.toLowerCase(), p); });
    return map;
  }, [allDbProducts]);

  const [products, setProductsRaw] = useState([]);
  const [aiResults, setAiResultsRaw] = useState(null);
  function setProducts(v) { setProductsRaw(v); try { sessionStorage.setItem("sai_products", JSON.stringify(v)); } catch {} }
  function setAiResults(v) { setAiResultsRaw(v); try { sessionStorage.setItem("sai_aiResults", JSON.stringify(v)); } catch {} }

  const scanned = products.length > 0;
  const [isScanning, setIsScanning] = useState(false);
  const [fakeProgress, setFakeProgress] = useState(0);
  const [scanMode, setScanMode] = useState(null);
  const [vis, setVis] = useState(false);
  const [selProduct, setSelProduct] = useState(null);
  const [selCompetitor, setSelCompetitor] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardTab, setOnboardTab] = useState("subscription");

  // Plan — cookie is source of truth (set server-side, no flash)
  const [selectedPlan, setSelectedPlan] = useState(
    isPaidServer ? planFromCookie : ((() => { try { return sessionStorage.getItem("sai_plan") || null; } catch { return null; } })())
  );
  const [isHydrated, setIsHydrated] = useState(isPaidServer); // if server knows isPaid, already hydrated
  useEffect(() => { setIsHydrated(true); }, []);

  const [scanCredits, setScanCreditsRaw] = useState(() => {
    if (serverSubscription?.scanCredits != null) return serverSubscription.scanCredits;
    try { const c = sessionStorage.getItem("sai_scan_credits"); return c ? parseInt(c) : 0; } catch { return 0; }
  });
  const [aiCredits, setAiCreditsRaw] = useState(() => {
    if (serverSubscription?.aiCredits != null) return serverSubscription.aiCredits;
    try { const c = sessionStorage.getItem("sai_credits"); return c ? parseInt(c) : 0; } catch { return 0; }
  });
  function setScanCredits(v) { setScanCreditsRaw(v); try { sessionStorage.setItem("sai_scan_credits", String(v)); } catch {} }
  function setAiCredits(v) { setAiCreditsRaw(v); try { sessionStorage.setItem("sai_credits", String(v)); } catch {} }

  const [googleConnected, setGoogleConnected] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [campaignId, setCampaignId] = useState(() => { try { return sessionStorage.getItem("sai_campaign_id")||"sim_001"; } catch { return "sim_001"; } });
  const [campaignControlStatus, setCampaignControlStatus] = useState(null); // 'pausing'|'removing'|'paused'|'removed'|'error'
  const [realSpend, setRealSpend] = useState(null); // live spend from Google Ads API
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showLaunchChoice, setShowLaunchChoice] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null);
  const [editHeadlines, setEditHeadlines] = useState([]);
  const [editDescriptions, setEditDescriptions] = useState([]);
  const [improvingIdx, setImprovingIdx] = useState(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanMsg, setScanMsg] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [pickedProducts, setPickedProducts] = useState([]);
  const [autoLaunching, setAutoLaunching] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(null);
  const [justSubscribed, setJustSubscribed] = useState(false); // true after selectPlan until scan starts // "auto"|"review"|null — set by Launch Choice after subscription

  const cancelRef = useRef(false);
  const creepRef = useRef(null);

  const _forcePreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'landing';
  const isPaid = !!selectedPlan;
  const hasScanAccess = isPaid || scanCredits > 0;
  const canPublish = isPaid;

  function LockedOverlay({ title, children }) {
    if (isPaid) return children || null;
    return (
      <div style={{position:"relative"}}>
        <div style={{filter:"blur(3px)",opacity:0.5,pointerEvents:"none"}}>{children}</div>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(10,10,26,.7)",borderRadius:16,zIndex:10,cursor:"pointer"}} onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>
          <div style={{fontSize:36,marginBottom:8}}>🔒</div>
          <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>{title || "Premium Feature"}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:12}}>Subscribe to unlock this section</div>
          <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:600}}>Upgrade Now →</div>
        </div>
      </div>
    );
  }

  const [marketIntel, setMarketIntel] = useState(null);
  useEffect(() => {
    async function fetchMarketSignal() {
      try {
        const form = new FormData();
        form.append("mode", "quick");
        form.append("regions", "US");
        const res = await fetch("/app/api/market-intel", { method: "POST", body: form });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) setMarketIntel(data.intel);
      } catch {}
    }
    fetchMarketSignal();
  }, []);

  // ⚠️ ALL HOOKS MUST BE CALLED HERE — before any early returns
  // Pre-compute values for the Google Ads hook
  const _analyzedCount = analyzedDbProducts.length;
  const _avgScore = _analyzedCount > 0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/_analyzedCount) : 0;
  const _mockCampaigns = isPaid && _analyzedCount > 0 ? Math.min(Math.floor(_analyzedCount * 0.6), 12) : 0;
  const liveAds = useGoogleAdsData(_mockCampaigns, _avgScore);

  function triggerConfetti() { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3500); }
  useEffect(() => { setVis(true); }, []);

  function selectPlan(plan) {
    setSelectedPlan(plan);
    setJustSubscribed(true); // Mark: show scanning flow, not dashboard
    setScanMsg(""); // Clear stale scan messages from previous sessions
    // Save as cookie (1 year) — survives tab close, cache clear
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `sai_plan=${encodeURIComponent(plan)}; expires=${expires}; path=/; SameSite=None; Secure`;
    try { sessionStorage.setItem("sai_plan", plan); } catch {}
    setAiCredits({ starter: 10, pro: 200, premium: 1000 }[plan] || 0);
    // Also save to server API (best effort)
    fetch("/app/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    }).catch(() => {});
  }

  async function doScan(mode) {
    const isAuto = mode === "auto";
    setScanMode(mode || "review"); setIsScanning(true); setFakeProgress(0);
    setScanMsg(hasScanAccess ? "Connecting to your Shopify store..." : "Quick preview scan starting...");
    setAutoStatus(null); setScanError(null); cancelRef.current = false;
    let fetchedProducts = [], allAiProducts = [];

    let smoothProg = 0;
    const smoothTimer = setInterval(() => { smoothProg = Math.min(smoothProg + 0.15, 8); setFakeProgress(Math.round(smoothProg * 10) / 10); }, 100);

    try {
      const scanAbort = new AbortController();
      cancelRef._abort = () => scanAbort.abort();
      const ff = new FormData(); ff.append("step", "fetch");
      const fr = await fetch("/app/api/scan", { method:"POST", body:ff, signal:scanAbort.signal });
      const fd = await fr.json().catch(() => { throw new Error("Server returned invalid response."); });
      if (!fd.success) throw new Error(fd.error || "Failed to fetch products");
      if (cancelRef.current) { clearInterval(smoothTimer); setIsScanning(false); return; }
      clearInterval(smoothTimer);

      const allFetched = fd.products, storeUrl = fd.storeInfo?.url || "";
      const toAnalyze = hasScanAccess ? allFetched : allFetched.slice(0, FREE_SCAN_LIMIT);
      fetchedProducts = allFetched; setProducts(allFetched);

      for (let p = Math.ceil(smoothProg); p <= 10; p++) { setFakeProgress(p); await new Promise(r => setTimeout(r, 40)); }
      setScanMsg(hasScanAccess ? `Found ${allFetched.length} products — analyzing with AI...` : `Found ${allFetched.length} products — analyzing top ${FREE_SCAN_LIMIT} for preview...`);
      await new Promise(r => setTimeout(r, 600));

      const BATCH = 3, total = toAnalyze.length, batches = Math.ceil(total / BATCH);
      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }
        const start = b * BATCH, batch = toAnalyze.slice(start, start + BATCH);
        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);
        let creepPct = batchStartPct;
        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < batchEndPct - 0.5) creepPct += 0.3;
          setFakeProgress(Math.round(creepPct * 10) / 10);
          const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          const curPct = Math.round(creepPct);
          if (hasScanAccess) {
            const sn = curPct<25?"Searching Google":curPct<45?"Analyzing competitors":curPct<60?"Checking rankings":curPct<80?"Generating ad copy":"Building strategy";
            setScanMsg(fakeNum+" of "+total+" products · "+sn);
          } else setScanMsg("Analyzing product "+fakeNum+" of "+total+"...");
        }, 400);
        creepRef.current = creepTimer;

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", storeUrl);
        const ar = await fetch("/app/api/scan", { method:"POST", body:af, signal:scanAbort.signal });
        clearInterval(creepTimer); creepRef.current = null;
        const ad = await ar.json().catch(() => { throw new Error(`AI returned invalid response on batch ${b+1}.`); });
        if (!ad.success) throw new Error(ad.error || `AI failed on batch ${b+1}`);
        allAiProducts = [...allAiProducts, ...(ad.result?.products || [])];
        setFakeProgress(batchEndPct);
      }

      if (cancelRef.current) { setIsScanning(false); return; }
      setScanMsg(hasScanAccess ? "Almost done — putting it all together! 🚀" : "Wrapping up your preview...");
      await new Promise(r => setTimeout(r, 600));

      const topScore = allAiProducts.reduce((best,p) => ((p.ad_score||0)>(best.ad_score||0)?p:best), allAiProducts[0]||{});
      let summary;
      if (hasScanAccess) {
        const opts = [`🎯 Analyzed ${allAiProducts.length} products. "${topScore.title||"Top product"}" scored ${topScore.ad_score||0}/100.`,`✨ Found ${allAiProducts.filter(p=>(p.ad_score||0)>=70).length} high-potential products!`,`🏆 Average score: ${Math.round(allAiProducts.reduce((a,p)=>a+(p.ad_score||0),0)/allAiProducts.length)}/100.`];
        summary = opts[Math.floor(Math.random()*opts.length)];
      } else {
        summary = `Preview: Analyzed ${FREE_SCAN_LIMIT} of ${fetchedProducts.length} products. ${topScore.title||"Your top product"} shows real potential! Upgrade to unlock all ${fetchedProducts.length - FREE_SCAN_LIMIT} remaining.`;
      }

      setAiResults({ summary, recommended_budget:100, products:allAiProducts });
      setFakeProgress(100); setScanMsg(hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!");
      triggerConfetti(); await new Promise(r => setTimeout(r, 800));

    } catch (e) {
      clearInterval(smoothTimer);
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      let msg = e.message || "Something went wrong";
      if (msg.includes("credit balance")||msg.includes("billing")) msg = "AI credits have run out. Please top up your Anthropic API balance.";
      else if (msg.includes("rate_limit")||msg.includes("429")) msg = "Too many requests. Please wait a minute and try again.";
      else if (msg.includes("401")||msg.includes("api_key")) msg = "API key is invalid. Please check your ANTHROPIC_API_KEY.";
      else if (msg.includes("overloaded")) msg = "AI service is temporarily overloaded. Please try again.";
      setScanError(msg); setIsScanning(false); setFakeProgress(0); return;
    }

    setIsScanning(false); setFakeProgress(0);

    if (isAuto && allAiProducts.length > 0 && canPublish) {
      setAutoLaunching(true);
      let successCount = 0;
      for (let i = 0; i < fetchedProducts.length; i++) {
        const prod = fetchedProducts[i], ai = allAiProducts.find(ap => ap.title===prod.title)||allAiProducts[i]||{};
        try {
          const form = new FormData();
          form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines||[]));
          form.append("descriptions", JSON.stringify(ai.descriptions||[])); form.append("keywords", JSON.stringify(ai.keywords||[]));
          form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
          const res = await fetch("/app/api/campaign", { method:"POST", body:form });
          const data = await res.json(); if (data.success) successCount++;
        } catch {}
      }
      setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    }
  }

  async function handleAutoCampaign() {
    if (!canPublish) { setShowOnboard(true); setOnboardTab("subscription"); setOnboardStep(1); return; }
    setAutoLaunching(true);
    let successCount = 0;
    const toProcess = analyzedDbProducts.length > 0 ? analyzedDbProducts : allDbProducts.slice(0, 5);
    for (const prod of toProcess) {
      const ai = prod.aiAnalysis||{};
      try {
        const form = new FormData();
        form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines||[]));
        form.append("descriptions", JSON.stringify(ai.descriptions||[])); form.append("keywords", JSON.stringify(ai.keywords||[]));
        form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
        const res = await fetch("/app/api/campaign", { method:"POST", body:form });
        const data = await res.json(); if (data.success) successCount++;
      } catch {}
    }
    setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    if (successCount > 0) triggerConfetti();
  }

  function handleProductClick(product) {
    if (!hasScanAccess) { setShowOnboard(true); setOnboardStep(1); return; }
    setSelProduct(product); setCampaignStatus(null);
    const isDb = !!product.hasAiAnalysis;
    const ai = isDb ? (product.aiAnalysis||{}) : (aiResults?.products?.find(ap => ap.title===product.title)||{});
    setEditHeadlines((ai.headlines||[]).map(h => typeof h==="string"?h:h.text||h));
    setEditDescriptions((ai.descriptions||[]).map(d => typeof d==="string"?d:d.text||d));
  }

  // ── Fetch real spend from Google Ads API ──
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    async function fetchSpend() {
      try {
        const form = new FormData();
        form.append("action", "list");
        const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
        const data = await res.json();
        if (!cancelled && data.campaigns) {
          // Find our campaign by id
          const numId = String(campaignId).split("/").pop();
          const camp = data.campaigns.find(c => String(c.id) === numId || c.resourceName === campaignId);
          if (camp) setRealSpend(parseFloat(camp.cost));
        }
      } catch {}
    }
    fetchSpend();
    const iv = setInterval(fetchSpend, 60000); // refresh every minute
    return () => { cancelled = true; clearInterval(iv); };
  }, [campaignId]);

  async function handlePauseCampaign() {
    if (!campaignId) return;
    setCampaignControlStatus("pausing");
    try {
      const form = new FormData();
      form.append("action", "pause");
      form.append("campaignId", campaignId);
      const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
      const data = await res.json();
      setCampaignControlStatus(data.success ? "paused" : "error");
    } catch { setCampaignControlStatus("error"); }
  }

  async function handleRemoveCampaign() {
    if (!campaignId) return;
    setCampaignControlStatus("removing");
    setConfirmRemove(false);
    try {
      const form = new FormData();
      form.append("action", "remove");
      form.append("campaignId", campaignId);
      const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setCampaignControlStatus("removed");
        setCampaignId(null);
        try { sessionStorage.removeItem("sai_campaign_id"); } catch {}
      } else {
        setCampaignControlStatus("error");
      }
    } catch { setCampaignControlStatus("error"); }
  }


  const handleUpgradeClick = React.useCallback(() => {
    setShowOnboard(true);
    setOnboardTab("subscription");
    setOnboardStep(1);
  }, []);

  // useLatest pattern — פונקציות יציבות שתמיד קוראות לנתונים המעודכנים
  const handleProductClickRef = useRef(handleProductClick);
  const handleAutoCampaignRef = useRef(handleAutoCampaign);
  useEffect(() => {
    handleProductClickRef.current = handleProductClick;
    handleAutoCampaignRef.current = handleAutoCampaign;
  });
  const handleProductClickCb = React.useCallback((p) => handleProductClickRef.current(p), []);
  const handleAutoCampaignCb = React.useCallback(() => handleAutoCampaignRef.current(), []);

  async function handleCreateCampaign() {
    if (!selProduct||!canPublish) return;
    setCampaignStatus("creating");
    try {
      const isDb = !!selProduct.hasAiAnalysis;
      const ai = isDb ? (selProduct.aiAnalysis||{}) : (aiResults?.products?.find(ap => ap.title===selProduct.title)||{});
      const form = new FormData();
      form.append("productTitle", selProduct.title); form.append("headlines", JSON.stringify(editHeadlines));
      form.append("descriptions", JSON.stringify(editDescriptions)); form.append("keywords", JSON.stringify(ai.keywords||[]));
      form.append("finalUrl", getProductUrl(selProduct)); form.append("dailyBudget", "50");
      const campAbort = new AbortController();
      const res = await fetch("/app/api/campaign", { method:"POST", body:form, signal:campAbort.signal });
      const data = await res.json(); setCampaignStatus(data.success ? "success" : "error");
      if (data.success) {
        triggerConfetti();
        const cid = data.campaignId || data.campaign_id || data.resourceName || null;
        if (cid) { setCampaignId(cid); try { sessionStorage.setItem("sai_campaign_id", cid); } catch {} }
      }
    } catch { setCampaignStatus("error"); }
  }

  async function handleAiImprove(type, index) {
    if (aiCredits <= 0) { setShowBuyCredits(true); return; }
    const key = `${type}-${index}`; setImprovingIdx(key);
    const text = type==="h" ? editHeadlines[index] : editDescriptions[index];
    try {
      const form = new FormData(); form.append("text", text); form.append("type", type==="h"?"headline":"description"); form.append("productTitle", selProduct?.title||"");
      const improveAbort = new AbortController();
      const res = await fetch("/app/api/ai-improve", { method:"POST", body:form, signal:improveAbort.signal });
      const data = await res.json();
      if (data.success && data.improved) {
        if (type==="h") { const n=[...editHeadlines]; n[index]=data.improved; setEditHeadlines(n); }
        else { const n=[...editDescriptions]; n[index]=data.improved; setEditDescriptions(n); }
        setAiCredits(aiCredits - 1);
      }
    } catch {}
    setImprovingIdx(null);
  }

  // ── ONBOARD MODAL ──

  // ── Computed values + useMemo hooks (MUST be before any early returns) ──
    const totalProducts = totalDbProducts;
    const analyzedCount = analyzedDbProducts.length;
    const avgScore = analyzedCount>0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/analyzedCount) : 0;
  // ── These useMemo hooks were inside if(hasScanAccess) — moved out to fix React hooks rule ──
    const sortedProducts = useMemo(() =>
      [...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0)),
    [allDbProducts]);
    const topCompetitors = useMemo(() => {
      const allCompetitors = analyzedDbProducts.flatMap(p=>p.aiAnalysis?.competitor_intel?.top_competitors||[]);
      const competitorMap = {};
      allCompetitors.forEach(c => { if (!c.domain) return; if (!competitorMap[c.domain]) competitorMap[c.domain]={count:0,strength:c.strength||"unknown"}; competitorMap[c.domain].count++; });
      return Object.entries(competitorMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
    }, [analyzedDbProducts]);
    const { keywordGaps, totalMonthlyGapLoss } = useMemo(() => {
      const myKeywords = new Set(
        analyzedDbProducts.flatMap(p => (p.aiAnalysis?.keywords||[]).map(k => (typeof k==="string"?k:k?.text||"").toLowerCase().trim()))
          .filter(Boolean)
      );
      const competitorKeywords = analyzedDbProducts.flatMap(p => p.aiAnalysis?.competitor_intel?.keyword_gaps||[])
        .map(k => (typeof k==="string"?k:k?.text||k).toLowerCase().trim())
        .filter(Boolean);
      const gapKeywordCounts = {};
      competitorKeywords.forEach(k => { gapKeywordCounts[k] = (gapKeywordCounts[k]||0)+1; });
      const gaps = Object.entries(gapKeywordCounts)
        .filter(([k]) => !myKeywords.has(k) && k.length > 3)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 8)
        .map(([keyword, freq]) => ({
          keyword,
          freq,
          estMonthlyLoss: Math.round((freq * 280) * (avgScore < 60 ? 1.4 : 1)),
          estClicks: Math.round(freq * 22),
          difficulty: freq >= 3 ? "High" : freq === 2 ? "Medium" : "Low",
          diffColor: freq >= 3 ? "#ef4444" : freq === 2 ? "#f59e0b" : "#22c55e",
        }));
      return { keywordGaps: gaps, totalMonthlyGapLoss: gaps.reduce((a,g) => a+g.estMonthlyLoss, 0) };
    }, [analyzedDbProducts, avgScore]);

  // OnboardModal — now imported from ../components/Modals.jsx

  // BuyCreditsModal — now imported from ../components/Modals.jsx

  // ── ERROR / LOADING SCREENS ──
  if (scanError) return (
    <div className="sr dk"><StyleTag/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>⚠️</div>
        <h2 className="ld-title">Scan Failed</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{scanError}</p>
        <div style={{display:"flex",gap:12}}>
          <button className="btn-primary" onClick={()=>{setScanError(null);doScan("review");}}>🔄 Try Again</button>
          <button className="btn-secondary" onClick={()=>setScanError(null)}>← Go Back</button>
        </div>
      </div>
    </div>
  );

  if (isScanning && !justSubscribed) {
    const pct = Math.round(fakeProgress);
    const steps = hasScanAccess ? [
      {label:"Fetching products from your store",done:pct>=10,active:pct<10},
      {label:"Searching Google for competitors",done:pct>=25,active:pct>=10&&pct<25},
      {label:"Analyzing competitor websites",done:pct>=45,active:pct>=25&&pct<45},
      {label:"Checking your Google rankings",done:pct>=60,active:pct>=45&&pct<60},
      {label:"Generating AI-optimized ad copy",done:pct>=80,active:pct>=60&&pct<80},
      {label:"Building your competitive strategy",done:pct>=100,active:pct>=80&&pct<100},
    ] : [
      {label:"Fetching products",done:pct>=10,active:pct<10},
      {label:"Quick AI analysis",done:pct>=55,active:pct>=10&&pct<55},
      {label:"Generating preview",done:pct>=100,active:pct>=55&&pct<100},
    ];
    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/>
        <div className="ld-wrap">
          <div className="ld-pct-ring">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={pct>=100?"#22c55e":"#6366f1"} strokeWidth="7" strokeDasharray="289" strokeDashoffset={289-(289*pct/100)} strokeLinecap="round" transform="rotate(-90 55 55)" style={{transition:"stroke-dashoffset .5s ease, stroke .3s"}}/>
            </svg>
            <span className="ld-pct-text">{pct}%</span>
          </div>
          <h2 className="ld-title">{hasScanAccess?(pct>=100?"Your store is ready to grow! 🎉":pct>=50?"Making great progress! ✨":"On it! Working my magic… 🤖"):(pct>=100?"Preview ready!":"Running quick preview...")}</h2>
          <p className="ld-sub">{scanMsg||"Hang tight — your AI assistant is hard at work"}</p>
          <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:pct+"%",transition:"width .5s ease"}}/></div>
          {hasScanAccess && <TipRotator/>}
          {!hasScanAccess && <div className="free-scan-note">🔓 Free preview — {FREE_SCAN_LIMIT} products only</div>}
          <div className="ld-steps">{steps.map((s,i)=><div key={i} className={`ld-step ${s.done?"ld-step-done":""} ${s.active?"ld-step-active":""}`}><span className="ld-dot">{s.done?"✓":""}</span>{s.label}</div>)}</div>
          <button className="btn-back" style={{marginTop:8}} onClick={()=>setShowCancelConfirm(true)}>← Cancel</button>
          {showCancelConfirm && (
            <div className="cancel-confirm-overlay">
              <div className="cancel-confirm-box">
                <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>Stop Scanning?</h3>
                <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:20}}>All progress will be lost.</p>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button className="btn-primary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>setShowCancelConfirm(false)}>Continue Scanning</button>
                  <button className="btn-secondary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>{cancelRef.current=true;if(creepRef.current){clearInterval(creepRef.current);creepRef.current=null;}setShowCancelConfirm(false);setIsScanning(false);setFakeProgress(0);setProducts([]);setAiResults(null);}}>Yes, Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (autoLaunching) return (
    <div className="sr dk"><StyleTag/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20,animation:"ldPulse 1s ease infinite"}}>⚡</div>
        <h2 className="ld-title">Launching Your Campaigns...</h2>
        <p className="ld-sub">AI is building and submitting Google Ads campaigns for all your products.</p>
        <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:"60%",animation:"barPulse 2s ease infinite"}}/></div>
      </div>
    </div>
  );

  if (autoStatus==="success"||autoStatus==="error") return (
    <div className="sr dk"><StyleTag/>
      <Confetti active={showConfetti}/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>{autoStatus==="success"?"✅":"❌"}</div>
        <h2 className="ld-title">{autoStatus==="success"?"Campaigns Are Live!":"Campaign Creation Failed"}</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{autoStatus==="success"?"Your AI-optimized campaigns are created in PAUSED state. Review them in Google Ads.":"Something went wrong. Try manual mode."}</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button className="btn-primary" onClick={()=>setAutoStatus(null)}>📊 View Dashboard</button>
          {autoStatus==="success" && <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{textDecoration:"none"}}>Open Google Ads →</a>}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════

  if (hasScanAccess) {
    const totalKeywords = analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.keywords?.length||0),0);
    const highPotential = analyzedDbProducts.filter(p=>(p.aiAnalysis?.ad_score||0)>=70).length;
    const topProduct = analyzedDbProducts.reduce((best,p)=>((p.aiAnalysis?.ad_score||0)>(best.aiAnalysis?.ad_score||0)?p:best),analyzedDbProducts[0]||null);
    const mockCampaigns = canPublish&&analyzedCount>0 ? Math.min(Math.floor(analyzedCount*0.6),12) : 0;
    const mockRoas = analyzedCount>0 ? (1.8+avgScore*0.028).toFixed(1) : "0";
    const competitorThreat = avgScore>=70?"Low":avgScore>=50?"Moderate":"High";
    const threatColor = {Low:"#22c55e",Moderate:"#f59e0b",High:"#ef4444"}[competitorThreat];
    const googleRankStatus = avgScore>=70?"page_1":avgScore>=50?"page_2":"page_3";

    // Competitor aggregation — sorted by count
    const competitorCount = topCompetitors.length;

    // Competitor Gap Finder — keywords competitors use that we don't

    // Live Google Ads data — from top-level hook
    const impressionsBase = liveAds.impressions;
    const clicksBase = liveAds.clicks;

    // ── Fresh paid subscriber — never scanned yet ──
    if (isPaid && (analyzedCount === 0 || justSubscribed)) return (
      <div className="sr dk"><StyleTag/><div className="bg-m"/>
        <div className="status-bar"><div className="status-bar-inner">
          <div className="sb-row sb-row-data">
            <div className="sb-chips-left">
              <div className="sb-chip2 sb-chip-plan"><span className="sb-dot sb-dot-green"/><span className="sb-label">PLAN</span><span className="sb-value">{selectedPlan.toUpperCase()}</span></div>
              <div className="sb-chip2"><span className="sb-label">📦 PRODUCTS</span><span className="sb-value">{totalProducts}</span></div>
              <div className="sb-chip2"><span className="sb-label">🎯 ANALYZED</span><span className="sb-value sb-val-green">0</span></div>
            </div>
          </div>
        </div></div>
        <div className="da">
          {autoScanMode ? (
            <CollectingDataScreen
              totalProducts={totalProducts}
              onComplete={() => { setJustSubscribed(false); window.location.reload(); }}
              onCancel={() => { setAutoScanMode(null); setJustSubscribed(false); }}
            />
          ) : (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:64,marginBottom:20}}>🚀</div>
              <h2 style={{fontSize:28,fontWeight:800,color:"#f1f5f9",marginBottom:12}}>Welcome to Smart Ads AI!</h2>
              <p style={{fontSize:16,color:"rgba(255,255,255,.55)",maxWidth:460,lineHeight:1.6,marginBottom:32}}>Complete the setup above to start scanning your store and generating AI-powered campaigns.</p>
            </div>
          )}
        </div>
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
      </div>
    );

    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/>
        <div className="bg-m"/>

        {/* STATUS BAR — two rows */}
        <div className="status-bar">
          <div className="status-bar-inner">
            {/* Row 1: data chips */}
            <div className="sb-row sb-row-data">
              <div className="sb-chips-left">
                {isPaid
                  ? <div className="sb-chip2 sb-chip-plan"><span className="sb-dot sb-dot-green"/><span className="sb-label">PLAN</span><span className="sb-value">{selectedPlan.toUpperCase()}</span></div>
                  : <div className="sb-chip2 sb-chip-credits"><span className="sb-dot sb-dot-cyan"/><span className="sb-label">SCAN CREDITS</span><span className="sb-value">{scanCredits}</span></div>}
                {isPaid && <div className="sb-chip2"><span className="sb-label">✨ AI CREDITS</span><span className="sb-value sb-val-cyan">{aiCredits}</span></div>}
                <div className="sb-chip2"><span className="sb-label">📦 PRODUCTS</span><span className="sb-value">{totalProducts}</span></div>
                <div className="sb-chip2"><span className="sb-label">🎯 ANALYZED</span><span className="sb-value sb-val-green">{analyzedCount}</span></div>
                {topProduct && <div className="sb-chip2 sb-chip-top2"><span className="sb-label">👑 TOP</span><span className="sb-value sb-val-gold" title={topProduct.title}>{topProduct.title.length>28?topProduct.title.slice(0,28)+"…":topProduct.title}</span></div>}
              </div>
              <div className="sb-chips-right">
                {canPublish
                  ? <div className="sb-chip2 sb-chip-publish-active"><span className="sb-dot sb-dot-green"/><span className="sb-label">PUBLISH</span><span className="sb-value sb-val-green">ACTIVE</span></div>
                  : <div className="sb-chip2 sb-chip-warn"><span className="sb-dot sb-dot-orange"/><span className="sb-label">PUBLISH</span><span className="sb-value">LOCKED</span></div>}
                {liveAds.isRealData && <div className="sb-chip2 sb-chip-live"><span className="sb-dot sb-dot-green" style={{animation:"ldPulse 1s ease infinite"}}/><span className="sb-label">LIVE DATA</span></div>}
              </div>
            </div>
            {/* Row 2: action buttons */}
            <div className="sb-row sb-row-actions">
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {isPaid
                  ? <button className="sb-btn2" onClick={()=>setShowBuyCredits(true)}>✨ Buy AI Credits</button>
                  : <>
                      <button className="sb-btn2 sb-btn2-upgrade" onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>↑ Upgrade to Publish</button>
                      <button className="sb-btn2" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
                    </>}
              </div>
              {liveAds.lastUpdated && (
                <span className="sb-last-updated">
                  {liveAds.isRealData ? "🟢 Live" : "⚪ Mock"} · Updated {liveAds.lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="da">
          {/* HEADER */}
          <div className="da-header">
            <div>
              <h1 className="da-title">Campaign Dashboard</h1>
              <p className="da-sub">{analyzedCount>0?`${analyzedCount} products analyzed · ${highPotential} high-potential · avg score ${avgScore}/100`:`${totalProducts} products synced · Run AI analysis to get started`}</p>
              {analyzedCount>0 && totalMonthlyGapLoss>0 && (
                <div className="da-potential-banner">
                  💸 Your store could be capturing an extra <strong>${totalMonthlyGapLoss.toLocaleString()}/mo</strong> in revenue — <span className="da-potential-link" onClick={() => document.querySelector('.clf-card, .tmo-card')?.scrollIntoView({behavior:'smooth'})}>see how →</span>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {analyzedCount>0 && <a href="/app/saved" className="btn-saved" style={{textDecoration:"none"}}>📋 My Results</a>}
              <button className="btn-secondary" style={{padding:"8px 16px",fontSize:13}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>
              {canPublish
                ? <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={handleAutoCampaign}>⚡ Auto Launch All</button>
                : <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={()=>doScan("review")}>🔍 Scan Products</button>}
            </div>
          </div>

          {/* ══ STORE HEALTH + LIVE PULSE ROW ══ */}
          {/* TOP MISSED OPPORTUNITY */}
          <TopMissedOpportunity
            topProduct={topProduct}
            avgScore={avgScore}
            totalMonthlyGapLoss={totalMonthlyGapLoss}
            analyzedCount={analyzedCount}
            hasScanAccess={hasScanAccess}
            onScan={() => { setShowOnboard(true); setOnboardTab("scan"); setOnboardStep(1); }}
            onViewProduct={handleProductClickCb}
          />

          <div className="health-pulse-row">
            <StoreHealthScore
              analyzedCount={analyzedCount}
              totalProducts={totalProducts}
              avgScore={avgScore}
              highPotential={highPotential}
              competitorCount={competitorCount}
            />
            <LivePulse
              campaigns={mockCampaigns}
              impressionsBase={impressionsBase}
              clicksBase={clicksBase}
              campaignId={campaignId}
              realSpend={realSpend}
              campaignControlStatus={campaignControlStatus}
              confirmRemove={confirmRemove}
              setConfirmRemove={setConfirmRemove}
              onPause={handlePauseCampaign}
              onRemove={handleRemoveCampaign}
            />
          </div>

          {/* SPEEDOMETERS */}
          <div className="speedo-row">
            <div className="speedo-card"><Speedometer value={avgScore} max={100} label="Avg Ad Score" color="#6366f1" size={130}/></div>
            <div className="speedo-card"><Speedometer value={highPotential} max={Math.max(totalProducts,1)} label="High-Potential" color="#22c55e" size={130}/></div>
            <div className="speedo-card"><Speedometer value={Math.min(mockCampaigns,20)} max={20} label="Active Campaigns" color="#06b6d4" size={130}/></div>
            <div className="speedo-card"><Speedometer value={parseFloat(mockRoas)*10} max={100} label="ROAS Score" color="#f59e0b" size={130}/></div>
          </div>

          {/* STATS */}
          <div className="stats-row" style={{marginBottom:24}}>
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={totalProducts}/></div><div className="stat-lbl">Total Products</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val">{analyzedCount>0?<Counter end={avgScore} suffix="/100"/>:<span style={{color:"rgba(255,255,255,.3)"}}>—</span>}</div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">🔑</div><div className="stat-val">{analyzedCount>0?<Counter end={totalKeywords}/>:<span style={{color:"rgba(255,255,255,.3)"}}>—</span>}</div><div className="stat-lbl">Keywords</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={analyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {totalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
          </div>

          
          {/* CAMPAIGN HERO CARD */}
          {isPaid && (
            <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(16,185,129,.06))",border:"1px solid rgba(34,197,94,.15)",borderRadius:16,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,#22c55e,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:"0 4px 16px rgba(34,197,94,.3)"}}>📈</div>
                <div>
                  <div style={{fontSize:32,fontWeight:800,color:"#fff",lineHeight:1}}>{mockCampaigns}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginTop:4}}>{mockCampaigns === 1 ? "Active Campaign" : "Active Campaigns"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:16,marginBottom:2}}>👁</div><div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.impressions ? liveAds.impressions.toLocaleString() : "—"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>Impressions</div></div>
                <div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:16,marginBottom:2}}>👆</div><div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.clicks ? liveAds.clicks.toLocaleString() : "—"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>Clicks</div></div>
                <div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:16,marginBottom:2}}>💰</div><div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.roas ? liveAds.roas+"x" : "—"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>ROAS</div></div>
              </div>
              <a href="/app/campaigns" style={{background:"linear-gradient(135deg,#22c55e,#10b981)",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:700,textDecoration:"none",boxShadow:"0 4px 12px rgba(34,197,94,.3)",whiteSpace:"nowrap"}}>View Campaigns →</a>
            </div>
          )}

          
          {/* STATUS ROW */}
          <div className="status-row">
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(34,197,94,.1)",color:"#22c55e"}}>📈</div><div><div className="status-card-label">Campaigns Active</div><div className="status-card-val">{mockCampaigns} running</div></div><div className="status-card-trend">{canPublish?`+${Math.round(mockCampaigns*0.2)} this week`:"Subscribe to launch"}</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(6,182,212,.1)",color:"#06b6d4"}}>👁</div><div><div className="status-card-label">Impressions</div><div className="status-card-val">{(mockCampaigns*4200).toLocaleString()}/mo</div></div><div className="status-card-trend up">est.</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>👆</div><div><div className="status-card-label">Est. Clicks</div><div className="status-card-val">{(mockCampaigns*180).toLocaleString()}/mo</div></div><div className="status-card-trend up">est.</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:`rgba(${threatColor==="#22c55e"?"34,197,94":threatColor==="#f59e0b"?"245,158,11":"239,68,68"},.1)`,color:threatColor}}>🕵️</div><div><div className="status-card-label">Competitor Threat</div><div className="status-card-val" style={{color:threatColor}}>{competitorThreat}</div></div><div className="status-card-trend" style={{color:threatColor}}>{googleRankStatus==="page_1"?"Page 1":googleRankStatus==="page_2"?"Page 2":"Page 3+"} rank</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(245,158,11,.1)",color:"#fbbf24"}}>💰</div><div><div className="status-card-label">Est. ROAS</div><div className="status-card-val">{mockRoas}x</div></div><div className="status-card-trend up">based on scores</div></div>
            {/* Total Spend Card */}
            {campaignId && (
              <div className="status-card status-card-spend">
                <div className="status-card-icon" style={{background:"rgba(34,197,94,.1)",color:"#22c55e"}}>💸</div>
                <div>
                  <div className="status-card-label">Total Spend</div>
                  <div className="status-card-val">
                    {realSpend != null ? `$${Number(realSpend).toFixed(2)}` : "Fetching…"}
                  </div>
                </div>
                <div className="status-card-trend up">{realSpend != null ? "live from Google" : "connecting…"}</div>
              </div>
            )}
          </div>
          {/* MARKET INTELLIGENCE */}
          <LockedOverlay title="Market Intelligence">
          <MarketAlert shopDomain={shopDomain}/>
          </LockedOverlay>

          {/* STORE PERFORMANCE ANALYTICS */}
          <LockedOverlay title="Store Performance Analytics">
          <StoreAnalyticsWidget/>
          </LockedOverlay>




          {/* COMPETITOR PANEL */}
          {topCompetitors.length>0 && (
            <div className="competitor-panel">
              <div className="competitor-panel-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div className="clf-live-dot"/>
                  <span className="competitor-panel-title">🕵️ Top Competitors Detected</span>
                  <span className="clf-live-badge">LIVE</span>
                </div>
                <span className="competitor-panel-sub">Across {analyzedCount} analyzed products · sorted by frequency</span>
              </div>
              <div className="competitor-list">
                {topCompetitors.map(([domain,data],i)=>{
                  const tc = data.strength==="strong"?"#ef4444":data.strength==="medium"?"#f59e0b":"#22c55e";
                  const keywords = analyzedDbProducts
                    .flatMap(p=>(p.aiAnalysis?.competitor_intel?.top_competitors||[]).filter(c=>c.domain===domain).flatMap(c=>c.keywords||[]))
                    .filter(Boolean).slice(0,3);
                  return (
                    <div key={i} className="competitor-item competitor-item-clickable" onClick={()=>setSelCompetitor({domain})}>
                      <div className="competitor-rank">#{i+1}</div>
                      <div className="competitor-favicon">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" onError={e=>{e.target.style.display="none"}} style={{width:16,height:16}}/>
                      </div>
                      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="competitor-domain competitor-domain-link" onClick={e=>e.stopPropagation()}>{domain}</a>
                      {keywords.length>0 && (
                        <div className="competitor-keywords">
                          {keywords.map((k,ki)=><span key={ki} className="competitor-kw-tag">{typeof k==="string"?k:k?.text||k}</span>)}
                        </div>
                      )}
                      <div className="competitor-count">{data.count} product{data.count!==1?"s":""}</div>
                      <div className="competitor-strength" style={{color:tc}}>{data.strength}</div>
                      <div className="competitor-click-hint">View ads →</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPETITOR GAP FINDER */}
          {analyzedCount > 0 && (
            <CompetitorGapFinder
              keywordGaps={keywordGaps}
              totalMonthlyGapLoss={totalMonthlyGapLoss}
              analyzedCount={analyzedCount}
              canPublish={canPublish}
              onUpgrade={handleUpgradeClick}
            />
          )}

          {/* BUDGET SIMULATOR */}
          <BudgetSimulator
            avgScore={avgScore}
            avgCpc={liveAds?.avgCpc || null}
            canPublish={canPublish}
            onUpgrade={handleUpgradeClick}
          />

          {/* AD PREVIEW PANEL */}
          <AdPreviewPanel
            topProduct={topProduct}
            mockCampaigns={mockCampaigns}
            canPublish={canPublish}
            shop={shopDomain}
            onLaunch={canPublish ? handleAutoCampaignCb : handleUpgradeClick}
            onViewProduct={handleProductClickCb}
          />

          {/* AI SUMMARY */}
          {analyzedCount>0 && (
            <div className="ai-summary-card" style={{marginBottom:24}}>
              <span className="ai-summary-icon">🤖</span>
              <div>
                <div className="celebrate-badge">✨ {analyzedCount===totalProducts?"All Products Analyzed":`${analyzedCount} Products Analyzed`}</div>
                <div>{highPotential} high-potential products found. {topProduct?.title?`"${topProduct.title}" is your top performer with a score of ${topProduct.aiAnalysis?.ad_score||0}.`:""} {canPublish?"Ready for campaign launch.":"Subscribe to publish campaigns to Google Ads."}</div>
              </div>
            </div>
          )}

          {/* ACTION CARD */}
          {canPublish ? (
            <div className="auto-campaign-card">
              <div className="auto-campaign-left">
                <div className="auto-campaign-icon">⚡</div>
                <div><div className="auto-campaign-title">Fully Automatic Campaign</div><div className="auto-campaign-desc">The AI handles everything — competitor research, keywords, ad copy, targeting, and launch. Zero manual work.</div></div>
              </div>
              <button className="btn-auto-launch" onClick={handleAutoCampaign}><span>Launch All Campaigns</span><span style={{fontSize:12,opacity:0.7,display:"block"}}>AI does everything for you</span></button>
            </div>
          ) : (
            <div className="upgrade-publish-card">
              <div className="upc-left">
                <div style={{fontSize:32,flexShrink:0}}>🔒</div>
                <div><div className="upc-title">Ready to Publish Campaigns?</div><div className="upc-desc">You have full AI scan access. Subscribe to push these campaigns live to Google Ads with one click.</div></div>
              </div>
              <button className="btn-primary" style={{padding:"12px 28px",flexShrink:0}} onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>View Plans →</button>
            </div>
          )}

          {/* PRODUCTS GRID */}
          <div style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{fontSize:18,fontWeight:700}}>Your Products</h2>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-secondary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>doScan("review")}>↻ Rescan</button>
              {canPublish && <button className="btn-secondary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <a href="/app/campaigns" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",borderRadius:10,fontSize:13,fontWeight:600,textDecoration:"none",border:"none",cursor:"pointer"}}>📋 Go to Campaigns →</a>
          </div>
          <div className="p-grid">
            {sortedProducts.map((product,idx)=>{
              const ai=product.aiAnalysis, hasAi=product.hasAiAnalysis&&ai, score=hasAi?ai.ad_score||0:0;
              const isTopPick=idx<3&&hasAi&&score>=60;
              const eI=hasAi?Math.round(score*46+500):0, eC=hasAi?Math.round(score*3.8+20):0, eCo=hasAi?Math.round(score*0.45+10):0;
              return (
                <div key={product.id} className={`p-card ${!hasAi?"p-card-pending":""} ${isTopPick?"p-card-recommended":""}`} onClick={()=>hasAi?handleProductClick(product):null}>
                  {isTopPick && <div className="p-card-rec-badge">⭐ AI Recommends</div>}
                  <div className="p-card-img-wrap">
                    {product.image?<img src={product.image} alt={product.title} className="p-card-img"/>:<div className="p-card-noimg">📦</div>}
                    {hasAi && <div className="p-card-score"><ScoreRing score={score}/></div>}
                    {!hasAi && <div className="p-card-pending-badge">🔒 Not analyzed</div>}
                    {!product.inStock && <div className="p-card-oos">Out of Stock</div>}
                  </div>
                  <div className="p-card-body">
                    <h3 className="p-card-title">{product.title}</h3>
                    <p className="p-card-price">${Number(product.price).toFixed(2)}</p>
                    {hasAi ? (
                      <>
                        <div className="p-card-metrics">
                          <div className="p-metric"><span className="p-metric-ic">👁</span><span className="p-metric-val">{eI.toLocaleString()}</span><span className="p-metric-lbl">/mo</span></div>
                          <div className="p-metric"><span className="p-metric-ic">👆</span><span className="p-metric-val">{eC}</span><span className="p-metric-lbl">/mo</span></div>
                          <div className="p-metric"><span className="p-metric-ic">💰</span><span className="p-metric-val">${eCo}</span><span className="p-metric-lbl">/day</span></div>
                        </div>
                        <div className="p-card-hl">{ai.headlines?.[0]||"AI headline preview..."}</div>
                        <div className="p-card-cta">{canPublish?"View & Launch →":"View AI Analysis →"}</div>
                      </>
                    ) : (
                      <><div className="p-card-hl" style={{color:"rgba(255,255,255,.25)"}}>Analysis pending...</div><div className="p-card-cta" style={{color:"rgba(255,255,255,.3)"}}>⏳ In queue</div></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MANUAL PICKER */}
        {showManualPicker && (
          <div className="modal-overlay" onClick={()=>setShowManualPicker(false)}>
            <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{maxWidth:680}}>
              <button className="modal-close" onClick={()=>setShowManualPicker(false)}>✕</button>
              <h2 style={{fontSize:20,fontWeight:800,marginBottom:6}}>🎯 Manual Campaign</h2>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:20}}>Select products. AI will create optimized campaigns for each one.</p>
              {!canPublish && <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fbbf24",marginBottom:16}}>🔒 Publishing requires a subscription. <span style={{color:"#a5b4fc",cursor:"pointer"}} onClick={()=>{setShowManualPicker(false);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>View plans →</span></div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxHeight:"50vh",overflowY:"auto",marginBottom:20}}>
                {[...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0)).filter(p=>p.hasAiAnalysis).map(p=>{
                  const picked=pickedProducts.includes(p.id), isRec=(p.aiAnalysis?.ad_score||0)>=70;
                  return (
                    <div key={p.id} className={`picker-card ${picked?"picker-selected":""}`} onClick={()=>setPickedProducts(prev=>picked?prev.filter(id=>id!==p.id):[...prev,p.id])}>
                      {isRec && <div className="picker-rec">⭐ Recommended</div>}
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {p.image && <img src={p.image} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover"}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.title}</div>
                          <div style={{fontSize:12,color:"#a5b4fc"}}>${Number(p.price).toFixed(2)} · Score: {p.aiAnalysis?.ad_score||0}/100</div>
                        </div>
                        <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${picked?"#6366f1":"rgba(255,255,255,.2)"}`,background:picked?"#6366f1":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{picked?"✓":""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {analyzedDbProducts.length===0 && <p style={{textAlign:"center",color:"rgba(255,255,255,.4)",fontSize:13}}>No analyzed products yet. Run AI analysis first.</p>}
              <div style={{display:"flex",gap:10}}>
                <button className="btn-secondary" style={{flex:1}} onClick={()=>setShowManualPicker(false)}>Cancel</button>
                <button className="btn-primary" style={{flex:2}} disabled={pickedProducts.length===0||!canPublish} onClick={async()=>{
                  if(!canPublish){setShowManualPicker(false);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);return;}
                  setShowManualPicker(false);setAutoLaunching(true);
                  let sc=0;
                  const sorted=[...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0));
                  for(const id of pickedProducts){
                    const prod=sorted.find(p=>p.id===id);if(!prod)continue;
                    const ai=prod.aiAnalysis||{};
                    try{const form=new FormData();form.append("productTitle",prod.title);form.append("headlines",JSON.stringify((ai.headlines||[]).map(h=>typeof h==="string"?h:h.text||h)));form.append("descriptions",JSON.stringify((ai.descriptions||[]).map(d=>typeof d==="string"?d:d.text||d)));form.append("keywords",JSON.stringify(ai.keywords||[]));form.append("finalUrl",getProductUrl(prod));form.append("dailyBudget","50");const res=await fetch("/app/api/campaign",{method:"POST",body:form});const data=await res.json();if(data.success)sc++;}catch{}
                  }
                  setAutoLaunching(false);setPickedProducts([]);setAutoStatus(sc>0?"success":"error");if(sc>0)triggerConfetti();
                }}>{canPublish?`🚀 Launch ${pickedProducts.length>0?pickedProducts.length+" ":""}Campaign${pickedProducts.length!==1?"s":""}` :"🔒 Subscribe to Launch"}</button>
              </div>
            </div>
          </div>
        )}

        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults}
          shop={shopDomain}
        />}
        {selCompetitor && <CompetitorModal competitor={selCompetitor} products={analyzedDbProducts} onClose={()=>setSelCompetitor(null)}/>}
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
        {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      </div>
    );
  }

  // ── FREE DEMO RESULTS ──
  if (scanned && products.length > 0) {
    const analyzedCount = aiResults?.products?.length||0, totalProducts = products.length;
    const avgScore = aiResults?.products?.length ? Math.round(aiResults.products.reduce((a,p)=>a+(p.ad_score||0),0)/aiResults.products.length) : 0;
    const highPotential = aiResults?.products?.filter(p=>p.ad_score>=70).length||0;
    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/><div className="bg-m"/>
        {isHydrated && !isPaid && scanCredits === 0 && <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>}
        <div className="da">
          <div className="da-header">
            <div>
              <button className="btn-back-home" onClick={()=>{setProducts([]);setAiResults(null);}}>← Back</button>
              <h1 className="da-title">Free Preview</h1>
              <p className="da-sub">{analyzedCount} of {totalProducts} products analyzed · Upgrade to unlock all {totalProducts-analyzedCount} remaining</p>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button className="btn-rescan" onClick={()=>doScan("review")}>↻ Scan Again</button>
              <button className="btn-secondary" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
              <button className="btn-primary" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Subscribe & Publish</button>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={totalProducts}/></div><div className="stat-lbl">Products Found</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val"><Counter end={avgScore} suffix="/100"/></div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">⚡</div><div className="stat-val"><Counter end={highPotential}/></div><div className="stat-lbl">High-Potential</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={analyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {totalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
          </div>
          <div className="ai-summary-card ai-summary-free"><span className="ai-summary-icon">🔒</span><div><div className="free-badge">Free Preview</div><div>{aiResults?.summary}</div></div></div>
          <div className="p-grid">
            {products.map(product=>{
              const ai=aiResults?.products?.find(ap=>ap.title===product.title), hasAi=!!ai, score=hasAi?ai.ad_score||0:0;
              const eI=hasAi?Math.round(score*46+500):0, eC=hasAi?Math.round(score*3.8+20):0, eCo=hasAi?Math.round(score*0.45+10):0;
              return (
                <div key={product.id} className={`p-card ${!hasAi?"p-card-locked":""}`} onClick={()=>hasAi?handleProductClick({...product,aiAnalysis:ai}):null}>
                  <div className="p-card-img-wrap">
                    {product.image?<img src={product.image} alt={product.title} className="p-card-img"/>:<div className="p-card-noimg">📦</div>}
                    {hasAi && <div className="p-card-score"><ScoreRing score={score}/></div>}
                    {!hasAi && <div className="p-card-locked-overlay"><div style={{fontSize:28}}>🔒</div><div style={{fontSize:11,marginTop:4}}>Upgrade to unlock</div></div>}
                  </div>
                  <div className="p-card-body">
                    <h3 className="p-card-title">{product.title}</h3>
                    <p className="p-card-price">${Number(product.price).toFixed(2)}</p>
                    {hasAi ? (<><div className="p-card-metrics"><div className="p-metric"><span className="p-metric-ic">👁</span><span className="p-metric-val">{eI.toLocaleString()}</span><span className="p-metric-lbl">/mo</span></div><div className="p-metric"><span className="p-metric-ic">👆</span><span className="p-metric-val">{eC}</span><span className="p-metric-lbl">/mo</span></div><div className="p-metric"><span className="p-metric-ic">💰</span><span className="p-metric-val">${eCo}</span><span className="p-metric-lbl">/day</span></div></div><div className="p-card-hl">{ai.headlines?.[0]||"AI headline preview..."}</div><div className="p-card-cta">View AI Analysis →</div></>) : (<div className="p-card-hl p-card-blur">Upgrade to see keywords, ad copy & competitor data</div>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="free-upgrade-cta" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>
            <div className="free-upgrade-icon">🚀</div>
            <div><div className="free-upgrade-title">Unlock All {totalProducts} Products + Full Campaigns</div><div className="free-upgrade-desc">Get competitor intelligence, ad copy, keywords & one-click Google Ads campaigns for every product</div></div>
            <div className="free-upgrade-arrow">→</div>
          </div>
        </div>
        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults}
          shop={shopDomain}
        />}
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
        {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      </div>
    );
  }

  // ── LANDING PAGE ──
  return (
    <div className="sr dk"><StyleTag/>
      <div className="bg-m"/>
      <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>
      <div className={`la ${vis?"la-v":""}`}>
        <section className="hero">
          <div className="hero-badge">🤖 AI-Powered Google Ads for Shopify</div>
          <h1 className="hero-h">Stop guessing.<br/><span className="hero-grad">Start selling.</span></h1>
          <p className="hero-p">Smart Ads AI scans your competitors, checks your Google rankings, writes killer ad copy, and launches campaigns that convert — in 60 seconds.</p>
          <div className="hero-btns">
            <button className="btn-primary btn-lg" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Start My Campaign</button>
            <button className="btn-secondary" onClick={()=>doScan("review")}>Try Free Preview</button>
          </div>
          <div className="hero-nudge" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}><span className="nudge-lock">⚡</span> No subscription? <strong>Buy scan credits</strong> — from $0.60/scan <span className="nudge-arrow">→</span></div>
          <div className="hero-metrics">
            <div className="hm"><span className="hm-val">+340%</span><span className="hm-lbl">Avg ROAS</span></div>
            <div className="hm"><span className="hm-val">47hrs</span><span className="hm-lbl">Saved/month</span></div>
            <div className="hm"><span className="hm-val">-52%</span><span className="hm-lbl">CPC Reduction</span></div>
          </div>
          <SuccessTicker/>
        </section>
        {/* ── BUDGET TEASER ── */}
        <section className="section lp-budget-section">
          <h2 className="sec-h">See your numbers before you commit</h2>
          <p className="sec-sub">Move the slider — watch your projected results update instantly.</p>
          <LandingBudgetTeaser />
        </section>

        {/* ── WHAT YOU'RE MISSING ── */}
        <section className="section lp-missing-section">
          <h2 className="sec-h">What's happening while you wait</h2>
          <p className="sec-sub">Every day without Smart Ads AI, your competitors are pulling ahead.</p>
          <LandingMissingBlock onInstall={() => { setShowOnboard(true); setOnboardStep(1); setOnboardTab("subscription"); }} />
        </section>

        <section className="section"><h2 className="sec-h">Sound familiar?</h2><div className="pain-grid">{[{ic:"💸",t:"Wasted Ad Spend",d:"Thousands spent on agencies with nothing to show for it."},{ic:"😵",t:"Google Ads Confusion",d:"The interface is overwhelming. You don't know where to start."},{ic:"📝",t:"Generic Ad Copy",d:"Your ads sound like everyone else's. No personality, no conversions."},{ic:"⏰",t:"Weeks of Setup",d:"By the time your campaign launches, the trend is already over."}].map((p,i)=><div key={i} className="pain-card"><span className="pain-ic">{p.ic}</span><h3 className="pain-t">{p.t}</h3><p className="pain-d">{p.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">What if AI could do it all — better?</h2><div className="sol-grid">{[{n:"60",s:"seconds",d:"Full competitor scan + campaign-ready ads"},{n:"Top 10",s:"competitors",d:"Scraped and analyzed for every product"},{n:"Real",s:"data",d:"Keywords from Google, not guesses from a robot"}].map((s,i)=><div key={i} className="sol-card"><div className="sol-n">{s.n}</div><div className="sol-s">{s.s}</div><p className="sol-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Stupidly simple. Seriously powerful.</h2><div className="steps-grid">{[{n:"1",t:"Scan",d:"AI scans your products and searches Google for your competitors."},{n:"2",t:"Analyze",d:"See competitor keywords, your rankings, and AI-optimized ad copy."},{n:"3",t:"Launch",d:"One click to launch campaigns built on real competitive data."}].map((s,i)=><div key={i} className="step-card"><div className="step-n">{s.n}</div><h3 className="step-t">{s.t}</h3><p className="step-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Everything you need. Nothing you don't.</h2><div className="feat-grid">{[{ic:"🕵️",t:"Competitor Intelligence",d:"We scan your competitors' sites, steal their best keywords, and find gaps they're missing."},{ic:"📍",t:"Google Rank Check",d:"See exactly where your store ranks — and where it doesn't."},{ic:"🧠",t:"AI Ad Copy",d:"Headlines and descriptions based on what's actually working for top-ranking competitors."},{ic:"🎯",t:"Smart Keywords",d:"Real keywords pulled from competitor websites, Google results, and search trends."},{ic:"📊",t:"Ad Score + Strategy",d:"Each product gets a competitive score and a strategy: aggressive, defensive, or dominant."},{ic:"⚡",t:"One-Click Launch",d:"From scan to live Google Ads campaign in 60 seconds. All campaigns start paused for your review."}].map((f,i)=><div key={i} className="feat-card"><span className="feat-ic">{f.ic}</span><h3 className="feat-t">{f.t}</h3><p className="feat-d">{f.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Loved by Shopify merchants</h2><div className="test-grid">{[{q:"Set up my first campaign in under 2 minutes. The AI copy was better than what my agency wrote.",n:"Sarah K.",r:"Fashion Store Owner"},{q:"Finally an app that makes Google Ads accessible. My ROAS went from 1.2x to 4.8x in a month.",n:"Mike T.",r:"Electronics Store"},{q:"I was spending $500/mo on a freelancer. Now AI does it better for $29/mo.",n:"Lisa R.",r:"Beauty & Wellness"}].map((t,i)=><div key={i} className="test-card"><p className="test-q">"{t.q}"</p><div className="test-author"><strong>{t.n}</strong><span>{t.r}</span></div></div>)}</div></section>
        <section className="section cta-section">
          <h2 className="cta-h">Your products deserve better ads.</h2>
          <p className="cta-p">Join 2,000+ Shopify merchants who stopped guessing and started growing.</p>
          <button className="btn-primary btn-lg" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Start My Campaign →</button>
          <div style={{marginTop:12,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-secondary" onClick={()=>doScan("review")}>🔍 Try Free Preview</button>
            <button className="btn-secondary" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
          </div>
        </section>
      </div>
      {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
      {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      {showLaunchChoice && (
        <div className="modal-overlay" onClick={()=>setShowLaunchChoice(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,textAlign:"center",padding:"44px 36px"}}>
            <button className="modal-close" onClick={()=>setShowLaunchChoice(false)}>✕</button>
            <div style={{fontSize:48,marginBottom:16}}>🚀</div>
            <h2 style={{fontSize:24,fontWeight:800,marginBottom:8}}>Launch Your Campaigns</h2>
            <p style={{color:"rgba(255,255,255,.55)",marginBottom:32,fontSize:15}}>How would you like to proceed?</p>
            <div style={{display:"flex",gap:16,flexDirection:"column"}}>
              <button className="launch-choice-btn launch-auto" onClick={()=>{setShowLaunchChoice(false);doScan("auto");}}><span className="launch-choice-icon">⚡</span><div><div className="launch-choice-title">Auto Launch</div><div className="launch-choice-desc">AI scans, builds and launches campaigns instantly — zero manual work</div></div></button>
              <button className="launch-choice-btn" onClick={()=>{setShowLaunchChoice(false);doScan("review");}}><span className="launch-choice-icon">🔍</span><div><div className="launch-choice-title">Review & Edit</div><div className="launch-choice-desc">Check keywords, headlines & images before launching</div></div></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

