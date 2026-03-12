import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { useLoaderData, useLocation, useRevalidator, useNavigate, Link } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopProducts, getSyncStatus } from "../sync.server.js";
import prisma from "../db.server.js";
import { getSubscriptionInfo } from "../license.server.js";
import { CSS } from "./styles.index.js";
import { Counter, ScoreRing, Speedometer } from "../components/ui/SmallWidgets";
import { TipRotator, Confetti, SuccessTicker } from "../components/SmallComponents";
import { CollectingDataScreen } from "../components/CollectingDataScreen";
import { CompetitorGapFinder } from "../components/CompetitorComponents";
import { StoreHealthScore, TopMissedOpportunity, BudgetSimulator } from "../components/DashboardWidgets";
import { LandingBudgetTeaser, LandingMissingBlock } from "../components/LandingComponents";
import { ProductModal } from "../components/ProductModal";
import { useGoogleAdsData } from "../hooks/useGoogleAdsData.js";
import { SubscriberHome } from "../components/SubscriberHome";
import GlobalModals from "../components/GlobalModals";
import { ScanningScreen } from "../components/ScanningScreen";
import { AutoLaunchingScreen, AutoStatusScreen } from "../components/AutoScreens";
import { DashboardView } from "../components/DashboardView";
import useAppStore, { appStore } from "../stores/useAppStore.js";
import { shallow } from "zustand/shallow";
import { withDbRetry } from "../utils/db-health";
import type { LoaderFunctionArgs } from "react-router";

