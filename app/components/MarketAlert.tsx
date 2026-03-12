// app/routes/MarketAlert.jsx
// ═══════════════════════════════════════════════════════════════
// Market Intelligence Widget v2 — Powered by AI Brain
// Shows REAL competitor data + Claude's analysis
// No news, no geopolitics — only ad-relevant intelligence
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";

interface MarketAlertProps {
  shopDomain: string;
}

interface Signal {
  type: string;
  title: string;
  detail: string;
  time: string;
  source?: string;
}

const SIGNAL_COLORS = {
  green:  { color: "#22c55e", bg: "rgba(34,197,94,.06)",  border: "rgba(34,197,94,.15)" },
  yellow: { color: "#f59e0b", bg: "rgba(245,158,11,.06)", border: "rgba(245,158,11,.15)" },
  red:    { color: "#ef4444", bg: "rgba(239,68,68,.06)",  border: "rgba(239,68,68,.15)" },
};

export function MarketAlert({ shopDomain }) {
  const [intel, setIntel] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Auto-fetch quick signal on mount
  useEffect(() => {
    fetchQuickSignal().then(() => { if (typeof window !== "undefined" && (!window.__marketIntel || window.__marketIntel._quickOnly)) { fetchFullAnalysis(); } });
  }, []);

  async function fetchQuickSignal() {
    try {
      const form = new FormData();
      form.append("action", "quick-signal");
      form.append("category", "bedding");
      const res = await fetch("/app/api/ai-engine", { method: "POST", body: form });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setIntel(prev => prev ? prev : {
          market_signal: data.signal || "green",
          signal_reason: data.signal_label || "Normal conditions",
          _quickOnly: true,
          _seasonal: data.seasonal || null,
          _holiday: data.holiday || null,
          _budget_multiplier: data.budget_multiplier || 1.0,
        });
        setLastFetch(new Date());
      }
    } catch { /* silent */ }
  }

  async function fetchFullAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("action", "market-analysis");
      form.append("category", "bedding");
      form.append("products", "[]"); // will use store products when available
      const res = await fetch("/app/api/ai-engine", { method: "POST", body: form });
      if (!res.ok) throw new Error("Analysis failed — try again");
      const data = await res.json();
      if (data.success && data.analysis) {
        setIntel({ ...data.analysis, _quickOnly: false });
        setRawData(data._raw || null);
        setLastFetch(new Date());
        setShowDetails(true);
      } else {
        throw new Error(data.error || "Analysis failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Loading state
  if (!intel) {
    return (
      <div style={S.container}>
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{"\uD83D\uDCCA"}</span>
            <span style={S.title}>Market Intelligence</span>
          </div>
        </div>
        <div style={{ padding: "12px 0", fontSize: 13, color: "rgba(255,255,255,.4)" }}>
          Loading market conditions...
        </div>
      </div>
    );
  }

  const sig = SIGNAL_COLORS[intel.market_signal] || SIGNAL_COLORS.yellow;
  const isQuick = intel._quickOnly;

  return (
    <div style={{ ...S.container, background: sig.bg, borderColor: sig.border }}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{"\uD83D\uDCCA"}</span>
          <span style={S.title}>Market Intelligence</span>
          <span style={{ ...S.badge, background: sig.color }}>
            {intel.signal_reason || (intel.market_signal === "green" ? "Good to advertise" : intel.market_signal === "red" ? "Caution" : "Monitor")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lastFetch && <span style={S.updated}>Updated {timeAgo(lastFetch)}</span>}
          <button style={S.btn} onClick={fetchFullAnalysis} disabled={loading}>
            {loading ? "\u23F3 Analyzing..." : (!isQuick ? "\uD83D\uDD04 Refresh Analysis" : "\uD83D\uDD0D Deep Analysis")}
          </button>
        </div>
      </div>

      {/* ── Quick info: seasonal + holiday ── */}
      {isQuick && intel._seasonal && (
        <div style={{ ...S.row, marginTop: 10 }}>
          <span>{intel._seasonal.season === "peak" ? "\uD83D\uDD25" : intel._seasonal.season === "low" ? "\uD83D\uDCA4" : "\u2696\uFE0F"}</span>
          <span style={{ color: intel._seasonal.season === "peak" ? "#22c55e" : intel._seasonal.season === "low" ? "#f59e0b" : "rgba(255,255,255,.6)", fontSize: 13 }}>
            {intel._seasonal.season === "peak" ? "Peak Season" : intel._seasonal.season === "low" ? "Low Season" : "Normal Season"}
            {intel._budget_multiplier && intel._budget_multiplier !== 1.0 && (" \u00B7 Budget suggestion: " + intel._budget_multiplier + "x")}
          </span>
        </div>
      )}

      {intel._holiday && (
        <div style={S.holidayBar}>
          <span>{"\uD83C\uDF89"}</span>
          <span><strong>{intel._holiday.name}</strong> in {intel._holiday.daysUntil} days</span>
        </div>
      )}

      {/* ── Prompt to run full analysis ── */}
      {isQuick && !loading && (
        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(99,102,241,.7)" }}>
          Full analysis will load automatically...
        </div>
      )}

      {/* ── Full Analysis Results ── */}
      {!isQuick && (
        <div style={{ marginTop: 14 }}>

          {/* Competition Level */}
          {intel.competition_level && (
            <div style={S.section}>
              <div style={S.sectionTitle}>{"\uD83C\uDFAF"} Competition Level: <span style={{ color: intel.competition_level === "extreme" || intel.competition_level === "high" ? "#ef4444" : intel.competition_level === "moderate" ? "#f59e0b" : "#22c55e", textTransform: "uppercase" }}>{intel.competition_level}</span></div>
              <div style={S.sectionBody}>{intel.competition_detail}</div>
            </div>
          )}

          {/* Big Player Threat */}
          {intel.big_player_threat && intel.big_player_threat !== "none" && (
            <div style={{ ...S.section, background: "rgba(239,68,68,.05)", borderColor: "rgba(239,68,68,.12)" }}>
              <div style={S.sectionTitle}>{"\u26A0\uFE0F"} Big Player Threat: <span style={{ color: "#ef4444", textTransform: "uppercase" }}>{intel.big_player_threat}</span></div>
              <div style={S.sectionBody}>{intel.big_player_advice}</div>
            </div>
          )}

          {/* Trend Analysis */}
          {intel.trend_analysis && (
            <div style={S.section}>
              <div style={S.sectionTitle}>{"\uD83D\uDCC8"} Trend Analysis</div>
              <div style={S.sectionBody}>{intel.trend_analysis}</div>
            </div>
          )}

          {/* Seasonal Advice */}
          {intel.seasonal_advice && (
            <div style={S.section}>
              <div style={S.sectionTitle}>{"\uD83D\uDCC5"} Seasonal Insight</div>
              <div style={S.sectionBody}>{intel.seasonal_advice}</div>
            </div>
          )}

          {/* Budget Recommendation */}
          {intel.budget_recommendation && (
            <div style={{ ...S.section, background: "rgba(99,102,241,.05)", borderColor: "rgba(99,102,241,.12)" }}>
              <div style={S.sectionTitle}>{"\uD83D\uDCB0"} Budget Recommendation</div>
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                <div style={S.metric}>
                  <div style={S.metricLabel}>MIN</div>
                  <div style={S.metricVal}>${intel.budget_recommendation.daily_min}/day</div>
                </div>
                <div style={{ ...S.metric, background: "rgba(99,102,241,.12)" }}>
                  <div style={S.metricLabel}>RECOMMENDED</div>
                  <div style={{ ...S.metricVal, color: "#a5b4fc" }}>${intel.budget_recommendation.daily_recommended}/day</div>
                </div>
                <div style={S.metric}>
                  <div style={S.metricLabel}>AGGRESSIVE</div>
                  <div style={S.metricVal}>${intel.budget_recommendation.daily_max}/day</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 8 }}>{intel.budget_recommendation.reasoning}</div>
            </div>
          )}

          {/* Keyword Strategy */}
          {intel.keyword_strategy && (
            <div style={S.section}>
              <div style={S.sectionTitle}>{"\uD83D\uDD11"} Keyword Strategy</div>
              {intel.keyword_strategy.target?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>TARGET: </span>
                  {intel.keyword_strategy.target.map((kw, i) => (
                    <span key={i} style={S.kwTag}>{kw}</span>
                  ))}
                </div>
              )}
              {intel.keyword_strategy.avoid?.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>AVOID: </span>
                  {intel.keyword_strategy.avoid.map((kw, i) => (
                    <span key={i} style={{ ...S.kwTag, background: "rgba(239,68,68,.1)", borderColor: "rgba(239,68,68,.2)", color: "#fca5a5" }}>{kw}</span>
                  ))}
                </div>
              )}
              {intel.keyword_strategy.reasoning && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 6 }}>{intel.keyword_strategy.reasoning}</div>
              )}
            </div>
          )}

          {/* Action Items */}
          {intel.action_items?.length > 0 && (
            <div style={{ ...S.section, background: "rgba(34,197,94,.05)", borderColor: "rgba(34,197,94,.12)" }}>
              <div style={S.sectionTitle}>{"\u2705"} Action Items</div>
              {intel.action_items.map((item, i) => (
                <div key={i} style={{ fontSize: 13, color: "rgba(255,255,255,.75)", padding: "4px 0", display: "flex", gap: 6 }}>
                  <span style={{ color: "#22c55e", fontWeight: 700 }}>{i + 1}.</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risk Alerts */}
          {intel.risk_alerts?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {intel.risk_alerts.map((r, i) => (
                <span key={i} style={S.riskTag}>{"\u26A0\uFE0F"} {r}</span>
              ))}
            </div>
          )}

          {/* Confidence + Data Sources */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>
              {intel.opportunity_score && ("Opportunity: " + intel.opportunity_score + "/100")}
              {intel.confidence && (" \u00B7 Confidence: " + intel.confidence + "%")}
            </div>
            {rawData && (
              <button style={{ background: "none", border: "none", fontSize: 11, color: "rgba(255,255,255,.25)", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowDetails(!showDetails)}>
                {showDetails ? "Hide" : "Show"} raw data
              </button>
            )}
          </div>

          {/* Raw data panel */}
          {showDetails && rawData && (
            <div style={{ marginTop: 8, padding: 10, background: "rgba(0,0,0,.2)", borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,.3)", lineHeight: 1.6 }}>
              <div>{rawData.competitorCount} competitors found ({rawData.bigPlayerCount} big players: {rawData.bigPlayers?.join(", ") || "none"})</div>
              {rawData.trends && <div>Trend: {rawData.trends.direction} ({rawData.trends.changePercent > 0 ? "+" : ""}{rawData.trends.changePercent}%)</div>}
              {rawData.storeRankings?.map((r, i) => (
                <div key={i}>"{r.keyword}": {r.found ? "#" + r.position : "not ranked"}</div>
              ))}
              {rawData.shoppingPrices?.map((s, i) => (
                <div key={i}>{s.source}: {s.price} — "{s.title?.slice(0, 40)}"</div>
              ))}
              <div style={{ marginTop: 4 }}>Analyzed: {rawData.analyzedAt}</div>
              <div>Sources: SerpAPI (competitor ads, shopping, trends) + Claude AI (analysis)</div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>{"\u26A0\uFE0F"} {error}</div>}
    </div>
  );
}

function timeAgo(date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

// ── Styles ──
const S = {
  container: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: "16px 20px",
    marginBottom: 20,
    minHeight: 72,
    transition: "min-height .3s ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  title: { fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,.9)" },
  badge: {
    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
    color: "#fff", textTransform: "uppercase", letterSpacing: 0.5,
  },
  btn: {
    background: "rgba(99,102,241,.15)", border: "1px solid rgba(99,102,241,.3)",
    borderRadius: 8, padding: "6px 14px", color: "#a5b4fc",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  updated: { fontSize: 11, color: "rgba(255,255,255,.3)" },
  row: { display: "flex", alignItems: "center", gap: 6 },
  holidayBar: {
    display: "flex", alignItems: "center", gap: 8, marginTop: 10,
    padding: "8px 12px", background: "rgba(99,102,241,.08)",
    border: "1px solid rgba(99,102,241,.15)", borderRadius: 10,
    fontSize: 13, color: "rgba(255,255,255,.85)",
  },
  section: {
    marginTop: 10, padding: "10px 14px",
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.06)",
    borderRadius: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.8)" },
  sectionBody: { fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 4, lineHeight: 1.5 },
  metric: {
    padding: "8px 14px", background: "rgba(255,255,255,.04)",
    borderRadius: 8, minWidth: 80, textAlign: "center",
  },
  metricLabel: { fontSize: 10, color: "rgba(255,255,255,.4)", fontWeight: 600, textTransform: "uppercase" },
  metricVal: { fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,.8)", marginTop: 2 },
  kwTag: {
    display: "inline-block", padding: "2px 8px", margin: "2px 4px 2px 0",
    background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.2)",
    borderRadius: 12, fontSize: 11, color: "#86efac",
  },
  riskTag: {
    padding: "4px 10px", background: "rgba(245,158,11,.1)",
    border: "1px solid rgba(245,158,11,.15)", borderRadius: 20,
    fontSize: 11, color: "#fbbf24",
  },
};
