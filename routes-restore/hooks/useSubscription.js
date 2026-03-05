import { useState, useCallback } from "react";

/**
 * useSubscription — Server-authoritative subscription management.
 *
 * SECURITY FIX: Plan comes from server DB (via loader), NOT from cookies or sessionStorage.
 * Credits come from server DB too. Client-side state is just a mirror that updates
 * optimistically then syncs back.
 *
 * @param {object} serverSubscription - from loader: { plan, scanCredits, aiCredits, canPublish, ... }
 */
export function useSubscription({ serverSubscription }) {
  // Initialize from server data — the ONLY source of truth
  const [plan, setPlanRaw] = useState(serverSubscription.plan || "free");
  const [scanCredits, setScanCreditsRaw] = useState(serverSubscription.scanCredits || 0);
  const [aiCredits, setAiCreditsRaw] = useState(serverSubscription.aiCredits || 0);
  const [isUpdating, setIsUpdating] = useState(false);

  const isPaid = !!plan && plan !== "free";
  const hasScanAccess = isPaid || scanCredits > 0;
  const canPublish = isPaid;

  /**
   * Select a plan — optimistic update + server sync.
   * SECURITY: Server validates the plan name. Even if someone calls this
   * with "premium", the server checks Shopify Billing before enabling features.
   */
  const selectPlan = useCallback(async (newPlan) => {
    setIsUpdating(true);
    // Optimistic update
    setPlanRaw(newPlan);
    const expectedCredits = { starter: 10, pro: 200, premium: 1000 }[newPlan] || 0;
    setAiCreditsRaw(expectedCredits);

    try {
      const res = await fetch("/app/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (data.success && data.subscription) {
        // Sync from server response — authoritative
        setPlanRaw(data.subscription.plan);
        setScanCreditsRaw(data.subscription.scanCredits);
        setAiCreditsRaw(data.subscription.aiCredits);
      } else {
        // Rollback on failure
        setPlanRaw(serverSubscription.plan);
        setAiCreditsRaw(serverSubscription.aiCredits);
        console.error("[SmartAds] Plan update failed:", data.error);
      }
    } catch (err) {
      // Rollback
      setPlanRaw(serverSubscription.plan);
      setAiCreditsRaw(serverSubscription.aiCredits);
      console.error("[SmartAds] Plan update error:", err);
    }
    setIsUpdating(false);
  }, [serverSubscription]);

  /**
   * Refresh subscription state from server.
   * Call after any action that changes credits (scan, ai-improve, campaign create).
   */
  const refreshSubscription = useCallback(async () => {
    try {
      const res = await fetch("/app/api/subscription");
      const data = await res.json();
      if (data.success && data.subscription) {
        setPlanRaw(data.subscription.plan);
        setScanCreditsRaw(data.subscription.scanCredits);
        setAiCreditsRaw(data.subscription.aiCredits);
      }
    } catch (err) {
      console.error("[SmartAds] Refresh subscription error:", err);
    }
  }, []);

  // Optimistic credit decrements (UI feels instant, server syncs in background)
  const decrementAiCredit = useCallback(() => {
    setAiCreditsRaw(prev => Math.max(0, prev - 1));
  }, []);

  const decrementScanCredit = useCallback(() => {
    setScanCreditsRaw(prev => Math.max(0, prev - 1));
  }, []);

  return {
    // State
    plan,
    scanCredits,
    aiCredits,
    isUpdating,
    // Derived
    isPaid,
    hasScanAccess,
    canPublish,
    // Actions
    selectPlan,
    refreshSubscription,
    decrementAiCredit,
    decrementScanCredit,
    setScanCredits: setScanCreditsRaw,
    setAiCredits: setAiCreditsRaw,
  };
}
