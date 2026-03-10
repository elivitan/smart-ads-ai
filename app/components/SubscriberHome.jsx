// SubscriberHome.jsx — Home page for paid subscribers
// ALL STYLING IS INLINE — no <style> tags, no CSS classes, no hydration issues
// PROPS: real data from Index(), plus callbacks

import React, { useState, useEffect } from "react";
import {
  Target, MousePointerClick, DollarSign, BarChart3, KeyRound,
  Brain, ArrowRight, AlertTriangle, AlertCircle, Rocket,
  Trophy, TrendingUp, TrendingDown, Swords, Search,
  ChevronRight, Zap, Globe, ShieldAlert, LayoutDashboard,
  Eye, Package, Crown, Star, Gem
} from "lucide-react";

// ── Helpers ──

function AnimNum({ end, pre = "", suf = "" }) {
  const [v, setV] = useState(0);
  const hasAnimated = React.useRef(false);
  useEffect(() => {
    if (end === 0) { setV(0); return; }
    if (hasAnimated.current) { setV(end); return; }
    hasAnimated.current = true;
    let frame;
    const duration = 1000;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setV(progress * end);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [end]);
  return <span>{pre}{end % 1 !== 0 ? v.toFixed(1) : Math.round(v)}{suf}</span>;
}

function ScoreRing({ score, size = 42 }) {
  const r = (size - 5) / 2, c = 2 * Math.PI * r;
  const col = score >= 80 ? "#059669" : score >= 60 ? "#d97706" : "#dc2626";
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="4"
        strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill="#1e293b" fontSize="11" fontWeight="800">{score}</text>
    </svg>
  );
}

// ── Plan badge config ──
const PLAN_CONFIG = {
  starter: { label: "STARTER", icon: Star, color: "#0ea5e9", bg: "rgba(14,165,233,.06)", border: "rgba(14,165,233,.15)" },
  pro: { label: "PRO", icon: Crown, color: "#7c3aed", bg: "rgba(109,40,217,.06)", border: "rgba(109,40,217,.15)" },
  premium: { label: "PREMIUM", icon: Gem, color: "#d97706", bg: "rgba(217,119,6,.06)", border: "rgba(217,119,6,.15)" },
};

