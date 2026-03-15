/**
 * Intelligence Dashboard — 4 widget blocks for deep intel features
 * Competitor profiles, keyword gaps, A/B tests, weekly reports
 */
import React, { useState, useEffect, useCallback } from "react";

// ── Types ──
interface CompetitorProfile {
  id: string;
  competitorDomain: string;
  healthScore: number;
  marketPosition: string;
  hiringSignal?: string | null;
  reviewRating?: number | null;
  reviewCount?: number | null;
  vulnerabilities: string;
  strengths: string;
  lastScrapedAt?: string | null;
  updatedAt: string;
}

interface CompetitorChange {
  id: string;
  competitorDomain: string;
  changeType: string;
  summary: string;
  severity: string;
  createdAt: string;
}

interface KeywordGap {
  id: string;
  keyword: string;
  source: string;
  estimatedVolume?: number | null;
  competitionLevel: string;
  opportunityScore: number;
  suggestedBid?: number | null;
  status: string;
}

interface ABTestData {
  id: string;
  campaignName: string;
  status: string;
  winnerId?: string | null;
  winnerReason?: string | null;
  confidenceLevel?: number | null;
  triggerReason: string;
  startedAt: string;
  endedAt?: string | null;
  variations: string;
}

interface WeeklyReportData {
  id: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  performanceGrade: string;
  totalSpend: number;
  totalRevenue: number;
  totalActions: number;
  competitorChanges: number;
  reportJson: string;
  createdAt: string;
}

// ── Styles ──
const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 16,
  padding: "20px 24px",
  marginBottom: 20,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,.4)",
  marginTop: 2,
};

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 6,
  background: `${color}18`,
  color,
});

const itemCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 12,
  padding: "12px 16px",
  marginBottom: 8,
};

const emptyStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "24px 16px",
  color: "rgba(255,255,255,.3)",
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const loadingStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px",
  color: "rgba(255,255,255,.3)",
  fontSize: 13,
};

// ── Helpers ──
function parseJsonSafe<T>(str: string, fallback: T): T {
  try { return JSON.parse(str); } catch { return fallback; }
}

function healthColor(score: number): string {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#22c55e";
  if (grade.startsWith("B")) return "#6366f1";
  if (grade.startsWith("C")) return "#f59e0b";
  return "#ef4444";
}

function severityColor(sev: string): string {
  if (sev === "high") return "#ef4444";
  if (sev === "medium") return "#f59e0b";
  return "#94a3b8";
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  } catch { return d; }
}

function hiringLabel(signal?: string | null): { text: string; color: string } {
  if (signal === "growing") return { text: "Growing", color: "#22c55e" };
  if (signal === "shrinking") return { text: "Shrinking", color: "#ef4444" };
  return { text: "Stable", color: "#94a3b8" };
}

