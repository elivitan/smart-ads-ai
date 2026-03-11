import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ── Small reusable components ──

const Counter = React.memo(function Counter({ end, dur = 1200, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = 0; const step = end / (dur / 16);
    const id = setInterval(() => { start += step; if (start >= end) { setV(end); clearInterval(id); } else setV(Math.floor(start)); }, 16);
    return () => clearInterval(id);
  }, [end, dur]);
  return <>{v.toLocaleString()}{suffix}</>;
});

const ScoreRing = React.memo(function ScoreRing({ score, size = 54 }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ filter:`drop-shadow(0 0 6px ${color}44)` }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:"stroke-dashoffset 1s ease" }}/>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={color} fontSize="13" fontWeight="800">{score}</text>
    </svg>
  );
});

const Speedometer = React.memo(function Speedometer({ value, max, label, color = "#6366f1", size = 120 }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(value), 300); return () => clearTimeout(t); }, [value]);
  const pct = Math.min(animated / max, 1);
  const startAngle = -225, endAngle = 45;
  const sweepRange = endAngle - startAngle; // 270 degrees
  const angle = startAngle + pct * sweepRange;
  const svgW = size, svgH = size * 0.78;
  const cx = svgW / 2, cy = svgH * 0.58, r = size * 0.34;
  function ptXY(pcx, pcy, pr, deg) { const rad = deg * Math.PI / 180; return { x: pcx + pr * Math.cos(rad), y: pcy + pr * Math.sin(rad) }; }
  const arcStart = ptXY(cx,cy,r,startAngle), arcEnd = ptXY(cx,cy,r,endAngle), fillEnd = ptXY(cx,cy,r,angle);
  const needleLen = r * 0.78;
  const needleTip = ptXY(cx,cy,needleLen,angle);
  const largeArc = sweepRange > 180 ? 1 : 0;
  const fillSweep = pct * sweepRange;
  const fillLargeArc = fillSweep > 180 ? 1 : 0;
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;
  const fillPath = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${fillLargeArc} 1 ${fillEnd.x} ${fillEnd.y}`;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" strokeLinecap="round"/>
        <path d={fillPath} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" style={{ transition:"d 1s cubic-bezier(.4,0,.2,1)" }}/>
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" style={{ transition:"x2 1s cubic-bezier(.4,0,.2,1),y2 1s cubic-bezier(.4,0,.2,1)" }}/>
        <circle cx={cx} cy={cy} r="3" fill={color}/>
        <text x={cx} y={cy + r * 0.62} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="18" fontWeight="800">{animated}</text>
      </svg>
      <span style={{ fontSize:11, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:".5px" }}>{label}</span>
    </div>
  );
});

// ══════════════════════════════════════════════
// COLLECTING DATA SCREEN
// For new paid subscribers — auto-starts scan in background
// ══════════════════════════════════════════════

const TIPS = ["💡 Ads with 10+ headlines get up to 15% more clicks","💡 Specific keywords like 'buy red sneakers size 10' convert 3x better","💡 Starting with $10/day is enough to get real data in a week","💡 Paused campaigns cost nothing — review before going live","💡 Negative keywords can cut wasted spend by up to 30%"];

const TipRotator = React.memo(function TipRotator() {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const iv = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i => (i+1)%TIPS.length); setVisible(true); },400); },4000); return () => clearInterval(iv); }, []);
  return <div className="tip-box" style={{ opacity:visible?1:0, transition:"opacity .4s ease" }}>{TIPS[idx]}</div>;
});

const Confetti = React.memo(function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const colors = ["#6366f1","#8b5cf6","#06b6d4","#22c55e","#f59e0b","#ec4899","#fff"];
    const left = Math.random()*100, delay = Math.random()*.8, dur = 2+Math.random()*1.5, sz = 6+Math.random()*6, rot = Math.random()*360;
    return <div key={i} style={{ position:"fixed",top:-20,left:left+"%",width:sz,height:sz*.4,background:colors[i%colors.length],borderRadius:2,zIndex:9999,transform:`rotate(${rot}deg)`,animation:`confettiFall ${dur}s ease-out ${delay}s forwards`,opacity:0 }}/>;
  });
  return <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999 }}>{pieces}</div>;
});

const TICKER = [
  { name:"🇺🇸 Shopify Plus store", action:"replaced a $2,500/mo agency with Smart Ads AI", time:"just now", emoji:"💎" },
  { name:"🇬🇧 First-time advertiser", action:"got their first Google Ads sale within 48 hours", time:"3 min ago", emoji:"🎯" },
  { name:"🇦🇺 Store with 340 products", action:"full AI scan completed in 58 seconds", time:"7 min ago", emoji:"⚡" },
  { name:"🇩🇪 DTC skincare brand", action:"went from 1.1x to 4.6x ROAS in 3 weeks", time:"19 min ago", emoji:"📈" },
];

function SuccessTicker() {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const iv = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i=>(i+1)%TICKER.length); setVisible(true); },500); },3500); return () => clearInterval(iv); }, []);
  const msg = TICKER[idx];
  return (
    <div className="ticker-wrap" style={{ opacity:visible?1:0, transition:"opacity .5s ease" }}>
      <span className="ticker-emoji">{msg.emoji}</span>
      <span className="ticker-text"><strong>{msg.name}</strong> {msg.action}</span>
      <span className="ticker-time">{msg.time}</span>
    </div>
  );
}


// ══════════════════════════════════════════════
// LANDING PAGE — BUDGET TEASER
// ══════════════════════════════════════════════

function ModalScrollLock() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);
  return null;
}

export { Counter, ScoreRing, Speedometer, TipRotator, Confetti, SuccessTicker, ModalScrollLock };
