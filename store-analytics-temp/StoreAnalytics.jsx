// app/routes/StoreAnalytics.jsx
// ══════════════════════════════════════════════
// Store Analytics Widget — pre-campaign intelligence dashboard
// Shows: orders, revenue, conversion, AI readiness, Google placeholders
// ══════════════════════════════════════════════

import React, { useState, useEffect } from "react";

const READINESS_CONFIG = {
  ready: { emoji: "🟢", color: "#22c55e", bg: "rgba(34,197,94,.08)" },
  almost_ready: { emoji: "🟡", color: "#f59e0b", bg: "rgba(245,158,11,.08)" },
  needs_work: { emoji: "🟠", color: "#f97316", bg: "rgba(249,115,22,.08)" },
  not_ready: { emoji: "🔴", color: "#ef4444", bg: "rgba(239,68,68,.08)" },
  unknown: { emoji: "⚪", color: "rgba(255,255,255,.4)", bg: "rgba(255,255,255,.03)" },
};

export function StoreAnalyticsWidget() {
  const [data, setData] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { fetchData("data"); }, []);

  async function fetchData(mode) {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("mode", mode);
      const res = await fetch("/app/api/store-analytics", { method: "POST", body: form });
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      if (result.success) {
        setData(result.analytics);
        if (result.readiness) {
          setReadiness(result.readiness);
          setExpanded(true);
        }
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const orders = data?.orders || {};
  const products = data?.products || {};
  const traffic = data?.traffic || {};

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <span style={styles.headerTitle}>Store Performance</span>
          {readiness && (
            <span style={{ ...styles.badge, background: (READINESS_CONFIG[readiness.readiness_level] || READINESS_CONFIG.unknown).color }}>
              {readiness.readiness_label || readiness.readiness_level}
            </span>
          )}
        </div>
        <button style={styles.analyzeBtn} onClick={() => fetchData("full")} disabled={loading}>
          {loading ? "⏳ Analyzing..." : "🧠 AI Readiness Check"}
        </button>
      </div>

      {/* Metrics row */}
      {data && (
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricIcon}>🛒</div>
            <div style={styles.metricVal}>{orders.total30d || 0}</div>
            <div style={styles.metricLabel}>Orders (30d)</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricIcon}>💰</div>
            <div style={styles.metricVal}>${(orders.revenue30d || 0).toLocaleString()}</div>
            <div style={styles.metricLabel}>Revenue (30d)</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricIcon}>🧾</div>
            <div style={styles.metricVal}>${orders.avgOrderValue || 0}</div>
            <div style={styles.metricLabel}>Avg Order Value</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricIcon}>📈</div>
            <div style={styles.metricVal}>{orders.ordersPerDay || 0}/day</div>
            <div style={styles.metricLabel}>Order Frequency</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricIcon}>👥</div>
            <div style={{ ...styles.metricVal, fontSize: 18 }}>{traffic.sessions30d ? `~${traffic.sessions30d.toLocaleString()}` : "—"}</div>
            <div style={styles.metricLabel}>Est. Sessions</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricIcon}>🎯</div>
            <div style={styles.metricVal}>{traffic.conversionRate || 0}%</div>
            <div style={styles.metricLabel}>Conv. Rate</div>
          </div>
        </div>
      )}

      {/* Top selling products */}
      {products.topSelling?.length > 0 && (
        <div style={styles.topProducts}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.4)", fontWeight: 600 }}>TOP SELLERS (30D):</span>
          <div style={styles.productTags}>
            {products.topSelling.map((p, i) => (
              <span key={i} style={styles.productTag}>
                {p.title} <span style={{ color: "#22c55e", fontWeight: 700 }}>×{p.qty}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Readiness Analysis */}
      {readiness && !readiness.error && expanded && (
        <div style={{ ...styles.readinessBox, background: (READINESS_CONFIG[readiness.readiness_level] || READINESS_CONFIG.unknown).bg }}>
          <div style={styles.readinessHeader}>
            <span style={{ fontSize: 24 }}>{(READINESS_CONFIG[readiness.readiness_level] || READINESS_CONFIG.unknown).emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,.9)" }}>
                Campaign Readiness: {readiness.readiness_score}/100
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{readiness.headline}</div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div style={styles.swGrid}>
            {readiness.strengths?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", marginBottom: 6 }}>✅ STRENGTHS</div>
                {readiness.strengths.map((s, i) => <div key={i} style={styles.swItem}>{s}</div>)}
              </div>
            )}
            {readiness.weaknesses?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>⚠️ WEAKNESSES</div>
                {readiness.weaknesses.map((w, i) => <div key={i} style={styles.swItem}>{w}</div>)}
              </div>
            )}
          </div>

          {/* Before campaign */}
          {readiness.before_campaign?.length > 0 && (
            <div style={styles.beforeCampaign}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", marginBottom: 6 }}>📋 DO THIS BEFORE LAUNCHING ADS</div>
              {readiness.before_campaign.map((item, i) => (
                <div key={i} style={styles.actionItem}>{i + 1}. {item}</div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div style={styles.recsRow}>
            {readiness.recommended_daily_budget && (
              <div style={styles.recCard}>
                <div style={styles.recLabel}>Recommended Budget</div>
                <div style={styles.recVal}>${readiness.recommended_daily_budget}/day</div>
              </div>
            )}
            {readiness.expected_roas && (
              <div style={styles.recCard}>
                <div style={styles.recLabel}>Expected ROAS</div>
                <div style={styles.recVal}>{readiness.expected_roas}x</div>
              </div>
            )}
            {readiness.expected_cpa && (
              <div style={styles.recCard}>
                <div style={styles.recLabel}>Expected CPA</div>
                <div style={styles.recVal}>${readiness.expected_cpa}</div>
              </div>
            )}
            {readiness.recommended_campaign_type && (
              <div style={styles.recCard}>
                <div style={styles.recLabel}>Campaign Type</div>
                <div style={styles.recVal}>{readiness.recommended_campaign_type.toUpperCase()}</div>
              </div>
            )}
          </div>

          {/* Focus products */}
          {readiness.focus_products?.length > 0 && (
            <div style={styles.focusProducts}>
              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>🎯 Advertise first:</span>
              {readiness.focus_products.map((p, i) => <span key={i} style={styles.focusTag}>{p}</span>)}
            </div>
          )}

          {readiness.confidence && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.25)", marginTop: 10 }}>
              Confidence: {readiness.confidence}% · Powered by AI + Shopify data
            </div>
          )}
        </div>
      )}

      {/* Google Integrations — Placeholders */}
      <div style={styles.integrationsRow}>
        <div style={styles.integrationCard}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={styles.integrationName}>Google Analytics</span>
          <span style={styles.comingSoon}>Coming Soon</span>
        </div>
        <div style={styles.integrationCard}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <span style={styles.integrationName}>Search Console</span>
          <span style={styles.comingSoon}>Coming Soon</span>
        </div>
        <div style={styles.integrationCard}>
          <span style={{ fontSize: 16 }}>🏪</span>
          <span style={styles.integrationName}>Merchant Center</span>
          <span style={styles.comingSoon}>Coming Soon</span>
        </div>
      </div>

      {error && <div style={styles.error}>⚠️ {error}</div>}
    </div>
  );
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
    marginBottom: 14,
  },
  headerTitle: { fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,.9)" },
  badge: {
    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
    color: "#fff", textTransform: "uppercase", letterSpacing: 0.5,
  },
  analyzeBtn: {
    background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)",
    borderRadius: 8, padding: "6px 14px", color: "#a5b4fc", fontSize: 12,
    fontWeight: 600, cursor: "pointer",
  },
  metricsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 10, marginBottom: 14,
  },
  metricCard: {
    background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "12px 14px",
    textAlign: "center",
  },
  metricIcon: { fontSize: 18, marginBottom: 4 },
  metricVal: { fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,.9)" },
  metricLabel: { fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 2 },
  topProducts: { marginBottom: 14 },
  productTags: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 },
  productTag: {
    padding: "4px 10px", background: "rgba(255,255,255,.05)", borderRadius: 20,
    fontSize: 12, color: "rgba(255,255,255,.7)",
  },
  readinessBox: {
    borderRadius: 12, padding: 16, marginBottom: 14,
    border: "1px solid rgba(255,255,255,.06)",
  },
  readinessHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 14 },
  swGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 },
  swItem: { fontSize: 12, color: "rgba(255,255,255,.65)", marginBottom: 4, paddingLeft: 8 },
  beforeCampaign: {
    padding: "10px 14px", background: "rgba(99,102,241,.06)", borderRadius: 10,
    marginBottom: 14,
  },
  actionItem: { fontSize: 12, color: "rgba(255,255,255,.7)", marginBottom: 4 },
  recsRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  recCard: {
    padding: "8px 14px", background: "rgba(255,255,255,.04)", borderRadius: 8,
    minWidth: 100,
  },
  recLabel: { fontSize: 10, color: "rgba(255,255,255,.4)", textTransform: "uppercase", fontWeight: 600 },
  recVal: { fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.85)", marginTop: 2 },
  focusProducts: {
    display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap",
  },
  focusTag: {
    padding: "3px 10px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.15)",
    borderRadius: 20, fontSize: 11, color: "#86efac",
  },
  integrationsRow: {
    display: "flex", gap: 10, flexWrap: "wrap",
  },
  integrationCard: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 14px", background: "rgba(255,255,255,.02)",
    border: "1px dashed rgba(255,255,255,.1)", borderRadius: 10,
    flex: "1 1 140px",
  },
  integrationName: { fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 600 },
  comingSoon: {
    fontSize: 10, color: "rgba(255,255,255,.25)", marginLeft: "auto",
    fontStyle: "italic",
  },
  error: { marginTop: 8, fontSize: 12, color: "#ef4444" },
};
