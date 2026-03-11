// useAppStore.js — Zustand centralized state for Smart Ads AI
// Phase 2: replaces 39 useState hooks in app._index.jsx
// NOTE: Uses createStore (vanilla) + useStore (react) to avoid SSR issues
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand/react";

const appStore = createStore((set, get) => ({

  // ── UI Slice ──
  showOnboard: false,
  onboardStep: 1,
  onboardTab: "subscription",
  showBuyCredits: false,
  showLaunchChoice: false,
  launchLoading: null,
  showConfetti: false,
  showDashboard: false,
  showCancelConfirm: false,
  vis: false,

  setShowOnboard: (v) => set({ showOnboard: v }),
  setOnboardStep: (v) => set({ onboardStep: v }),
  setOnboardTab: (v) => set({ onboardTab: v }),
  setShowBuyCredits: (v) => set({ showBuyCredits: v }),
  setShowLaunchChoice: (v) => set({ showLaunchChoice: v }),
  setLaunchLoading: (v) => set({ launchLoading: v }),
  setShowConfetti: (v) => set({ showConfetti: v }),
  setShowDashboard: (v) => set({ showDashboard: v }),
  setShowCancelConfirm: (v) => set({ showCancelConfirm: v }),
  setVis: (v) => set({ vis: v }),

  triggerConfetti: () => {
    set({ showConfetti: true });
    setTimeout(() => set({ showConfetti: false }), 3500);
  },
  openUpgradeModal: () => set({ showOnboard: true, onboardTab: "subscription", onboardStep: 1 }),
  openCreditsTab: () => set({ showOnboard: true, onboardTab: "credits" }),

  // ── Subscription Slice ──
  selectedPlan: null,
  scanCredits: 0,
  aiCredits: 0,
  googleConnected: false,
  justSubscribed: false,
  autoScanMode: null,
  isHydrated: false,

  setSelectedPlan: (v) => set({ selectedPlan: v }),
  setScanCredits: (v) => {
    set({ scanCredits: v });
    try { sessionStorage.setItem("sai_scan_credits", String(v)); } catch {}
  },
  setAiCredits: (v) => {
    set({ aiCredits: v });
    try { sessionStorage.setItem("sai_credits", String(v)); } catch {}
  },
  setGoogleConnected: (v) => set({ googleConnected: v }),
  setJustSubscribed: (v) => set({ justSubscribed: v }),
  setAutoScanMode: (v) => set({ autoScanMode: v }),
  setIsHydrated: (v) => set({ isHydrated: v }),

  initSubscription: ({ isPaidServer, planFromCookie, serverSubscription }) => {
    set({
      selectedPlan: isPaidServer ? planFromCookie : null,
      scanCredits: serverSubscription?.scanCredits ?? 0,
      aiCredits: serverSubscription?.aiCredits ?? 0,
      isHydrated: isPaidServer,
    });
  },

  hydrateFromSession: ({ isPaidServer, serverSubscription }) => {
    try {
      if (!isPaidServer) {
        const stored = sessionStorage.getItem("sai_plan");
        if (stored) set({ selectedPlan: stored });
      }
      if (serverSubscription?.scanCredits == null) {
        const sc = sessionStorage.getItem("sai_scan_credits");
        if (sc) set({ scanCredits: parseInt(sc) });
      }
      if (serverSubscription?.aiCredits == null) {
        const ac = sessionStorage.getItem("sai_credits");
        if (ac) set({ aiCredits: parseInt(ac) });
      }
    } catch {}
    set({ isHydrated: true });
  },

  selectPlan: (plan) => {
    set({
      selectedPlan: plan,
      justSubscribed: true,
      scanMsg: "",
      aiCredits: { starter: 10, pro: 200, premium: 1000 }[plan] || 0,
    });
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = "sai_plan=" + encodeURIComponent(plan) + "; expires=" + expires + "; path=/; SameSite=None; Secure";
    try { sessionStorage.setItem("sai_plan", plan); } catch {}
    try { sessionStorage.setItem("sai_credits", String({ starter: 10, pro: 200, premium: 1000 }[plan] || 0)); } catch {}
    fetch("/app/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    }).catch(() => {});
  },

  // ── Scanning Slice ──
  isScanning: false,
  fakeProgress: 0,
  scanMode: null,
  scanMsg: "",
  scanError: null,
  products: [],
  aiResults: null,

  setIsScanning: (v) => set({ isScanning: v }),
  setFakeProgress: (v) => set({ fakeProgress: v }),
  setScanMode: (v) => set({ scanMode: v }),
  setScanMsg: (v) => set({ scanMsg: v }),
  setScanError: (v) => set({ scanError: v }),
  setProducts: (v) => {
    set({ products: v });
    try { sessionStorage.setItem("sai_products", JSON.stringify(v)); } catch {}
  },
  setAiResults: (v) => {
    set({ aiResults: v });
    try { sessionStorage.setItem("sai_aiResults", JSON.stringify(v)); } catch {}
  },

  // ── Campaign Slice ──
  campaignId: "sim_001",
  campaignStatus: null,
  campaignControlStatus: null,
  realSpend: null,
  confirmRemove: false,
  autoStatus: null,
  autoLaunching: false,
  selProduct: null,
  selCompetitor: null,
  editHeadlines: [],
  editDescriptions: [],
  improvingIdx: null,
  pickedProducts: [],
  showManualPicker: false,

  setCampaignId: (v) => {
    set({ campaignId: v });
    if (v) { try { sessionStorage.setItem("sai_campaign_id", v); } catch {} }
    else { try { sessionStorage.removeItem("sai_campaign_id"); } catch {} }
  },
  setCampaignStatus: (v) => set({ campaignStatus: v }),
  setCampaignControlStatus: (v) => set({ campaignControlStatus: v }),
  setRealSpend: (v) => set({ realSpend: v }),
  setConfirmRemove: (v) => set({ confirmRemove: v }),
  setAutoStatus: (v) => set({ autoStatus: v }),
  setAutoLaunching: (v) => set({ autoLaunching: v }),
  setSelProduct: (v) => set({ selProduct: v }),
  setSelCompetitor: (v) => set({ selCompetitor: v }),
  setEditHeadlines: (v) => set({ editHeadlines: v }),
  setEditDescriptions: (v) => set({ editDescriptions: v }),
  setImprovingIdx: (v) => set({ improvingIdx: v }),
  setPickedProducts: (v) => set({ pickedProducts: v }),
  setShowManualPicker: (v) => set({ showManualPicker: v }),

  // ── Constants ──
  FREE_SCAN_LIMIT: 3,

  // ── doScan action ──
  // deps = { cancelRef, creepRef, getProductUrl }
  doScan: async (mode, deps) => {
    const { cancelRef, creepRef, getProductUrl } = deps;
    const { selectedPlan, scanCredits, triggerConfetti,
            setAutoLaunching, setAutoStatus } = get();
    const hasScanAccess = !!selectedPlan || scanCredits > 0;
    const canPublish = !!selectedPlan;
    const FREE_SCAN_LIMIT = 3;
    const isAuto = mode === "auto";

    set({
      scanMode: mode || "review",
      isScanning: true,
      fakeProgress: 0,
      scanMsg: hasScanAccess ? "Connecting to your Shopify store..." : "Quick preview scan starting...",
      autoStatus: null,
      scanError: null,
    });
    cancelRef.current = false;

    let fetchedProducts = [], allAiProducts = [];
    let smoothProg = 0;
    const smoothTimer = setInterval(() => {
      smoothProg = Math.min(smoothProg + 0.15, 8);
      set({ fakeProgress: Math.round(smoothProg * 10) / 10 });
    }, 100);

    try {
      const scanAbort = new AbortController();
      cancelRef._abort = () => scanAbort.abort();
      const ff = new FormData(); ff.append("step", "fetch");
      const fr = await fetch("/app/api/scan", { method: "POST", body: ff, signal: scanAbort.signal });
      const fd = await fr.json().catch(() => { throw new Error("Server returned invalid response."); });
      if (!fd.success) throw new Error(fd.error || "Failed to fetch products");
      if (cancelRef.current) { clearInterval(smoothTimer); set({ isScanning: false }); return; }
      clearInterval(smoothTimer);

      const allFetched = fd.products, fetchedStoreUrl = fd.storeInfo?.url || "";
      const toAnalyze = hasScanAccess ? allFetched : allFetched.slice(0, FREE_SCAN_LIMIT);
      fetchedProducts = allFetched;
      set({ products: allFetched });
      try { sessionStorage.setItem("sai_products", JSON.stringify(allFetched)); } catch {}

      for (let p = Math.ceil(smoothProg); p <= 10; p++) { set({ fakeProgress: p }); await new Promise(r => setTimeout(r, 40)); }
      set({ scanMsg: hasScanAccess ? `Found ${allFetched.length} products — analyzing with AI...` : `Found ${allFetched.length} products — analyzing top ${FREE_SCAN_LIMIT} for preview...` });
      await new Promise(r => setTimeout(r, 600));

      const BATCH = 3, total = toAnalyze.length, batches = Math.ceil(total / BATCH);
      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { set({ isScanning: false }); return; }
        const start = b * BATCH, batch = toAnalyze.slice(start, start + BATCH);
        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);
        let creepPct = batchStartPct;
        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < batchEndPct - 0.5) creepPct += 0.3;
          set({ fakeProgress: Math.round(creepPct * 10) / 10 });
          const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          const curPct = Math.round(creepPct);
          if (hasScanAccess) {
            const sn = curPct < 25 ? "Searching Google" : curPct < 45 ? "Analyzing competitors" : curPct < 60 ? "Checking rankings" : curPct < 80 ? "Generating ad copy" : "Building strategy";
            set({ scanMsg: fakeNum + " of " + total + " products · " + sn });
          } else set({ scanMsg: "Analyzing product " + fakeNum + " of " + total + "..." });
        }, 400);
        creepRef.current = creepTimer;

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", fetchedStoreUrl);
        const ar = await fetch("/app/api/scan", { method: "POST", body: af, signal: scanAbort.signal });
        clearInterval(creepTimer); creepRef.current = null;
        const ad = await ar.json().catch(() => { throw new Error(`AI returned invalid response on batch ${b + 1}.`); });
        if (!ad.success) throw new Error(ad.error || `AI failed on batch ${b + 1}`);
        allAiProducts = [...allAiProducts, ...(ad.result?.products || [])];
        set({ fakeProgress: batchEndPct });
      }

      if (cancelRef.current) { set({ isScanning: false }); return; }
      set({ scanMsg: hasScanAccess ? "Almost done — putting it all together! 🚀" : "Wrapping up your preview..." });
      await new Promise(r => setTimeout(r, 600));

      const topScore = allAiProducts.reduce((best, p) => ((p.ad_score || 0) > (best.ad_score || 0) ? p : best), allAiProducts[0] || {});
      let summary;
      if (hasScanAccess) {
        const opts = [`🎯 Analyzed ${allAiProducts.length} products. "${topScore.title || "Top product"}" scored ${topScore.ad_score || 0}/100.`, `✨ Found ${allAiProducts.filter(p => (p.ad_score || 0) >= 70).length} high-potential products!`, `🏆 Average score: ${Math.round(allAiProducts.reduce((a, p) => a + (p.ad_score || 0), 0) / allAiProducts.length)}/100.`];
        summary = opts[Math.floor(Math.random() * opts.length)];
      } else {
        summary = `Preview: Analyzed ${FREE_SCAN_LIMIT} of ${fetchedProducts.length} products. ${topScore.title || "Your top product"} shows real potential! Upgrade to unlock all ${fetchedProducts.length - FREE_SCAN_LIMIT} remaining.`;
      }

      const aiResultsData = { summary, recommended_budget: 100, products: allAiProducts };
      set({ aiResults: aiResultsData, fakeProgress: 100, scanMsg: hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!" });
      try { sessionStorage.setItem("sai_aiResults", JSON.stringify(aiResultsData)); } catch {}
      triggerConfetti();
      await new Promise(r => setTimeout(r, 800));

    } catch (e) {
      clearInterval(smoothTimer);
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      let msg = e.message || "Something went wrong";
      if (msg.includes("credit balance") || msg.includes("billing")) msg = "AI credits have run out. Please top up your Anthropic API balance.";
      else if (msg.includes("rate_limit") || msg.includes("429")) msg = "Too many requests. Please wait a minute and try again.";
      else if (msg.includes("401") || msg.includes("api_key")) msg = "API key is invalid. Please check your ANTHROPIC_API_KEY.";
      else if (msg.includes("overloaded")) msg = "AI service is temporarily overloaded. Please try again.";
      set({ scanError: msg, isScanning: false, fakeProgress: 0 });
      return;
    }

    set({ isScanning: false, fakeProgress: 0 });

    if (isAuto && allAiProducts.length > 0 && canPublish) {
      set({ autoLaunching: true });
      let successCount = 0;
      for (let i = 0; i < fetchedProducts.length; i++) {
        const prod = fetchedProducts[i], ai = allAiProducts.find(ap => ap.title === prod.title) || allAiProducts[i] || {};
        try {
          const form = new FormData();
          form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines || []));
          form.append("descriptions", JSON.stringify(ai.descriptions || [])); form.append("keywords", JSON.stringify(ai.keywords || []));
          form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
          const res = await fetch("/app/api/campaign", { method: "POST", body: form });
          const data = await res.json(); if (data.success) successCount++;
        } catch {}
      }
      set({ autoLaunching: false, autoStatus: successCount > 0 ? "success" : "error" });
    }
  },

  // ── handleAutoCampaign action ──
  // deps = { analyzedDbProducts, allDbProducts, getProductUrl, navigate, cancelRef }
  handleAutoCampaign: async (deps) => {
    const { analyzedDbProducts, allDbProducts, getProductUrl, navigate, cancelRef } = deps;
    const { selectedPlan, openUpgradeModal, triggerConfetti } = get();
    const canPublish = !!selectedPlan;
    if (!canPublish) { openUpgradeModal(); return; }

    set({ autoLaunching: true });
    let successCount = 0;
    const toProcess = analyzedDbProducts.length > 0 ? analyzedDbProducts : allDbProducts.slice(0, 5);
    for (const prod of toProcess) {
      if (cancelRef.current) break;
      const ai = prod.aiAnalysis || {};
      const rawH = (ai.headlines || []).map(h => typeof h === "string" ? h : h?.text || h).filter(Boolean);
      const rawD = (ai.descriptions || []).map(d => typeof d === "string" ? d : d?.text || d).filter(Boolean);
      const headlines = rawH.length >= 3 ? rawH : [...rawH, prod.title + " - Shop Now", "Free Shipping Available", "Best Deals Online"].slice(0, Math.max(3, rawH.length));
      const descriptions = rawD.length >= 2 ? rawD : [...rawD, "Discover " + prod.title + ". Premium quality at great prices. Order today.", "Shop our collection. Fast shipping, easy returns, satisfaction guaranteed."].slice(0, Math.max(2, rawD.length));
      try {
        const form = new FormData();
        form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(headlines));
        form.append("descriptions", JSON.stringify(descriptions)); form.append("keywords", JSON.stringify(ai.keywords || []));
        form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
        const res = await fetch("/app/api/campaign", { method: "POST", body: form });
        const data = await res.json(); if (data.success) successCount++;
      } catch {}
    }
    set({ autoLaunching: false, autoStatus: successCount > 0 ? "success" : "error" });
    if (successCount > 0) { triggerConfetti(); setTimeout(() => navigate("/app/campaigns"), 3000); }
  },

  hydrateCampaign: () => {
    try {
      const c = sessionStorage.getItem("sai_campaign_id");
      if (c) set({ campaignId: c });
    } catch {}
  },
}));

// React hook wrapper — only uses React when called inside a component
export default function useAppStore(selector) {
  return useStore(appStore, selector || ((s) => s));
}
