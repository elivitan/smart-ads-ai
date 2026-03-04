import React, { useState, useEffect } from "react";

// ══════════════════════════════════════════════
// LANDING PAGE COMPONENTS
// Extracted from app._index.jsx for maintainability
// ══════════════════════════════════════════════

const TICKER_DATA = [
  { name: "🇺🇸 Shopify Plus store", action: "replaced a $2,500/mo agency with Smart Ads AI", time: "just now", emoji: "💎" },
  { name: "🇬🇧 First-time advertiser", action: "got their first Google Ads sale within 48 hours", time: "3 min ago", emoji: "🎯" },
  { name: "🇦🇺 Store with 340 products", action: "full AI scan completed in 58 seconds", time: "7 min ago", emoji: "⚡" },
  { name: "🇩🇪 DTC skincare brand", action: "went from 1.1x to 4.6x ROAS in 3 weeks", time: "19 min ago", emoji: "📈" },
];

export function SuccessTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % TICKER_DATA.length); setVisible(true); }, 500);
    }, 3500);
    return () => clearInterval(iv);
  }, []);
  const msg = TICKER_DATA[idx];
  return (
    <div className="ticker-wrap" style={{ opacity: visible ? 1 : 0, transition: "opacity .5s ease" }}>
      <span className="ticker-emoji">{msg.emoji}</span>
      <span className="ticker-text"><strong>{msg.name}</strong> {msg.action}</span>
      <span className="ticker-time">{msg.time}</span>
    </div>
  );
}

export function LandingBudgetTeaser() {
  const [daily, setDaily] = useState(30);
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
          onChange={e => setDaily(Number(e.target.value))}
          className="budget-sim-slider" />
        <div className="budget-sim-range-labels"><span>$5</span><span>$200</span></div>
      </div>
      <div className="lp-budget-results">
        {[
          { val: clicks.toLocaleString(), icon: "👆", lbl: "Clicks/day" },
          { val: orders, icon: "🛍", lbl: "Orders/day" },
          { val: `$${revenue.toLocaleString()}`, icon: "💵", lbl: "Revenue/day" },
          { val: `${roas}x`, icon: "📈", lbl: "ROAS", color: roasColor, border: roasColor + "55" },
        ].map((r, i) => (
          <div key={i} className="lp-budget-result" style={r.border ? { borderColor: r.border } : {}}>
            <div className="lp-budget-result-val" style={r.color ? { color: r.color } : {}}>{r.val}</div>
            <div className="lp-budget-result-lbl">{r.icon} {r.lbl}</div>
          </div>
        ))}
      </div>
      <div className="lp-budget-footer">
        * Based on avg Shopify store metrics · Your actual results depend on products & competition
      </div>
    </div>
  );
}

