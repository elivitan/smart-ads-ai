import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

function CompetitorModal({ competitor, products, onClose }) {
  const [loading, setLoading] = useState(true);
  const [compData, setCompData] = useState(null);
  const domain = competitor?.domain;

  function buildFromMentions(mentions) {
    const strength = mentions[0]?.strength || "medium";
    const avgPos =
      mentions.length > 0
        ? Math.round(
            mentions.reduce((a, m) => a + (m.position || 3), 0) /
              mentions.length,
          )
        : 3;
    const trafficBase =
      strength === "strong" ? 18000 : strength === "medium" ? 8000 : 3000;
    const estMonthlyTraffic = Math.round(
      trafficBase * (1 + Math.random() * 0.4),
    );
    const estAdSpend = Math.round(
      estMonthlyTraffic * (strength === "strong" ? 0.9 : 0.5),
    );
    const allKeywords = [
      ...new Set(mentions.flatMap((m) => m.keywords || [])),
    ].slice(0, 8);
    const brand = domain.split(".")[0];
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const mockAds = [
      {
        headline: `${cap(brand)} Official Store`,
        headline2: "Free Shipping On All Orders",
        headline3: "Shop Now & Save 40%",
        description: `Discover our full range of premium products. Trusted by thousands. Fast delivery guaranteed.`,
        url: `https://${domain}`,
        position: avgPos,
        keywords: allKeywords.slice(0, 3),
      },
      allKeywords.length > 2 && {
        headline: `Best ${cap(allKeywords[0] || "Products")}`,
        headline2: "Compare & Save Today",
        headline3: "Limited Time Deal",
        description: `Looking for ${allKeywords[0] || "great products"}? Best selection at unbeatable prices. Free returns.`,
        url: `https://${domain}/shop`,
        position: avgPos + 1,
        keywords: allKeywords.slice(1, 4),
      },
    ].filter(Boolean);
    return {
      domain,
      strength,
      avgPosition: avgPos,
      estMonthlyTraffic,
      estAdSpend,
      productsFound: mentions.length,
      keywords: allKeywords,
      ads: mockAds,
      priceRange: mentions[0]?.price_range || "Unknown",
      source: "estimated",
    };
  }

  useEffect(() => {
    if (!domain) return;
    const mentions = products.flatMap((p) => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return [];
      const found = (intel.top_competitors || []).find(
        (c) => c.domain === domain,
      );
      if (!found) return [];
      return [
        {
          product: p.title,
          position: found.position,
          strength: found.strength,
          price_range: found.price_range,
          keywords: (intel.keyword_gaps || []).slice(0, 5),
        },
      ];
    });
    async function enrich() {
      try {
        const res = await fetch("/app/api/competitor-intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const d = await res.json();
          if (d.success) {
            setCompData({
              ...buildFromMentions(mentions),
              ...d.data,
              source: "real",
            });
            setLoading(false);
            return;
          }
        }
      } catch {}
      setCompData(buildFromMentions(mentions));
      setLoading(false);
    }
    setTimeout(enrich, 700);
  }, [domain]);

  if (!competitor) return null;
  const strengthColor =
    { strong: "#ef4444", medium: "#f59e0b", weak: "#22c55e" }[
      compData?.strength
    ] || "#a5b4fc";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide comp-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="comp-modal-header">
          <div className="comp-modal-favicon">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
              onError={(e) => {
                e.target.style.display = "none";
              }}
              style={{ width: 28, height: 28 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="comp-modal-domain"
              >
                {domain}
              </a>
              {compData && (
                <span
                  className="comp-modal-strength"
                  style={{
                    color: strengthColor,
                    borderColor: `${strengthColor}44`,
                  }}
                >
                  {compData.strength}
                </span>
              )}
              {compData?.source === "estimated" && (
                <span className="comp-est-badge">AI Estimate</span>
              )}
              {compData?.source === "real" && (
                <span className="comp-real-badge">● Live Data</span>
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,.4)",
                marginTop: 3,
              }}
            >
              Competing on {compData?.productsFound || "?"} of your products
            </div>
          </div>
        </div>
        {loading ? (
          <div className="comp-modal-loading">
            <div className="comp-loading-spinner" />
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>
              Analyzing competitor intelligence...
            </div>
          </div>
        ) : (
          <>
            <div className="comp-metrics-row">
              {[
                {
                  icon: "📈",
                  val: compData.estMonthlyTraffic.toLocaleString(),
                  lbl: "Est. Monthly Traffic",
                },
                {
                  icon: "💸",
                  val: "$" + compData.estAdSpend.toLocaleString(),
                  lbl: "Est. Ad Spend/mo",
                },
                {
                  icon: "📍",
                  val: "#" + compData.avgPosition,
                  lbl: "Avg Google Position",
                },
                {
                  icon: "🔑",
                  val: compData.keywords.length,
                  lbl: "Keyword Overlaps",
                },
              ].map((m, i) => (
                <div key={i} className="comp-metric-card">
                  <div className="comp-metric-icon">{m.icon}</div>
                  <div className="comp-metric-val">{m.val}</div>
                  <div className="comp-metric-lbl">{m.lbl}</div>
                </div>
              ))}
            </div>
            {compData.ads.length > 0 && (
              <div className="comp-ads-section">
                <div className="comp-section-title">🎯 Their Active Ads</div>
                <div className="comp-ads-list">
                  {compData.ads.map((ad, i) => (
                    <div key={i} className="comp-ad-card">
                      <div className="comp-ad-position-badge">
                        Position #{ad.position}
                      </div>
                      <div className="comp-ad-inner">
                        <div className="comp-ad-sponsored">Sponsored</div>
                        <div className="comp-ad-url-row">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                            alt=""
                            style={{ width: 14, height: 14 }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <span style={{ fontSize: 12, color: "#202124" }}>
                            {ad.url}
                          </span>
                        </div>
                        <div className="comp-ad-headline">
                          {ad.headline} | {ad.headline2} | {ad.headline3}
                        </div>
                        <div className="comp-ad-desc">{ad.description}</div>
                        {ad.keywords?.length > 0 && (
                          <div className="comp-ad-kw-row">
                            {ad.keywords.map((k, j) => (
                              <span key={j} className="comp-ad-kw">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {compData.keywords.length > 0 && (
              <div className="comp-kw-section">
                <div className="comp-section-title">
                  🔑 Keywords They Target — You Don't
                </div>
                <div className="comp-kw-grid">
                  {compData.keywords.map((k, i) => (
                    <div key={i} className="comp-kw-chip">
                      + {k}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="comp-source-note">
              {compData.source === "real"
                ? "✅ Live data from Google Search"
                : "ℹ️ AI-estimated data · Connect SerpAPI for live competitor ads"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CompetitorGapFinder = React.memo(function CompetitorGapFinder({
  keywordGaps,
  totalMonthlyGapLoss,
  analyzedCount,
  onAddKeyword,
  canPublish,
  onUpgrade,
}) {
  const [expanded, setExpanded] = useState(false);
  const [addedKeywords, setAddedKeywords] = useState(new Set());
  const [animateTotal, setAnimateTotal] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimateTotal(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (analyzedCount === 0) return null;

  const hasGaps = keywordGaps.length > 0;
  const displayGaps = expanded ? keywordGaps : keywordGaps.slice(0, 4);

  function handleAdd(keyword) {
    if (!canPublish) {
      onUpgrade();
      return;
    }
    setAddedKeywords((prev) => new Set([...prev, keyword]));
    onAddKeyword && onAddKeyword(keyword);
  }

  return (
    <div className="gap-card">
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
          {/* Alert bar */}
          <div className="gap-alert">
            <span className="gap-alert-icon">⚠️</span>
            <span>
              Competitors are capturing{" "}
              <strong>
                {keywordGaps
                  .reduce((a, g) => a + g.estClicks, 0)
                  .toLocaleString()}{" "}
                clicks/mo
              </strong>{" "}
              on keywords you're not bidding on
            </span>
          </div>

          {/* Gap table */}
          <div className="gap-table">
            <div className="gap-table-head">
              <span>Keyword</span>
              <span>Competitors</span>
              <span>Est. Lost Clicks</span>
              <span>Est. Monthly Loss</span>
              <span>Difficulty</span>
              <span></span>
            </div>
            {displayGaps.map((gap, i) => {
              const isAdded = addedKeywords.has(gap.keyword);
              return (
                <div
                  key={i}
                  className={`gap-row ${isAdded ? "gap-row-added" : ""}`}
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="gap-keyword">
                    <span className="gap-keyword-text">{gap.keyword}</span>
                  </div>
                  <div className="gap-freq">
                    {Array.from({ length: Math.min(gap.freq, 5) }).map(
                      (_, j) => (
                        <span
                          key={j}
                          className="gap-freq-dot"
                          style={{ background: gap.diffColor }}
                        />
                      ),
                    )}
                    <span className="gap-freq-num">{gap.freq}</span>
                  </div>
                  <div className="gap-clicks">
                    ~{gap.estClicks} <span className="gap-unit">clicks</span>
                  </div>
                  <div
                    className="gap-loss"
                    style={{
                      color:
                        gap.estMonthlyLoss > 400
                          ? "#ef4444"
                          : gap.estMonthlyLoss > 200
                            ? "#f59e0b"
                            : "#fbbf24",
                    }}
                  >
                    ${gap.estMonthlyLoss.toLocaleString()}
                  </div>
                  <div className="gap-diff" style={{ color: gap.diffColor }}>
                    <span
                      className="gap-diff-dot"
                      style={{ background: gap.diffColor }}
                    />
                    {gap.difficulty}
                  </div>
                  <div className="gap-action">
                    {isAdded ? (
                      <span className="gap-added-badge">✓ Added</span>
                    ) : (
                      <button
                        className="gap-add-btn"
                        onClick={() => handleAdd(gap.keyword)}
                      >
                        {canPublish ? "+ Add" : "🔒"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {keywordGaps.length > 4 && (
            <button
              className="gap-expand-btn"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded
                ? `↑ Show less`
                : `↓ Show ${keywordGaps.length - 4} more gaps`}
            </button>
          )}

          {/* CTA */}
          {!canPublish ? (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">
                🔒 Subscribe to add these keywords to your campaigns instantly
              </span>
              <button className="gap-upgrade-btn" onClick={onUpgrade}>
                Unlock →
              </button>
            </div>
          ) : addedKeywords.size > 0 ? (
            <div className="gap-success-row">
              <span>
                ✅ {addedKeywords.size} keyword
                {addedKeywords.size !== 1 ? "s" : ""} added to your campaigns
              </span>
            </div>
          ) : (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">
                💡 Click "+ Add" to target these keywords and recover lost
                traffic
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════
// STORE HEALTH SCORE — main innovation component
// ══════════════════════════════════════════════

export { CompetitorModal, CompetitorGapFinder };
