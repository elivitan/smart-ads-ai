// app/routes/MarketAlert.jsx
// ══════════════════════════════════════════════
// Market Intelligence Alert — dashboard widget
// Shows: signal (green/yellow/red), headline, recommendation, holidays
// ══════════════════════════════════════════════

import React, { useState, useEffect } from "react";

const SIGNAL_CONFIG = {
  green: { emoji: "🟢", color: "#22c55e", bg: "rgba(34,197,94,.08)", border: "rgba(34,197,94,.2)", label: "Good to Advertise" },
  yellow: { emoji: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.2)", label: "Proceed with Caution" },
  red: { emoji: "🔴", color: "#ef4444", bg: "rgba(239,68,68,.08)", border: "rgba(239,68,68,.2)", label: "Consider Pausing" },
};

const BUDGET_ICONS = { increase: "📈", maintain: "➡️", decrease: "📉", pause: "⏸️" };

export function MarketAlert({ shopDomain }) {
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  // Auto-fetch on mount + every 6 hours
  useEffect(() => {
    fetchQuickSignal();
    const iv = setInterval(fetchQuickSignal, 6 * 60 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  async function fetchQuickSignal() {
    try {
      const form = new FormData();
      form.append("mode", "quick");
      form.append("regions", "US");
      const res = await fetch("/app/api/market-intel", { method: "POST", body: form });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.intel) {
        setIntel(prev => ({ ...prev, ...data.intel, _quickOnly: !prev?.headline }));
        setLastFetch(new Date());
      }
    } catch { /* silent */ }
  }

  async function fetchFullAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("mode", "full");
      form.append("regions", "US");
      form.append("productCategory", "general");
      const res = await fetch("/app/api/market-intel", { method: "POST", body: form });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.success && data.intel) {
        setIntel({ ...data.intel, _quickOnly: false });
        setLastFetch(new Date());
        setExpanded(true);
      } else {
        throw new Error(data.error || "Analysis failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!intel) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <span style={styles.headerIcon}>🌍</span>
          <span style={styles.headerTitle}>Market Intelligence</span>
        </div>
        <div style={styles.loadingState}>
          <span style={{ opacity: 0.5 }}>Loading market conditions...</span>
        </div>
      </div>
    );
  }

  const sig = SIGNAL_CONFIG[intel.signal] || SIGNAL_CONFIG.yellow;

  return (
    <div style={{ ...styles.container, background: sig.bg, borderColor: sig.border }}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{sig.emoji}</span>
          <span style={styles.headerTitle}>Market Intelligence</span>
          <span style={{ ...styles.signalBadge, background: sig.color }}>{intel.signal_label || sig.label}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lastFetch && <span style={styles.lastUpdated}>Updated {formatTimeAgo(lastFetch)}</span>}
          <button style={styles.refreshBtn} onClick={fetchFullAnalysis} disabled={loading}>
            {loading ? "⏳ Analyzing..." : "🔄 Deep Analysis"}
          </button>
        </div>
      </div>

      {/* Quick signal — always visible */}
      {intel.holiday && (
        <div style={styles.holidayBanner}>
          <span style={{ fontSize: 16 }}>🎉</span>
          <span><strong>{intel.holiday.name}</strong> in {intel.holiday.daysUntil} days — {intel.holiday.adTip}</span>
        </div>
      )}

      {intel.seasonal && (
        <div style={styles.seasonBar}>
          <span>{intel.seasonal.season === "peak" ? "🔥" : intel.seasonal.season === "low" ? "❄️" : "📊"}</span>
          <span style={{ color: intel.seasonal.season === "peak" ? "#22c55e" : intel.seasonal.season === "low" ? "#f59e0b" : "rgba(255,255,255,.6)" }}>
            {intel.seasonal.season === "peak" ? "Peak Season" : intel.seasonal.season === "low" ? "Low Season" : "Normal Season"}
            {intel.seasonal.budgetMultiplier !== 1.0 && ` · Suggested budget: ${intel.seasonal.budgetMultiplier}x`}
          </span>
        </div>
      )}

      {/* Full analysis — shown when expanded */}
      {intel.headline && !intel._quickOnly && (
        <div style={{ marginTop: 12 }}>
          <div style={styles.headline}>{intel.headline}</div>

          {intel.recommendation && (
            <div style={styles.recommendation}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span>{intel.recommendation}</span>
            </div>
          )}

          <div style={styles.metricsRow}>
            {intel.budget_advice && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Budget</span>
                <span style={styles.metricVal}>{BUDGET_ICONS[intel.budget_advice]} {intel.budget_advice}</span>
              </div>
            )}
            {intel.budget_multiplier != null && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Multiplier</span>
                <span style={{ ...styles.metricVal, color: intel.budget_multiplier > 1 ? "#22c55e" : intel.budget_multiplier < 1 ? "#f59e0b" : "rgba(255,255,255,.7)" }}>
                  {intel.budget_multiplier}x
                </span>
              </div>
            )}
            {intel.confidence != null && (
              <div style={styles.metric}>
                <span style={styles.metricLabel}>Confidence</span>
                <span style={styles.metricVal}>{intel.confidence}%</span>
              </div>
            )}
          </div>

          {intel.timing_advice && (
            <div style={styles.timingAdvice}>⏰ {intel.timing_advice}</div>
          )}

          {intel.upcoming_opportunity && (
            <div style={styles.opportunity}>🎯 <strong>Next opportunity:</strong> {intel.upcoming_opportunity}</div>
          )}

          {intel.risks?.length > 0 && (
            <div style={styles.risks}>
              <span style={{ fontWeight: 600, color: "#f59e0b" }}>⚠️ Risks:</span>
              {intel.risks.map((r, i) => <span key={i} style={styles.riskTag}>{r}</span>)}
            </div>
          )}

          {/* Raw data summary */}
          {intel._raw && (
            <div style={styles.rawData}>
              <span>📡 Sources: Holidays{intel._raw.trends ? " · Google Trends" : ""}{intel._raw.newsCount > 0 ? ` · News (${intel._raw.newsCount} articles)` : ""} · AI Analysis</span>
            </div>
          )}
        </div>
      )}

      {/* Show "analyze" prompt if only quick data */}
      {intel._quickOnly && !loading && (
        <div style={styles.analyzePrompt} onClick={fetchFullAnalysis}>
          Click "Deep Analysis" for full market report with news, trends & AI recommendations →
        </div>
      )}

      {error && <div style={styles.error}>⚠️ {error}</div>}
    </div>
  );
}

