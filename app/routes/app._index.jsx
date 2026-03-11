import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { useLoaderData, useLocation, useRevalidator, useNavigate, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopProducts, getSyncStatus } from "../sync.server.js";
import { getSubscriptionInfo } from "../license.server.js";
import { CSS } from "./styles.index.js";
import { Counter, ScoreRing, Speedometer } from "../components/ui/SmallWidgets.jsx";
import { TipRotator, Confetti, SuccessTicker } from "./SmallComponents.jsx";
import { CollectingDataScreen } from "./CollectingDataScreen.jsx";
import { CompetitorGapFinder } from "./CompetitorComponents.jsx";
import { StoreHealthScore, TopMissedOpportunity, BudgetSimulator } from "./DashboardWidgets.jsx";
import { LandingBudgetTeaser, LandingMissingBlock } from "./LandingComponents.jsx";
import { ProductModal } from "../components/ProductModal.jsx";
import { useGoogleAdsData } from "../hooks/useGoogleAdsData.js";
import { SubscriberHome } from "../components/SubscriberHome.jsx";
import GlobalModals from "../components/GlobalModals.jsx";
import { ScanningScreen } from "../components/ScanningScreen.jsx";
import { AutoLaunchingScreen, AutoStatusScreen } from "../components/AutoScreens.jsx";
import { DashboardView } from "../components/DashboardView.jsx";
import useAppStore from "../stores/useAppStore.js";

