import React, { useState, useEffect } from "react";

// ══════════════════════════════════════════════
// SmallComponents.tsx — Supplementary UI components
// Counter, ScoreRing, Speedometer are in SmallWidgets.tsx
// This file contains: TipRotator, Confetti, SuccessTicker, ModalScrollLock
// ══════════════════════════════════════════════

// ── Tips for CollectingDataScreen ──

const TIPS: readonly string[] = [
  "💡 Ads with 10+ headlines get up to 15% more clicks",
  "💡 Specific keywords like 'buy red sneakers size 10' convert 3x better",
  "💡 Starting with $10/day is enough to get real data in a week",
  "💡 Paused campaigns cost nothing — review before going live",
  "💡 Negative keywords can cut wasted spend by up to 30%",
] as const;

export const TipRotator = React.memo(function TipRotator(): React.JSX.Element {
  const [idx, setIdx] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);

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
    <div className="tip-box" style={{ opacity: visible ? 1 : 0, transition: "opacity .4s ease" }}>
      {TIPS[idx]}
    </div>
  );
});

// ── Confetti celebration ──

interface ConfettiProps {
  active: boolean;
}

export const Confetti = React.memo(function Confetti({ active }: ConfettiProps): React.JSX.Element | null {
  if (!active) return null;
  const colors: string[] = ["#6366f1", "#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ec4899", "#fff"];
  const pieces = Array.from({ length: 60 }, (_, i) => {
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
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {pieces}
    </div>
  );
});

// ── Success ticker for landing/scanning ──

interface TickerMessage {
  name: string;
  action: string;
  time: string;
  emoji: string;
}

const TICKER: readonly TickerMessage[] = [
  { name: "🇺🇸 Shopify Plus store", action: "replaced a $2,500/mo agency with Smart Ads AI", time: "just now", emoji: "💎" },
  { name: "🇬🇧 First-time advertiser", action: "got their first Google Ads sale within 48 hours", time: "3 min ago", emoji: "🎯" },
  { name: "🇦🇺 Store with 340 products", action: "full AI scan completed in 58 seconds", time: "7 min ago", emoji: "⚡" },
  { name: "🇩🇪 DTC skincare brand", action: "went from 1.1x to 4.6x ROAS in 3 weeks", time: "19 min ago", emoji: "📈" },
] as const;

export function SuccessTicker(): React.JSX.Element {
  const [idx, setIdx] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TICKER.length);
        setVisible(true);
      }, 500);
    }, 3500);
    return () => clearInterval(iv);
  }, []);

  const msg = TICKER[idx];
  return (
    <div className="ticker-wrap" style={{ opacity: visible ? 1 : 0, transition: "opacity .5s ease" }}>
      <span className="ticker-emoji">{msg.emoji}</span>
      <span className="ticker-text">
        <strong>{msg.name}</strong> {msg.action}
      </span>
      <span className="ticker-time">{msg.time}</span>
    </div>
  );
}

// ── Modal scroll lock utility ──

export function ModalScrollLock(): null {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);
  return null;
}
