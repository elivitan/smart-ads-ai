import { useState, useEffect, useCallback } from "react";

/**
 * useUI
 * Manages all modal, overlay, and UI-state.
 * Adding a new modal = add 1 line here, never touch business logic.
 */
export function useUI() {
  const [vis, setVis] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardTab, setOnboardTab] = useState("subscription");
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [pickedProducts, setPickedProducts] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selCompetitor, setSelCompetitor] = useState(null);
  const [selProduct, setSelProduct] = useState(null);
  const [editHeadlines, setEditHeadlines] = useState([]);
  const [editDescriptions, setEditDescriptions] = useState([]);
  const [improvingIdx, setImprovingIdx] = useState(null);

  useEffect(() => { setVis(true); }, []);

  function triggerConfetti() {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);
  }

  // Opens subscription upgrade flow from anywhere in the app
  const openUpgrade = useCallback(() => {
    setShowOnboard(true);
    setOnboardTab("subscription");
    setOnboardStep(1);
  }, []);

  function handleProductClick(product, aiResults, hasScanAccess) {
    if (!hasScanAccess) { openUpgrade(); return; }
    setSelProduct(product);
    const isDb = !!product.hasAiAnalysis;
    const ai = isDb
      ? (product.aiAnalysis || {})
      : (aiResults?.products?.find(ap => ap.title === product.title) || {});
    setEditHeadlines((ai.headlines || []).map(h => typeof h === "string" ? h : h.text || h));
    setEditDescriptions((ai.descriptions || []).map(d => typeof d === "string" ? d : d.text || d));
  }

  return {
    // state
    vis,
    showOnboard,
    onboardStep,
    onboardTab,
    showBuyCredits,
    showManualPicker,
    pickedProducts,
    showConfetti,
    showCancelConfirm,
    selCompetitor,
    selProduct,
    editHeadlines,
    editDescriptions,
    improvingIdx,
    // actions
    setShowOnboard,
    setOnboardStep,
    setOnboardTab,
    setShowBuyCredits,
    setShowManualPicker,
    setPickedProducts,
    setShowCancelConfirm,
    setSelCompetitor,
    setSelProduct,
    setEditHeadlines,
    setEditDescriptions,
    setImprovingIdx,
    triggerConfetti,
    openUpgrade,
    handleProductClick,
  };
}
