// useAppStore.js — Zustand centralized state for Smart Ads AI
// Phase 2: replaces 39 useState hooks in app._index.jsx
import { create } from "zustand";

const useAppStore = create((set, get) => ({

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
    document.cookie = `sai_plan=${encodeURIComponent(plan)}; expires=${expires}; path=/; SameSite=None; Secure`;
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

  hydrateCampaign: () => {
    try {
      const c = sessionStorage.getItem("sai_campaign_id");
      if (c) set({ campaignId: c });
    } catch {}
  },
}));

export default useAppStore;
