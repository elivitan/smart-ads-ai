/**
 * useLivePulse.js
 *
 * Separates demo mode (simulated data) from live mode (Google Ads API).
 * LivePulse component receives clean data — never knows which mode it's in.
 *
 * Usage:
 *   const pulse = useLivePulse({ campaignId, mockCampaigns, avgScore });
 *   // pulse.mode → "live" | "demo"
 *   // pulse.impressions, pulse.clicks, pulse.spend, pulse.ctr, pulse.roas
 */

import { useState, useEffect, useRef, useCallback } from "react";

const POLL_INTERVAL_LIVE = 30000; // 30s for real API
const POLL_INTERVAL_DEMO = 2800; // 2.8s for demo animation

/**
 * @param {object} opts
 * @param {string|null} opts.campaignId - Real campaign ID (null = demo mode)
 * @param {number} opts.mockCampaigns - Number of campaigns for demo calc
 * @param {number} opts.avgScore - Average AI score for demo ROAS
 * @returns {object} Pulse data
 */
export function useLivePulse({ campaignId, mockCampaigns = 0, avgScore = 0 }) {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(campaignId ? "live" : "demo");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const prevRef = useRef(null);
  const mountedRef = useRef(true);

  // ── Demo data generator ────────────────────────────────────────────
  const buildDemoData = useCallback(
    (prev) => {
      const campaigns = mockCampaigns || 0;
      const hourOfDay = new Date().getHours();
      const trafficMult = hourOfDay >= 10 && hourOfDay <= 20 ? 1.3 : 0.7;

      const impressions = Math.round(
        (prev?.impressions || campaigns * 4200) +
          Math.random() * 14 * trafficMult,
      );
      const clicks = Math.round(
        (prev?.clicks || campaigns * 180) + (Math.random() > 0.6 ? 1 : 0),
      );
      const cpc = 0.35 + Math.random() * 0.2;
      const cost = parseFloat(
        ((prev?.cost || campaigns * 79) + Math.random() * 0.44).toFixed(2),
      );

      return {
        impressions,
        clicks,
        cost,
        spend: cost,
        cpc: parseFloat(cpc.toFixed(2)),
        conversions: prev?.conversions || Math.round(campaigns * 3.2),
        roas: parseFloat((1.8 + avgScore * 0.028).toFixed(2)),
        ctr:
          impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00",
        campaigns,
        source: "demo",
      };
    },
    [mockCampaigns, avgScore],
  );

  // ── Live data fetcher ──────────────────────────────────────────────
  const fetchLiveData = useCallback(async () => {
    try {
      const res = await fetch("/app/api/google-ads/metrics", {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        return {
          ...json.data,
          spend: json.data.cost || json.data.spend || 0,
          cpc:
            json.data.clicks > 0
              ? parseFloat((json.data.cost / json.data.clicks).toFixed(2))
              : 0,
          ctr:
            json.data.impressions > 0
              ? ((json.data.clicks / json.data.impressions) * 100).toFixed(2)
              : "0.00",
          source: "live",
        };
      }
    } catch (err) {
      // Silently fall back to demo if live fails
      console.warn("[SmartAds] Live metrics unavailable:", err.message);
      setError(err.message);
    }
    return null;
  }, []);

  // ── Polling loop ───────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function tick() {
      if (!mountedRef.current) return;
      if (document.visibilityState === "hidden") return;

      let nextData = null;

      if (campaignId) {
        // Try live first
        nextData = await fetchLiveData();
        if (nextData) {
          setMode("live");
          setError(null);
        } else {
          // Fall back to demo
          setMode("demo");
          nextData = buildDemoData(prevRef.current);
        }
      } else {
        setMode("demo");
        nextData = buildDemoData(prevRef.current);
      }

      if (mountedRef.current && nextData) {
        prevRef.current = nextData;
        setData(nextData);
        setLastUpdated(new Date());
      }
    }

    tick();
    const interval = campaignId ? POLL_INTERVAL_LIVE : POLL_INTERVAL_DEMO;
    const iv = setInterval(tick, interval);

    // Pause when tab hidden
    const handleVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [campaignId, buildDemoData, fetchLiveData]);

  const result = data || buildDemoData(null);

  return {
    ...result,
    mode,
    isLive: mode === "live",
    isDemo: mode === "demo",
    lastUpdated,
    error,
  };
}
