/**
 * Advanced Engine Widgets — 8 new dashboard blocks for AI engines 11-18
 * Digital Twin, Agent Bidding, Weather Arbitrage, Review Creative,
 * Flash Sale, Search Sentinel, Performance Guard, Supply Chain
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

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ════════════════════════════════════════════════════════════
// 1. DIGITAL TWIN SIMULATOR WIDGET
// ════════════════════════════════════════════════════════════
export function DigitalTwinWidget() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState("500");
  const [error, setError] = useState("");

  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "simulate");
      fd.append("budget", budget);
      fd.append("durationDays", "30");
      const res = await fetch("/app/api/digital-twin", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setResult(data.result);
      else setError(data.error || "Simulation failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [budget]);

  const riskColor = (r: number) => r <= 30 ? "#22c55e" : r <= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🔮</span>
        <span>Digital Twin Simulator</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="Budget ($)"
          style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 13, outline: "none" }}
        />
        <button onClick={runSimulation} disabled={loading} style={{ ...btnStyle, padding: "6px 16px", fontSize: 12 }}>
          {loading ? "Simulating..." : "Run 1,000 Scenarios"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Predicted Revenue</div>
            <div style={valueText}>{formatCurrency(result.predictedRevenue || 0)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Predicted ROAS</div>
            <div style={valueText}>{(result.predictedRoas || 0).toFixed(2)}x</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Risk Score</div>
            <div style={{ ...valueText, color: riskColor(result.riskScore || 50) }}>{result.riskScore || 50}/100</div>
          </div>
          {result.scenarios && (
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <span style={dimText}>P10: {formatCurrency(result.scenarios.p10 || 0)}</span>
              <span style={dimText}>P25: {formatCurrency(result.scenarios.p25 || 0)}</span>
              <span style={{ ...labelText, fontWeight: 700 }}>P50: {formatCurrency(result.scenarios.p50 || 0)}</span>
              <span style={dimText}>P75: {formatCurrency(result.scenarios.p75 || 0)}</span>
              <span style={dimText}>P90: {formatCurrency(result.scenarios.p90 || 0)}</span>
            </div>
          )}
          {result.recommendation && (
            <div style={{ gridColumn: "1 / -1", padding: "8px 12px", background: "rgba(99,102,241,0.1)", borderRadius: 10 }}>
              <span style={{ ...labelText, fontWeight: 600 }}>AI Recommendation: </span>
              <span style={labelText}>{typeof result.recommendation === "string" ? result.recommendation : result.recommendation.reason || "N/A"}</span>
            </div>
          )}
        </div>
      )}
      {!result && !loading && !error && (
        <div style={dimText}>Enter a budget and run 1,000 Monte Carlo scenarios to predict campaign outcomes before spending a dollar.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 2. MULTI-AGENT BIDDING SYNDICATE WIDGET
// ════════════════════════════════════════════════════════════
export function AgentBiddingWidget() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "run");
      const res = await fetch("/app/api/agent-bidding", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setSession(data.result);
      else setError(data.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  const agentIcon = (name: string) => {
    if (name.toLowerCase().includes("conservative")) return "🛡️";
    if (name.toLowerCase().includes("aggressive")) return "⚔️";
    if (name.toLowerCase().includes("retention")) return "💎";
    return "🤖";
  };

  const voteColor = (rec: string) => {
    if (rec === "increase") return "#22c55e";
    if (rec === "decrease" || rec === "pause") return "#ef4444";
    return "#f59e0b";
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>⚔️</span>
        <span>Agent Bidding War Room</span>
        <button onClick={runSession} disabled={loading} style={{ ...btnStyle, marginLeft: "auto", padding: "4px 12px", fontSize: 11, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
          {loading ? "Agents Debating..." : "Run Agent Debate"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {session?.agentVotes && (
        <div style={{ display: "grid", gap: 8 }}>
          {(Array.isArray(session.agentVotes) ? session.agentVotes : []).map((v: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <span style={{ fontSize: 20 }}>{agentIcon(v.agent || "")}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{v.agent}</div>
                <div style={dimText}>{v.reasoning}</div>
              </div>
              <span style={badgeStyle(voteColor(v.recommendation || ""))}>
                {(v.recommendation || "").toUpperCase()}
              </span>
              <span style={dimText}>{((v.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
          ))}
          {session.consensus && (
            <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))", borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)" }}>
              <div style={{ color: "#a78bfa", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>CEO DECISION</div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{session.consensus.action?.toUpperCase()} — {session.consensus.reasoning}</div>
              {session.consensus.budget && <div style={dimText}>Budget: {formatCurrency(session.consensus.budget)}</div>}
            </div>
          )}
        </div>
      )}
      {!session && !loading && !error && (
        <div style={dimText}>3 AI agents (Conservative, Aggressive, Retention) debate your budget allocation. A CEO agent makes the final call.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 3. WEATHER & EVENT ARBITRAGE WIDGET
// ════════════════════════════════════════════════════════════
export function WeatherArbitrageWidget() {
  const [triggers, setTriggers] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [wRes, hRes] = await Promise.all([
        fetch("/app/api/weather", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "check_weather"); return fd; })() }),
        fetch("/app/api/weather", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "check_holidays"); return fd; })() }),
      ]);
      const wData = await wRes.json();
      const hData = await hRes.json();
      if (wData.success) setTriggers(Array.isArray(wData.result) ? wData.result : []);
      if (hData.success) setHolidays(Array.isArray(hData.result) ? hData.result : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weatherIcon = (condition: string) => {
    const c = (condition || "").toLowerCase();
    if (c.includes("snow")) return "❄️";
    if (c.includes("rain") || c.includes("storm")) return "🌧️";
    if (c.includes("heat") || c.includes("hot")) return "☀️";
    return "🌤️";
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🌦️</span>
        <span>Weather & Event Arbitrage</span>
        <button onClick={fetchData} disabled={loading} style={{ ...btnStyle, marginLeft: "auto", padding: "4px 12px", fontSize: 11 }}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {triggers.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelText, fontWeight: 600, marginBottom: 6 }}>Active Weather Triggers</div>
          {triggers.slice(0, 5).map((t: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 4 }}>
              <span>{weatherIcon(t.condition || t.triggerType)}</span>
              <span style={labelText}>{t.location || "US"}</span>
              <span style={dimText}>{t.condition || t.triggerType}</span>
              <span style={{ ...badgeStyle("#6366f1"), marginLeft: "auto" }}>{t.suggestedAction || "adjust"}</span>
            </div>
          ))}
        </div>
      )}
      {holidays.length > 0 && (
        <div>
          <div style={{ ...labelText, fontWeight: 600, marginBottom: 6 }}>Upcoming Holidays</div>
          {holidays.slice(0, 5).map((h: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 4 }}>
              <span>🎉</span>
              <span style={labelText}>{h.holiday}</span>
              <span style={badgeStyle(h.daysUntil <= 3 ? "#ef4444" : h.daysUntil <= 7 ? "#f59e0b" : "#22c55e")}>
                {h.daysUntil} days
              </span>
              <span style={{ ...dimText, marginLeft: "auto" }}>{h.suggestedAction}</span>
            </div>
          ))}
        </div>
      )}
      {triggers.length === 0 && holidays.length === 0 && !loading && !error && (
        <div style={dimText}>Monitoring weather conditions and upcoming events across major US cities to auto-adjust your campaigns.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 4. REVIEW-TO-CREATIVE WIDGET
// ════════════════════════════════════════════════════════════
export function ReviewCreativeWidget() {
  const [phrases, setPhrases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");

  const fetchPhrases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("action", "top_phrases");
      const res = await fetch("/app/api/review-creative", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) setPhrases(Array.isArray(data.result) ? data.result : []);
      else setError(data.error || "Failed");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  const extractReviews = useCallback(async () => {
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("action", "extract");
      const res = await fetch("/app/api/review-creative", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) fetchPhrases();
      else setError(data.error || "Extraction failed");
    } catch (e: any) { setError(e.message); }
    setExtracting(false);
  }, [fetchPhrases]);

  useEffect(() => { fetchPhrases(); }, [fetchPhrases]);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>💬</span>
        <span>Review-to-Creative Pipeline</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={extractReviews} disabled={extracting} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
            {extracting ? "Extracting..." : "Extract Reviews"}
          </button>
          <button onClick={fetchPhrases} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11 }}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {phrases.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {phrases.slice(0, 8).map((p: any, i: number) => (
            <div key={i} style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
              <div style={{ color: "#fff", fontSize: 13, fontStyle: "italic" }}>"{p.extractedPhrase || p.phrase}"</div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <span style={dimText}>{p.productTitle || p.product || ""}</span>
                {p.frequency > 1 && <span style={badgeStyle("#6366f1")}>x{p.frequency}</span>}
                {p.usedInAds > 0 && <span style={badgeStyle("#22c55e")}>Used in {p.usedInAds} ads</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {phrases.length === 0 && !loading && !error && (
        <div style={dimText}>Extract golden phrases from customer reviews and inject them directly into your ad copy.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 5. FLASH SALE WIDGET
// ════════════════════════════════════════════════════════════
export function FlashSaleWidget() {
  const [sales, setSales] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, cRes] = await Promise.all([
        fetch("/app/api/flash-sale", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "active"); return fd; })() }),
        fetch("/app/api/flash-sale", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "candidates"); return fd; })() }),
      ]);
      const aData = await aRes.json();
      const cData = await cRes.json();
      if (aData.success) setSales(Array.isArray(aData.result) ? aData.result : []);
      if (cData.success) setCandidates(Array.isArray(cData.result) ? cData.result : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>⚡</span>
        <span>Flash Sale Engine</span>
        <button onClick={fetchData} disabled={loading} style={{ ...btnStyle, marginLeft: "auto", padding: "4px 12px", fontSize: 11 }}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {sales.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelText, fontWeight: 600, marginBottom: 6, color: "#ef4444" }}>Active Flash Sales</div>
          {sales.slice(0, 4).map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(239,68,68,0.08)", borderRadius: 8, marginBottom: 4 }}>
              <span style={{ color: "#ef4444", fontWeight: 700, fontSize: 14 }}>-{s.discountPct || 0}%</span>
              <span style={labelText}>{s.productTitle}</span>
              <span style={{ ...dimText, marginLeft: "auto" }}>${s.salePrice?.toFixed(2)} (was ${s.originalPrice?.toFixed(2)})</span>
            </div>
          ))}
        </div>
      )}
      {candidates.length > 0 && (
        <div>
          <div style={{ ...labelText, fontWeight: 600, marginBottom: 6 }}>Sale Candidates</div>
          {candidates.slice(0, 5).map((c: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 4 }}>
              <span style={labelText}>{c.title}</span>
              <span style={badgeStyle("#f59e0b")}>{c.reason}</span>
              <span style={{ ...dimText, marginLeft: "auto" }}>-{c.suggestedDiscount}% suggested</span>
            </div>
          ))}
        </div>
      )}
      {sales.length === 0 && candidates.length === 0 && !loading && !error && (
        <div style={dimText}>Auto-detect slow inventory and launch synchronized flash sales with price drops + bid spikes.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 6. SEARCH SENTINEL WIDGET
// ════════════════════════════════════════════════════════════
export function SearchSentinelWidget() {
  const [findings, setFindings] = useState<any[]>([]);
  const [savings, setSavings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rRes, sRes] = await Promise.all([
        fetch("/app/api/search-sentinel", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "recent"); return fd; })() }),
        fetch("/app/api/search-sentinel", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "report"); return fd; })() }),
      ]);
      const rData = await rRes.json();
      const sData = await sRes.json();
      if (rData.success) setFindings(Array.isArray(rData.result) ? rData.result : []);
      if (sData.success) setSavings(sData.result);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("action", "scan");
      const res = await fetch("/app/api/search-sentinel", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) fetchData();
      else setError(data.error || "Scan failed");
    } catch (e: any) { setError(e.message); }
    setScanning(false);
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const wasteColor = (score: number) => score >= 70 ? "#ef4444" : score >= 40 ? "#f59e0b" : "#22c55e";

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🔍</span>
        <span>Silent Profit Sentinel</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button onClick={runScan} disabled={scanning} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
            {scanning ? "Scanning..." : "Scan Now"}
          </button>
          <button onClick={fetchData} disabled={loading} style={{ ...btnStyle, padding: "4px 12px", fontSize: 11 }}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {savings && (
        <div style={{ display: "flex", gap: 16, marginBottom: 12, padding: "10px 14px", background: "rgba(34,197,94,0.08)", borderRadius: 10 }}>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Total Saved</div>
            <div style={{ color: "#22c55e", fontSize: 20, fontWeight: 700 }}>{formatCurrency(savings.totalSaved || 0)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={dimText}>Terms Blocked</div>
            <div style={valueText}>{savings.totalBlocked || 0}</div>
          </div>
        </div>
      )}
      {findings.length > 0 && (
        <div style={{ display: "grid", gap: 4 }}>
          {findings.slice(0, 8).map((f: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: wasteColor(f.wasteScore || 0) }} />
              <span style={{ color: "#fff", fontSize: 12, flex: 1 }}>{f.searchTerm}</span>
              <span style={dimText}>${(f.cost || 0).toFixed(2)} waste</span>
              <span style={badgeStyle(wasteColor(f.wasteScore || 0))}>{f.actionTaken || "flagged"}</span>
            </div>
          ))}
        </div>
      )}
      {findings.length === 0 && !loading && !error && (
        <div style={dimText}>Hourly search term scanning blocks wasteful keywords before another dollar is spent.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 7. PERFORMANCE GUARD (INSURANCE) WIDGET
// ════════════════════════════════════════════════════════════
export function PerformanceGuardWidget() {
  const [guards, setGuards] = useState<any[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [hRes, sRes] = await Promise.all([
        fetch("/app/api/performance-guard", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "history"); return fd; })() }),
        fetch("/app/api/performance-guard", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "savings"); return fd; })() }),
      ]);
      const hData = await hRes.json();
      const sData = await sRes.json();
      if (hData.success) setGuards(Array.isArray(hData.result) ? hData.result : []);
      if (sData.success) setTotalSaved(sData.result?.totalSaved || 0);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const fd = new FormData();
      fd.append("action", "check");
      const res = await fetch("/app/api/performance-guard", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) fetchData();
      else setError(data.error || "Check failed");
    } catch (e: any) { setError(e.message); }
    setChecking(false);
  }, [fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const guardIcon = (type: string) => {
    if (type === "auto_pause") return "⏸️";
    if (type === "budget_cut") return "✂️";
    if (type === "bid_reduction") return "📉";
    return "⚠️";
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🛡️</span>
        <span>Performance Insurance</span>
        <button onClick={runCheck} disabled={checking} style={{ ...btnStyle, marginLeft: "auto", padding: "4px 12px", fontSize: 11, background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
          {checking ? "Checking..." : "Run Safety Check"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {totalSaved > 0 && (
        <div style={{ textAlign: "center", padding: "10px 0", marginBottom: 12, background: "rgba(34,197,94,0.08)", borderRadius: 10 }}>
          <div style={dimText}>Total Money Protected</div>
          <div style={{ color: "#22c55e", fontSize: 28, fontWeight: 700 }}>{formatCurrency(totalSaved)}</div>
        </div>
      )}
      {guards.length > 0 && (
        <div style={{ display: "grid", gap: 6 }}>
          {guards.slice(0, 6).map((g: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
              <span>{guardIcon(g.guardType)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{g.campaignName}</div>
                <div style={dimText}>{g.triggerMetric}: {g.actualValue?.toFixed(2)} (threshold: {g.triggerValue?.toFixed(2)})</div>
              </div>
              <span style={badgeStyle("#22c55e")}>{formatCurrency(g.moneySaved || 0)} saved</span>
            </div>
          ))}
        </div>
      )}
      {guards.length === 0 && !loading && !error && (
        <div style={dimText}>Auto-pauses campaigns predicted to lose money. Your money guardian that never sleeps.</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 8. SUPPLY CHAIN ADS WIDGET
// ════════════════════════════════════════════════════════════
export function SupplyChainWidget() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [preWarm, setPreWarm] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [aRes, pRes] = await Promise.all([
        fetch("/app/api/supply-chain", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "active"); return fd; })() }),
        fetch("/app/api/supply-chain", { method: "POST", body: (() => { const fd = new FormData(); fd.append("action", "pre_warm"); return fd; })() }),
      ]);
      const aData = await aRes.json();
      const pData = await pRes.json();
      if (aData.success) setShipments(Array.isArray(aData.result) ? aData.result : []);
      if (pData.success) setPreWarm(Array.isArray(pData.result) ? pData.result : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusIcon = (s: string) => {
    if (s === "arrived") return "✅";
    if (s === "in_transit") return "🚚";
    if (s === "pending") return "📦";
    return "⏳";
  };

  const statusColor = (s: string) => {
    if (s === "arrived") return "#22c55e";
    if (s === "in_transit") return "#f59e0b";
    return "#6366f1";
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🚚</span>
        <span>Supply Chain Ads</span>
        <button onClick={fetchData} disabled={loading} style={{ ...btnStyle, marginLeft: "auto", padding: "4px 12px", fontSize: 11 }}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 8 }}>{error}</div>}
      {shipments.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ ...labelText, fontWeight: 600, marginBottom: 6 }}>Tracked Shipments</div>
          {shipments.slice(0, 5).map((s: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 4 }}>
              <span>{statusIcon(s.status)}</span>
              <span style={labelText}>{s.productTitle}</span>
              <span style={badgeStyle(statusColor(s.status))}>{s.status}</span>
              {s.quantity > 0 && <span style={dimText}>{s.quantity} units</span>}
              {s.estimatedArrival && <span style={{ ...dimText, marginLeft: "auto" }}>ETA: {new Date(s.estimatedArrival).toLocaleDateString()}</span>}
            </div>
          ))}
        </div>
      )}
      {preWarm.length > 0 && (
        <div>
          <div style={{ ...labelText, fontWeight: 600, marginBottom: 6, color: "#f59e0b" }}>Ready to Pre-Warm</div>
          {preWarm.slice(0, 4).map((p: any, i: number) => (
            <div key={i} style={{ padding: "6px 10px", background: "rgba(245,158,11,0.08)", borderRadius: 8, marginBottom: 4 }}>
              <div style={labelText}>{p.title || p.productTitle}</div>
              <div style={dimText}>Arrives: {p.arrivalDate ? new Date(p.arrivalDate).toLocaleDateString() : "TBD"}</div>
            </div>
          ))}
        </div>
      )}
      {shipments.length === 0 && preWarm.length === 0 && !loading && !error && (
        <div style={dimText}>Track incoming shipments, auto-launch "Coming Soon" teasers, and spike bids the moment inventory arrives.</div>
      )}
    </div>
  );
}