function formatTimeAgo(date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = {
  container: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: "16px 20px",
    marginBottom: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  headerIcon: { fontSize: 20 },
  headerTitle: { fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,.9)" },
  signalBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 20,
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  refreshBtn: {
    background: "rgba(99,102,241,.15)",
    border: "1px solid rgba(99,102,241,.3)",
    borderRadius: 8,
    padding: "6px 14px",
    color: "#a5b4fc",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  lastUpdated: { fontSize: 11, color: "rgba(255,255,255,.3)" },
  loadingState: { padding: "12px 0", fontSize: 13 },
  holidayBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: "10px 14px",
    background: "rgba(99,102,241,.08)",
    border: "1px solid rgba(99,102,241,.15)",
    borderRadius: 10,
    fontSize: 13,
    color: "rgba(255,255,255,.85)",
  },
  seasonBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    fontSize: 13,
  },
  headline: {
    fontSize: 14,
    fontWeight: 600,
    color: "rgba(255,255,255,.9)",
    marginBottom: 8,
  },
  recommendation: {
    display: "flex",
    gap: 8,
    padding: "10px 14px",
    background: "rgba(255,255,255,.04)",
    borderRadius: 10,
    fontSize: 13,
    color: "rgba(255,255,255,.75)",
    lineHeight: 1.5,
  },
  metricsRow: {
    display: "flex",
    gap: 16,
    marginTop: 12,
    flexWrap: "wrap",
  },
  metric: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "8px 14px",
    background: "rgba(255,255,255,.04)",
    borderRadius: 8,
    minWidth: 80,
  },
  metricLabel: { fontSize: 10, color: "rgba(255,255,255,.4)", textTransform: "uppercase", fontWeight: 600 },
  metricVal: { fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.8)" },
  timingAdvice: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255,255,255,.5)",
  },
  opportunity: {
    marginTop: 8,
    fontSize: 13,
    color: "rgba(255,255,255,.7)",
    padding: "8px 12px",
    background: "rgba(34,197,94,.06)",
    borderRadius: 8,
    border: "1px solid rgba(34,197,94,.1)",
  },
  risks: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 10,
    fontSize: 12,
  },
  riskTag: {
    padding: "3px 10px",
    background: "rgba(245,158,11,.1)",
    border: "1px solid rgba(245,158,11,.15)",
    borderRadius: 20,
    fontSize: 11,
    color: "#fbbf24",
  },
  rawData: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid rgba(255,255,255,.06)",
    fontSize: 11,
    color: "rgba(255,255,255,.25)",
  },
  analyzePrompt: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(99,102,241,.7)",
    cursor: "pointer",
    textDecoration: "underline dotted",
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    color: "#ef4444",
  },
};
