/**
 * useCampaignLaunch.js
 *
 * Enterprise campaign launch hook with:
 * - Async polling (POST returns jobId, then poll for status)
 * - Partial failure UI states
 * - Persisted launch state (survives modal close/reopen)
 * - Idempotency protection
 * - Retry from failure point
 *
 * Usage:
 *   const launch = useCampaignLaunch({ onSuccess, onError });
 *   launch.start(payload);  // Starts async launch
 *   launch.retry();         // Retries from failure
 *   launch.reset();         // Resets to idle
 *   // launch.state, launch.steps, launch.error, launch.progress
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ── States ───────────────────────────────────────────────────────────────
export const LAUNCH_STATES = {
  IDLE: "idle",
  SUBMITTING: "submitting", // POST request in flight
  POLLING: "polling", // Waiting for backend to finish
  SUCCESS: "success",
  FAILED: "failed",
  PARTIAL_FAILURE: "partial", // Some steps succeeded, some failed
};

const POLL_INTERVAL = 2000; // 2s between polls
const POLL_MAX_ATTEMPTS = 30; // 60s max wait
const STORAGE_KEY = "smartads_launch_state";

// ── Persistence helpers ──────────────────────────────────────────────────
function saveLaunchState(data) {
  try {
    window.__smartads_launch = data;
  } catch {
    /* ignore */
  }
}

function loadLaunchState() {
  try {
    return window.__smartads_launch || null;
  } catch {
    return null;
  }
}

function clearLaunchState() {
  try {
    window.__smartads_launch = null;
  } catch {
    /* ignore */
  }
}

// ── Step progress mapping ────────────────────────────────────────────────
const STEP_PROGRESS = {
  QUEUED: { pct: 5, label: "Queued...", icon: "🕐" },
  VALIDATING: { pct: 15, label: "Validating campaign...", icon: "✅" },
  CREATING: {
    pct: 30,
    label: "Creating campaign in Google Ads...",
    icon: "🚀",
  },
  BUDGET_CREATED: { pct: 45, label: "Budget configured...", icon: "💰" },
  CAMPAIGN_CREATED: { pct: 55, label: "Campaign created!", icon: "📢" },
  UPLOADING_ASSETS: { pct: 70, label: "Uploading ad assets...", icon: "🖼️" },
  ASSETS_UPLOADED: { pct: 80, label: "Assets ready!", icon: "✨" },
  LINKING_CONVERSIONS: {
    pct: 90,
    label: "Setting up conversion tracking...",
    icon: "📊",
  },
  ENABLED: { pct: 100, label: "Campaign is live!", icon: "🎉" },
  FAILED: { pct: 0, label: "Failed", icon: "❌" },
  FAILED_PARTIAL: { pct: 0, label: "Partially failed", icon: "⚠️" },
  ROLLBACK: { pct: 0, label: "Rolled back", icon: "↩️" },
};

export function getStepInfo(state) {
  return STEP_PROGRESS[state] || { pct: 0, label: state, icon: "⏳" };
}