// ═══════════════════════════════════════════════
// 1. Competitor Intelligence Widget
// ═══════════════════════════════════════════════
export function CompetitorIntelWidget({ shopDomain }: { shopDomain: string }) {
  const [profiles, setProfiles] = useState<CompetitorProfile[]>([]);
  const [changes, setChanges] = useState<CompetitorChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<"profiles" | "changes">("profiles");

  const fetchData = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/app/api/competitor-deep", {
          method: "POST",
          body: new URLSearchParams({ action: "get_profiles" }),
        }),
        fetch("/app/api/competitor-deep", {
          method: "POST",
          body: new URLSearchParams({ action: "get_changes", days: "30" }),
        }),
      ]);
      const pData = await pRes.json();
      const cData = await cRes.json();
      if (pData.success) setProfiles(pData.profiles || []);
      if (cData.success) setChanges(cData.changes || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeepScan = async () => {
    setScanning(true);
    try {
      await fetch("/app/api/competitor-deep", {
        method: "POST",
        body: new URLSearchParams({ action: "deep_scan" }),
      });
      await fetchData();
    } catch { /* silent */ }
    setScanning(false);
  };

  if (loading) return <div style={cardStyle}><div style={loadingStyle}>Loading business intelligence...</div></div>;

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            <span style={{ fontSize: 20 }}>🕵️</span>
            Deep Business Intelligence
          </div>
          <div style={subtitleStyle}>
            {profiles.length > 0
              ? `${profiles.length} competitors tracked`
              : "Run a deep scan to build intel profiles"}
          </div>
        </div>
        <button style={{ ...btnStyle, opacity: scanning ? 0.6 : 1 }} onClick={handleDeepScan} disabled={scanning}>
          {scanning ? "Scanning..." : "Deep Scan"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button
          onClick={() => setTab("profiles")}
          style={{
            ...btnStyle,
            background: tab === "profiles" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,.06)",
            fontSize: 12,
            padding: "5px 12px",
          }}
        >
          Profiles ({profiles.length})
        </button>
        <button
          onClick={() => setTab("changes")}
          style={{
            ...btnStyle,
            background: tab === "changes" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,.06)",
            fontSize: 12,
            padding: "5px 12px",
          }}
        >
          Changes ({changes.length})
        </button>
      </div>

      {tab === "profiles" && (
        profiles.length === 0 ? (
          <div style={emptyStyle}>No competitors tracked yet. Click "Deep Scan" to get started.</div>
        ) : (
          profiles.slice(0, 6).map((p) => {
            const vulns = parseJsonSafe<string[]>(p.vulnerabilities, []);
            const strs = parseJsonSafe<string[]>(p.strengths, []);
            const hiring = hiringLabel(p.hiringSignal);
            return (
              <div key={p.id} style={itemCardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${p.competitorDomain}&sz=16`}
                      alt=""
                      style={{ width: 16, height: 16, borderRadius: 2 }}
                      onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{p.competitorDomain}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={badgeStyle(hiring.color)}>{hiring.text}</span>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      border: `3px solid ${healthColor(p.healthScore)}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: healthColor(p.healthScore),
                    }}>
                      {p.healthScore}
                    </div>
                  </div>
                </div>
                {p.reviewRating != null && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 4 }}>
                    {"★".repeat(Math.round(p.reviewRating))}{"☆".repeat(5 - Math.round(p.reviewRating))}
                    {" "}{p.reviewRating.toFixed(1)} ({p.reviewCount || 0} reviews)
                  </div>
                )}
                {vulns.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {vulns.slice(0, 3).map((v, i) => (
                      <span key={i} style={{ ...badgeStyle("#22c55e"), fontSize: 10 }}>
                        {v}
                      </span>
                    ))}
                  </div>
                )}
                {strs.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {strs.slice(0, 2).map((s, i) => (
                      <span key={i} style={{ ...badgeStyle("#ef4444"), fontSize: 10 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )
      )}

      {tab === "changes" && (
        changes.length === 0 ? (
          <div style={emptyStyle}>No changes detected yet. After the first scan, the system will track all changes automatically.</div>
        ) : (
          changes.slice(0, 8).map((c) => (
            <div key={c.id} style={{ ...itemCardStyle, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: severityColor(c.severity),
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{c.summary}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 2 }}>
                  {c.competitorDomain} · {formatDate(c.createdAt)}
                </div>
              </div>
              <span style={badgeStyle(severityColor(c.severity))}>
                {c.severity === "high" ? "Urgent" : c.severity === "medium" ? "Medium" : "Low"}
              </span>
            </div>
          ))
        )
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 2. Keyword Gap Widget
// ═══════════════════════════════════════════════
export function KeywordGapWidget() {
  const [gaps, setGaps] = useState<KeywordGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchGaps = useCallback(async () => {
    try {
      const res = await fetch("/app/api/competitor-deep", {
        method: "POST",
        body: new URLSearchParams({ action: "get_gaps" }),
      });
      const data = await res.json();
      if (data.success) setGaps(data.gaps || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGaps(); }, [fetchGaps]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch("/app/api/competitor-deep", {
        method: "POST",
        body: new URLSearchParams({ action: "gap_analysis" }),
      });
      await fetchGaps();
    } catch { /* silent */ }
    setAnalyzing(false);
  };

  if (loading) return <div style={cardStyle}><div style={loadingStyle}>Loading keyword gaps...</div></div>;

  const topGaps = gaps.filter(g => g.status === "new").sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 10);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            <span style={{ fontSize: 20 }}>🔑</span>
            Keyword Gap Analysis
          </div>
          <div style={subtitleStyle}>
            Keywords your competitors are bidding on that you're not
          </div>
        </div>
        <button style={{ ...btnStyle, opacity: analyzing ? 0.6 : 1 }} onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? "Analyzing..." : "Run Gap Analysis"}
        </button>
      </div>

      {topGaps.length === 0 ? (
        <div style={emptyStyle}>No keyword gaps found yet. Click "Run Gap Analysis" after competitors are tracked.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {topGaps.map((g) => (
            <div key={g.id} style={itemCardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{g.keyword}</span>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: g.opportunityScore >= 70 ? "rgba(34,197,94,.15)" : g.opportunityScore >= 40 ? "rgba(245,158,11,.15)" : "rgba(148,163,184,.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: g.opportunityScore >= 70 ? "#22c55e" : g.opportunityScore >= 40 ? "#f59e0b" : "#94a3b8",
                }}>
                  {g.opportunityScore}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
                <span>Source: {g.source}</span>
                {g.suggestedBid != null && <span>Bid: ${g.suggestedBid.toFixed(2)}</span>}
                {g.estimatedVolume != null && <span>{g.estimatedVolume.toLocaleString()} searches</span>}
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={badgeStyle(
                  g.competitionLevel === "low" ? "#22c55e" : g.competitionLevel === "high" ? "#ef4444" : "#f59e0b"
                )}>
                  {g.competitionLevel === "low" ? "Low Competition" : g.competitionLevel === "high" ? "High Competition" : "Medium Competition"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 3. A/B Testing Widget
// ═══════════════════════════════════════════════
export function ABTestWidget() {
  const [tests, setTests] = useState<ABTestData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/app/api/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ab_tests" }),
        });
        const data = await res.json();
        if (data.success) setTests(data.tests || []);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={cardStyle}><div style={loadingStyle}>Loading A/B tests...</div></div>;

  const running = tests.filter(t => t.status === "running");
  const completed = tests.filter(t => t.status !== "running");

  const statusLabel = (s: string) => {
    if (s === "running") return { text: "Running", color: "#6366f1" };
    if (s === "winner_found") return { text: "Winner Found", color: "#22c55e" };
    if (s === "no_winner") return { text: "No Winner", color: "#f59e0b" };
    return { text: s, color: "#94a3b8" };
  };

  const triggerLabel = (t: string) => {
    if (t === "creative_fatigue") return "Creative Fatigue";
    if (t === "low_ctr") return "Low CTR";
    if (t === "manual") return "Manual";
    return t;
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            <span style={{ fontSize: 20 }}>🧪</span>
            A/B Tests
          </div>
          <div style={subtitleStyle}>
            {running.length > 0
              ? `${running.length} test${running.length !== 1 ? "s" : ""} currently running`
              : "Tests are created automatically when ad fatigue is detected"}
          </div>
        </div>
        {running.length > 0 && (
          <span style={badgeStyle("#6366f1")}>
            {running.length} Active
          </span>
        )}
      </div>

      {tests.length === 0 ? (
        <div style={emptyStyle}>No A/B tests yet. The system will create tests automatically when ad fatigue is detected.</div>
      ) : (
        <>
          {tests.slice(0, 6).map((t) => {
            const st = statusLabel(t.status);
            const vars = parseJsonSafe<any[]>(t.variations, []);
            return (
              <div key={t.id} style={itemCardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                      {t.campaignName || "Campaign"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 1 }}>
                      Trigger: {triggerLabel(t.triggerReason)} · Started {formatDate(t.startedAt)}
                    </div>
                  </div>
                  <span style={badgeStyle(st.color)}>{st.text}</span>
                </div>
                {/* Variations mini-bar */}
                <div style={{ display: "flex", gap: 4 }}>
                  {vars.slice(0, 3).map((v: any, i: number) => (
                    <div key={i} style={{
                      flex: 1,
                      background: t.winnerId === v.id ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.04)",
                      border: `1px solid ${t.winnerId === v.id ? "rgba(34,197,94,.3)" : "rgba(255,255,255,.06)"}`,
                      borderRadius: 8,
                      padding: "6px 8px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", marginBottom: 2 }}>
                        {v.isOriginal ? "Original" : `Variant ${i}`}
                        {t.winnerId === v.id && " 🏆"}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>
                        {v.ctr != null ? `${(v.ctr * 100).toFixed(1)}%` : "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
                        {v.impressions != null ? `${v.impressions} views` : "Pending"}
                      </div>
                    </div>
                  ))}
                </div>
                {t.winnerReason && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginTop: 6, fontStyle: "italic" }}>
                    {t.winnerReason}
                  </div>
                )}
                {t.confidenceLevel != null && t.confidenceLevel > 0 && (
                  <div style={{ fontSize: 11, color: "#6366f1", marginTop: 2 }}>
                    Confidence: {(t.confidenceLevel * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 4. Weekly Report Widget
// ═══════════════════════════════════════════════
export function WeeklyReportWidget() {
  const [reports, setReports] = useState<WeeklyReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch("/app/api/weekly-report", {
        method: "POST",
        body: new URLSearchParams({ action: "list", limit: "4" }),
      });
      const data = await res.json();
      if (data.success) setReports(data.reports || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await fetch("/app/api/weekly-report", {
        method: "POST",
        body: new URLSearchParams({ action: "generate" }),
      });
      await fetchReports();
    } catch { /* silent */ }
    setGenerating(false);
  };

  if (loading) return <div style={cardStyle}><div style={loadingStyle}>Loading weekly reports...</div></div>;

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>
            <span style={{ fontSize: 20 }}>📊</span>
            Weekly Reports
          </div>
          <div style={subtitleStyle}>
            Automated agency-style report — every Sunday
          </div>
        </div>
        <button style={{ ...btnStyle, opacity: generating ? 0.6 : 1 }} onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate Report"}
        </button>
      </div>

      {reports.length === 0 ? (
        <div style={emptyStyle}>No reports yet. The first report will be generated automatically on Sunday, or click "Generate Report" now.</div>
      ) : (
        reports.map((r) => {
          const isExpanded = expanded === r.id;
          let reportData: any = null;
          if (isExpanded) {
            reportData = parseJsonSafe(r.reportJson, null);
          }
          return (
            <div key={r.id} style={{ ...itemCardStyle, cursor: "pointer" }} onClick={() => setExpanded(isExpanded ? null : r.id)}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: `${gradeColor(r.performanceGrade)}18`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 800,
                    color: gradeColor(r.performanceGrade),
                  }}>
                    {r.performanceGrade}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                      Week {formatDate(r.weekStart)} — {formatDate(r.weekEnd)}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 1 }}>
                      {r.summary.length > 80 ? r.summary.slice(0, 80) + "..." : r.summary}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      ${r.totalSpend.toFixed(0)}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Spend</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                      ${r.totalRevenue.toFixed(0)}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Revenue</div>
                  </div>
                  <span style={{ fontSize: 16, color: "rgba(255,255,255,.3)", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
                </div>
              </div>

              {isExpanded && reportData && (
                <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 12 }} onClick={(e) => e.stopPropagation()}>
                  {reportData.executive_summary && (
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginBottom: 12, lineHeight: 1.6 }}>
                      {reportData.executive_summary}
                    </div>
                  )}
                  {reportData.what_ai_did && reportData.what_ai_did.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#a5b4fc", marginBottom: 4 }}>What AI Did This Week:</div>
                      {reportData.what_ai_did.slice(0, 5).map((item: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,.5)", paddingLeft: 12, marginBottom: 2 }}>• {item}</div>
                      ))}
                    </div>
                  )}
                  {reportData.next_week_plan && reportData.next_week_plan.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginBottom: 4 }}>Next Week Plan:</div>
                      {reportData.next_week_plan.slice(0, 4).map((item: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,.5)", paddingLeft: 12, marginBottom: 2 }}>• {item}</div>
                      ))}
                    </div>
                  )}
                  {reportData.money_summary && (
                    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {reportData.money_summary.roas != null && (
                        <span style={badgeStyle("#6366f1")}>ROAS: {reportData.money_summary.roas}x</span>
                      )}
                      {reportData.money_summary.verdict && (
                        <span style={badgeStyle("#22c55e")}>{reportData.money_summary.verdict}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