// Error Boundary — prevents widget crashes from killing the whole page
interface WEBProps {
  label?: string;
  children?: React.ReactNode;
}
interface WEBState {
  hasError: boolean;
  error: Error | null;
}
class WidgetErrorBoundary extends React.Component<WEBProps, WEBState> {
  constructor(props: WEBProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) { console.error(`[WidgetErrorBoundary] ${this.props.label || "widget"} crashed:`, err, info); }
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
interface LockedOverlayProps {
  isPaid: boolean;
  onUpgrade: () => void;
  title?: string;
  children?: React.ReactNode;
}
function LockedOverlay({ isPaid, onUpgrade, title, children }: LockedOverlayProps) {
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

function getPlanFromCookie(request: Request): string | null {
  try {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/sai_plan=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

function StyleTag() { return <style dangerouslySetInnerHTML={{__html: CSS}}/>; }

interface IndexLoaderData {
  products: Array<Record<string, unknown>>;
  syncStatus: Record<string, unknown>;
  shop: string;
  planFromCookie: string;
  isPaidServer: boolean;
  needsInitialSync: boolean;
  subscription: Record<string, unknown>;
  userState: Record<string, unknown> | null;
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<IndexLoaderData> => {
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
  } catch (e: unknown) {
    console.error("[SmartAds] Failed to load subscription:", e instanceof Error ? e.message : e);
  }

  const serverPlan = subscriptionInfo?.plan || planFromCookie || "free";
  const isPaidServer = !!serverPlan && serverPlan !== "free";

  // Load persistent user state from DB
  let userState = null;
  try {
    userState = await withDbRetry("index-userstate", () => prisma.userState.findUnique({ where: { shop } }));
  } catch (e: unknown) {
    console.error("[SmartAds] Failed to load UserState:", e instanceof Error ? e.message : e);
  }

  return {
    products: dbProducts,
    syncStatus,
    shop,
    planFromCookie: serverPlan,
    isPaidServer,
    needsInitialSync,
    subscription: subscriptionInfo || { plan: serverPlan, scanCredits: 0, aiCredits: 0, canPublish: isPaidServer },
    userState,
  };
  } catch (loaderErr: unknown) {
    console.error("[SmartAds] Loader error:", loaderErr instanceof Error ? loaderErr.message : loaderErr);
    return {
      products: [],
      syncStatus: { totalProducts: 0 },
      shop: "",
      planFromCookie: "free",
      isPaidServer: false,
      needsInitialSync: true,
      subscription: { plan: "free", scanCredits: 0, aiCredits: 0, canPublish: false },
      userState: null,
    };
  }
};



export default function Index() {
  const { products: dbProducts, planFromCookie, isPaidServer, shop: shopDomain, needsInitialSync, subscription: serverSubscription, userState } = useLoaderData<IndexLoaderData>();
  const storeUrl = shopDomain ? `https://${shopDomain}` : "https://your-store.myshopify.com";
  const loaderHadError = !shopDomain;

  // ── Zustand Store (shallow selectors — only re-render on used fields) ──
  const {
    showOnboard, setShowOnboard, onboardStep, setOnboardStep, onboardTab, setOnboardTab,
    showBuyCredits, setShowBuyCredits, showLaunchChoice, setShowLaunchChoice,
    launchLoading, setLaunchLoading, showConfetti, showDashboard, setShowDashboard,
    showCancelConfirm, setShowCancelConfirm, vis, setVis, triggerConfetti,
    openUpgradeModal, openCreditsTab,
    selectedPlan, scanCredits, setScanCredits, aiCredits, setAiCredits,
    googleConnected, setGoogleConnected, justSubscribed, setJustSubscribed,
    autoScanMode, setAutoScanMode, isHydrated, initSubscription, selectPlan,
    isScanning, setIsScanning, fakeProgress, setFakeProgress, scanMode, setScanMode,
    scanMsg, setScanMsg, scanError, setScanError,
    products, setProducts, aiResults, setAiResults,
    campaignId, setCampaignId, campaignStatus, setCampaignStatus,
    campaignControlStatus, setCampaignControlStatus,
    realSpend, setRealSpend, confirmRemove, setConfirmRemove,
    autoStatus, setAutoStatus, autoLaunching, setAutoLaunching,
    selProduct, setSelProduct, selCompetitor, setSelCompetitor,
    editHeadlines, setEditHeadlines, editDescriptions, setEditDescriptions,
    improvingIdx, setImprovingIdx, pickedProducts, setPickedProducts,
  } = useAppStore(s => ({
    showOnboard: s.showOnboard, setShowOnboard: s.setShowOnboard, onboardStep: s.onboardStep, setOnboardStep: s.setOnboardStep, onboardTab: s.onboardTab, setOnboardTab: s.setOnboardTab,
    showBuyCredits: s.showBuyCredits, setShowBuyCredits: s.setShowBuyCredits, showLaunchChoice: s.showLaunchChoice, setShowLaunchChoice: s.setShowLaunchChoice,
    launchLoading: s.launchLoading, setLaunchLoading: s.setLaunchLoading, showConfetti: s.showConfetti, showDashboard: s.showDashboard, setShowDashboard: s.setShowDashboard,
    showCancelConfirm: s.showCancelConfirm, setShowCancelConfirm: s.setShowCancelConfirm, vis: s.vis, setVis: s.setVis, triggerConfetti: s.triggerConfetti, openUpgradeModal: s.openUpgradeModal, openCreditsTab: s.openCreditsTab,
    selectedPlan: s.selectedPlan, scanCredits: s.scanCredits, setScanCredits: s.setScanCredits, aiCredits: s.aiCredits, setAiCredits: s.setAiCredits,
    googleConnected: s.googleConnected, setGoogleConnected: s.setGoogleConnected, justSubscribed: s.justSubscribed, setJustSubscribed: s.setJustSubscribed,
    autoScanMode: s.autoScanMode, setAutoScanMode: s.setAutoScanMode, isHydrated: s.isHydrated, initSubscription: s.initSubscription, selectPlan: s.selectPlan,
    isScanning: s.isScanning, setIsScanning: s.setIsScanning, fakeProgress: s.fakeProgress, setFakeProgress: s.setFakeProgress, scanMode: s.scanMode, setScanMode: s.setScanMode,
    scanMsg: s.scanMsg, setScanMsg: s.setScanMsg, scanError: s.scanError, setScanError: s.setScanError, products: s.products, setProducts: s.setProducts, aiResults: s.aiResults, setAiResults: s.setAiResults,
    campaignId: s.campaignId, setCampaignId: s.setCampaignId, campaignStatus: s.campaignStatus, setCampaignStatus: s.setCampaignStatus, campaignControlStatus: s.campaignControlStatus, setCampaignControlStatus: s.setCampaignControlStatus,
    realSpend: s.realSpend, setRealSpend: s.setRealSpend, confirmRemove: s.confirmRemove, setConfirmRemove: s.setConfirmRemove, autoStatus: s.autoStatus, setAutoStatus: s.setAutoStatus, autoLaunching: s.autoLaunching, setAutoLaunching: s.setAutoLaunching,
    selProduct: s.selProduct, setSelProduct: s.setSelProduct, selCompetitor: s.selCompetitor, setSelCompetitor: s.setSelCompetitor,
    editHeadlines: s.editHeadlines, setEditHeadlines: s.setEditHeadlines, editDescriptions: s.editDescriptions, setEditDescriptions: s.setEditDescriptions,
    improvingIdx: s.improvingIdx, setImprovingIdx: s.setImprovingIdx, pickedProducts: s.pickedProducts, setPickedProducts: s.setPickedProducts,
  }), shallow);

  // ── Initialize store from server data (once) ──
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      initSubscription({ isPaidServer, planFromCookie, serverSubscription });
      // Apply DB state (primary source of truth)
      if (userState) {
        const u = {};
        if (userState.selectedPlan) u.selectedPlan = userState.selectedPlan;
        if (userState.scanCredits) u.scanCredits = userState.scanCredits;
        if (userState.aiCredits) u.aiCredits = userState.aiCredits;
        if (userState.campaignId) u.campaignId = userState.campaignId;
        if (userState.autoScanMode) u.autoScanMode = userState.autoScanMode;
        if (userState.showDashboard) u.showDashboard = userState.showDashboard;
        if (userState.lastScanProducts) {
          try { u.products = JSON.parse(userState.lastScanProducts); } catch(err: unknown) { console.error("[SmartAds] app._index:unknown error:", err instanceof Error ? err.message : err); }
        }
        if (userState.lastAiResults) {
          try { u.aiResults = JSON.parse(userState.lastAiResults); } catch(err: unknown) { console.error("[SmartAds] app._index:unknown error:", err instanceof Error ? err.message : err); }
        }
        if (Object.keys(u).length > 0) appStore.setState(u);
      }
      appStore.setState({ isHydrated: true });
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

  function getProductUrl(product: Record<string, unknown>): string {
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

  // ── SCAN FUNCTION (delegated to store) ──
  function doScan(mode: string) {
    appStore.getState().doScan(mode, { cancelRef, creepRef, getProductUrl });
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
      } catch(err: unknown) { console.error("[SmartAds] app._index:camp error:", err instanceof Error ? err.message : err); }
    }
    fetchSpend();
    const iv = setInterval(fetchSpend, 60000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [campaignId]);



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
  // Show error banner if loader failed
  if (loaderHadError) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a1a",color:"#fff",fontFamily:"system-ui,sans-serif",padding:40,textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:20}}>??</div>
      <h2 style={{fontSize:22,fontWeight:700,marginBottom:12}}>Connection Issue</h2>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",marginBottom:24,maxWidth:400}}>We could not connect to your Shopify store. This is usually temporary � please try reloading.</p>
      <button onClick={function(){window.location.reload()}} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",padding:"12px 24px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"}}>Reload Page</button>
    </div>
  );

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

  if (isScanning) {
    return (
      <ScanningScreen StyleTag={StyleTag} cancelRef={cancelRef} creepRef={creepRef} FREE_SCAN_LIMIT={3}/>
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

    // ── SUBSCRIBER HOME PAGE ──
    if (isPaid && analyzedCount > 0 && !justSubscribed && !showDashboard) return (
      <>
      <SubscriberHome
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
            } catch(err: unknown) { console.error("[SmartAds] app._index:data error:", err instanceof Error ? err.message : err); }
          }
          setAutoLaunching(false); setPickedProducts([]);
          if (sc>0) { setAutoStatus("success"); triggerConfetti(); } else { setAutoStatus("error"); }
        }}
        doScan={doScan} handleProductClick={appStore.getState().handleProductClick} navigate={navigate}
        handlePauseCampaign={appStore.getState().handlePauseCampaign} handleRemoveCampaign={appStore.getState().handleRemoveCampaign}
        StyleTag={StyleTag}
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
                <div key={product.id} className={`p-card ${!hasAi?"p-card-locked":""}`} onClick={()=>hasAi?appStore.getState().handleProductClick({...product,aiAnalysis:ai}):null}>
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

// Route-level ErrorBoundary � catches loader crashes, render errors, etc.
export function ErrorBoundary() {
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a1a",color:"#fff",fontFamily:"system-ui,sans-serif",padding:40,textAlign:"center"}}>
      <div style={{fontSize:64,marginBottom:20}}>??</div>
      <h1 style={{fontSize:24,fontWeight:700,marginBottom:12}}>Something went wrong</h1>
      <p style={{fontSize:14,color:"rgba(255,255,255,0.6)",marginBottom:24,maxWidth:400}}>Smart Ads AI encountered an error loading this page. This is usually temporary.</p>
      <div style={{display:"flex",gap:12}}>
        <button onClick={function(){window.location.reload()}} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",padding:"12px 24px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer"}}>Reload Page</button>
        <a href="/app" style={{background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.2)",padding:"12px 24px",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",textDecoration:"none"}}>Go Home</a>
      </div>
    </div>
  );
}
