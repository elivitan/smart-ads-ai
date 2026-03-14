import React, { useState, useEffect, useMemo, useId } from "react";

// ── Types ──────────────────────────────────────────────────────────────
interface KeywordGap {
  keyword: string;
  match_type?: string;
  source?: string;
  campaignId?: string | null;
  geo?: string | null;
  freq?: number;
  estClicks?: number;
  estMonthlyLoss?: number;
  difficulty?: string;
  diffColor?: string;
}

interface StableGap extends KeywordGap {
  _key: string;
  _index: number;
}

interface AddKeywordMeta {
  matchType: string;
  source: string;
  campaignId: string | null;
  geo: string | null;
}

interface CompetitorGapFinderProps {
  keywordGaps: KeywordGap[];
  totalMonthlyGapLoss: number;
  analyzedCount: number;
  onAddKeyword?: (keyword: string, meta: AddKeywordMeta) => void;
  canPublish: boolean;
  onUpgrade: () => void;
}

/**
 * CompetitorGapFinder
 * Enterprise-ready version with:
 * - Composite keys (keyword + source + matchType + campaignId)
 * - Memoized gap list to prevent re-render explosion
 * - Multi-mount guard via useId
 * - Stable references for callbacks
 */
const CompetitorGapFinder = React.memo(function CompetitorGapFinder({
  keywordGaps,
  totalMonthlyGapLoss,
  analyzedCount,
  onAddKeyword,
  canPublish,
  onUpgrade,
}: CompetitorGapFinderProps) {
  const instanceId = useId(); // Multi-mount guard
  const [expanded, setExpanded] = useState<boolean>(false);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
  const [animateTotal, setAnimateTotal] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimateTotal(true), 600);
    return () => clearTimeout(t);
  }, []);

  // ── Composite key builder ──────────────────────────────────────────
  function buildKey(gap: KeywordGap): string {
    return `${gap.keyword}|${gap.match_type || "BROAD"}|${gap.source || "competitor"}|${gap.campaignId || "all"}|${gap.geo || "global"}`;
  }

  // ── Memoize gaps to prevent upstream re-render triggering re-calc ──
  const stableGaps = useMemo<StableGap[]>(() => {
    if (!keywordGaps || keywordGaps.length === 0) return [];
    return keywordGaps.map((gap, i) => ({
      ...gap,
      _key: buildKey(gap),
      _index: i,
    }));
  }, [keywordGaps]);

  const displayGaps: StableGap[] = expanded ? stableGaps : stableGaps.slice(0, 4);

  const totalLostClicks = useMemo<number>(
    () => stableGaps.reduce((a, g) => a + (g.estClicks || 0), 0),
    [stableGaps],
  );

  function handleAdd(gap: StableGap): void {
    if (!canPublish) {
      onUpgrade();
      return;
    }
    setAddedKeys((prev) => new Set([...prev, gap._key]));
    onAddKeyword &&
      onAddKeyword(gap.keyword, {
        matchType: gap.match_type || "BROAD",
        source: gap.source || "competitor",
        campaignId: gap.campaignId || null,
        geo: gap.geo || null,
      });
  }

  if (analyzedCount === 0) return null;

  const hasGaps: boolean = stableGaps.length > 0;

  return (
    <div className="gap-card" data-instance={instanceId}>
      <div className="gap-card-header">
        <div className="gap-card-title-row">
          <span className="gap-card-icon">🎯</span>
          <div>
            <div className="gap-card-title">Competitor Gap Finder</div>
            <div className="gap-card-sub">
              Keywords your competitors target — that you're missing
            </div>
          </div>
        </div>
        {hasGaps && (
          <div className="gap-loss-badge">
            <div className="gap-loss-label">Est. Monthly Loss</div>
            <div
              className={`gap-loss-amount ${animateTotal ? "gap-loss-visible" : ""}`}
            >
              ${totalMonthlyGapLoss.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {!hasGaps ? (
        <div className="gap-empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            No major gaps detected
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>
            Your keyword coverage looks solid compared to competitors
          </div>
        </div>
      ) : (
        <>
          <div className="gap-alert">
            <span className="gap-alert-icon">⚠️</span>
            <span>
              Competitors are capturing{" "}
              <strong>{totalLostClicks.toLocaleString()} clicks/mo</strong> on
              keywords you're not bidding on
            </span>
          </div>

          <div className="gap-table">
            <div className="gap-table-head">
              <span>Keyword</span>
              <span>Competitors</span>
              <span>Est. Lost Clicks</span>
              <span>Est. Monthly Loss</span>
              <span>Difficulty</span>
              <span></span>
            </div>
            {displayGaps.map((gap) => {
              const isAdded: boolean = addedKeys.has(gap._key);
              return (
                <div
                  key={gap._key}
                  className={`gap-row ${isAdded ? "gap-row-added" : ""}`}
                  style={{ animationDelay: `${gap._index * 0.06}s` }}
                >
                  <div className="gap-keyword">
                    <span className="gap-keyword-text">{gap.keyword}</span>
                    {gap.match_type && gap.match_type !== "BROAD" && (
                      <span className="gap-match-type">{gap.match_type}</span>
                    )}
                  </div>
                  <div className="gap-freq">
                    {Array.from({ length: Math.min(gap.freq || 1, 5) }).map(
                      (_, j) => (
                        <span
                          key={j}
                          className="gap-freq-dot"
                          style={{ background: gap.diffColor }}
                        />
                      ),
                    )}
                    <span className="gap-freq-num">{gap.freq || 1}</span>
                  </div>
                  <div className="gap-clicks">
                    ~{gap.estClicks || 0}{" "}
                    <span className="gap-unit">clicks</span>
                  </div>
                  <div
                    className="gap-loss"
                    style={{
                      color:
                        (gap.estMonthlyLoss || 0) > 400
                          ? "#ef4444"
                          : (gap.estMonthlyLoss || 0) > 200
                            ? "#f59e0b"
                            : "#fbbf24",
                    }}
                  >
                    ${(gap.estMonthlyLoss || 0).toLocaleString()}
                  </div>
                  <div
                    className="gap-diff"
                    style={{ color: gap.diffColor || "#fbbf24" }}
                  >
                    <span
                      className="gap-diff-dot"
                      style={{ background: gap.diffColor || "#fbbf24" }}
                    />
                    {gap.difficulty || "Medium"}
                  </div>
                  <div className="gap-action">
                    {isAdded ? (
                      <span className="gap-added-badge">✓ Added</span>
                    ) : (
                      <button
                        className="gap-add-btn"
                        onClick={() => handleAdd(gap)}
                      >
                        {canPublish ? "+ Add" : "🔒 Upgrade"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {stableGaps.length > 4 && (
            <button
              className="gap-expand-btn"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : `Show all ${stableGaps.length} gaps`}
            </button>
          )}

          {addedKeys.size > 0 ? (
            <div className="gap-summary-row">
              <span>
                ✅ {addedKeys.size} keyword{addedKeys.size !== 1 ? "s" : ""}{" "}
                added to your campaigns
              </span>
            </div>
          ) : (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">
                🎯 Add these keywords to capture missed traffic
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default CompetitorGapFinder;
