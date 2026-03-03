/**
 * campaignStateMachine.js
 * 
 * Replaces simple UI string status with a proper state machine.
 * Every transition is validated — no illegal state jumps.
 * 
 * Usage:
 *   import { useCampaignControl } from "./campaignStateMachine.js";
 *   const control = useCampaignControl({ campaignId, onStatusChange });
 *   control.pause();   // ENABLED → PAUSING → VERIFYING → PAUSED
 *   control.remove();  // PAUSED → REMOVING → VERIFYING → REMOVED
 *   control.retry();   // FAILED_TEMP → RETRYING → ...
 */

import { useState, useCallback, useRef } from "react";

// ── States ───────────────────────────────────────────────────────────────
export const STATES = {
  IDLE: "idle",               // No campaign
  ENABLED: "enabled",         // Running
  PAUSING: "pausing",         // Pause request sent
  PAUSED: "paused",           // Confirmed paused
  ENABLING: "enabling",       // Resume request sent
  REMOVING: "removing",       // Remove request sent
  REMOVED: "removed",         // Confirmed removed
  SYNCING: "syncing",         // Fetching status from Google
  VERIFYING: "verifying",     // Confirming action with Google
  RETRYING: "retrying",       // Retrying failed action
  FAILED_TEMP: "failed_temp", // Temporary failure (retryable)
  FAILED_PERM: "failed_perm", // Permanent failure (manual fix needed)
  ERROR: "error",             // Generic error (legacy compat)
};

// ── Valid Transitions ────────────────────────────────────────────────────
const TRANSITIONS = {
  [STATES.IDLE]:        [STATES.ENABLED, STATES.SYNCING],
  [STATES.ENABLED]:     [STATES.PAUSING, STATES.REMOVING, STATES.SYNCING, STATES.ERROR],
  [STATES.PAUSING]:     [STATES.VERIFYING, STATES.FAILED_TEMP, STATES.FAILED_PERM, STATES.ERROR],
  [STATES.PAUSED]:      [STATES.ENABLING, STATES.REMOVING, STATES.SYNCING],
  [STATES.ENABLING]:    [STATES.VERIFYING, STATES.FAILED_TEMP, STATES.FAILED_PERM, STATES.ERROR],
  [STATES.REMOVING]:    [STATES.VERIFYING, STATES.FAILED_TEMP, STATES.FAILED_PERM, STATES.ERROR],
  [STATES.REMOVED]:     [],  // Terminal state
  [STATES.SYNCING]:     [STATES.ENABLED, STATES.PAUSED, STATES.REMOVED, STATES.FAILED_TEMP, STATES.ERROR],
  [STATES.VERIFYING]:   [STATES.ENABLED, STATES.PAUSED, STATES.REMOVED, STATES.FAILED_TEMP, STATES.ERROR],
  [STATES.RETRYING]:    [STATES.VERIFYING, STATES.FAILED_TEMP, STATES.FAILED_PERM, STATES.ERROR],
  [STATES.FAILED_TEMP]: [STATES.RETRYING, STATES.SYNCING],
  [STATES.FAILED_PERM]: [STATES.SYNCING],  // Can only sync to check if manually fixed
  [STATES.ERROR]:       [STATES.RETRYING, STATES.SYNCING, STATES.ENABLED, STATES.PAUSED],
};

