import React, { useState, useEffect } from "react";

// ══════════════════════════════════════════════
// SHARED UI COMPONENTS
// Small reusable components extracted from app._index.jsx
// ══════════════════════════════════════════════

export const Counter = React.memo(function Counter({
  end,
  dur = 1200,
  suffix = "",
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (end === 0) {
      setV(0);
      return;
    }
    let start = 0;
    const step = Math.ceil(end / (dur / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        setV(end);
        clearInterval(timer);
      } else setV(start);
    }, 16);
    return () => clearInterval(timer);
  }, [end, dur]);
  return (
    <>
      {v.toLocaleString()}
      {suffix}
    </>
  );
});

export function ScoreRing({ score, size = 40 }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color =
    score >= 80
      ? "#22c55e"
      : score >= 65
        ? "#84cc16"
        : score >= 50
          ? "#f59e0b"
          : "#ef4444";
  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,.1)"
        strokeWidth="4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={color}
        fontSize={size * 0.28}
        fontWeight="800"
      >
        {score}
      </text>
    </svg>
  );
}

export const Speedometer = React.memo(function Speedometer({
  value,
  max,
  label,
  color = "#6366f1",
  size = 130,
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - 10) / 2;
  const c = Math.PI * r; // semicircle
  const offset = c - pct * c;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg
        width={size}
        height={size / 2 + 10}
        viewBox={`0 0 ${size} ${size / 2 + 10}`}
      >
        <path
          d={`M 5 ${size / 2 + 5} A ${r} ${r} 0 0 1 ${size - 5} ${size / 2 + 5}`}
          fill="none"
          stroke="rgba(255,255,255,.07)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M 5 ${size / 2 + 5} A ${r} ${r} 0 0 1 ${size - 5} ${size / 2 + 5}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)",
          }}
        />
        <text
          x="50%"
          y={size / 2 - 4}
          dominantBaseline="central"
          textAnchor="middle"
          fill="#fff"
          fontSize="22"
          fontWeight="800"
        >
          {value}
        </text>
      </svg>
      <span
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,.4)",
          textTransform: "uppercase",
          letterSpacing: ".5px",
        }}
      >
        {label}
      </span>
    </div>
  );
});

export const Confetti = React.memo(function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const colors = [
      "#6366f1",
      "#8b5cf6",
      "#06b6d4",
      "#22c55e",
      "#f59e0b",
      "#ec4899",
      "#fff",
    ];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const dur = 2 + Math.random() * 1.5;
    const sz = 6 + Math.random() * 6;
    const rot = Math.random() * 360;
    return (
      <div
        key={i}
        style={{
          position: "fixed",
          top: -20,
          left: left + "%",
          width: sz,
          height: sz * 0.4,
          background: colors[i % colors.length],
          borderRadius: 2,
          zIndex: 9999,
          transform: `rotate(${rot}deg)`,
          animation: `confettiFall ${dur}s ease-out ${delay}s forwards`,
          opacity: 0,
        }}
      />
    );
  });
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {pieces}
    </div>
  );
});

const TIPS = [
  "💡 Ads with 10+ headlines get up to 15% more clicks",
  "💡 Specific keywords like 'buy red sneakers size 10' convert 3x better",
  "💡 Starting with $10/day is enough to get real data in a week",
  "💡 Paused campaigns cost nothing — review before going live",
  "💡 Negative keywords can cut wasted spend by up to 30%",
];

export const TipRotator = React.memo(function TipRotator() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TIPS.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div
      className="tip-box"
      style={{ opacity: visible ? 1 : 0, transition: "opacity .4s ease" }}
    >
      {TIPS[idx]}
    </div>
  );
});

/**
 * ModalScrollLock — prevents body scroll when a modal is open
 */
export function ModalScrollLock() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);
  return null;
}

/**
 * DemoDataBadge — shown next to any data that's estimated/mock
 * TRANSPARENCY FIX: Always tell users when data isn't real
 */
export function DemoDataBadge({ label = "Demo", style }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: "rgba(255,255,255,.4)",
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.1)",
        padding: "1px 6px",
        borderRadius: 4,
        textTransform: "uppercase",
        letterSpacing: ".5px",
        ...style,
      }}
    >
      {label}
    </span>
  );
}
