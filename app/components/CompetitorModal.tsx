import React, { useState, useEffect } from "react";

// ══════════════════════════════════════════════
// CompetitorModal.tsx — Competitor intelligence modal
// ══════════════════════════════════════════════

interface CompetitorMention {
  product: string;
  position: number;
  strength: "strong" | "medium" | "weak";
  price_range: string;
  keywords: string[];
}

interface CompetitorAd {
  headline: string;
  headline2: string;
  headline3: string;
  description: string;
  url: string;
  position: number;
  keywords: string[];
}

interface CompetitorData {
  domain: string;
  strength: "strong" | "medium" | "weak";
  avgPosition: number;
  estMonthlyTraffic: number;
  estAdSpend: number;
  productsFound: number;
  keywords: string[];
  ads: CompetitorAd[];
  priceRange: string;
  source: "estimated" | "real";
}

interface CompetitorInfo {
  domain: string;
  strength?: string;
  position?: number;
  price_range?: string;
}

interface ProductWithAi {
  title: string;
  aiAnalysis?: {
    competitor_intel?: {
      top_competitors?: CompetitorInfo[];
      keyword_gaps?: string[];
    };
  };
}

interface CompetitorModalProps {
  competitor: { domain: string } | null;
  products: ProductWithAi[];
  onClose: () => void;
}

// Seed-based pseudo-random to avoid hydration mismatch
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

export function CompetitorModal({ competitor, products, onClose }: CompetitorModalProps): React.JSX.Element | null {
  const [loading, setLoading] = useState<boolean>(true);
  const [compData, setCompData] = useState<CompetitorData | null>(null);
  const domain = competitor?.domain;

  function buildFromMentions(mentions: CompetitorMention[]): CompetitorData {
    const strength = mentions[0]?.strength || "medium";
    const avgPos = mentions.length > 0
      ? Math.round(mentions.reduce((a, m) => a + (m.position || 3), 0) / mentions.length)
      : 3;
    const trafficBase = strength === "strong" ? 18000 : strength === "medium" ? 8000 : 3000;
    // Use seeded random based on domain to avoid hydration mismatch
    const rand = seededRandom(domain || "default");
    const estMonthlyTraffic = Math.round(trafficBase * (1 + rand * 0.4));
    const estAdSpend = Math.round(estMonthlyTraffic * (strength === "strong" ? 0.9 : 0.5));
    const allKeywords = [...new Set(mentions.flatMap(m => m.keywords || []))].slice(0, 8);
    const brand = (domain || "").split(".")[0];
    const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
    const mockAds: CompetitorAd[] = [
      {
        headline: `${cap(brand)} Official Store`,
        headline2: "Free Shipping On All Orders",
        headline3: "Shop Now & Save 40%",
        description: "Discover our full range of premium products. Trusted by thousands. Fast delivery guaranteed.",
        url: `https://${domain}`,
        position: avgPos,
        keywords: allKeywords.slice(0, 3),
      },
      ...(allKeywords.length > 2
        ? [{
            headline: `Best ${cap(allKeywords[0] || "Products")}`,
            headline2: "Compare & Save Today",
            headline3: "Limited Time Deal",
            description: `Looking for ${allKeywords[0] || "great products"}? Best selection at unbeatable prices. Free returns.`,
            url: `https://${domain}/shop`,
            position: avgPos + 1,
            keywords: allKeywords.slice(1, 4),
          }]
        : []),
    ];
    return {
      domain: domain || "",
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
    const mentions: CompetitorMention[] = products.flatMap((p) => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return [];
      const found = (intel.top_competitors || []).find((c) => c.domain === domain);
      if (!found) return [];
      return [{
        product: p.title,
        position: found.position || 3,
        strength: (found.strength as CompetitorMention["strength"]) || "medium",
        price_range: found.price_range || "Unknown",
        keywords: (intel.keyword_gaps || []).slice(0, 5),
      }];
    });

    async function enrich(): Promise<void> {
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
            setCompData({ ...buildFromMentions(mentions), ...d.data, source: "real" });
            setLoading(false);
            return;
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[SmartAds] CompetitorModal:enrich error:", message);
      }
      setCompData(buildFromMentions(mentions));
      setLoading(false);
    }

    setTimeout(enrich, 700);
  }, [domain]);

  if (!competitor) return null;
  const strengthColor: string =
    ({ strong: "#ef4444", medium: "#f59e0b", weak: "#22c55e" } as Record<string, string>)[compData?.strength || ""] || "#a5b4fc";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide comp-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="comp-modal-header">
          <div className="comp-modal-favicon">
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt=""
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              style={{ width: 28, height: 28 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="comp-modal-domain">
                {domain}
              </a>
              {compData && (
                <span className="comp-modal-strength" style={{ color: strengthColor, borderColor: `${strengthColor}44` }}>
                  {compData.strength}
                </span>
              )}
              {compData?.source === "estimated" && <span className="comp-est-badge">AI Estimate</span>}
              {compData?.source === "real" && <span className="comp-real-badge">● Live Data</span>}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 3 }}>
              Competing on {compData?.productsFound || "?"} of your products
            </div>
          </div>
        </div>

        {loading ? (
          <div className="comp-modal-loading">
            <div className="comp-loading-spinner" />
            <div style={{ fontSize: 14, color: "rgba(255,255,255,.5)" }}>Analyzing competitor intelligence...</div>
          </div>
        ) : compData ? (
          <>
            <div className="comp-metrics-row">
              {([
                { icon: "📈", val: compData.estMonthlyTraffic.toLocaleString(), lbl: "Est. Monthly Traffic" },
                { icon: "💸", val: "$" + compData.estAdSpend.toLocaleString(), lbl: "Est. Ad Spend/mo" },
                { icon: "📍", val: "#" + compData.avgPosition, lbl: "Avg Google Position" },
                { icon: "🔑", val: String(compData.keywords.length), lbl: "Keyword Overlaps" },
              ] as const).map((m, i) => (
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
                      <div className="comp-ad-position-badge">Position #{ad.position}</div>
                      <div className="comp-ad-inner">
                        <div className="comp-ad-sponsored">Sponsored</div>
                        <div className="comp-ad-url-row">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                            alt=""
                            style={{ width: 14, height: 14 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <span style={{ fontSize: 12, color: "#202124" }}>{ad.url}</span>
                        </div>
                        <div className="comp-ad-headline">
                          {ad.headline} | {ad.headline2} | {ad.headline3}
                        </div>
                        <div className="comp-ad-desc">{ad.description}</div>
                        {ad.keywords?.length > 0 && (
                          <div className="comp-ad-kw-row">
                            {ad.keywords.map((k, j) => (
                              <span key={j} className="comp-ad-kw">{k}</span>
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
                <div className="comp-section-title">🔑 Keywords They Target — You Don't</div>
                <div className="comp-kw-grid">
                  {compData.keywords.map((k, i) => (
                    <div key={i} className="comp-kw-chip">+ {k}</div>
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
        ) : null}
      </div>
    </div>
  );
}