// ── Shared inline style fragments ──
const btnBase = { border: "none", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 };
const btnSecondary = { ...btnBase, background: "#fff", border: "1px solid #e2e8f0", color: "#475569", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const btnPrimary = { ...btnBase, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(109,40,217,.25)" };
const card = { background: "#fff", border: "1px solid #e8eaef", borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,.03), 0 1px 2px rgba(0,0,0,.02)", position: "relative", overflow: "hidden" };

// ── Main Component ──

export function SubscriberHome({
  selectedPlan, shopDomain, analyzedDbProducts, totalProducts,
  analyzedCount, avgScore, topCompetitors, liveAds,
  keywordGaps, totalMonthlyGapLoss,
  onOpenDashboard, onScan, onLaunch, onBuyCredits,
}) {
  const [vis, setVis] = useState(false);
  const [greet, setGreet] = useState("Good morning");

  useEffect(() => {
    const h = new Date().getHours();
    setGreet(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    setTimeout(() => setVis(true), 60);
  }, []);

  const anim = (delay) => ({
    opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(10px)",
    transition: `all .5s cubic-bezier(.16,1,.3,1) ${delay}ms`,
  });

  // ── Derived data ──
  const plan = (selectedPlan || "starter").toLowerCase();
  const planCfg = PLAN_CONFIG[plan] || PLAN_CONFIG.starter;
  const PlanIcon = planCfg.icon;
  const storeName = shopDomain ? shopDomain.replace(".myshopify.com", "") : "Your Store";

  const highPotential = analyzedDbProducts.filter(p => (p.aiAnalysis?.ad_score || 0) >= 70).length;
  const competitorThreat = avgScore >= 70 ? "Low" : avgScore >= 50 ? "Moderate" : "High";
  const threatColor = { Low: "#059669", Moderate: "#d97706", High: "#dc2626" }[competitorThreat];
  const googleRank = avgScore >= 70 ? "Page 1" : avgScore >= 50 ? "Page 2-3" : "Page 3+";
  const rankTrending = avgScore >= 55;

  const mockCampaigns = analyzedCount > 0 ? Math.min(Math.floor(analyzedCount * 0.6), 12) : 0;
  const mockClicks = liveAds?.clicks || Math.round(analyzedCount * 38);
  const mockRoas = analyzedCount > 0 ? parseFloat((1.8 + avgScore * 0.028).toFixed(1)) : 0;
  const mockSpend = liveAds?.spend || Math.round(analyzedCount * 8.5);
  const gapCount = keywordGaps?.length || Math.max(Math.round((100 - avgScore) / 12), 1);
  const gapLoss = totalMonthlyGapLoss || gapCount * 520;

  const topProducts = [...analyzedDbProducts]
    .sort((a, b) => (b.aiAnalysis?.ad_score || 0) - (a.aiAnalysis?.ad_score || 0))
    .slice(0, 3);

  const topGapKeyword = keywordGaps?.[0]?.keyword || topCompetitors?.[0]?.domain?.replace("www.", "") || "competitor keywords";

  // AI recommendation
  let aiTip = "";
  if (avgScore < 50) aiTip = `Your average score is ${avgScore}/100 — most products need optimization. Running a full scan will identify quick wins.`;
  else if (gapCount > 5) aiTip = `Found ${gapCount} keyword gaps where competitors rank and you don't. Closing the top 3 gaps could recover ~$${Math.round(gapLoss * 0.4).toLocaleString()}/mo in lost traffic.`;
  else if (highPotential > 3) aiTip = `You have ${highPotential} high-potential products scoring 70+. Launching campaigns for the top 5 could generate an estimated ${mockRoas}x ROAS.`;
  else aiTip = `Your store is performing well with an avg score of ${avgScore}/100. Consider increasing budget on your top products to capture more market share.`;

  // Urgent actions
  const alerts = [];
  if (gapCount > 3) alerts.push({ t: `${gapCount} keyword gaps vs competitors`, s: "bad", a: "Fix Gaps" });
  if (analyzedCount < totalProducts) alerts.push({ t: `${totalProducts - analyzedCount} products not yet analyzed`, s: "warn", a: "Scan Now" });
  if (highPotential > 0) alerts.push({ t: `${highPotential} products ready to launch`, s: "good", a: "Launch" });
  if (alerts.length === 0) alerts.push({ t: "All systems running smoothly", s: "good", a: "Dashboard" });

  const alertIcons = { bad: <AlertCircle size={14} />, warn: <AlertTriangle size={14} />, good: <Rocket size={14} /> };
  const alertStyles = {
    bad: { bg: "#fef2f2", border: "#fee2e2", iconColor: "#ef4444", text: "#991b1b", tag: "#fecaca" },
    warn: { bg: "#fffbeb", border: "#fef3c7", iconColor: "#f59e0b", text: "#92400e", tag: "#fde68a" },
    good: { bg: "#f0fdf4", border: "#dcfce7", iconColor: "#22c55e", text: "#166534", tag: "#bbf7d0" },
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(165deg, #fafbfe 0%, #f1f4fb 40%, #f6f4fb 70%, #faf8fc 100%)",
      fontFamily: "'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif",
      color: "#1e293b",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap" rel="stylesheet"/>

      {/* Ambient */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse at 0% 0%, rgba(99,102,241,.04), transparent 40%), radial-gradient(ellipse at 100% 100%, rgba(168,85,247,.03), transparent 40%)",
      }}/>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1060, margin: "0 auto", padding: "32px 28px 48px" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, ...anim(0) }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700,
              color: planCfg.color, background: planCfg.bg, padding: "5px 12px",
              borderRadius: 8, marginBottom: 10, letterSpacing: .4, border: `1px solid ${planCfg.border}`,
            }}>
              <PlanIcon size={13} />
              {planCfg.label} PLAN
              <span style={{ width: 1, height: 12, background: planCfg.border, margin: "0 4px" }} />
              <span style={{ fontWeight: 500, opacity: .8 }}>{storeName}</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#0f172a" }}>{greet}</h1>
            <p style={{ fontSize: 14, color: "#94a3b8", margin: "5px 0 0" }}>Here's what needs your attention today</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnSecondary} onClick={onOpenDashboard}><LayoutDashboard size={14} /> Dashboard</button>
            <button style={btnSecondary} onClick={onScan}><Search size={14} /> New Scan</button>
            <button style={btnPrimary} onClick={onLaunch}><Rocket size={14} /> Launch Campaign</button>
          </div>
        </div>

        {/* ── AI INSIGHT ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(109,40,217,.04), rgba(99,102,241,.03))",
          border: "1px solid rgba(109,40,217,.12)", borderRadius: 14, padding: "16px 20px",
          marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start", ...anim(80),
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(109,40,217,.2)",
          }}><Brain size={18} color="#fff" /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", marginBottom: 4, letterSpacing: .3 }}>AI RECOMMENDATION</div>
            <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{aiTip}</div>
          </div>
        </div>

        {/* ── URGENT ACTIONS ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 22, ...anim(150) }}>
          {alerts.slice(0, 3).map((a, i) => {
            const st = alertStyles[a.s];
            return (
              <div key={i} style={{
                flex: 1, background: st.bg, border: `1px solid ${st.border}`,
                borderRadius: 12, padding: "14px 16px", cursor: "pointer",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: st.iconColor }}>{alertIcons[a.s]}</span>
                  <div style={{ flex: 1, fontSize: 12, color: "#374151", fontWeight: 500, lineHeight: 1.4 }}>{a.t}</div>
                </div>
                <span style={{
                  fontSize: 11, color: st.text, fontWeight: 700,
                  background: st.tag, padding: "3px 8px", borderRadius: 4,
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}>{a.a} <ChevronRight size={10} /></span>
              </div>
            );
          })}
        </div>

        {/* ── KPI ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 22 }}>
          {[
            { l: "Active Campaigns", v: mockCampaigns, icon: <Target size={18} />, c: "#7c3aed" },
            { l: "Total Clicks", v: mockClicks, icon: <MousePointerClick size={18} />, c: "#0ea5e9" },
            { l: "ROAS", v: mockRoas, icon: <DollarSign size={18} />, c: "#059669", suf: "x" },
            { l: "Monthly Spend", v: mockSpend, icon: <BarChart3 size={18} />, c: "#d97706", pre: "$" },
            { l: "Keyword Gaps", v: gapCount, icon: <KeyRound size={18} />, c: "#dc2626" },
          ].map((k, i) => (
            <div key={i} style={{ ...card, padding: "16px 16px 12px", ...anim(220 + i * 50) }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent 10%, ${k.c}30, transparent 90%)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>{k.l}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}><AnimNum end={k.v} pre={k.pre || ""} suf={k.suf || ""} /></div>
                </div>
                <span style={{ color: k.c, opacity: .45 }}>{k.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── TWO COLUMNS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>

          {/* Left: Top Products */}
          <div style={{ ...card, padding: "20px 22px", ...anim(480) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Trophy size={16} color="#d97706" />
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>Top Products</h2>
              </div>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{analyzedCount}/{totalProducts} analyzed</span>
            </div>

            {topProducts.length > 0 ? topProducts.map((p, i) => {
              const ai = p.aiAnalysis || {};
              const score = ai.ad_score || 0;
              const estClicks = Math.round(score * 3.8 + 20);
              const estSpend = Math.round(score * 0.45 + 10);
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", marginBottom: 8,
                  background: "#fafbfc", borderRadius: 10, border: "1px solid #f1f5f9", cursor: "pointer",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{p.title}</div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94a3b8", alignItems: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MousePointerClick size={10} /> ~{estClicks}/mo</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}><DollarSign size={10} /> ${estSpend}/day</span>
                      {score >= 70 ? <TrendingUp size={12} color="#059669" /> : <TrendingDown size={12} color="#dc2626" />}
                    </div>
                  </div>
                  <ScoreRing score={score} />
                </div>
              );
            }) : (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#94a3b8", fontSize: 13 }}>
                <Package size={24} style={{ marginBottom: 8, opacity: .4 }} /><div>Run a scan to see your top products</div>
              </div>
            )}

            {analyzedCount > 0 && (
              <div style={{
                marginTop: 12, padding: "12px 16px", borderRadius: 10,
                background: "linear-gradient(135deg, rgba(34,197,94,.05), rgba(109,40,217,.03))",
                border: "1px solid rgba(34,197,94,.12)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 5 }}>
                    <Eye size={13} color="#059669" /> Overall Performance
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{highPotential} high-potential · avg score {avgScore}/100</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}><AnimNum end={mockRoas} suf="x" /></div>
              </div>
            )}
          </div>

          {/* Right: Competitive Intel */}
          <div style={{ ...card, padding: "20px 22px", ...anim(560) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Swords size={16} color="#dc2626" />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>Competitive Intelligence</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              {[
                { l: "Threat Level", v: competitorThreat, c: threatColor, bg: `${threatColor}0d`, border: `${threatColor}20`, icon: <ShieldAlert size={13} /> },
                { l: "Google Rank", v: googleRank, c: "#0ea5e9", bg: "rgba(14,165,233,.05)", border: "rgba(14,165,233,.12)", sub: rankTrending, icon: <Globe size={13} /> },
                { l: "Gap Loss/mo", v: `$${gapLoss.toLocaleString()}`, c: "#dc2626", bg: "rgba(220,38,38,.05)", border: "rgba(220,38,38,.12)", icon: <DollarSign size={13} /> },
              ].map((m, i) => (
                <div key={i} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 5 }}>
                    <span style={{ color: m.c, opacity: .6 }}>{m.icon}</span>
                    <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>{m.l}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: m.c }}>{m.v}</div>
                  {m.sub !== undefined && (
                    <div style={{ fontSize: 10, color: m.sub ? "#059669" : "#dc2626", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      {m.sub ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {m.sub ? "Improving" : "Declining"}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{
              background: "rgba(220,38,38,.03)", border: "1px solid rgba(220,38,38,.1)",
              borderRadius: 10, padding: "12px 14px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", marginBottom: 3, letterSpacing: .3, display: "flex", alignItems: "center", gap: 4 }}>
                <KeyRound size={12} /> TOP KEYWORD GAP
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>"{topGapKeyword}"</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>Competitors rank for this — you don't. ~${Math.round(gapLoss / Math.max(gapCount, 1))}/mo lost</div>
            </div>

            {topCompetitors.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8, letterSpacing: .3, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                  <Zap size={12} /> Top Competitors
                </div>
                {topCompetitors.slice(0, 3).map((comp, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 10, padding: "10px 0",
                    borderBottom: i < Math.min(topCompetitors.length, 3) - 1 ? "1px solid #f1f5f9" : "none",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      background: "rgba(220,38,38,.05)", border: "1px solid rgba(220,38,38,.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}><Zap size={14} color="#dc2626" /></div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>{comp.domain || comp.name || `Competitor ${i + 1}`}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Found in {comp.count || 1} product{(comp.count || 1) > 1 ? "s" : ""} analysis</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── DASHBOARD CTA ── */}
        <div onClick={onOpenDashboard} style={{
          ...card, padding: "22px 26px", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", ...anim(660),
        }}>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #7c3aed, #6366f1, #0ea5e9)", opacity: .4 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(109,40,217,.2)",
            }}><LayoutDashboard size={22} color="#fff" /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>Open Full Dashboard</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Deep dive — all {analyzedCount} products, budget simulator, competitor analysis & campaign management
              </div>
            </div>
          </div>
          <button style={{ ...btnPrimary, padding: "12px 24px", fontSize: 14 }}>
            View Dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
