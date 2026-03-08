import React, { useState, useEffect } from "react";

export const Counter = React.memo(function Counter({ end, dur = 1200, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = 0; const step = end / (dur / 16);
    const id = setInterval(() => { start += step; if (start >= end) { setV(end); clearInterval(id); } else setV(Math.floor(start)); }, 16);
    return () => clearInterval(id);
  }, [end, dur]);
  return <>{v.toLocaleString()}{suffix}</>;
});

export const ScoreRing = React.memo(function ScoreRing({ score, size = 54 }) {
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

export const Speedometer = React.memo(function Speedometer({ value, max, label, color = "#6366f1", size = 120 }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(value), 300); return () => clearTimeout(t); }, [value]);
  const pct = Math.min(animated / max, 1);
  const startAngle = -225, endAngle = 45;
  const sweepRange = endAngle - startAngle;
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
