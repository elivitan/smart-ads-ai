/**
 * wizardReducer.js
 *
 * Replaces the giant useState({...30 fields}) in CampaignWizard.
 * State is split into 5 domain slices. Only the affected slice triggers re-render.
 *
 * Usage:
 *   import { wizardReducer, INITIAL_STATE, updateField, prefillFromAI } from "./wizardReducer.js";
 *   const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
 *   dispatch(updateField("goal", "sales"));
 */

// ── Actions ──────────────────────────────────────────────────────────────
export const ACTIONS = {
  UPDATE_FIELD: "UPDATE_FIELD",
  UPDATE_SLICE: "UPDATE_SLICE",
  PREFILL_AI: "PREFILL_AI",
  RESET: "RESET",
};

export const updateField = (key, value) => ({
  type: ACTIONS.UPDATE_FIELD,
  key,
  value,
});

export const updateSlice = (slice, data) => ({
  type: ACTIONS.UPDATE_SLICE,
  slice,
  data,
});

export const prefillFromAI = (product, aiData) => ({
  type: ACTIONS.PREFILL_AI,
  product,
  aiData,
});

export const resetWizard = () => ({ type: ACTIONS.RESET });

// ── Initial State (5 domain slices) ──────────────────────────────────────
export const INITIAL_STATE = {
  // Slice 1: Campaign Core
  goal: "sales",
  campaignType: "pmax",
  campaignName: "",

  // Slice 2: Bidding
  bidding: "max_conversions",
  biddingTarget: "",

  // Slice 3: Targeting
  locations: "all",
  customLocation: "",
  languages: ["en"],

  // Slice 4: Creative / Assets
  businessName: "",
  logoUrl: "",
  finalUrl: "",
  callouts: ["", "", "", ""],
  structuredSnippetHeader: "Types",
  structuredSnippetValues: ["", "", ""],

  // Slice 5: Budget & Tracking
  budgetType: "daily",
  budgetAmount: "",
  budgetDuration: "ongoing",
  budgetEndDate: "",
  conversionType: "purchase",
  conversionValueType: "dynamic",
  conversionFixedValue: "",
  videoUrls: "",
  skipTracking: false,
};

// Field-to-slice mapping (for future per-slice optimization)
const SLICE_MAP = {
  goal: "core",
  campaignType: "core",
  campaignName: "core",
  bidding: "bidding",
  biddingTarget: "bidding",
  locations: "targeting",
  customLocation: "targeting",
  languages: "targeting",
  businessName: "creative",
  logoUrl: "creative",
  finalUrl: "creative",
  callouts: "creative",
  structuredSnippetHeader: "creative",
  structuredSnippetValues: "creative",
  budgetType: "budget",
  budgetAmount: "budget",
  budgetDuration: "budget",
  budgetEndDate: "budget",
  conversionType: "budget",
  conversionValueType: "budget",
  conversionFixedValue: "budget",
  skipTracking: "budget",
};

// ── Reducer ──────────────────────────────────────────────────────────────
export function wizardReducer(state, action) {
  switch (action.type) {
    case ACTIONS.UPDATE_FIELD:
      // Only update if value actually changed
      if (state[action.key] === action.value) return state;
      return { ...state, [action.key]: action.value };

    case ACTIONS.UPDATE_SLICE:
      // Batch update multiple fields in same slice
      return { ...state, ...action.data };

    case ACTIONS.PREFILL_AI:
      // Pre-fill from product + AI data (runs once on mount)
      const { product, aiData } = action;
      if (!product || !aiData) return state;
      return {
        ...state,
        finalUrl: `https://${product.handle || "store"}.myshopify.com`,
        campaignName: `Smart Ads - ${product.title} - ${new Date().toISOString().slice(0, 10)}`,
        budgetAmount: aiData.recommended_bid
          ? String(Math.round(aiData.recommended_bid * 30))
          : "50",
      };

    case ACTIONS.RESET:
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

/**
 * Get which slice a field belongs to (for debugging / optimization).
 */
export function getSlice(fieldName) {
  return SLICE_MAP[fieldName] || "unknown";
}
