import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";


const StoreHealthScore = React.memo(function StoreHealthScore({ analyzedCount, totalProducts, avgScore, highPotential, competitorCount }) {
  const [expanded, setExpanded] = useState(false);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 500); return () => clearTimeout(t); }, []);

  const adQuality = avgScore;
  const productCoverage = totalProducts > 0 ? Math.round((analyzedCount / totalProducts) * 100) : 0;
  const competitorIntel = Math.min(competitorCount * 20, 100);
  const budgetEfficiency = avgScore > 0 ? Math.min(Math.round(avgScore * 0.85 + highPotential * 2.5), 100) : 0;
  const overall = Math.round(adQuality * 0.35 + productCoverage * 0.25 + competitorIntel * 0.2 + budgetEfficiency * 0.2);

  const grade = overall >= 85 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : overall >= 40 ? "D" : "F";
  const gradeColor = overall >= 85 ? "#22c55e" : overall >= 70 ? "#84cc16" : overall >= 55 ? "#f59e0b" : overall >= 40 ? "#f97316" : "#ef4444";
  const statusText = overall >= 85 ? "Excellent" : overall >= 70 ? "Good" : overall >= 55 ? "Average" : overall >= 40 ? "Needs Work" : "Critical";

  const subScores = [
    { label:"Ad Quality", value:adQuality, color:"#6366f1", icon:"🎯", tip:`Avg score ${avgScore}/100 across products` },
    { label:"Product Coverage", value:productCoverage, color:"#06b6d4", icon:"📦", tip:`${analyzedCount} of ${totalProducts} analyzed` },
    { label:"Competitor Intel", value:competitorIntel, color:"#8b5cf6", icon:"🕵️", tip:`${competitorCount} competitors found` },
    { label:"Budget Efficiency", value:budgetEfficiency, color:"#f59e0b", icon:"💰", tip:"Estimated ROI based on scores" },
  ];

  const sz = 148, rr = 58, circ = 2 * Math.PI * rr;
  const offset = circ - (animated ? overall / 100 : 0) * circ;

  return (
    <div className="health-card" onClick={() => setExpanded(e => !e)}>
      <div className="health-top">
        {/* Big ring */}
        <div className="health-ring-wrap">
          <svg width={sz} height={sz}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <circle cx={sz/2} cy={sz/2} r={rr} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="12"/>
            <circle cx={sz/2} cy={sz/2} r={rr} fill="none" stroke={gradeColor} strokeWidth="12"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${sz/2} ${sz/2})`}
              filter="url(#glow)"
              style={{ transition:"stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1), stroke .5s" }}/>
            <text x="50%" y="42%" dominantBaseline="central" textAnchor="middle"
              fill={gradeColor} fontSize="38" fontWeight="900">{grade}</text>
            <text x="50%" y="63%" dominantBaseline="central" textAnchor="middle"
              fill="rgba(255,255,255,.35)" fontSize="12">{overall}/100</text>
          </svg>
          <div className="health-pulse" style={{ borderColor:`${gradeColor}30` }}/>
          <div className="health-pulse health-pulse-2" style={{ borderColor:`${gradeColor}15` }}/>
        </div>

        {/* Info */}
        <div className="health-info">
          <div className="health-label">Store Health Score</div>
          <div className="health-status-text" style={{ color:gradeColor }}>{statusText}</div>
          <div className="health-desc">
            {overall >= 70
              ? `${highPotential} products ready for high-impact campaigns. Keep it up!`
              : `Analyze more products and improve ad scores to boost your rating.`}
          </div>
          {/* Mini sub-score bars */}
          <div className="health-mini-bars">
            {subScores.map((s,i) => (
              <div key={i} className="health-mini-bar-row">
                <span className="health-mini-lbl">{s.icon}</span>
                <div className="health-mini-track">
                  <div className="health-mini-fill" style={{ width:`${animated ? s.value : 0}%`, background:s.color, transition:`width ${1.2+i*0.15}s cubic-bezier(.4,0,.2,1)` }}/>
                </div>
                <span className="health-mini-val" style={{ color:s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div className="health-expand">{expanded ? "Hide ↑" : "Details ↓"}</div>
        </div>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="health-breakdown">
          {subScores.map((s,i) => {
            const sr = 22, sc = 2 * Math.PI * sr;
            const so = sc - (animated ? s.value / 100 : 0) * sc;
            return (
              <div key={i} className="health-sub-item">
                <svg width="52" height="52">
                  <circle cx="26" cy="26" r={sr} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="5"/>
                  <circle cx="26" cy="26" r={sr} fill="none" stroke={s.color} strokeWidth="5"
                    strokeDasharray={sc} strokeDashoffset={so} strokeLinecap="round"
                    transform="rotate(-90 26 26)"
                    style={{ transition:`stroke-dashoffset ${1.2+i*0.2}s cubic-bezier(.4,0,.2,1)`, filter:`drop-shadow(0 0 4px ${s.color}88)` }}/>
                  <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={s.color} fontSize="10" fontWeight="800">{s.value}</text>
                </svg>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.4)", marginTop:2 }}>{s.tip}</div>
                </div>
              </div>
            );
          })}
          <div className="health-tips">
            {productCoverage < 100 && <div className="health-tip-item">💡 Analyze {totalProducts - analyzedCount} more products to improve coverage</div>}
            {adQuality < 70 && <div className="health-tip-item">💡 Boost low-scoring products with stronger keywords</div>}
            {competitorIntel < 60 && <div className="health-tip-item">💡 Run full scan to gather more competitor intelligence</div>}
          </div>
        </div>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════
// LIVE PULSE — real-time campaign activity
// ══════════════════════════════════════════════

const LivePulse = React.memo(function LivePulse({ campaigns, campaignList, campaignHistory, impressionsBase, clicksBase, campaignId, realSpend, campaignControlStatus, confirmRemove, setConfirmRemove, onPause, onRemove }) {
  const activeCampaigns = (campaignList || []).filter(c => c.status === "ENABLED");
  const pausedCampaigns = (campaignList || []).filter(c => c.status === "PAUSED");
  const allCampaigns = [...activeCampaigns, ...pausedCampaigns];
  const hasAnyCampaigns = allCampaigns.length > 0;
  const [heartbeat, setHeartbeat] = useState(false);
  const [impressions, setImpressions] = useState(impressionsBase || 0);
  const [clicks, setClicks] = useState(clicksBase || 0);
  const [lastEvent, setLastEvent] = useState("Monitoring your campaigns...");
  const [eventVisible, setEventVisible] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const historyRef = useRef(campaignHistory || []);
  const campaignListRef = useRef(allCampaigns);

  const events = [
    "New impression recorded",
    "Click converted — product page visited",
    "Competitor bid change detected",
    "Ad shown — mobile search",
    "High-intent search click recorded",
    "Quality score updated",
    "Smart bidding adjustment applied",
  ];

  // Keep refs in sync with props
  useEffect(() => { historyRef.current = campaignHistory || []; }, [campaignHistory]);
  useEffect(() => { campaignListRef.current = allCampaigns; }, [allCampaigns.length]);
  useEffect(() => { setImpressions(impressionsBase || 0); }, [impressionsBase]);
  useEffect(() => { setClicks(clicksBase || 0); }, [clicksBase]);

  // Heartbeat + events animation
  useEffect(() => {
    if (!hasAnyCampaigns) return;
    const tick = () => {
      setHeartbeat(true);
      setTimeout(() => setHeartbeat(false), 700);
      if (Math.random() > 0.45) {
        setEventVisible(false);
        setTimeout(() => { setLastEvent(events[Math.floor(Math.random() * events.length)]); setEventVisible(true); }, 300);
      }
    };
    tick();
    const iv = setInterval(() => { if (document.visibilityState !== "hidden") tick(); }, 3000);
    return () => clearInterval(iv);
  }, [hasAnyCampaigns]);

  // Canvas chart — uses callback ref pattern to handle mount/unmount correctly
  const canvasCallbackRef = useCallback((node) => {
    // Cleanup previous animation
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    canvasRef.current = node;
    if (!node) return;

    const ctx = node.getContext("2d");
    const W = node.width, H = node.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const history = historyRef.current;
      const camps = campaignListRef.current;

      let data;
      let label;
      if (history.length >= 5) {
        // Enough history — show real trend line
        const impValues = history.map(h => h.impressions || 0);
        const maxImp = Math.max(...impValues, 1);
        data = impValues.map(v => Math.max(v / maxImp, 0.05));
        label = history.length + " data points";
      } else {
        // Not enough history — build chart from current campaign metrics
        // Create meaningful data points: impressions, clicks*10, cost*5, CTR*20, conversions*50
        const points = [];
        for (const c of camps) {
          const imp = c.impressions || 0;
          const clk = (c.clicks || 0) * 12;
          const cst = parseFloat(c.cost || 0) * 8;
          const ctr = parseFloat(c.ctr || 0) * 25;
          points.push(imp * 0.3, clk, imp * 0.6, cst, imp * 0.8, ctr, imp);
        }
        // If no campaign data, show gentle animated wave
        if (points.length === 0 || points.every(p => p === 0)) {
          const t = Date.now() / 1500;
          data = Array.from({ length: 20 }, (_, i) => 0.25 + Math.sin(t + i * 0.4) * 0.12 + Math.sin(t * 0.7 + i * 0.2) * 0.06);
          label = "Waiting for data...";
        } else {
          const maxP = Math.max(...points, 1);
          data = points.map(v => Math.max(v / maxP, 0.05));
          // Ensure at least 8 points for a smooth curve
          while (data.length < 8) {
            const mid = Math.floor(data.length / 2);
            data.splice(mid, 0, (data[mid - 1] + data[mid]) / 2);
          }
          label = "Campaign metrics";
        }
        // Add history points on top if we have some
        if (history.length > 0) {
          const impValues = history.map(h => h.impressions || 0);
          const maxAll = Math.max(...data.map((d,i) => d), ...impValues.map(v => v / (Math.max(...impValues, 1))), 1);
          for (const h of history) {
            data.push(Math.max((h.impressions || 0) / (Math.max(...impValues, 1) || 1), 0.05));
          }
          label = history.length + " data points + metrics";
        }
      }

      const step = W / (data.length - 1);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,.04)";
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(y => {
        ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
      });

      // Fill gradient
      const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
      fillGrad.addColorStop(0, "rgba(99,102,241,.2)");
      fillGrad.addColorStop(1, "rgba(99,102,241,0)");

      // Line gradient
      const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
      lineGrad.addColorStop(0, "rgba(99,102,241,.3)");
      lineGrad.addColorStop(0.6, "#6366f1");
      lineGrad.addColorStop(1, "#22c55e");

      // Fill path
      ctx.beginPath();
      ctx.moveTo(0, H);
      data.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.8;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = (i - 1) * step, py = H - data[i - 1] * H * 0.8;
          ctx.bezierCurveTo(px + step / 2, py, x - step / 2, y, x, y);
        }
      });
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = fillGrad; ctx.fill();

      // Stroke
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = (i - 1) * step, py = H - data[i - 1] * H * 0.8;
          ctx.bezierCurveTo(px + step / 2, py, x - step / 2, y, x, y);
        }
      });
      ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5;
      ctx.shadowColor = "#6366f1"; ctx.shadowBlur = 8;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Live dot
      const lx = (data.length - 1) * step, ly = H - data[data.length - 1] * H * 0.8;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e"; ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 14;
      ctx.fill(); ctx.shadowBlur = 0;

      // Ripple
      ctx.beginPath(); ctx.arc(lx, ly, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(34,197,94,.3)"; ctx.lineWidth = 1.5; ctx.stroke();

      // Label
      ctx.font = "10px Arial";
      ctx.fillStyle = "rgba(255,255,255,.25)";
      ctx.fillText(label, 6, 12);

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
  }, []);

  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const spend = allCampaigns.reduce((a, c) => a + parseFloat(c.cost || 0), 0).toFixed(2);

  // ── EMPTY STATE: no campaigns at all ──
  if (!hasAnyCampaigns) return (
    <div className="pulse-card pulse-empty">
      <div style={{ fontSize:36, marginBottom:10 }}>📡</div>
      <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Live Campaign Pulse</div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,.4)" }}>Launch campaigns to see real-time data</div>
    </div>
  );

  // ── UNIFIED ACTIVE STATE: chart + metrics + campaign list + controls ──
  return (
    <div className="pulse-card">
      {/* Header */}
      <div className="pulse-header-row">
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div className={`pulse-dot-live ${heartbeat ? "pulse-beat" : ""}`} style={{background: activeCampaigns.length > 0 ? undefined : "#f59e0b"}}/>
          <span style={{ fontSize:14, fontWeight:700 }}>Live Campaign Pulse</span>
          {activeCampaigns.length > 0 && <span className="pulse-live-tag">LIVE</span>}
          {activeCampaigns.length === 0 && <span className="pulse-live-tag" style={{background:"rgba(245,158,11,.15)",color:"#f59e0b"}}>PAUSED</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {campaignControlStatus==="paused" && <span className="pulse-status-badge pulse-badge-paused">⏸ Paused</span>}
          {campaignControlStatus==="removed" && <span className="pulse-status-badge pulse-badge-removed">✅ Removed</span>}
          {campaignControlStatus==="enabled" && <span className="pulse-status-badge" style={{background:"rgba(34,197,94,.15)",color:"#22c55e",padding:"3px 10px",borderRadius:8,fontSize:11,fontWeight:700}}>▶ Resumed</span>}
          {campaignControlStatus==="error" && <span className="pulse-status-badge pulse-badge-error">⚠️ Failed</span>}
          <svg width="22" height="20" viewBox="0 0 24 22" fill="none" className={heartbeat ? "heart-beat" : ""}>
            <path d="M12 21C12 21 3 14 3 8C3 5.2 5.2 3 8 3C9.7 3 11.2 3.9 12 5.2C12.8 3.9 14.3 3 16 3C18.8 3 21 5.2 21 8C21 14 12 21 12 21Z"
              fill={heartbeat ? "#ef4444" : "#6366f1"} style={{ transition:"fill .3s" }}/>
          </svg>
        </div>
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", marginBottom:10 }}>{activeCampaigns.length} active · {pausedCampaigns.length} paused</div>

      {/* Chart — always rendered */}
      <div style={{ position:"relative", marginBottom:14 }}>
        <canvas ref={canvasCallbackRef} width={520} height={72} className="pulse-canvas"/>
      </div>

      {/* Metrics */}
      <div className="pulse-metrics-row">
        <div className="pulse-metric-box pulse-m-imp">
          <div className="pulse-m-val">{impressions.toLocaleString()}</div>
          <div className="pulse-m-lbl">👁 Impressions</div>
        </div>
        <div className="pulse-metric-box pulse-m-clk">
          <div className="pulse-m-val">{clicks.toLocaleString()}</div>
          <div className="pulse-m-lbl">👆 Clicks</div>
        </div>
        <div className="pulse-metric-box pulse-m-ctr">
          <div className="pulse-m-val">{ctr}%</div>
          <div className="pulse-m-lbl">📊 CTR</div>
        </div>
        <div className="pulse-metric-box pulse-m-cost">
          <div className="pulse-m-val">${spend}</div>
          <div className="pulse-m-lbl">💸 Spend</div>
        </div>
      </div>

      {/* Campaign list with controls */}
      <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:6}}>
        <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:2}}>YOUR CAMPAIGNS</div>
        {allCampaigns.map((camp, i) => (
          <div key={camp.id || i} style={{
            display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
            background:"rgba(255,255,255,.03)", borderRadius:8,
            border:"1px solid rgba(255,255,255,.06)"
          }}>
            <div style={{
              width:7, height:7, borderRadius:"50%",
              background: camp.status === "ENABLED" ? "#22c55e" : camp.status === "PAUSED" ? "#f59e0b" : "#ef4444",
              flexShrink:0
            }}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{camp.name}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:1}}>
                {camp.type === "PERFORMANCE_MAX" ? "PMax" : camp.type === "SEARCH" ? "Search" : camp.type} · {"$"}{camp.dailyBudget}/day · {camp.impressions?.toLocaleString() || 0} imp
              </div>
            </div>
            <div style={{display:"flex",gap:5,flexShrink:0}}>
              {camp.status === "ENABLED" && (
                <button className="pulse-btn pulse-btn-pause" style={{padding:"3px 8px",fontSize:10}}
                  onClick={() => { if (onPause) onPause(camp.id || camp.resourceName); }}
                  disabled={campaignControlStatus==="pausing"||campaignControlStatus==="removing"}>
                  {campaignControlStatus==="pausing" ? "⏳" : "⏸"}
                </button>
              )}
              {camp.status === "PAUSED" && (
                <button className="pulse-btn" style={{padding:"3px 8px",fontSize:10,background:"rgba(34,197,94,.1)",color:"#22c55e",border:"1px solid rgba(34,197,94,.2)"}}
                  onClick={() => { if (onPause) onPause(camp.id || camp.resourceName, "enable"); }}
                  disabled={campaignControlStatus==="enabling"}>
                  {campaignControlStatus==="enabling" ? "⏳" : "▶"}
                </button>
              )}
              <button className="pulse-btn pulse-btn-remove" style={{padding:"3px 10px",fontSize:10,display:"flex",alignItems:"center",gap:3}}
                onClick={() => { if (setConfirmRemove) setConfirmRemove(camp.id || camp.resourceName); }}
                disabled={campaignControlStatus==="removing"}>
                <span style={{fontSize:12,lineHeight:1}}>✕</span> Del
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Live event */}
      {activeCampaigns.length > 0 && (
        <div className="pulse-event-bar" style={{ opacity: eventVisible ? 1 : 0, transition:"opacity .3s", marginTop:10 }}>
          <span className="pulse-event-dot-green"/>
          <span className="pulse-event-txt">{lastEvent}</span>
          <span className="pulse-event-time">just now</span>
        </div>
      )}

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <div className="pulse-confirm-overlay">
          <div className="pulse-confirm-box">
            <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
            <h3 style={{fontSize:16,fontWeight:800,marginBottom:8}}>Remove Campaign?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:20}}>
              This will permanently remove the campaign from Google Ads. This cannot be undone.
            </p>
            <div style={{display:"flex",gap:10}}>
              <button className="pulse-btn pulse-btn-remove" style={{flex:1}} onClick={() => { if (onRemove) onRemove(confirmRemove); }}>Yes, Remove</button>
              <button className="pulse-btn pulse-btn-pause" style={{flex:1}} onClick={() => setConfirmRemove(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const TopMissedOpportunity = React.memo(function TopMissedOpportunity({ topProduct, avgScore, totalMonthlyGapLoss, analyzedCount, onScan, onViewProduct, hasScanAccess }) {
  if (!topProduct && analyzedCount === 0) {
    // Never scanned — show teaser
    return (
      <div className="tmo-card tmo-teaser">
        <div className="tmo-teaser-icon">🔍</div>
        <div className="tmo-teaser-content">
          <h3 className="tmo-teaser-title">Discover Your #1 Missed Opportunity</h3>
          <p className="tmo-teaser-sub">Run a free scan to see which product could be making you the most money right now — and exactly why it isn't.</p>
          <button className="tmo-teaser-btn" onClick={onScan}>⚡ Run Free Scan Now</button>
        </div>
        <div className="tmo-teaser-bg">💰</div>
      </div>
    );
  }

  if (!topProduct) return null;

  const ai = topProduct.aiAnalysis || {};
  const score = ai.ad_score || 0;
  const topKeyword = (ai.keywords?.[0]?.text || ai.keywords?.[0] || "your top keyword");
  const estMonthly = totalMonthlyGapLoss > 0 ? totalMonthlyGapLoss : Math.round(score * 18 + 240);
  const topComp = ai.competitor_intel?.top_competitors?.[0]?.domain || null;

  return (
    <div className="tmo-card">
      <div className="tmo-badge">🎯 Your #1 Opportunity</div>
      <div className="tmo-content">
        <div className="tmo-left">
          {topProduct.image && <img src={topProduct.image} alt="" className="tmo-img"/>}
          <div className="tmo-product-info">
            <div className="tmo-product-title">{topProduct.title}</div>
            <div className="tmo-product-price">${Number(topProduct.price||0).toFixed(2)}</div>
            <div className="tmo-score-row">
              <div className="tmo-score-bar">
                <div className="tmo-score-fill" style={{width:`${score}%`, background: score>=70?"#22c55e":score>=50?"#f59e0b":"#ef4444"}}/>
              </div>
              <span className="tmo-score-val">{score}/100</span>
            </div>
          </div>
        </div>
        <div className="tmo-right">
          <div className="tmo-money-lost">
            <div className="tmo-money-val">${estMonthly.toLocaleString()}</div>
            <div className="tmo-money-lbl">estimated monthly revenue<br/>you could be capturing</div>
          </div>
          <div className="tmo-insights">
            {topComp && <div className="tmo-insight">⚔️ <strong>{topComp}</strong> is bidding on "<em>{topKeyword}</em>" right now</div>}
            <div className="tmo-insight">🔑 Top keyword: <strong>"{topKeyword}"</strong></div>
            {ai.strategy && <div className="tmo-insight">📋 Recommended strategy: <strong>{ai.strategy.replace(/_/g," ").toUpperCase()}</strong></div>}
          </div>
          <button className="tmo-cta" onClick={() => onViewProduct && onViewProduct(topProduct)}>
            🚀 View Full Campaign →
          </button>
        </div>
      </div>
    </div>
  );
});


// ══════════════════════════════════════════════
// BUDGET SIMULATOR
// ══════════════════════════════════════════════

const BudgetSimulator = React.memo(function BudgetSimulator({ avgScore, avgCpc, canPublish, onUpgrade }) {
  const [vals, setVals] = useState({ budget: 20, aov: 80, conv: 2.5 });

  // Calculations
  const cpc = avgCpc || Math.max(0.25, (1.2 - avgScore * 0.006));
  const dailyClicks   = Math.round(vals.budget / cpc);
  const dailyOrders   = (dailyClicks * vals.conv / 100);
  const dailyRevenue  = dailyOrders * vals.aov;
  const dailyProfit   = dailyRevenue - vals.budget;
  const monthlyBudget = vals.budget * 30;
  const monthlyRev    = dailyRevenue * 30;
  const roas          = vals.budget > 0 ? (dailyRevenue / vals.budget).toFixed(1) : "0";
  const breakEvenDays = dailyProfit > 0 ? Math.ceil(monthlyBudget / dailyProfit) : null;
  const roasNum       = parseFloat(roas);
  const roasColor     = roasNum >= 4 ? "#22c55e" : roasNum >= 2 ? "#f59e0b" : "#ef4444";
  const roasLabel     = roasNum >= 4 ? "Excellent" : roasNum >= 2 ? "Good" : "Low";

  return (
    <div className="budget-sim-card">
      <div className="budget-sim-header">
        <div>
          <h3 className="budget-sim-title">💰 Budget Simulator</h3>
          <p className="budget-sim-sub">Adjust your budget and see projected results</p>
        </div>
        {!canPublish && (
          <button className="budget-sim-upgrade" onClick={onUpgrade}>🔒 Subscribe to Launch</button>
        )}
      </div>

      {/* Sliders */}
      <div className="budget-sim-inputs">
        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Daily Budget</span>
            <span className="budget-sim-input-val">${vals.budget}/day</span>
          </div>
          <input type="range" min="5" max="500" step="5" value={vals.budget}
            onChange={e => setVals(v => ({...v, budget: Number(e.target.value)}))}
            className="budget-sim-slider" />
          <div className="budget-sim-range-labels"><span>$5</span><span>$500</span></div>
        </div>

        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Avg Order Value</span>
            <span className="budget-sim-input-val">${vals.aov}</span>
          </div>
          <input type="range" min="10" max="500" step="5" value={vals.aov}
            onChange={e => setVals(v => ({...v, aov: Number(e.target.value)}))}
            className="budget-sim-slider" />
          <div className="budget-sim-range-labels"><span>$10</span><span>$500</span></div>
        </div>

        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Conversion Rate</span>
            <span className="budget-sim-input-val">{vals.conv}%</span>
          </div>
          <input type="range" min="0.1" max="10" step="0.1" value={vals.conv}
            onChange={e => setVals(v => ({...v, conv: parseFloat(e.target.value)}))}
            className="budget-sim-slider" />
          <div className="budget-sim-range-labels"><span>0.1%</span><span>10%</span></div>
        </div>
      </div>

      {/* Results */}
      <div className="budget-sim-results">
        <div className="budget-sim-result-card">
          <div className="budget-sim-result-val">{dailyClicks.toLocaleString()}</div>
          <div className="budget-sim-result-lbl">👆 Daily Clicks</div>
        </div>
        <div className="budget-sim-result-card">
          <div className="budget-sim-result-val">{dailyOrders.toFixed(1)}</div>
          <div className="budget-sim-result-lbl">🛍 Daily Orders</div>
        </div>
        <div className="budget-sim-result-card">
          <div className="budget-sim-result-val">${Math.round(dailyRevenue).toLocaleString()}</div>
          <div className="budget-sim-result-lbl">💵 Daily Revenue</div>
        </div>
        <div className="budget-sim-result-card" style={{borderColor: roasColor + "44"}}>
          <div className="budget-sim-result-val" style={{color: roasColor}}>{roas}x</div>
          <div className="budget-sim-result-lbl">📈 ROAS <span style={{color:roasColor,fontSize:10}}>({roasLabel})</span></div>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="budget-sim-monthly">
        <div className="budget-sim-monthly-row">
          <span>Monthly ad spend</span>
          <span style={{color:"#ef4444"}}>-${(vals.budget*30).toLocaleString()}</span>
        </div>
        <div className="budget-sim-monthly-row">
          <span>Monthly revenue</span>
          <span style={{color:"#22c55e"}}>+${Math.round(dailyRevenue*30).toLocaleString()}</span>
        </div>
        <div className="budget-sim-monthly-row" style={{fontWeight:800,fontSize:15,borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:8,marginTop:4}}>
          <span>Monthly profit</span>
          <span style={{color: dailyProfit >= 0 ? "#22c55e" : "#ef4444"}}>
            {dailyProfit >= 0 ? "+" : ""}${Math.round((dailyRevenue-vals.budget)*30).toLocaleString()}
          </span>
        </div>
        {breakEvenDays && breakEvenDays <= 60 && (
          <div className="budget-sim-breakeven">
            ⚡ Break-even in ~{breakEvenDays} days at this budget
          </div>
        )}
      </div>

      <div className="budget-sim-note">
        * Based on avg score {avgScore}/100 · Est. CPC ${cpc.toFixed(2)} · Results may vary
      </div>
    </div>
  );
});

export { StoreHealthScore, LivePulse, TopMissedOpportunity, BudgetSimulator };
