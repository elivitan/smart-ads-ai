/**
 * Engine Widgets — 6 new dashboard blocks for AI engines
 * Profit Intel, Inventory, Competitor Spend, Forecast, Benchmarks, Funnel
 */
import React, { useState, useEffect, useCallback } from "react";

// ── Helpers ──
function parseJsonSafe(val: any, fallback: any = null) {
  if (!val) return fallback;
  if (typeof val === "object") return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const cardStyle: React.CSSProperties = {
  background: "rgba(30,30,60,0.5)",
  borderRadius: 16,
  padding: 20,
  border: "1px solid rgba(255,255,255,0.06)",
  marginBottom: 16,
};

const headerStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#fff",
  marginBottom: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const badgeStyle = (color: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  background: `${color}22`,
  color,
});

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const dimText: React.CSSProperties = { color: "rgba(255,255,255,0.5)", fontSize: 12 };
const labelText: React.CSSProperties = { color: "rgba(255,255,255,0.7)", fontSize: 13 };
const valueText: React.CSSProperties = { color: "#fff", fontSize: 18, fontWeight: 700 };

// ════════════════════════════════════════════════════════════
// 1. PROFIT INTEL WIDGET
// ════════════════════════════════════════════════════════════
export function ProfitIntelWidget() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "scores");
      const res = await fetch("/app/api/profit-intel", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setScores(data.scores || []);
      else setError(data.error || "Failed to load");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchScores(); }, [fetchScores]);

  const scoreColor = (s: number) => s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>💰</span>
        <span>Profit Intelligence</span>
        <button onClick={fetchScores} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, marginLeft: "auto" }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {scores.length === 0 && !loading && !error && (
        <div style={dimText}>No profit data yet. Run a scan to analyze product profitability.</div>
      )}
      {scores.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {scores.slice(0, 8).map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{s.productTitle || s.productId || `Product ${i + 1}`}</div>
                <div style={dimText}>
                  {s.netProfitPerClick != null && `Net/click: ${formatCurrency(s.netProfitPerClick)}`}
                  {s.netProfitPerConv != null && ` · Net/conv: ${formatCurrency(s.netProfitPerConv)}`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ ...badgeStyle(scoreColor(s.profitScore || 0)) }}>{s.profitScore || 0}/100</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 2. INVENTORY WIDGET
// ════════════════════════════════════════════════════════════
export function InventoryWidget() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "status");
      const res = await fetch("/app/api/inventory", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success) setData(json);
      else setError(json.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const alertColor = (type: string) => {
    if (type === "low_stock" || type === "stockout_predicted") return "#ef4444";
    if (type === "overstock") return "#f59e0b";
    if (type === "throttled") return "#f97316";
    if (type === "boosted") return "#22c55e";
    return "#94a3b8";
  };

  const alerts = data?.alerts || data?.lowStock || [];
  const summary = data?.summary || {};

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>📦</span>
        <span>Inventory-Aware Ads</span>
        <button onClick={fetchStatus} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, marginLeft: "auto" }}>
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {summary.totalProducts != null && (
        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          <div><div style={labelText}>Total Products</div><div style={valueText}>{summary.totalProducts || 0}</div></div>
          <div><div style={labelText}>Low Stock</div><div style={{ ...valueText, color: "#ef4444" }}>{summary.lowStock || 0}</div></div>
          <div><div style={labelText}>Overstocked</div><div style={{ ...valueText, color: "#f59e0b" }}>{summary.overstock || 0}</div></div>
          <div><div style={labelText}>Healthy</div><div style={{ ...valueText, color: "#22c55e" }}>{summary.healthy || 0}</div></div>
        </div>
      )}
      {Array.isArray(alerts) && alerts.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {alerts.slice(0, 6).map((a: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <span style={badgeStyle(alertColor(a.alertType || a.type))}>{(a.alertType || a.type || "").replace(/_/g, " ")}</span>
              <span style={{ color: "#fff", fontSize: 12, flex: 1 }}>{a.productTitle || a.title || "Unknown"}</span>
              {a.daysUntilOut != null && <span style={{ ...dimText, color: "#ef4444" }}>{a.daysUntilOut}d left</span>}
              {a.currentStock != null && <span style={dimText}>Stock: {a.currentStock}</span>}
            </div>
          ))}
        </div>
      )}
      {!data && !loading && !error && <div style={dimText}>No inventory data yet.</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 3. COMPETITOR SPEND WIDGET
// ════════════════════════════════════════════════════════════
export function CompetitorSpendWidget({ shopDomain }: { shopDomain?: string }) {
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "get");
      const res = await fetch("/app/api/competitor-spend", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setEstimates(data.result || data.estimates || []);
      else setError(data.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trendIcon = (dir: string) => dir === "increasing" ? "📈" : dir === "decreasing" ? "📉" : "➡️";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🕵️</span>
        <span>Competitor Ad Spend</span>
        <button onClick={fetchData} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, marginLeft: "auto" }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {estimates.length === 0 && !loading && !error && (
        <div style={dimText}>No competitor spend data yet. Connect Google Ads for auction insights.</div>
      )}
      {estimates.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {estimates.slice(0, 6).map((e: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{e.competitorDomain}</div>
                <div style={dimText}>
                  {e.impressionShare != null && `Imp share: ${formatPct(e.impressionShare)}`}
                  {e.overlapRate != null && ` · Overlap: ${formatPct(e.overlapRate)}`}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{e.estimatedMonthly ? formatCurrency(e.estimatedMonthly) + "/mo" : "N/A"}</div>
                <div style={dimText}>{trendIcon(e.trendDirection)} {e.trendPct != null ? `${e.trendPct > 0 ? "+" : ""}${e.trendPct.toFixed(0)}%` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 4. FORECAST WIDGET
// ════════════════════════════════════════════════════════════
export function ForecastWidget() {
  const [forecast, setForecast] = useState<any>(null);
  const [lifecycle, setLifecycle] = useState<any[]>([]);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "sales");
      fd.append("period", period);
      const res = await fetch("/app/api/forecast", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setForecast(data.result);
      else setError(data.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [period]);

  const fetchLifecycle = useCallback(async () => {
    try {
      const fd = new FormData();
      fd.append("action", "lifecycle");
      const res = await fetch("/app/api/forecast", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setLifecycle(data.result || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchForecast(); fetchLifecycle(); }, [fetchForecast, fetchLifecycle]);

  const trendColor = (t: string) => t === "growing" ? "#22c55e" : t === "declining" ? "#ef4444" : "#f59e0b";
  const stageColor = (s: string) => s === "rising" ? "#22c55e" : s === "peak" ? "#3b82f6" : s === "declining" ? "#f59e0b" : "#ef4444";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🔮</span>
        <span>Revenue Forecast</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {(["week", "month"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ ...btnStyle, padding: "4px 10px", fontSize: 11, opacity: period === p ? 1 : 0.5 }}>
              {p === "week" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {loading && <div style={dimText}>Calculating forecast...</div>}
      {forecast && !loading && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
            <div>
              <div style={labelText}>Predicted Revenue</div>
              <div style={valueText}>{formatCurrency(forecast.predicted || 0)}</div>
            </div>
            <div>
              <div style={labelText}>Confidence</div>
              <div style={valueText}>{((forecast.confidence || 0) * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style={labelText}>Trend</div>
              <div style={{ ...valueText, color: trendColor(forecast.trend || "stable") }}>{(forecast.trend || "stable").toUpperCase()}</div>
            </div>
          </div>
        </div>
      )}
      {lifecycle.length > 0 && (
        <>
          <div style={{ ...labelText, marginBottom: 6, fontWeight: 600 }}>Product Lifecycle</div>
          <div style={{ display: "grid", gap: 6 }}>
            {lifecycle.slice(0, 5).map((p: any, i: number) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                <span style={badgeStyle(stageColor(p.stage))}>{p.stage}</span>
                <span style={{ color: "#fff", fontSize: 12, flex: 1 }}>{p.title}</span>
                <span style={dimText}>{p.trend > 0 ? "+" : ""}{(p.trend * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 5. BENCHMARKS WIDGET
// ════════════════════════════════════════════════════════════
export function BenchmarksWidget() {
  const [benchmarks, setBenchmarks] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchBenchmarks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "benchmarks");
      const res = await fetch("/app/api/benchmarks", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setBenchmarks(data.result);
      else setError(data.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBenchmarks(); }, [fetchBenchmarks]);

  const deltaColor = (d: number) => d >= 0 ? "#22c55e" : "#ef4444";

  const metrics = benchmarks ? [
    { label: "ROAS", shop: benchmarks.roas?.shop, industry: benchmarks.roas?.industry, delta: benchmarks.roas?.delta },
    { label: "CTR", shop: benchmarks.ctr?.shop, industry: benchmarks.ctr?.industry, delta: benchmarks.ctr?.delta },
    { label: "CPC", shop: benchmarks.cpc?.shop, industry: benchmarks.cpc?.industry, delta: benchmarks.cpc?.delta },
    { label: "Conv Rate", shop: benchmarks.convRate?.shop, industry: benchmarks.convRate?.industry, delta: benchmarks.convRate?.delta },
  ].filter(m => m.shop != null) : [];

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>📊</span>
        <span>You vs Industry</span>
        <button onClick={fetchBenchmarks} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, marginLeft: "auto" }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {metrics.length === 0 && !loading && !error && (
        <div style={dimText}>No benchmark data yet. Contribute anonymous data to see how you compare.</div>
      )}
      {metrics.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {metrics.map((m, i) => (
            <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={labelText}>{m.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor(m.delta || 0) }}>
                  {(m.delta || 0) >= 0 ? "+" : ""}{((m.delta || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, ((m.shop || 0) / Math.max(m.industry || 1, 0.01)) * 50)}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius: 3 }} />
                </div>
                <span style={{ ...dimText, minWidth: 80, textAlign: "right" }}>You: {typeof m.shop === "number" ? m.shop.toFixed(2) : "N/A"}</span>
                <span style={{ ...dimText, minWidth: 80, textAlign: "right" }}>Avg: {typeof m.industry === "number" ? m.industry.toFixed(2) : "N/A"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 6. FUNNEL WIDGET
// ════════════════════════════════════════════════════════════
export function FunnelWidget() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "queue");
      const res = await fetch("/app/api/funnel", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setQueue(data.result || []);
      else setError(data.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  const launchFunnel = useCallback(async () => {
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("action", "create");
      fd.append("funnelType", "full_store");
      fd.append("totalDailyBudget", "50");
      const res = await fetch("/app/api/funnel", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) fetchQueue();
      else setError(data.error || "Failed to create funnel");
    } catch (e: any) { setError(e.message); }
    setCreating(false);
  }, [fetchQueue]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const priorityColor = (p: number) => p >= 60 ? "#22c55e" : p >= 30 ? "#f59e0b" : "#ef4444";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🎯</span>
        <span>Full Funnel Orchestrator</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={launchFunnel} disabled={creating} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
            {creating ? "Creating..." : "Launch Funnel"}
          </button>
          <button onClick={fetchQueue} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11 }}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {queue.length === 0 && !loading && !error && (
        <div style={dimText}>No campaigns in queue. Launch a funnel to auto-create and manage campaigns.</div>
      )}
      {queue.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {queue.slice(0, 8).map((c: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{c.campaignName}</div>
                <div style={dimText}>ROAS: {c.roas?.toFixed(2) || "N/A"} · Budget: {formatCurrency(c.suggestedBudget || 0)}/day</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 40, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, c.priority || 0)}%`, height: "100%", background: priorityColor(c.priority || 0), borderRadius: 2 }} />
                </div>
                <span style={{ ...dimText, fontSize: 11 }}>P{Math.round(c.priority || 0)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
