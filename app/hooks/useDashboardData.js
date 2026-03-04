import { useMemo } from "react";

/**
 * useDashboardData
 * Enterprise data layer ג€” all heavy computations in one place.
 * UI components receive clean, pre-computed data.
 */
export function useDashboardData(allDbProducts) {
  const analyzedDbProducts = useMemo(
    () => allDbProducts.filter((p) => p.hasAiAnalysis),
    [allDbProducts],
  );

  // O(1) lookup maps ג€” no more O(n) find() in render
  const productById = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach((p) => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [allDbProducts]);

  const productByTitle = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach((p) => {
      if (p.title) map.set(p.title.toLowerCase(), p);
    });
    return map;
  }, [allDbProducts]);

  const analyzedCount = analyzedDbProducts.length;
  const totalProducts = allDbProducts.length;

  const avgScore = useMemo(
    () =>
      analyzedCount > 0
        ? Math.round(
            analyzedDbProducts.reduce(
              (a, p) => a + (p.aiAnalysis?.ad_score || 0),
              0,
            ) / analyzedCount,
          )
        : 0,
    [analyzedDbProducts, analyzedCount],
  );

  const highPotential = useMemo(
    () =>
      analyzedDbProducts.filter((p) => (p.aiAnalysis?.ad_score || 0) >= 70)
        .length,
    [analyzedDbProducts],
  );

  const sortedProducts = useMemo(
    () =>
      [...allDbProducts].sort(
        (a, b) => (b.aiAnalysis?.ad_score || 0) - (a.aiAnalysis?.ad_score || 0),
      ),
    [allDbProducts],
  );

  const topProduct = sortedProducts[0] || null;

  const topCompetitors = useMemo(() => {
    const allCompetitors = analyzedDbProducts.flatMap(
      (p) => p.aiAnalysis?.competitor_intel?.top_competitors || [],
    );
    const competitorMap = {};
    allCompetitors.forEach((c) => {
      if (!c.domain) return;
      if (!competitorMap[c.domain]) {
        competitorMap[c.domain] = {
          count: 0,
          strength: c.strength || "medium",
          keywords: [],
        };
      }
      competitorMap[c.domain].count++;
      if (c.keywords) competitorMap[c.domain].keywords.push(...c.keywords);
    });
    return Object.entries(competitorMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
  }, [analyzedDbProducts]);

  const { keywordGaps, totalMonthlyGapLoss } = useMemo(() => {
    const gaps = [];
    // Deterministic hash to avoid random jumps on re-render
    function simpleHash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++)
        h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    }
    analyzedDbProducts.forEach((p) => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return;
      (intel.keyword_gaps || []).forEach((kw) => {
        const keyword =
          typeof kw === "string" ? kw : kw?.keyword || kw?.text || "";
        if (!keyword) return;
        const hash = simpleHash(keyword + (p.title || ""));
        const estLoss = Math.round((avgScore || 50) * 0.8 + (hash % 200));
        gaps.push({
          keyword,
          product: p.title,
          productId: p.id,
          estMonthlyLoss: estLoss,
          difficulty:
            estLoss > 300 ? "Hard" : estLoss > 150 ? "Medium" : "Easy",
          competitor: intel.top_competitors?.[0]?.domain || "competitor.com",
        });
      });
    });
    gaps.sort((a, b) => b.estMonthlyLoss - a.estMonthlyLoss);
    return {
      keywordGaps: gaps.slice(0, 10),
      totalMonthlyGapLoss: gaps.reduce((a, g) => a + g.estMonthlyLoss, 0),
    };
  }, [analyzedDbProducts, avgScore]);

  const healthScore = useMemo(() => {
    if (analyzedCount === 0) return 0;
    const coverage =
      totalProducts > 0 ? (analyzedCount / totalProducts) * 25 : 0;
    const scoreComp = avgScore * 0.4;
    const competitorComp = Math.min(topCompetitors.length * 5, 20);
    const keywordComp = Math.min(keywordGaps.length * 1.5, 15);
    return Math.min(
      Math.round(coverage + scoreComp + competitorComp + keywordComp),
      100,
    );
  }, [analyzedCount, totalProducts, avgScore, topCompetitors, keywordGaps]);

  return {
    analyzedDbProducts,
    analyzedCount,
    totalProducts,
    avgScore,
    highPotential,
    sortedProducts,
    topProduct,
    topCompetitors,
    keywordGaps,
    totalMonthlyGapLoss,
    healthScore,
    productById,
    productByTitle,
  };
}