function canTransition(from, to) {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Retry config ─────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // Exponential backoff
const VERIFY_DELAY = 3000;
const VERIFY_MAX_ATTEMPTS = 5;

// ── Hook ─────────────────────────────────────────────────────────────────
export function useCampaignControl({ campaignId, onStatusChange } = {}) {
  const [state, setState] = useState(campaignId ? STATES.ENABLED : STATES.IDLE);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [history, setHistory] = useState([]);
  const mountedRef = useRef(true);
  const pendingAction = useRef(null);

  // Safe transition
  const transition = useCallback((to, meta = {}) => {
    setState(prev => {
      if (!canTransition(prev, to)) {
        console.warn(`[SmartAds] Invalid transition: ${prev} → ${to}`);
        return prev;
      }
      const entry = {
        from: prev,
        to,
        timestamp: new Date().toISOString(),
        ...meta,
      };
      setHistory(h => [...h.slice(-19), entry]); // Keep last 20
      onStatusChange?.(to, entry);
      return to;
    });
    if (meta.error) setError(meta.error);
    else setError(null);
  }, [onStatusChange]);

  // ── Verify with Google Ads ─────────────────────────────────────────
  const verifyWithGoogle = useCallback(async (expectedState, attempt = 0) => {
    transition(STATES.VERIFYING);
    try {
      await new Promise(r => setTimeout(r, VERIFY_DELAY));
      const res = await fetch("/app/api/campaign-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", campaignId }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();

      if (!mountedRef.current) return;

      if (data.success) {
        const googleStatus = data.status?.toLowerCase();
        if (googleStatus === expectedState || googleStatus === "paused" || googleStatus === "removed" || googleStatus === "enabled") {
          transition(googleStatus === "enabled" ? STATES.ENABLED :
                     googleStatus === "paused" ? STATES.PAUSED :
                     googleStatus === "removed" ? STATES.REMOVED : STATES.ENABLED);
          return;
        }
      }

      // Google hasn't confirmed yet — retry verification
      if (attempt < VERIFY_MAX_ATTEMPTS) {
        setTimeout(() => verifyWithGoogle(expectedState, attempt + 1), VERIFY_DELAY);
      } else {
        transition(STATES.FAILED_TEMP, { error: "Google Ads didn't confirm the action. Try syncing." });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      if (attempt < VERIFY_MAX_ATTEMPTS) {
        setTimeout(() => verifyWithGoogle(expectedState, attempt + 1), VERIFY_DELAY);
      } else {
        transition(STATES.FAILED_TEMP, { error: err.message });
      }
    }
  }, [campaignId, transition]);

  // ── Actions ────────────────────────────────────────────────────────
  const executeAction = useCallback(async (action, successState) => {
    pendingAction.current = action;
    setRetryCount(0);

    try {
      const res = await fetch("/app/api/campaign-manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, campaignId }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();

      if (!mountedRef.current) return;

      if (data.success) {
        verifyWithGoogle(successState);
      } else {
        const isRetryable = data.retryable !== false &&
          (data.error?.includes("RATE") || data.error?.includes("TIMEOUT") || data.error?.includes("INTERNAL"));
        transition(isRetryable ? STATES.FAILED_TEMP : STATES.FAILED_PERM, {
          error: data.error || `${action} failed`,
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      transition(STATES.FAILED_TEMP, { error: err.message });
    }
  }, [campaignId, transition, verifyWithGoogle]);

  const pause = useCallback(() => {
    transition(STATES.PAUSING);
    executeAction("pause", "paused");
  }, [transition, executeAction]);

  const enable = useCallback(() => {
    transition(STATES.ENABLING);
    executeAction("enable", "enabled");
  }, [transition, executeAction]);

  const remove = useCallback(() => {
    transition(STATES.REMOVING);
    executeAction("remove", "removed");
  }, [transition, executeAction]);

  const sync = useCallback(() => {
    transition(STATES.SYNCING);
    verifyWithGoogle("enabled");
  }, [transition, verifyWithGoogle]);

  const retry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) {
      transition(STATES.FAILED_PERM, { error: `Max retries (${MAX_RETRIES}) reached.` });
      return;
    }
    setRetryCount(c => c + 1);
    transition(STATES.RETRYING);

    const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
    setTimeout(() => {
      if (!mountedRef.current) return;
      const action = pendingAction.current;
      if (action) {
        executeAction(action, action === "pause" ? "paused" : action === "remove" ? "removed" : "enabled");
      }
    }, delay);
  }, [retryCount, transition, executeAction]);

  // ── Derived state (for backward compat with UI) ────────────────────
  const isLoading = [STATES.PAUSING, STATES.ENABLING, STATES.REMOVING, STATES.SYNCING, STATES.VERIFYING, STATES.RETRYING].includes(state);
  const isFailed = [STATES.FAILED_TEMP, STATES.FAILED_PERM, STATES.ERROR].includes(state);
  const canRetry = state === STATES.FAILED_TEMP && retryCount < MAX_RETRIES;
  const canPause = state === STATES.ENABLED;
  const canEnable = state === STATES.PAUSED;
  const canRemove = [STATES.ENABLED, STATES.PAUSED].includes(state);

  return {
    // State
    state,
    error,
    retryCount,
    history,

    // Actions
    pause,
    enable,
    remove,
    sync,
    retry,

    // Derived
    isLoading,
    isFailed,
    canRetry,
    canPause,
    canEnable,
    canRemove,

    // Legacy compat
    campaignControlStatus: state,
  };
}
