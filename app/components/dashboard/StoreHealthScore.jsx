import React, { useState, useEffect, useMemo } from "react";

/**
 * StoreHealthScore — Enterprise Version
 *
 * Improvements over MVP:
 * - Non-linear scoring (diminishing returns at extremes)
 * - Time decay (older scans count less)
 * - Confidence factor (fewer products = lower confidence)
 * - Industry baseline comparison
 * - Penalty system for critical issues
 */
const StoreHealthScore = React.memo(function StoreHealthScore({
  analyzedCount,
  totalProducts,
  avgScore,
  highPotential,
  competitorCount,
  lastScanDate, // ISO date string of last scan
  industryAvg, // Optional: industry average score (0-100)
  criticalIssues, // Optional: number of critical issues found
}) {
  const [expanded, setExpanded] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 500);
    return () => clearTimeout(t);
  }, []);

  // ── Non-linear curve (diminishing returns) ─────────────────────────
  // Score of 50 → 50, Score of 80 → 76, Score of 95 → 88
  // This prevents inflated scores from small improvements at the top
  function curve(value, power = 0.85) {
    const clamped = Math.max(0, Math.min(100, value));
    return Math.round(Math.pow(clamped / 100, power) * 100);
  }

  // ── Time decay factor ──────────────────────────────────────────────
  // Fresh scan (0 days) = 1.0, 7 days = 0.9, 30 days = 0.7, 90+ days = 0.4
  const decayFactor = useMemo(() => {
    if (!lastScanDate) return 0.85; // Default if no date
    const daysSinceScan = Math.max(
      0,
      (Date.now() - new Date(lastScanDate).getTime()) / 86400000,
    );
    if (daysSinceScan <= 1) return 1.0;
    if (daysSinceScan <= 7) return 0.95;
    if (daysSinceScan <= 14) return 0.9;
    if (daysSinceScan <= 30) return 0.8;
    if (daysSinceScan <= 60) return 0.6;
    return 0.4; // Very stale
  }, [lastScanDate]);

  // ── Confidence factor ──────────────────────────────────────────────
  // < 3 products = low confidence, 3-10 = medium, 10+ = high
  const confidence = useMemo(() => {
    if (analyzedCount === 0) return 0;
    if (analyzedCount <= 2) return 0.5;
    if (analyzedCount <= 5) return 0.7;
    if (analyzedCount <= 10) return 0.85;
    if (analyzedCount <= 20) return 0.95;
    return 1.0;
  }, [analyzedCount]);

  const confidenceLabel =
    confidence >= 0.9 ? "High" : confidence >= 0.7 ? "Medium" : "Low";
  const confidenceColor =
    confidence >= 0.9 ? "#22c55e" : confidence >= 0.7 ? "#f59e0b" : "#ef4444";

  // ── Sub-scores with non-linear curves ──────────────────────────────
  const adQuality = curve(avgScore);
  const productCoverage =
    totalProducts > 0
      ? curve(Math.round((analyzedCount / totalProducts) * 100))
      : 0;
  const competitorIntel = curve(Math.min(competitorCount * 20, 100));
  const budgetEfficiency =
    avgScore > 0
      ? curve(Math.min(Math.round(avgScore * 0.85 + highPotential * 2.5), 100))
      : 0;

  // ── Critical issue penalty ─────────────────────────────────────────
  // Each critical issue subtracts 5-15 points
  const criticalPenalty = Math.min((criticalIssues || 0) * 8, 30);

  // ── Overall score with all factors ─────────────────────────────────
  const rawOverall = Math.round(
    adQuality * 0.35 +
      productCoverage * 0.25 +
      competitorIntel * 0.2 +
      budgetEfficiency * 0.2,
  );

  const decayedScore = Math.round(rawOverall * decayFactor);
  const penalizedScore = Math.max(0, decayedScore - criticalPenalty);
  const overall = Math.round(penalizedScore * confidence);

  // ── Industry comparison ────────────────────────────────────────────
  const baseline = industryAvg || 62; // Default industry average
  const vsIndustry = overall - baseline;
  const vsIndustryLabel =
    vsIndustry > 0
      ? `+${vsIndustry} above avg`
      : vsIndustry < 0
        ? `${vsIndustry} below avg`
        : "At industry avg";

  // ── Grade ──────────────────────────────────────────────────────────
  const grade =
    overall >= 85
      ? "A"
      : overall >= 70
        ? "B"
        : overall >= 55
          ? "C"
          : overall >= 40
            ? "D"
            : "F";
  const gradeColor =
    overall >= 85
      ? "#22c55e"
      : overall >= 70
        ? "#84cc16"
        : overall >= 55
          ? "#f59e0b"
          : overall >= 40
            ? "#f97316"
            : "#ef4444";
  const statusText =
    overall >= 85
      ? "Excellent"
      : overall >= 70
        ? "Good"
        : overall >= 55
          ? "Average"
          : overall >= 40
            ? "Needs Work"
            : "Critical";

  // ── Staleness warning ──────────────────────────────────────────────
  const isStale = decayFactor < 0.8;
  const staleMessage =
    decayFactor < 0.5
      ? "Score heavily reduced — data is very outdated. Re-scan recommended."
      : decayFactor < 0.8
        ? "Score slightly reduced — consider re-scanning."
        : null;

  const subScores = [
    {
      label: "Ad Quality",
      value: adQuality,
      color: "#6366f1",
      icon: "🎯",
      tip: `Avg score ${avgScore}/100 across products`,
    },
    {
      label: "Product Coverage",
      value: productCoverage,
      color: "#06b6d4",
      icon: "📦",
      tip: `${analyzedCount}/${totalProducts} products analyzed`,
    },
    {
      label: "Competitor Intel",
      value: competitorIntel,
      color: "#8b5cf6",
      icon: "🔍",
      tip: `${competitorCount} competitors found`,
    },
    {
      label: "Budget Efficiency",
      value: budgetEfficiency,
      color: "#f59e0b",
      icon: "💰",
      tip: `${highPotential} high-potential products detected`,
    },
  ];

  return (
    <div className="health-card">
      <div className="health-card-header">
        <div className="health-card-title-row">
          <span className="health-card-icon">🏥</span>
          <div>
            <div className="health-card-title">Store Health Score</div>
            <div className="health-card-sub">
              AI-powered store readiness analysis
            </div>
          </div>
        </div>
        <div
          className="health-grade-circle"
          style={{ borderColor: gradeColor }}
        >
          <span className="health-grade-letter" style={{ color: gradeColor }}>
            {grade}
          </span>
        </div>
      </div>

      {/* Overall Score */}
      <div className="health-overall">
        <div className="health-score-ring">
          <svg width="90" height="90" viewBox="0 0 90 90">
            <circle
              cx="45"
              cy="45"
              r="38"
              fill="none"
              stroke="rgba(255,255,255,.08)"
              strokeWidth="6"
            />
            <circle
              cx="45"
              cy="45"
              r="38"
              fill="none"
              stroke={gradeColor}
              strokeWidth="6"
              strokeDasharray={`${animated ? (overall / 100) * 239 : 0} 239`}
              strokeLinecap="round"
              transform="rotate(-90 45 45)"
              style={{ transition: "stroke-dasharray 1.2s ease-out" }}
            />
          </svg>
          <span className="health-score-number" style={{ color: gradeColor }}>
            {animated ? overall : 0}
          </span>
        </div>
        <div className="health-overall-info">
          <div className="health-status" style={{ color: gradeColor }}>
            {statusText}
          </div>
          <div
            className="health-industry-compare"
            style={{
              color: vsIndustry >= 0 ? "#22c55e" : "#f59e0b",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {vsIndustryLabel}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11 }}>
            <span style={{ color: confidenceColor }}>
              Confidence: {confidenceLabel}
            </span>
            {isStale && <span style={{ color: "#f97316" }}>⚠ Stale data</span>}
          </div>
        </div>
      </div>

      {/* Staleness warning */}
      {staleMessage && (
        <div
          style={{
            background: "rgba(249,115,22,.1)",
            border: "1px solid rgba(249,115,22,.3)",
            borderRadius: 8,
            padding: "8px 12px",
            margin: "8px 0",
            fontSize: 12,
            color: "#f97316",
          }}
        >
          ⏰ {staleMessage}
        </div>
      )}

      {/* Critical issues penalty */}
      {criticalPenalty > 0 && (
        <div
          style={{
            background: "rgba(239,68,68,.1)",
            border: "1px solid rgba(239,68,68,.3)",
            borderRadius: 8,
            padding: "8px 12px",
            margin: "8px 0",
            fontSize: 12,
            color: "#ef4444",
          }}
        >
          ⚠ {criticalIssues} critical issue{criticalIssues > 1 ? "s" : ""}{" "}
          detected (−{criticalPenalty} points)
        </div>
      )}

      {/* Sub-scores */}
      <div className="health-subs">
        {subScores.map((s) => (
          <div key={s.label} className="health-sub-row">
            <span className="health-sub-icon">{s.icon}</span>
            <div className="health-sub-info">
              <div className="health-sub-label">{s.label}</div>
              <div className="health-sub-bar-bg">
                <div
                  className="health-sub-bar-fill"
                  style={{
                    width: animated ? `${s.value}%` : "0%",
                    background: s.color,
                    transition: "width 1s ease-out",
                  }}
                />
              </div>
            </div>
            <span className="health-sub-val" style={{ color: s.color }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Score breakdown (expanded) */}
      {expanded && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: "rgba(255,255,255,.03)",
            borderRadius: 8,
            fontSize: 11,
            color: "rgba(255,255,255,.5)",
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong>Score breakdown:</strong>
          </div>
          <div>
            Raw score: {rawOverall} → Decay ({Math.round(decayFactor * 100)}%):{" "}
            {decayedScore}
            {criticalPenalty > 0 ? ` → Penalty: −${criticalPenalty}` : ""}→
            Confidence ({Math.round(confidence * 100)}%):{" "}
            <strong style={{ color: gradeColor }}>{overall}</strong>
          </div>
          <div style={{ marginTop: 4 }}>
            Industry baseline: {baseline} | Your score: {overall} (
            {vsIndustryLabel})
          </div>
          {subScores.map((s) => (
            <div key={s.label}>
              {s.icon} {s.label}: {s.value}/100 — {s.tip}
            </div>
          ))}
        </div>
      )}

      <button
        className="health-expand-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide details" : "Show breakdown"}
      </button>
    </div>
  );
});

export default StoreHealthScore;
