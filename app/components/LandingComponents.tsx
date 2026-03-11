import React, { useState, useEffect } from "react";

function LandingBudgetTeaser(): React.JSX.Element {
  const [daily, setDaily] = useState<number>(30);
  const cpc = 0.72;
  const clicks = Math.round(daily / cpc);
  const orders = (clicks * 0.028).toFixed(1);
  const revenue = Math.round(clicks * 0.028 * 85);
  const roas = (revenue / daily).toFixed(1);
  const roasColor = parseFloat(roas) >= 4 ? "#22c55e" : parseFloat(roas) >= 2 ? "#f59e0b" : "#ef4444";

  return (
    <div className="lp-budget-card">
      <div className="lp-budget-slider-wrap">
        <div className="lp-budget-slider-label">
          <span>Daily Budget</span>
          <span className="lp-budget-val">${daily}/day</span>
        </div>
        <input type="range" min="5" max="200" step="5" value={daily}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDaily(Number(e.target.value))}
          className="budget-sim-slider" />
        <div className="budget-sim-range-labels"><span>$5</span><span>$200</span></div>
      </div>
      <div className="lp-budget-results">
        <div className="lp-budget-result">
          <div className="lp-budget-result-val">{clicks.toLocaleString()}</div>
          <div className="lp-budget-result-lbl">👆 Clicks/day</div>
        </div>
        <div className="lp-budget-result">
          <div className="lp-budget-result-val">{orders}</div>
          <div className="lp-budget-result-lbl">🛍 Orders/day</div>
        </div>
        <div className="lp-budget-result">
          <div className="lp-budget-result-val">${revenue.toLocaleString()}</div>
          <div className="lp-budget-result-lbl">💵 Revenue/day</div>
        </div>
        <div className="lp-budget-result" style={{borderColor: roasColor + "55"}}>
          <div className="lp-budget-result-val" style={{color: roasColor}}>{roas}x</div>
          <div className="lp-budget-result-lbl">📈 ROAS</div>
        </div>
      </div>
      <div className="lp-budget-footer">
        * Based on avg Shopify store metrics · Your actual results depend on products & competition
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// LANDING PAGE — WHAT YOU'RE MISSING
// ══════════════════════════════════════════════

interface LandingMissingBlockProps {
  onInstall: () => void;
}

interface CounterState {
  competitors: number;
  revenue: number;
  products: number;
}

function LandingMissingBlock({ onInstall }: LandingMissingBlockProps): React.JSX.Element {
  const [counter, setCounter] = useState<CounterState>({ competitors: 38, revenue: 1840, products: 0 });

  useEffect(() => {
    const iv = setInterval(() => {
      setCounter(prev => ({
        competitors: prev.competitors + Math.floor(Math.random() * 2),
        revenue: prev.revenue + Math.floor(Math.random() * 40 + 10),
        products: prev.products,
      }));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const stats = [
    { icon: "⚔️", val: counter.competitors, suffix: "", label: "competitors bidding on your keywords right now", color: "#ef4444" },
    { icon: "💸", val: `$${counter.revenue.toLocaleString()}`, suffix: "/mo", label: "in revenue going to competitors this month", color: "#f59e0b" },
    { icon: "📭", val: counter.products, suffix: "", label: "of your products have active Google Ads", color: "#6366f1" },
  ];

  return (
    <div className="lp-missing-card">
      <div className="lp-missing-stats">
        {stats.map((s, i) => (
          <div key={i} className="lp-missing-stat">
            <div className="lp-missing-icon">{s.icon}</div>
            <div className="lp-missing-val" style={{color: s.color}}>
              {s.val}{s.suffix}
            </div>
            <div className="lp-missing-lbl">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="lp-missing-cta">
        <div className="lp-missing-cta-text">
          <strong>See your real numbers →</strong>
          <span> Connect your store and get a full competitive analysis in 60 seconds.</span>
        </div>
        <button className="lp-missing-btn" onClick={onInstall}>
          ⚡ Get My Free Analysis
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
// TOP MISSED OPPORTUNITY CARD
// ══════════════════════════════════════════════

export { LandingBudgetTeaser, LandingMissingBlock };
