/**
 * Revolutionary Engine Widgets — 5 dashboard blocks for AI engines 19-23
 * Competitor Strike, Ghost Campaign, Life Moment, Bid Arbitrage, Currency Margin
 */
import React, { useState, useEffect, useCallback } from "react";

// ── Shared Styles ──
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.04)",
};

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ════════════════════════════════════════════════════════════
// 1. COMPETITOR STRIKE WIDGET (Engine 19)
// ════════════════════════════════════════════════════════════
export function CompetitorStrikeWidget() {
  const [strikes, setStrikes] = useState<any[]>([]);
  const [weaknesses, setWeaknesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStrikes = useCallback(async () => {
    try {
      const fd = new FormData();
      fd.append("action", "list");
      const res = await fetch("/app/api/competitor-strike", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setStrikes(data.strikes || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadStrikes(); }, [loadStrikes]);

  const scanWeaknesses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "weaknesses");
      const res = await fetch("/app/api/competitor-strike", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setWeaknesses(data.weaknesses || []);
      else setError(data.error || "Scan failed");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    setLoading(false);
  }, []);

  const statusColor: Record<string, string> = {
    planned: "#f59e0b",
    active: "#6366f1",
    completed: "#22c55e",
    cancelled: "#64748b",
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>⚔️</span>
        <span>Predatory Competitor Strike</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={scanWeaknesses} disabled={loading} style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}>
          {loading ? "Scanning..." : "Scan Weaknesses"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {weaknesses.length > 0 && (
        <div style={{ marginBottom: 12, padding: 10, background: "rgba(99,102,241,0.08)", borderRadius: 10 }}>
          <div style={{ ...labelText, marginBottom: 6 }}>Discovered Weaknesses</div>
          {weaknesses.slice(0, 5).map((w: any, i: number) => (
            <div key={i} style={rowStyle}>
              <span style={labelText}>{w.competitor || w.domain || "Unknown"}</span>
              <span style={badgeStyle("#f59e0b")}>{w.weakness || w.type || "Gap"}</span>
              <span style={dimText}>Score: {w.score || w.opportunityScore || "N/A"}</span>
            </div>
          ))}
        </div>
      )}
      {strikes.length > 0 ? (
        strikes.slice(0, 5).map((s: any) => (
          <div key={s.id} style={rowStyle}>
            <div>
              <div style={labelText}>{s.competitorDomain}</div>
              <div style={dimText}>{s.strikeType}</div>
            </div>
            <span style={badgeStyle(statusColor[s.status] || "#64748b")}>{s.status}</span>
          </div>
        ))
      ) : (
        !weaknesses.length && <div style={dimText}>No strikes yet. Scan for weaknesses to get started.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 2. GHOST CAMPAIGN WIDGET (Engine 20)
// ════════════════════════════════════════════════════════════
export function GhostCampaignWidget() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOpportunities = useCallback(async () => {
    try {
      const fd = new FormData();
      fd.append("action", "list");
      const res = await fetch("/app/api/ghost-campaign", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setOpportunities(data.opportunities || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadOpportunities(); }, [loadOpportunities]);

  const discover = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "discover");
      const res = await fetch("/app/api/ghost-campaign", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        setOpportunities(data.opportunities || []);
      } else setError(data.error || "Discovery failed");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    setLoading(false);
  }, []);

  const statusColor: Record<string, string> = {
    discovered: "#6366f1",
    testing: "#f59e0b",
    validated: "#22c55e",
    rejected: "#ef4444",
  };

  const scoreColor = (s: number) => s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#64748b";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>👻</span>
        <span>Ghost Campaign Discovery</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={discover} disabled={loading} style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}>
          {loading ? "Discovering..." : "Discover Opportunities"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {opportunities.length > 0 ? (
        opportunities.slice(0, 8).map((o: any) => (
          <div key={o.id} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={labelText}>{o.keyword}</div>
              <div style={dimText}>
                {o.discoveryType} · Vol: {o.searchVolume || "?"} · CPC: ${o.estimatedCpc?.toFixed(2) || "?"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ ...valueText, fontSize: 14, color: scoreColor(o.opportunityScore) }}>
                {o.opportunityScore}
              </span>
              <span style={badgeStyle(statusColor[o.status] || "#64748b")}>{o.status}</span>
            </div>
          </div>
        ))
      ) : (
        <div style={dimText}>No ghost opportunities yet. Run discovery to find untapped niches.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 3. LIFE MOMENT WIDGET (Engine 21)
// ════════════════════════════════════════════════════════════
export function LifeMomentWidget() {
  const [moments, setMoments] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [momentsRes, campaignsRes] = await Promise.all([
        fetch("/app/api/life-moment", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "upcoming"); return fd; })() }),
        fetch("/app/api/life-moment", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "list"); return fd; })() }),
      ]);
      const momentsData = await momentsRes.json();
      const campaignsData = await campaignsRes.json();
      if (momentsData.success) setMoments(momentsData.moments || []);
      if (campaignsData.success) setCampaigns(campaignsData.campaigns || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const detect = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "detect");
      const res = await fetch("/app/api/life-moment", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setMoments(data.moments || []);
      else setError(data.error || "Detection failed");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    setLoading(false);
  }, []);

  const momentEmoji: Record<string, string> = {
    wedding: "💒", baby: "👶", moving: "🏠", graduation: "🎓",
    holiday: "🎄", back_to_school: "📚", new_job: "💼", retirement: "🌴",
  };

  const statusColor: Record<string, string> = {
    draft: "#64748b", active: "#22c55e", paused: "#f59e0b", completed: "#6366f1",
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🎯</span>
        <span>Life Moment Targeting</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={detect} disabled={loading} style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}>
          {loading ? "Detecting..." : "Detect Moments"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      {moments.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelText, marginBottom: 6 }}>Upcoming Moments</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {moments.slice(0, 8).map((m: any, i: number) => (
              <div key={i} style={{ ...badgeStyle("#6366f1"), padding: "4px 10px", fontSize: 12 }}>
                {momentEmoji[m.momentType] || "📅"} {m.label || m.momentType}
              </div>
            ))}
          </div>
        </div>
      )}

      {campaigns.length > 0 ? (
        campaigns.slice(0, 5).map((c: any) => (
          <div key={c.id} style={rowStyle}>
            <div>
              <div style={labelText}>
                {momentEmoji[c.momentType] || "📅"} {c.momentType}
              </div>
              <div style={dimText}>
                {(() => { try { return JSON.parse(c.productIds || "[]").length; } catch { return 0; } })()} products
              </div>
            </div>
            <span style={badgeStyle(statusColor[c.status] || "#64748b")}>{c.status}</span>
          </div>
        ))
      ) : (
        !moments.length && <div style={dimText}>No life moment campaigns yet. Detect moments to find opportunities.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 4. BID ARBITRAGE WIDGET (Engine 22)
// ════════════════════════════════════════════════════════════
export function BidArbitrageWidget() {
  const [windows, setWindows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadWindows = useCallback(async () => {
    try {
      const fd = new FormData();
      fd.append("action", "list");
      const res = await fetch("/app/api/bid-arbitrage", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setWindows(data.result || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadWindows(); }, [loadWindows]);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "analyze");
      const res = await fetch("/app/api/bid-arbitrage", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) loadWindows();
      else setError(data.error || "Analysis failed");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    setLoading(false);
  }, [loadWindows]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const arbitrageWindows = windows.filter((w: any) => w.isArbitrage);
  const totalSavings = arbitrageWindows.reduce((sum: number, w: any) => sum + (w.avgCpc * w.sampleSize * 0.2), 0);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>⏰</span>
        <span>Bid Time Arbitrage</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={analyze} disabled={loading} style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}>
          {loading ? "Analyzing..." : "Analyze Hourly Data"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      {arbitrageWindows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Arbitrage Windows</div>
            <div style={{ ...valueText, color: "#22c55e" }}>{arbitrageWindows.length}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Avg CPC Savings</div>
            <div style={{ ...valueText, color: "#22c55e" }}>
              {arbitrageWindows.length > 0 ? `$${(arbitrageWindows.reduce((s: number, w: any) => s + w.avgCpc, 0) / arbitrageWindows.length).toFixed(2)}` : "$0"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Est. Monthly Savings</div>
            <div style={{ ...valueText, color: "#22c55e" }}>{formatCurrency(totalSavings)}</div>
          </div>
        </div>
      )}

      {windows.length > 0 ? (
        <div>
          <div style={{ ...labelText, marginBottom: 6 }}>Best Time Windows</div>
          {arbitrageWindows.slice(0, 6).map((w: any) => (
            <div key={w.id} style={rowStyle}>
              <div>
                <div style={labelText}>
                  {dayNames[w.dayOfWeek]} {w.hourStart}:00–{w.hourEnd}:00
                </div>
                <div style={dimText}>
                  CPC: ${w.avgCpc?.toFixed(2)} · Conv: {((w.avgConvRate || 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={badgeStyle("#22c55e")}>
                  {w.bidMultiplier > 1 ? `+${((w.bidMultiplier - 1) * 100).toFixed(0)}%` : "Arbitrage"}
                </span>
                <span style={dimText}>{w.sampleSize} clicks</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={dimText}>No arbitrage windows yet. Analyze hourly performance to find opportunities.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 5. CURRENCY MARGIN WIDGET (Engine 23)
// ════════════════════════════════════════════════════════════
export function CurrencyMarginWidget() {
  const [events, setEvents] = useState<any[]>([]);
  const [rates, setRates] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async () => {
    try {
      const fd = new FormData();
      fd.append("action", "list");
      const res = await fetch("/app/api/currency-margin", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setEvents(data.events || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const checkRates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "rates");
      const res = await fetch("/app/api/currency-margin", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setRates(data.rates || data);
      else setError(data.error || "Rate check failed");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Error"); }
    setLoading(false);
  }, []);

  const eventEmoji: Record<string, string> = {
    favorable_rate: "📈",
    margin_squeeze: "📉",
    arbitrage_opportunity: "💰",
    price_adjustment: "🏷️",
  };

  const eventColor: Record<string, string> = {
    favorable_rate: "#22c55e",
    margin_squeeze: "#ef4444",
    arbitrage_opportunity: "#6366f1",
    price_adjustment: "#f59e0b",
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>💱</span>
        <span>Currency & Margin Optimizer</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={checkRates} disabled={loading} style={{ ...btnStyle, fontSize: 12, padding: "6px 14px" }}>
          {loading ? "Checking..." : "Check Rates"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}

      {rates && rates.baseCurrency && (
        <div style={{ marginBottom: 12, padding: 10, background: "rgba(99,102,241,0.08)", borderRadius: 10 }}>
          <div style={{ ...labelText, marginBottom: 6 }}>Current Rates ({rates.baseCurrency})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(rates.rates || {}).slice(0, 6).map(([currency, rate]: [string, any]) => (
              <div key={currency} style={{ ...badgeStyle("#6366f1"), padding: "4px 10px" }}>
                {currency}: {typeof rate === "number" ? rate.toFixed(4) : rate}
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length > 0 ? (
        events.slice(0, 6).map((e: any) => (
          <div key={e.id} style={rowStyle}>
            <div>
              <div style={labelText}>
                {eventEmoji[e.eventType] || "📊"} {e.fromCurrency} → {e.toCurrency}
              </div>
              <div style={dimText}>
                Rate: {e.exchangeRate?.toFixed(4)}
                {e.marginImpactPct != null && ` · Impact: ${formatPct(e.marginImpactPct)}`}
              </div>
            </div>
            <span style={badgeStyle(eventColor[e.eventType] || "#64748b")}>{e.eventType.replace(/_/g, " ")}</span>
          </div>
        ))
      ) : (
        <div style={dimText}>No currency events yet. Check rates to start monitoring.</div>
      )}
    </div>
  );
}