// ── Hook ─────────────────────────────────────────────────────────────────
export function useCampaignLaunch({ onSuccess, onError } = {}) {
  const [state, setState] = useState(LAUNCH_STATES.IDLE);
  const [steps, setSteps] = useState([]);
  const [error, setError] = useState(null);
  const [launchId, setLaunchId] = useState(null);
  const [campaignId, setCampaignId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(null);

  const mountedRef = useRef(true);
  const pollRef = useRef(null);
  const idempotencyRef = useRef(null);
  const payloadRef = useRef(null);

  // ── Restore persisted state on mount ───────────────────────────────
  useEffect(() => {
    const saved = loadLaunchState();
    if (saved && saved.launchId && saved.state !== LAUNCH_STATES.SUCCESS) {
      setState(saved.state === "polling" ? LAUNCH_STATES.POLLING : saved.state);
      setSteps(saved.steps || []);
      setLaunchId(saved.launchId);
      setError(saved.error);
      setProgress(saved.progress || 0);
      setCurrentStep(saved.currentStep);

      // Resume polling if was in progress
      if (saved.state === "polling" || saved.state === "submitting") {
        pollForStatus(saved.launchId);
      }
    }

    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Persist state changes ──────────────────────────────────────────
  useEffect(() => {
    if (state !== LAUNCH_STATES.IDLE) {
      saveLaunchState({ state, steps, launchId, error, progress, currentStep });
    }
  }, [state, steps, launchId, error, progress, currentStep]);

  // ── Poll for campaign status ───────────────────────────────────────
  const pollForStatus = useCallback(
    async (jobId) => {
      if (!jobId) return;
      setState(LAUNCH_STATES.POLLING);
      let attempts = 0;

      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        attempts++;
        if (!mountedRef.current || attempts > POLL_MAX_ATTEMPTS) {
          clearInterval(pollRef.current);
          if (mountedRef.current) {
            setState(LAUNCH_STATES.FAILED);
            setError(
              "Timed out waiting for campaign creation. Check Google Ads dashboard.",
            );
          }
          return;
        }

        try {
          const res = await fetch(
            `/app/api/campaign-status?launchId=${jobId}`,
            {
              signal: AbortSignal.timeout(8000),
            },
          );
          const data = await res.json();

          if (!mountedRef.current) return;

          if (data.steps && data.steps.length > 0) {
            setSteps(data.steps);
            const lastStep = data.steps[data.steps.length - 1];
            const info = getStepInfo(lastStep.state);
            setCurrentStep(lastStep.state);
            setProgress(info.pct);
          }

          if (data.state === "ENABLED") {
            clearInterval(pollRef.current);
            setState(LAUNCH_STATES.SUCCESS);
            setCampaignId(
              data.campaignId ||
                data.steps?.find((s) => s.campaignId)?.campaignId,
            );
            setProgress(100);
            clearLaunchState();
            onSuccess?.(data);
          } else if (data.state === "FAILED") {
            clearInterval(pollRef.current);
            setState(LAUNCH_STATES.FAILED);
            setError(data.error || "Campaign creation failed");
            onError?.(data);
          } else if (data.state === "FAILED_PARTIAL") {
            clearInterval(pollRef.current);
            setState(LAUNCH_STATES.PARTIAL_FAILURE);
            setError(
              data.error || "Campaign partially created — some steps failed",
            );
            setCampaignId(data.steps?.find((s) => s.campaignId)?.campaignId);
            onError?.(data);
          }
        } catch (err) {
          // Network error during poll — keep trying
          console.warn("[SmartAds] Poll error:", err.message);
        }
      }, POLL_INTERVAL);
    },
    [onSuccess, onError],
  );

  // ── Start launch ───────────────────────────────────────────────────
  const start = useCallback(
    async (payload) => {
      if (state === LAUNCH_STATES.SUBMITTING || state === LAUNCH_STATES.POLLING)
        return;

      // Generate idempotency key
      if (!idempotencyRef.current) {
        idempotencyRef.current = `wiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }

      payloadRef.current = payload;
      setState(LAUNCH_STATES.SUBMITTING);
      setError(null);
      setSteps([{ state: "QUEUED", ts: new Date().toISOString() }]);
      setProgress(5);
      setCurrentStep("QUEUED");

      const fullPayload = {
        ...payload,
        idempotencyKey: idempotencyRef.current,
      };

      try {
        const res = await fetch("/app/api/campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fullPayload),
          signal: AbortSignal.timeout(15000), // Short timeout — just submit the job
        });
        const data = await res.json();

        if (!mountedRef.current) return;

        if (data.launchId) {
          setLaunchId(data.launchId);

          // If already complete (fast path)
          if (data.state === "ENABLED" && data.success) {
            setState(LAUNCH_STATES.SUCCESS);
            setCampaignId(data.campaignId);
            setSteps(data.steps || []);
            setProgress(100);
            clearLaunchState();
            onSuccess?.(data);
          } else if (
            data.state === "FAILED" ||
            data.state === "FAILED_PARTIAL"
          ) {
            setState(
              data.state === "FAILED_PARTIAL"
                ? LAUNCH_STATES.PARTIAL_FAILURE
                : LAUNCH_STATES.FAILED,
            );
            setError(data.error);
            setSteps(data.steps || []);
          } else {
            // Async path — start polling
            pollForStatus(data.launchId);
          }
        } else if (data.success) {
          // Legacy path (no launchId returned)
          setState(LAUNCH_STATES.SUCCESS);
          setCampaignId(data.campaignId);
          setProgress(100);
          clearLaunchState();
          onSuccess?.(data);
        } else {
          setState(LAUNCH_STATES.FAILED);
          setError(data.error || "Launch failed");
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setState(LAUNCH_STATES.FAILED);
        setError(
          err.name === "TimeoutError"
            ? "Request timed out. Campaign may still be creating — check back soon."
            : err.message,
        );
      }
    },
    [state, pollForStatus, onSuccess, onError],
  );

  // ── Retry ──────────────────────────────────────────────────────────
  const retry = useCallback(() => {
    idempotencyRef.current = null;
    if (payloadRef.current) {
      start(payloadRef.current);
    }
  }, [start]);

  // ── Reset ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState(LAUNCH_STATES.IDLE);
    setSteps([]);
    setError(null);
    setLaunchId(null);
    setCampaignId(null);
    setProgress(0);
    setCurrentStep(null);
    idempotencyRef.current = null;
    payloadRef.current = null;
    clearLaunchState();
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────
  const isLoading =
    state === LAUNCH_STATES.SUBMITTING || state === LAUNCH_STATES.POLLING;
  const isFailed =
    state === LAUNCH_STATES.FAILED || state === LAUNCH_STATES.PARTIAL_FAILURE;
  const isPartial = state === LAUNCH_STATES.PARTIAL_FAILURE;
  const isSuccess = state === LAUNCH_STATES.SUCCESS;
  const stepInfo = getStepInfo(currentStep);

  return {
    // State
    state,
    steps,
    error,
    launchId,
    campaignId,
    progress,
    currentStep,
    stepInfo,

    // Actions
    start,
    retry,
    reset,

    // Derived
    isLoading,
    isFailed,
    isPartial,
    isSuccess,
  };
}