// Error Boundary — prevents widget crashes from killing the whole page
class WidgetErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err, info) { console.error(`[WidgetErrorBoundary] ${this.props.label || "widget"} crashed:`, err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(239,68,68,.2)",borderRadius:16,padding:"16px 20px",marginBottom:20,minHeight:72}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:18}}>⚠️</span>
            <span style={{fontWeight:700,fontSize:14,color:"rgba(255,255,255,.7)"}}>{this.props.label || "Widget"}</span>
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:6}}>
            Something went wrong loading this section.
            <button onClick={()=>this.setState({hasError:false,error:null})} style={{marginLeft:8,background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.3)",borderRadius:6,padding:"3px 10px",color:"#a5b4fc",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// LockedOverlay — MUST be outside Index() to prevent child remount loops
function LockedOverlay({ isPaid, onUpgrade, title, children }) {
  if (isPaid) return children || null;
  return (
    <div style={{position:"relative"}}>
      <div style={{filter:"blur(3px)",opacity:0.5,pointerEvents:"none"}}>{children}</div>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(10,10,26,.7)",borderRadius:16,zIndex:10,cursor:"pointer"}} onClick={onUpgrade}>
        <div style={{fontSize:36,marginBottom:8}}>🔒</div>
        <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>{title || "Premium Feature"}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:12}}>Subscribe to unlock this section</div>
        <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:600}}>Upgrade Now →</div>
      </div>
    </div>
  );
}

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

  // ── Zustand Store ──
  const store = useAppStore();
  const {
    // UI
    showOnboard, setShowOnboard, onboardStep, setOnboardStep, onboardTab, setOnboardTab,
    showBuyCredits, setShowBuyCredits, showLaunchChoice, setShowLaunchChoice,
    launchLoading, setLaunchLoading, showConfetti, showDashboard, setShowDashboard,
    showCancelConfirm, setShowCancelConfirm, vis, setVis, triggerConfetti,
    openUpgradeModal, openCreditsTab,
    // Subscription
    selectedPlan, scanCredits, setScanCredits, aiCredits, setAiCredits,
    googleConnected, setGoogleConnected, justSubscribed, setJustSubscribed,
    autoScanMode, setAutoScanMode, isHydrated,
    initSubscription, hydrateFromSession, selectPlan,
    // Scanning
    isScanning, setIsScanning, fakeProgress, setFakeProgress, scanMode, setScanMode,
    scanMsg, setScanMsg, scanError, setScanError,
    products, setProducts, aiResults, setAiResults,
    // Campaign
    campaignId, setCampaignId, campaignStatus, setCampaignStatus,
    campaignControlStatus, setCampaignControlStatus,
    realSpend, setRealSpend, confirmRemove, setConfirmRemove,
    autoStatus, setAutoStatus, autoLaunching, setAutoLaunching,
    selProduct, setSelProduct, selCompetitor, setSelCompetitor,
    editHeadlines, setEditHeadlines, editDescriptions, setEditDescriptions,
    improvingIdx, setImprovingIdx, pickedProducts, setPickedProducts,
    hydrateCampaign,
  } = store;

  // ── Initialize store from server data (once) ──
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      initSubscription({ isPaidServer, planFromCookie, serverSubscription });
      hydrateFromSession({ isPaidServer, serverSubscription });
      hydrateCampaign();
    }
  }, []);

  // Enterprise: trigger initial sync on client side
  useEffect(() => {
    if (needsInitialSync) {
      fetch("/app/api/sync", { method: "POST" }).catch(() => {});
    }
  }, [needsInitialSync]);

  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef(0);
  useEffect(() => { const s = scrollRef.current; if (s > 0) window.scrollTo(0, s); const h = () => { scrollRef.current = window.scrollY; }; window.addEventListener("scroll", h, { passive: true }); return () => window.removeEventListener("scroll", h); });
  useEffect(() => {
    if (location.hash === "#launch") {
      setShowLaunchChoice(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location.hash]);

  const revalidator = useRevalidator();

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

  const scanned = products.length > 0;
  const _forcePreview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'landing';
  const isPaid = !!selectedPlan;
  const hasScanAccess = isPaid || scanCredits > 0;
  const canPublish = isPaid;

  // Pre-compute values for the Google Ads hook
  const _analyzedCount = analyzedDbProducts.length;
  const _avgScore = _analyzedCount > 0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/_analyzedCount) : 0;
  const _mockCampaigns = isPaid && _analyzedCount > 0 ? Math.min(Math.floor(_analyzedCount * 0.6), 12) : 0;
  const liveAds = useGoogleAdsData(_mockCampaigns, _avgScore);

  useEffect(() => { setVis(true); }, []);

  const cancelRef = useRef(false);
  const creepRef = useRef(null);

  // ── SCAN FUNCTION ──
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

      const allFetched = fd.products, fetchedStoreUrl = fd.storeInfo?.url || "";
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

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", fetchedStoreUrl);
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
    if (!canPublish) { openUpgradeModal(); return; }
    setAutoLaunching(true);
    let successCount = 0;
    const toProcess = analyzedDbProducts.length > 0 ? analyzedDbProducts : allDbProducts.slice(0, 5);
    for (const prod of toProcess) {
      if (cancelRef.current) break;
      const ai = prod.aiAnalysis||{};
      const rawH = (ai.headlines||[]).map(h=>typeof h==="string"?h:h?.text||h).filter(Boolean);
      const rawD = (ai.descriptions||[]).map(d=>typeof d==="string"?d:d?.text||d).filter(Boolean);
      const headlines = rawH.length >= 3 ? rawH : [...rawH, prod.title+" - Shop Now", "Free Shipping Available", "Best Deals Online"].slice(0,Math.max(3,rawH.length));
      const descriptions = rawD.length >= 2 ? rawD : [...rawD, "Discover "+prod.title+". Premium quality at great prices. Order today.", "Shop our collection. Fast shipping, easy returns, satisfaction guaranteed."].slice(0,Math.max(2,rawD.length));
      try {
        const form = new FormData();
        form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(headlines));
        form.append("descriptions", JSON.stringify(descriptions)); form.append("keywords", JSON.stringify(ai.keywords||[]));
        form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
        const res = await fetch("/app/api/campaign", { method:"POST", body:form });
        const data = await res.json(); if (data.success) successCount++;
      } catch {}
    }
    setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    if (successCount > 0) { triggerConfetti(); setTimeout(() => navigate("/app/campaigns"), 3000); }
  }

  function handleProductClick(product) {
    if (!hasScanAccess) { openUpgradeModal(); return; }
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
        if (!res.ok || !(res.headers.get("content-type")||"").includes("json")) { console.warn("[campaign-manage] non-JSON response:", res.status); return; }
        const data = await res.json();
        if (!cancelled && data.campaigns) {
          const numId = String(campaignId).split("/").pop();
          const camp = data.campaigns.find(c => String(c.id) === numId || c.resourceName === campaignId);
          if (camp) setRealSpend(parseFloat(camp.cost));
        }
      } catch {}
    }
    fetchSpend();
    const iv = setInterval(fetchSpend, 60000);
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
      if (!res.ok || !(res.headers.get("content-type")||"").includes("json")) { console.warn("[campaign-manage] non-JSON response:", res.status); setCampaignControlStatus("error"); return; }
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
      if (!res.ok || !(res.headers.get("content-type")||"").includes("json")) { console.warn("[campaign-manage] non-JSON response:", res.status); setCampaignControlStatus("error"); return; }
      const data = await res.json();
      if (data.success) {
        setCampaignControlStatus("removed");
        setCampaignId(null);
      } else {
        setCampaignControlStatus("error");
      }
    } catch { setCampaignControlStatus("error"); }
  }

  const handleUpgradeClick = useCallback(() => { openUpgradeModal(); }, []);

  const handleProductClickRef = useRef(handleProductClick);
  const handleAutoCampaignRef = useRef(handleAutoCampaign);
  useEffect(() => {
    handleProductClickRef.current = handleProductClick;
    handleAutoCampaignRef.current = handleAutoCampaign;
  });
  const handleProductClickCb = useCallback((p) => handleProductClickRef.current(p), []);
  const handleAutoCampaignCb = useCallback(() => handleAutoCampaignRef.current(), []);

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
        if (cid) setCampaignId(cid);
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

  // ── Computed values (MUST be before any early returns) ──
  const totalProducts = totalDbProducts;
  const analyzedCount = analyzedDbProducts.length;
  const avgScore = analyzedCount>0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/analyzedCount) : 0;
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
    return (
      <ScanningScreen StyleTag={StyleTag} cancelRef={cancelRef} creepRef={creepRef} FREE_SCAN_LIMIT={FREE_SCAN_LIMIT}/>
    );
  }

  if (autoLaunching) return (
    <AutoLaunchingScreen cancelRef={cancelRef} StyleTag={StyleTag}/>
  );

  if (autoStatus==="success"||autoStatus==="error") return (
    <AutoStatusScreen navigate={navigate} StyleTag={StyleTag}/>
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
    const competitorCount = topCompetitors.length;
    const impressionsBase = liveAds.impressions;
    const clicksBase = liveAds.clicks;

    // ── SUBSCRIBER HOME PAGE ──
    if (isPaid && analyzedCount > 0 && !justSubscribed && !showDashboard) return (
      <>
      <SubscriberHome
        selectedPlan={selectedPlan}
        shopDomain={shopDomain}
        analyzedDbProducts={analyzedDbProducts}
        totalProducts={totalProducts}
        analyzedCount={analyzedCount}
        avgScore={avgScore}
        topCompetitors={topCompetitors}
        liveAds={liveAds}
        keywordGaps={keywordGaps}
        totalMonthlyGapLoss={totalMonthlyGapLoss}
        onOpenDashboard={() => setShowDashboard(true)}
        onScan={() => doScan("review")}
        onLaunch={() => setShowLaunchChoice(true)}
        onBuyCredits={() => openCreditsTab()}
      />
      <GlobalModals navigate={navigate}/>
      </>
    );

    // ── Fresh paid subscriber ──
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
        <GlobalModals navigate={navigate}/>
      </div>
    );

    return (<>
      <DashboardView
        analyzedDbProducts={analyzedDbProducts} totalProducts={totalProducts}
        analyzedCount={analyzedCount} avgScore={avgScore}
        topCompetitors={topCompetitors} liveAds={liveAds}
        keywordGaps={keywordGaps} totalMonthlyGapLoss={totalMonthlyGapLoss}
        shopDomain={shopDomain} allDbProducts={allDbProducts} storeUrl={storeUrl}
        sortedProducts={sortedProducts}
        onManualLaunch={async (productIds) => {
          setAutoLaunching(true);
          let sc = 0;
          const sorted = [...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0));
          for (const id of productIds) {
            const prod = sorted.find(p=>p.id===id); if(!prod) continue;
            const ai = prod.aiAnalysis||{};
            try {
              const form = new FormData();
              form.append("productTitle", prod.title);
              form.append("headlines", JSON.stringify((ai.headlines||[]).map(h=>typeof h==="string"?h:h.text||h)));
              form.append("descriptions", JSON.stringify((ai.descriptions||[]).map(d=>typeof d==="string"?d:d.text||d)));
              form.append("keywords", JSON.stringify(ai.keywords||[]));
              form.append("finalUrl", getProductUrl(prod));
              form.append("dailyBudget", "50");
              const res = await fetch("/app/api/campaign", {method:"POST", body:form});
              const data = await res.json();
              if(data.success) sc++;
            } catch{}
          }
          setAutoLaunching(false); setPickedProducts([]);
          if (sc>0) { setAutoStatus("success"); triggerConfetti(); } else { setAutoStatus("error"); }
        }}
        doScan={doScan} handleProductClick={handleProductClick} navigate={navigate}
        handlePauseCampaign={handlePauseCampaign} handleRemoveCampaign={handleRemoveCampaign}
        StyleTag={StyleTag}
        mockCampaigns={mockCampaigns} mockRoas={mockRoas}
        competitorThreat={competitorThreat} threatColor={threatColor}
        googleRankStatus={googleRankStatus} competitorCount={competitorCount}
        impressionsBase={impressionsBase} clicksBase={clicksBase}
        totalKeywords={totalKeywords} highPotential={highPotential} topProduct={topProduct}
      />
      <GlobalModals navigate={navigate}/>
    </>);
  }

  // ── FREE DEMO RESULTS ──
  if (scanned && products.length > 0) {
    const demoAnalyzedCount = aiResults?.products?.length||0, demoTotalProducts = products.length;
    const demoAvgScore = aiResults?.products?.length ? Math.round(aiResults.products.reduce((a,p)=>a+(p.ad_score||0),0)/aiResults.products.length) : 0;
    const demoHighPotential = aiResults?.products?.filter(p=>p.ad_score>=70).length||0;
    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/><div className="bg-m"/>
        {isHydrated && !isPaid && scanCredits === 0 && <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={openUpgradeModal}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>}
        <div className="da">
          <div className="da-header">
            <div>
              <button className="btn-back-home" onClick={()=>{setProducts([]);setAiResults(null);}}>← Back</button>
              <h1 className="da-title">Free Preview</h1>
              <p className="da-sub">{demoAnalyzedCount} of {demoTotalProducts} products analyzed · Upgrade to unlock all {demoTotalProducts-demoAnalyzedCount} remaining</p>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button className="btn-rescan" onClick={()=>doScan("review")}>↻ Scan Again</button>
              <button className="btn-secondary" onClick={openCreditsTab}>⚡ Buy Scan Credits</button>
              <button className="btn-primary" onClick={openUpgradeModal}>🚀 Subscribe & Publish</button>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={demoTotalProducts}/></div><div className="stat-lbl">Products Found</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val"><Counter end={demoAvgScore} suffix="/100"/></div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">⚡</div><div className="stat-val"><Counter end={demoHighPotential}/></div><div className="stat-lbl">High-Potential</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={demoAnalyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {demoTotalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
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
          <div className="free-upgrade-cta" onClick={openUpgradeModal}>
            <div className="free-upgrade-icon">🚀</div>
            <div><div className="free-upgrade-title">Unlock All {totalProducts} Products + Full Campaigns</div><div className="free-upgrade-desc">Get competitor intelligence, ad copy, keywords & one-click Google Ads campaigns for every product</div></div>
            <div className="free-upgrade-arrow">→</div>
          </div>
        </div>
        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults}
          shop={shopDomain}
        />}
        <GlobalModals navigate={navigate}/>
      </div>
    );
  }

  // ── LANDING PAGE ──
  return (
    <div className="sr dk"><StyleTag/>
      <div className="bg-m"/>
      <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={openUpgradeModal}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>
      <div className={`la ${vis?"la-v":""}`}>
        <section className="hero">
          <div className="hero-badge">🤖 AI-Powered Google Ads for Shopify</div>
          <h1 className="hero-h">Stop guessing.<br/><span className="hero-grad">Start selling.</span></h1>
          <p className="hero-p">Smart Ads AI scans your competitors, checks your Google rankings, writes killer ad copy, and launches campaigns that convert — in 60 seconds.</p>
          <div className="hero-btns">
            <button className="btn-primary btn-lg" onClick={openUpgradeModal}>🚀 Start My Campaign</button>
            <button className="btn-secondary" onClick={()=>doScan("review")}>Try Free Preview</button>
          </div>
          <div className="hero-nudge" onClick={openCreditsTab}><span className="nudge-lock">⚡</span> No subscription? <strong>Buy scan credits</strong> — from $0.60/scan <span className="nudge-arrow">→</span></div>
          <div className="hero-metrics">
            <div className="hm"><span className="hm-val">+340%</span><span className="hm-lbl">Avg ROAS</span></div>
            <div className="hm"><span className="hm-val">47hrs</span><span className="hm-lbl">Saved/month</span></div>
            <div className="hm"><span className="hm-val">-52%</span><span className="hm-lbl">CPC Reduction</span></div>
          </div>
          <SuccessTicker/>
        </section>
        <section className="section lp-budget-section">
          <h2 className="sec-h">See your numbers before you commit</h2>
          <p className="sec-sub">Move the slider — watch your projected results update instantly.</p>
          <LandingBudgetTeaser />
        </section>
        <section className="section lp-missing-section">
          <h2 className="sec-h">What's happening while you wait</h2>
          <p className="sec-sub">Every day without Smart Ads AI, your competitors are pulling ahead.</p>
          <LandingMissingBlock onInstall={openUpgradeModal} />
        </section>
        <section className="section"><h2 className="sec-h">Sound familiar?</h2><div className="pain-grid">{[{ic:"💸",t:"Wasted Ad Spend",d:"Thousands spent on agencies with nothing to show for it."},{ic:"😵",t:"Google Ads Confusion",d:"The interface is overwhelming. You don't know where to start."},{ic:"📝",t:"Generic Ad Copy",d:"Your ads sound like everyone else's. No personality, no conversions."},{ic:"⏰",t:"Weeks of Setup",d:"By the time your campaign launches, the trend is already over."}].map((p,i)=><div key={i} className="pain-card"><span className="pain-ic">{p.ic}</span><h3 className="pain-t">{p.t}</h3><p className="pain-d">{p.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">What if AI could do it all — better?</h2><div className="sol-grid">{[{n:"60",s:"seconds",d:"Full competitor scan + campaign-ready ads"},{n:"Top 10",s:"competitors",d:"Scraped and analyzed for every product"},{n:"Real",s:"data",d:"Keywords from Google, not guesses from a robot"}].map((s,i)=><div key={i} className="sol-card"><div className="sol-n">{s.n}</div><div className="sol-s">{s.s}</div><p className="sol-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Stupidly simple. Seriously powerful.</h2><div className="steps-grid">{[{n:"1",t:"Scan",d:"AI scans your products and searches Google for your competitors."},{n:"2",t:"Analyze",d:"See competitor keywords, your rankings, and AI-optimized ad copy."},{n:"3",t:"Launch",d:"One click to launch campaigns built on real competitive data."}].map((s,i)=><div key={i} className="step-card"><div className="step-n">{s.n}</div><h3 className="step-t">{s.t}</h3><p className="step-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Everything you need. Nothing you don't.</h2><div className="feat-grid">{[{ic:"🕵️",t:"Competitor Intelligence",d:"We scan your competitors' sites, steal their best keywords, and find gaps they're missing."},{ic:"📍",t:"Google Rank Check",d:"See exactly where your store ranks — and where it doesn't."},{ic:"🧠",t:"AI Ad Copy",d:"Headlines and descriptions based on what's actually working for top-ranking competitors."},{ic:"🎯",t:"Smart Keywords",d:"Real keywords pulled from competitor websites, Google results, and search trends."},{ic:"📊",t:"Ad Score + Strategy",d:"Each product gets a competitive score and a strategy: aggressive, defensive, or dominant."},{ic:"⚡",t:"One-Click Launch",d:"From scan to live Google Ads campaign in 60 seconds. All campaigns start paused for your review."}].map((f,i)=><div key={i} className="feat-card"><span className="feat-ic">{f.ic}</span><h3 className="feat-t">{f.t}</h3><p className="feat-d">{f.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Loved by Shopify merchants</h2><div className="test-grid">{[{q:"Set up my first campaign in under 2 minutes. The AI copy was better than what my agency wrote.",n:"Sarah K.",r:"Fashion Store Owner"},{q:"Finally an app that makes Google Ads accessible. My ROAS went from 1.2x to 4.8x in a month.",n:"Mike T.",r:"Electronics Store"},{q:"I was spending $500/mo on a freelancer. Now AI does it better for $29/mo.",n:"Lisa R.",r:"Beauty & Wellness"}].map((t,i)=><div key={i} className="test-card"><p className="test-q">"{t.q}"</p><div className="test-author"><strong>{t.n}</strong><span>{t.r}</span></div></div>)}</div></section>
        <section className="section cta-section">
          <h2 className="cta-h">Your products deserve better ads.</h2>
          <p className="cta-p">Join 2,000+ Shopify merchants who stopped guessing and started growing.</p>
          <button className="btn-primary btn-lg" onClick={openUpgradeModal}>🚀 Start My Campaign →</button>
          <div style={{marginTop:12,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-secondary" onClick={()=>doScan("review")}>🔍 Try Free Preview</button>
            <button className="btn-secondary" onClick={openCreditsTab}>⚡ Buy Scan Credits</button>
          </div>
        </section>
      </div>
      <GlobalModals navigate={navigate}/>
    </div>
  );
}
