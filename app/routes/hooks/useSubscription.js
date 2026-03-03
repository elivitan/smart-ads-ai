import { useState, useEffect } from "react";

/**
 * useSubscription
 * Manages plan, credits, and access flags.
 * Isolated: changing billing logic never touches scan or campaign code.
 */
export function useSubscription({ isPaidServer, planFromCookie }) {
  const [selectedPlan, setSelectedPlanRaw] = useState(() => {
    if (isPaidServer) return planFromCookie;
    try { return sessionStorage.getItem("sai_plan") || null; } catch { return null; }
  });

  const [isHydrated, setIsHydrated] = useState(isPaidServer);
  useEffect(() => { setIsHydrated(true); }, []);

  const [scanCredits, setScanCreditsRaw] = useState(() => {
    try { const c = sessionStorage.getItem("sai_scan_credits"); return c ? parseInt(c) : 0; } catch { return 0; }
  });

  const [aiCredits, setAiCreditsRaw] = useState(() => {
    try { const c = sessionStorage.getItem("sai_credits"); return c ? parseInt(c) : 0; } catch { return 0; }
  });

  function setScanCredits(v) {
    setScanCreditsRaw(v);
    try { sessionStorage.setItem("sai_scan_credits", String(v)); } catch {}
  }

  function setAiCredits(v) {
    setAiCreditsRaw(v);
    try { sessionStorage.setItem("sai_credits", String(v)); } catch {}
  }

  function setSelectedPlan(plan) {
    setSelectedPlanRaw(plan);
    try { sessionStorage.setItem("sai_plan", plan || ""); } catch {}
  }

  async function selectPlan(plan) {
    setSelectedPlan(plan);
    setAiCredits({ starter: 10, pro: 200, premium: 1000 }[plan] || 0);
    try {
      await fetch("/app/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
    } catch (err) { console.error("[SmartAds]", err); }
  }

  const isPaid = !!selectedPlan && selectedPlan !== "free";
  const hasScanAccess = isPaid || scanCredits > 0;
  const canPublish = isPaid;

  return {
    // state
    selectedPlan,
    scanCredits,
    aiCredits,
    isHydrated,
    // derived
    isPaid,
    hasScanAccess,
    canPublish,
    // actions
    selectPlan,
    setScanCredits,
    setAiCredits,
  };
}
