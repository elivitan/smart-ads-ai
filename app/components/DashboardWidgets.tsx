import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

interface StoreHealthScoreProps {
  analyzedCount: number;
  totalProducts: number;
  avgScore: number;
  highPotential: number;
  competitorCount: number;
}

interface TopMissedOpportunityProps {
  topProduct: any;
  avgScore: number;
  totalMonthlyGapLoss: number;
  analyzedCount: number;
  onScan: () => void;
  onViewProduct: (p: any) => void;
  hasScanAccess: boolean;
}

interface BudgetSimulatorProps {
  avgScore: number;
  avgCpc: number;
  canPublish: boolean;
  onUpgrade: () => void;
}


const StoreHealthScore = React.memo(function StoreHealthScore({ analyzedCount, totalProducts, avgScore, highPotential, competitorCount }: StoreHealthScoreProps) {
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


const TopMissedOpportunity = React.memo(function TopMissedOpportunity({ topProduct, avgScore, totalMonthlyGapLoss, analyzedCount, onScan, onViewProduct, hasScanAccess }: TopMissedOpportunityProps) {
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

const BudgetSimulator = React.memo(function BudgetSimulator({ avgScore, avgCpc, canPublish, onUpgrade }: BudgetSimulatorProps) {
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

export { StoreHealthScore, TopMissedOpportunity, BudgetSimulator };