export function LandingMissingBlock({ onInstall }) {
  const [counter, setCounter] = useState({ competitors: 38, revenue: 1840 });

  useEffect(() => {
    const iv = setInterval(() => {
      setCounter(prev => ({
        competitors: prev.competitors + Math.floor(Math.random() * 2),
        revenue: prev.revenue + Math.floor(Math.random() * 40 + 10),
      }));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const stats = [
    { icon: "⚔️", val: counter.competitors, suffix: "", label: "competitors bidding on your keywords right now", color: "#ef4444" },
    { icon: "💸", val: `$${counter.revenue.toLocaleString()}`, suffix: "/mo", label: "in revenue going to competitors this month", color: "#f59e0b" },
    { icon: "📭", val: 0, suffix: "", label: "of your products have active Google Ads", color: "#6366f1" },
  ];

  return (
    <div className="lp-missing-card">
      <div className="lp-missing-stats">
        {stats.map((s, i) => (
          <div key={i} className="lp-missing-stat">
            <div className="lp-missing-icon">{s.icon}</div>
            <div className="lp-missing-val" style={{ color: s.color }}>{s.val}{s.suffix}</div>
            <div className="lp-missing-lbl">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="lp-missing-cta">
        <div className="lp-missing-cta-text">
          <strong>See your real numbers →</strong>
          <span> Connect your store and get a full competitive analysis in 60 seconds.</span>
        </div>
        <button className="lp-missing-btn" onClick={onInstall}>⚡ Get My Free Analysis</button>
      </div>
    </div>
  );
}

/**
 * Full Landing Page — shown when user has no subscription and hasn't scanned
 */
export default function LandingPage({ vis, onStartTrial, onFreeScan, onBuyCredits }) {
  return (
    <div className={`la ${vis ? "la-v" : ""}`}>
      <section className="hero">
        <div className="hero-badge">🤖 AI-Powered Google Ads for Shopify</div>
        <h1 className="hero-h">Stop guessing.<br /><span className="hero-grad">Start selling.</span></h1>
        <p className="hero-p">Smart Ads AI scans your competitors, checks your Google rankings, writes killer ad copy, and launches campaigns that convert — in 60 seconds.</p>
        <div className="hero-btns">
          <button className="btn-primary btn-lg" onClick={onStartTrial}>🚀 Start My Campaign</button>
          <button className="btn-secondary" onClick={onFreeScan}>Try Free Preview</button>
        </div>
        <div className="hero-nudge" onClick={onBuyCredits}>
          <span className="nudge-lock">⚡</span> No subscription? <strong>Buy scan credits</strong> — from $0.60/scan <span className="nudge-arrow">→</span>
        </div>
        <div className="hero-metrics">
          <div className="hm"><span className="hm-val">+340%</span><span className="hm-lbl">Avg ROAS</span></div>
          <div className="hm"><span className="hm-val">47hrs</span><span className="hm-lbl">Saved/month</span></div>
          <div className="hm"><span className="hm-val">-52%</span><span className="hm-lbl">CPC Reduction</span></div>
        </div>
        <SuccessTicker />
      </section>

      <section className="section lp-budget-section">
        <h2 className="sec-h">See your numbers before you commit</h2>
        <p className="sec-sub">Move the slider — watch your projected results update instantly.</p>
        <LandingBudgetTeaser />
      </section>

      <section className="section lp-missing-section">
        <h2 className="sec-h">What's happening while you wait</h2>
        <p className="sec-sub">Every day without Smart Ads AI, your competitors are pulling ahead.</p>
        <LandingMissingBlock onInstall={onStartTrial} />
      </section>

      <section className="section">
        <h2 className="sec-h">Sound familiar?</h2>
        <div className="pain-grid">
          {[
            { ic: "💸", t: "Wasted Ad Spend", d: "Thousands spent on agencies with nothing to show for it." },
            { ic: "😵", t: "Google Ads Confusion", d: "The interface is overwhelming. You don't know where to start." },
            { ic: "📝", t: "Generic Ad Copy", d: "Your ads sound like everyone else's. No personality, no conversions." },
            { ic: "⏰", t: "Weeks of Setup", d: "By the time your campaign launches, the trend is already over." },
          ].map((p, i) => <div key={i} className="pain-card"><span className="pain-ic">{p.ic}</span><h3 className="pain-t">{p.t}</h3><p className="pain-d">{p.d}</p></div>)}
        </div>
      </section>

      <section className="section">
        <h2 className="sec-h">What if AI could do it all — better?</h2>
        <div className="sol-grid">
          {[
            { n: "60", s: "seconds", d: "Full competitor scan + campaign-ready ads" },
            { n: "Top 10", s: "competitors", d: "Scraped and analyzed for every product" },
            { n: "Real", s: "data", d: "Keywords from Google, not guesses from a robot" },
          ].map((s, i) => <div key={i} className="sol-card"><div className="sol-n">{s.n}</div><div className="sol-s">{s.s}</div><p className="sol-d">{s.d}</p></div>)}
        </div>
      </section>

      <section className="section">
        <h2 className="sec-h">Stupidly simple. Seriously powerful.</h2>
        <div className="steps-grid">
          {[
            { n: "1", t: "Scan", d: "AI scans your products and searches Google for your competitors." },
            { n: "2", t: "Analyze", d: "See competitor keywords, your rankings, and AI-optimized ad copy." },
            { n: "3", t: "Launch", d: "One click to launch campaigns built on real competitive data." },
          ].map((s, i) => <div key={i} className="step-card"><div className="step-n">{s.n}</div><h3 className="step-t">{s.t}</h3><p className="step-d">{s.d}</p></div>)}
        </div>
      </section>

      <section className="section">
        <h2 className="sec-h">Everything you need. Nothing you don't.</h2>
        <div className="feat-grid">
          {[
            { ic: "🕵️", t: "Competitor Intelligence", d: "We scan your competitors' sites, steal their best keywords, and find gaps they're missing." },
            { ic: "📍", t: "Google Rank Check", d: "See exactly where your store ranks — and where it doesn't." },
            { ic: "🧠", t: "AI Ad Copy", d: "Headlines and descriptions based on what's actually working for top-ranking competitors." },
            { ic: "🎯", t: "Smart Keywords", d: "Real keywords pulled from competitor websites, Google results, and search trends." },
            { ic: "📊", t: "Ad Score + Strategy", d: "Each product gets a competitive score and a strategy: aggressive, defensive, or dominant." },
            { ic: "⚡", t: "One-Click Launch", d: "From scan to live Google Ads campaign in 60 seconds. All campaigns start paused for your review." },
          ].map((f, i) => <div key={i} className="feat-card"><span className="feat-ic">{f.ic}</span><h3 className="feat-t">{f.t}</h3><p className="feat-d">{f.d}</p></div>)}
        </div>
      </section>

      <section className="section">
        <h2 className="sec-h">Loved by Shopify merchants</h2>
        <div className="test-grid">
          {[
            { q: "Set up my first campaign in under 2 minutes. The AI copy was better than what my agency wrote.", n: "Sarah K.", r: "Fashion Store Owner" },
            { q: "Finally an app that makes Google Ads accessible. My ROAS went from 1.2x to 4.8x in a month.", n: "Mike T.", r: "Electronics Store" },
            { q: "I was spending $500/mo on a freelancer. Now AI does it better for $29/mo.", n: "Lisa R.", r: "Beauty & Wellness" },
          ].map((t, i) => <div key={i} className="test-card"><p className="test-q">"{t.q}"</p><div className="test-author"><strong>{t.n}</strong><span>{t.r}</span></div></div>)}
        </div>
      </section>

      <section className="section cta-section">
        <h2 className="cta-h">Your products deserve better ads.</h2>
        <p className="cta-p">Join 2,000+ Shopify merchants who stopped guessing and started growing.</p>
        <button className="btn-primary btn-lg" onClick={onStartTrial}>🚀 Start My Campaign →</button>
        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={onFreeScan}>🔍 Try Free Preview</button>
          <button className="btn-secondary" onClick={onBuyCredits}>⚡ Buy Scan Credits</button>
        </div>
      </section>
    </div>
  );
}
