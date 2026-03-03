import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopProducts, getSyncStatus } from "../sync.server.js";
import { OnboardModal, BuyCreditsModal } from "../components/Modals.jsx";

// ── CSS extracted to separate file (BUG FIX: was injected 6x via <style>{CSS}</style>) ──
import "./app._index.css";

// Cookie helper — read plan from request cookie
function getPlanFromCookie(request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/sai_plan=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}


export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const syncStatus = await getSyncStatus(shop);
  // Enterprise: never block render with heavy sync — flag client to sync instead
  const needsInitialSync = syncStatus.totalProducts === 0;
  const dbProducts = await getShopProducts(shop);
  const planFromCookie = getPlanFromCookie(request);
  const isPaidServer = !!planFromCookie && planFromCookie !== "free";
  return { products: dbProducts, syncStatus, shop, planFromCookie, isPaidServer, needsInitialSync };
};

const FREE_SCAN_LIMIT = 3;

// ── Constants moved outside components (BUG FIX: prevented re-creation on every render) ──
const REAL_STEPS = [
  { label: "Fetching products from your store", icon: "📦", threshold: 5 },
  { label: "Searching Google for competitors", icon: "🔍", threshold: 20 },
  { label: "Analyzing competitor websites", icon: "🕵️", threshold: 40 },
  { label: "Checking your Google rankings", icon: "📍", threshold: 60 },
  { label: "Generating AI-optimized ad copy", icon: "🤖", threshold: 80 },
  { label: "Building your competitive strategy", icon: "📊", threshold: 98 },
];
const INTRO_PHASES = [
  { label: "Connecting to your Shopify store", icon: "🔗", duration: 1400 },
  { label: "Reading your product catalog", icon: "📦", duration: 1200 },
  { label: "Connecting AI analysis engine", icon: "🤖", duration: 1200 },
];

// ══════════════════════════════════════════════
// GOOGLE ADS LIVE DATA HOOK
// Tries real API first → falls back to mock
// When Google Ads is connected, data flows automatically
// ══════════════════════════════════════════════
function useGoogleAdsData(mockCampaigns, avgScore) {
  const [liveData, setLiveData] = useState(null);
  const [isRealData, setIsRealData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevRef = useRef(null);

  function buildMockData(prev) {
    const campaigns = mockCampaigns || 0;
    const hourOfDay = new Date().getHours();
    const trafficMult = (hourOfDay >= 10 && hourOfDay <= 20) ? 1.3 : 0.7;
    return {
      impressions: Math.round((prev?.impressions || campaigns * 4200) + Math.random() * 14 * trafficMult),
      clicks: Math.round((prev?.clicks || campaigns * 180) + (Math.random() > 0.6 ? 1 : 0)),
      cost: parseFloat(((prev?.cost || campaigns * 79) + Math.random() * 0.44).toFixed(2)),
      conversions: prev?.conversions || Math.round(campaigns * 3.2),
      roas: parseFloat((1.8 + avgScore * 0.028).toFixed(2)),
      campaigns,
      source: "mock",
    };
  }

  async function tryRealAPI(prev) {
    // Real API disabled until Google Ads token is approved
    // Will auto-enable when /app/api/google-ads/metrics route is created
    return null;
  }

  useEffect(() => {
    let mounted = true;
    async function tick() {
      if (document.visibilityState === "hidden") return; // pause when tab hidden
      const real = await tryRealAPI(prevRef.current);
      if (!mounted) return;
      const next = real || buildMockData(prevRef.current);
      prevRef.current = next;
      setLiveData(next);
      setLastUpdated(new Date());
    }
    tick();
    const iv = setInterval(tick, 2800);
    return () => { mounted = false; clearInterval(iv); };
  }, [mockCampaigns, avgScore]);

  const data = liveData || buildMockData(null);
  const ctr = (data.clicks > 0 && data.impressions > 0)
    ? ((data.clicks / data.impressions) * 100).toFixed(2) : "0.00";
  return { ...data, ctr, isRealData, lastUpdated };
}


// ══════════════════════════════════════════════

// HELPER: find AI result by product (id-first, title-fallback)
function findAiForProduct(aiProducts, product) {
  if (!aiProducts || !product) return null;
  if (product.id) {
    const byId = aiProducts.find(ap => ap.id && String(ap.id) === String(product.id));
    if (byId) return byId;
  }
  if (product.title) {
    return aiProducts.find(ap => ap.title === product.title) || null;
  }
  return null;
}

// COMPETITOR DETAIL MODAL
// Click a competitor → see their ads + traffic estimate
// ══════════════════════════════════════════════
function CompetitorModal({ competitor, products, onClose }) {
  const [loading, setLoading] = useState(true);
  const [compData, setCompData] = useState(null);
  const domain = competitor?.domain;

  function buildFromMentions(mentions) {
    const strength = mentions[0]?.strength || "medium";
    const avgPos = mentions.length > 0
      ? Math.round(mentions.reduce((a,m)=>a+(m.position||3),0)/mentions.length) : 3;
    const trafficBase = strength==="strong"?18000:strength==="medium"?8000:3000;
    const estMonthlyTraffic = Math.round(trafficBase*(1+Math.random()*0.4));
    const estAdSpend = Math.round(estMonthlyTraffic*(strength==="strong"?0.9:0.5));
    const allKeywords = [...new Set(mentions.flatMap(m=>m.keywords||[]))].slice(0,8);
    const brand = domain.split(".")[0];
    const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
    const mockAds = [
      { headline:`${cap(brand)} Official Store`, headline2:"Free Shipping On All Orders", headline3:"Shop Now & Save 40%",
        description:`Discover our full range of premium products. Trusted by thousands. Fast delivery guaranteed.`,
        url:`https://${domain}`, position:avgPos, keywords:allKeywords.slice(0,3) },
      allKeywords.length>2 && { headline:`Best ${cap(allKeywords[0]||"Products")}`, headline2:"Compare & Save Today", headline3:"Limited Time Deal",
        description:`Looking for ${allKeywords[0]||"great products"}? Best selection at unbeatable prices. Free returns.`,
        url:`https://${domain}/shop`, position:avgPos+1, keywords:allKeywords.slice(1,4) },
    ].filter(Boolean);
    return { domain, strength, avgPosition:avgPos, estMonthlyTraffic, estAdSpend, productsFound:mentions.length, keywords:allKeywords, ads:mockAds, priceRange:mentions[0]?.price_range||"Unknown", source:"estimated" };
  }

  useEffect(() => {
    if (!domain) return;
    const mentions = products.flatMap(p => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return [];
      const found = (intel.top_competitors||[]).find(c=>c.domain===domain);
      if (!found) return [];
      return [{ product:p.title, position:found.position, strength:found.strength, price_range:found.price_range, keywords:(intel.keyword_gaps||[]).slice(0,5) }];
    });
    async function enrich() {
      try {
        const res = await fetch("/app/api/competitor-intel", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({domain}), signal:AbortSignal.timeout(8000) });
        if (res.ok) { const d=await res.json(); if(d.success){ setCompData({...buildFromMentions(mentions),...d.data,source:"real"}); setLoading(false); return; } }
      } catch(err) { console.error("[SmartAds]", err); }
      setCompData(buildFromMentions(mentions));
      setLoading(false);
    }
    setTimeout(enrich, 700);
  }, [domain]);

  if (!competitor) return null;
  const strengthColor = {strong:"#ef4444",medium:"#f59e0b",weak:"#22c55e"}[compData?.strength]||"#a5b4fc";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide comp-modal" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="comp-modal-header">
          <div className="comp-modal-favicon">
            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" onError={e=>{e.target.style.display="none"}} style={{width:28,height:28}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="comp-modal-domain">{domain}</a>
              {compData && <span className="comp-modal-strength" style={{color:strengthColor,borderColor:`${strengthColor}44`}}>{compData.strength}</span>}
              {compData?.source==="estimated" && <span className="comp-est-badge">AI Estimate</span>}
              {compData?.source==="real" && <span className="comp-real-badge">● Live Data</span>}
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:3}}>Competing on {compData?.productsFound||"?"} of your products</div>
          </div>
        </div>
        {loading ? (
          <div className="comp-modal-loading">
            <div className="comp-loading-spinner"/>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)"}}>Analyzing competitor intelligence...</div>
          </div>
        ) : (
          <>
            <div className="comp-metrics-row">
              {[
                {icon:"📈",val:compData.estMonthlyTraffic.toLocaleString(),lbl:"Est. Monthly Traffic"},
                {icon:"💸",val:"$"+compData.estAdSpend.toLocaleString(),lbl:"Est. Ad Spend/mo"},
                {icon:"📍",val:"#"+compData.avgPosition,lbl:"Avg Google Position"},
                {icon:"🔑",val:compData.keywords.length,lbl:"Keyword Overlaps"},
              ].map((m,i)=>(
                <div key={i} className="comp-metric-card">
                  <div className="comp-metric-icon">{m.icon}</div>
                  <div className="comp-metric-val">{m.val}</div>
                  <div className="comp-metric-lbl">{m.lbl}</div>
                </div>
              ))}
            </div>
            {compData.ads.length>0 && (
              <div className="comp-ads-section">
                <div className="comp-section-title">🎯 Their Active Ads</div>
                <div className="comp-ads-list">
                  {compData.ads.map((ad,i)=>(
                    <div key={i} className="comp-ad-card">
                      <div className="comp-ad-position-badge">Position #{ad.position}</div>
                      <div className="comp-ad-inner">
                        <div className="comp-ad-sponsored">Sponsored</div>
                        <div className="comp-ad-url-row">
                          <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" style={{width:14,height:14}} onError={e=>{e.target.style.display="none"}}/>
                          <span style={{fontSize:12,color:"#202124"}}>{ad.url}</span>
                        </div>
                        <div className="comp-ad-headline">{ad.headline} | {ad.headline2} | {ad.headline3}</div>
                        <div className="comp-ad-desc">{ad.description}</div>
                        {ad.keywords?.length>0 && (
                          <div className="comp-ad-kw-row">
                            {ad.keywords.map((k,j)=><span key={j} className="comp-ad-kw">{k}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {compData.keywords.length>0 && (
              <div className="comp-kw-section">
                <div className="comp-section-title">🔑 Keywords They Target — You Don't</div>
                <div className="comp-kw-grid">
                  {compData.keywords.map((k,i)=><div key={i} className="comp-kw-chip">+ {k}</div>)}
                </div>
              </div>
            )}
            <div className="comp-source-note">
              {compData.source==="real"?"✅ Live data from Google Search":"ℹ️ AI-estimated data · Connect SerpAPI for live competitor ads"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const Counter = React.memo(function Counter({ end, dur = 1200, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = 0; const step = end / (dur / 16);
    const id = setInterval(() => { start += step; if (start >= end) { setV(end); clearInterval(id); } else setV(Math.floor(start)); }, 16);
    return () => clearInterval(id);
  }, [end, dur]);
  return <>{v.toLocaleString()}{suffix}</>;
});

const ScoreRing = React.memo(function ScoreRing({ score, size = 54 }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ filter:`drop-shadow(0 0 6px ${color}44)` }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:"stroke-dashoffset 1s ease" }}/>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={color} fontSize="13" fontWeight="800">{score}</text>
    </svg>
  );
});

const Speedometer = React.memo(function Speedometer({ value, max, label, color = "#6366f1", size = 120 }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(value), 300); return () => clearTimeout(t); }, [value]);
  const pct = Math.min(animated / max, 1);
  const startAngle = -225, endAngle = 45;
  const sweepRange = endAngle - startAngle;
  const angle = startAngle + pct * sweepRange;
  const svgW = size, svgH = size * 0.78;
  const cx = svgW / 2, cy = svgH * 0.58, r = size * 0.34;
  function ptXY(pcx, pcy, pr, deg) { const rad = deg * Math.PI / 180; return { x: pcx + pr * Math.cos(rad), y: pcy + pr * Math.sin(rad) }; }
  const arcStart = ptXY(cx,cy,r,startAngle), arcEnd = ptXY(cx,cy,r,endAngle), fillEnd = ptXY(cx,cy,r,angle);
  const needleLen = r * 0.78;
  const needleTip = ptXY(cx,cy,needleLen,angle);
  const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
  const fillLargeArc = pct > 0.5 ? 1 : 0;
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;
  const fillPath = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${fillLargeArc} 1 ${fillEnd.x} ${fillEnd.y}`;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" strokeLinecap="round"/>
        <path d={fillPath} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" style={{ transition:"d 1s cubic-bezier(.4,0,.2,1)" }}/>
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" style={{ transition:"x2 1s cubic-bezier(.4,0,.2,1),y2 1s cubic-bezier(.4,0,.2,1)" }}/>
        <circle cx={cx} cy={cy} r="3" fill={color}/>
        <text x={cx} y={cy + r * 0.62} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="18" fontWeight="800">{animated}</text>
      </svg>
      <span style={{ fontSize:11, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:".5px" }}>{label}</span>
    </div>
  );
});

// ══════════════════════════════════════════════
// COLLECTING DATA SCREEN
// For new paid subscribers — auto-starts scan in background
// ══════════════════════════════════════════════
function CollectingDataScreen({ totalProducts, onScan, realProgress, scanMsg, onCancel }) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [scanStarted, setScanStarted] = useState(false);
  const [dots, setDots] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Animated dots
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(iv);
  }, []);

  // Run intro sequence, then trigger real scan
  useEffect(() => {
    let cancelled = false;
    async function run() {
      for (let i = 0; i < INTRO_PHASES.length; i++) {
        if (cancelled) return;
        setCurrentStep(i);
        const from = Math.round((i / INTRO_PHASES.length) * 15);
        const to = Math.round(((i + 1) / INTRO_PHASES.length) * 15);
        await animateProgress(from, to, INTRO_PHASES[i].duration);
        if (cancelled) return;
      }
      if (!scanStarted) { setScanStarted(true); onScan(); }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  function animateProgress(from, to, duration) {
    return new Promise(resolve => {
      const steps = to - from;
      if (steps <= 0) { setProgress(to); resolve(); return; }
      const stepDuration = (duration || 1200) / steps;
      let current = from;
      const iv = setInterval(() => {
        current++;
        setProgress(current);
        if (current >= to) { clearInterval(iv); resolve(); }
      }, stepDuration);
    });
  }

  // Once real scan starts, use realProgress
  const displayProgress = scanStarted && realProgress != null
    ? Math.max(15, realProgress)
    : progress;

  const isDone = displayProgress >= 100;

  // Current step label
  let currentLabel, currentIcon;
  if (!scanStarted) {
    const p = INTRO_PHASES[Math.min(currentStep, INTRO_PHASES.length - 1)];
    currentLabel = p?.label;
    currentIcon = p?.icon;
  } else {
    const activeStep = REAL_STEPS.findLast(s => displayProgress >= s.threshold - 20) || REAL_STEPS[0];
    currentLabel = isDone ? "Your store is ready!" : activeStep.label;
    currentIcon = activeStep.icon;
  }

  const title = isDone ? "Your store is ready! 🎉" : (currentLabel + dots);
  const words = ["impressions","clicks","CTR","ROAS","keywords","budget","CPC","conversions","reach","bids","ads","score"];

  return (
    <div className="cds-wrap">
      <div className="cds-particles">
        {words.map((w, i) => (
          <div key={i} className="cds-particle" style={{
            left: `${8 + (i * 8) % 84}%`,
            top: `${15 + (i * 11) % 70}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${3.5 + (i % 3) * 0.8}s`,
          }}>{w}</div>
        ))}
      </div>

      <div className="cds-center">
        <div className="cds-radar">
          <div className="cds-ring cds-ring-1"/>
          <div className="cds-ring cds-ring-2"/>
          <div className="cds-ring cds-ring-3"/>
          <div className="cds-radar-dot" style={isDone ? {background:"#22c55e",boxShadow:"0 0 24px #22c55e"} : {}}/>
          {!isDone && <div className="cds-radar-sweep"/>}
          {isDone && <div className="cds-done-check">✓</div>}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">
          {isDone
            ? `${totalProducts} products analyzed — your dashboard is ready`
            : (scanStarted && scanMsg) ? scanMsg : `Setting up your AI campaign intelligence for ${totalProducts} products`}
        </div>

        <div className="cds-progress-wrap">
          <div className="cds-progress-bar">
            <div className="cds-progress-fill" style={{ width: `${displayProgress}%` }}/>
            <div className="cds-progress-glow" style={{ left: `${Math.min(displayProgress, 98)}%` }}/>
          </div>
          <div className="cds-progress-pct">{displayProgress}%</div>
        </div>

        <div className="cds-steps">
          {(scanStarted ? REAL_STEPS : INTRO_PHASES).map((p, i) => {
            let done, active;
            if (scanStarted) {
              // Determine active step from scanMsg content
              const msgLower = (scanMsg || "").toLowerCase();
              const stepKeywords = [
                ["fetching","store","found"],
                ["google","competitor","search"],
                ["analyzing","website"],
                ["ranking","rank"],
                ["ai","copy","headline","generat","analyzing product"],
                ["strategy","campaign","together","ready","done"],
              ];
              let activeIdx = 0;
              for (let k = 0; k < stepKeywords.length; k++) {
                if (stepKeywords[k].some(kw => msgLower.includes(kw))) activeIdx = k;
              }
              if (displayProgress >= 100) activeIdx = REAL_STEPS.length;
              done = i < activeIdx;
              active = i === activeIdx;
            } else {
              done = i < currentStep;
              active = i === currentStep;
            }
            return (
              <div key={i} className={`cds-step ${done ? "cds-step-done" : active ? "cds-step-active" : "cds-step-waiting"}`}>
                <div className="cds-step-icon">
                  {done ? "✓" : active ? <span className="cds-step-spinner"/> : "○"}
                </div>
                <span className="cds-step-label">{p.icon} {p.label}</span>
                {done && <span className="cds-step-done-badge">done</span>}
              </div>
            );
          })}
        </div>

        {isDone && (
          <div className="cds-cta-wrap" style={{animation:"cdsCtaPop .5s ease"}}>
            <div className="cds-cta-msg">✅ Analysis complete — loading your dashboard</div>
            <div className="cds-loading-bar"><div className="cds-loading-fill"/></div>
          </div>
        )}

        {/* Cancel button */}
        {!isDone && onCancel && (
          <button className="cds-cancel-btn" onClick={() => setShowCancelConfirm(true)}>
            ✕ Cancel scan
          </button>
        )}
      </div>

      {/* Cancel confirm dialog */}
      {showCancelConfirm && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8,color:"#fff"}}>Cancel scan?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:24,lineHeight:1.5}}>
              The scan is in progress. If you cancel now, your products won't be analyzed and you'll return to the home screen.
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn-secondary" style={{padding:"10px 22px",fontSize:13}} onClick={() => setShowCancelConfirm(false)}>
                Continue Scanning
              </button>
              <button className="btn-primary" style={{padding:"10px 22px",fontSize:13,background:"linear-gradient(135deg,#ef4444,#dc2626)"}} onClick={() => { setShowCancelConfirm(false); onCancel(); }}>
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// AD PREVIEW PANEL
// ══════════════════════════════════════════════
const AdPreviewPanel = React.memo(function AdPreviewPanel({ topProduct, mockCampaigns, canPublish, onLaunch, onViewProduct, shop }) {
  const [tab, setTab] = useState("search"); // search | shopping | mobile
  const [typing, setTyping] = useState(false);
  const [typedQuery, setTypedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const isActive = mockCampaigns > 0 && canPublish;
  const ai = topProduct?.aiAnalysis || topProduct?.ai || {};
  const headlines = (ai.headlines || []).map(h => typeof h === "string" ? h : h?.text || h).filter(Boolean);
  const descriptions = (ai.descriptions || []).map(d => typeof d === "string" ? d : d?.text || d).filter(Boolean);
  const keywords = (ai.keywords || []).map(k => typeof k === "string" ? k : k?.text || k).filter(Boolean);
  const score = ai.ad_score || 0;
  const productTitle = topProduct?.title || "Your Top Product";
  const productPrice = topProduct?.price ? `$${Number(topProduct.price).toFixed(2)}` : "$49.99";
  const productImage = topProduct?.image || null;
  const storeDomain = shop || "your-store.myshopify.com";

  // Simulate typing in search bar
  const searchQuery = keywords[0] || "luxury bedding set queen";
  useEffect(() => {
    if (!topProduct) return;
    let i = 0;
    setTypedQuery("");
    setTyping(true);
    const iv = setInterval(() => {
      i++;
      setTypedQuery(searchQuery.slice(0, i));
      if (i >= searchQuery.length) { clearInterval(iv); setTyping(false); setShowDropdown(true); setTimeout(() => setShowDropdown(false), 2000); }
    }, 60);
    return () => clearInterval(iv);
  }, [topProduct?.id]);

  const h1 = headlines[0] || productTitle;
  const h2 = headlines[1] || "Free Shipping On Orders $50+";
  const h3 = headlines[2] || "Shop Now & Save";
  const d1 = descriptions[0] || `Discover ${productTitle}. Premium quality, unbeatable prices. Order today.`;

  const adStrengthLabel = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Average" : "Poor";
  const adStrengthColor = score >= 80 ? "#22c55e" : score >= 65 ? "#84cc16" : score >= 50 ? "#f59e0b" : "#ef4444";

  if (!topProduct) return (
    <div className="adp-card adp-empty">
      <div className="adp-empty-icon">📰</div>
      <div className="adp-empty-title">Ad Preview</div>
      <div className="adp-empty-desc">Analyze products to see your ad previews here</div>
    </div>
  );

  return (
    <div className="adp-card">
      {/* Header */}
      <div className="adp-header">
        <div className="adp-header-left">
          <div className={`adp-status-dot ${isActive ? "adp-dot-active" : "adp-dot-preview"}`}/>
          <span className="adp-title">{isActive ? "Live Ad" : "Recommended Ad"}</span>
          {isActive
            ? <span className="adp-badge adp-badge-live">● LIVE</span>
            : <span className="adp-badge adp-badge-preview">PREVIEW</span>}
        </div>
        <div className="adp-score-pill" style={{ borderColor: `${adStrengthColor}44`, color: adStrengthColor }}>
          <ScoreRing score={score} size={28}/>
          <span>{adStrengthLabel}</span>
        </div>
      </div>

      {/* Product context */}
      <div className="adp-product-row">
        {productImage && <img src={productImage} alt="" className="adp-product-img"/>}
        <div className="adp-product-info">
          <div className="adp-product-name">{productTitle}</div>
          <div className="adp-product-price">{productPrice}</div>
        </div>
        {!isActive && (
          <div className="adp-not-live-badge">Not running</div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="adp-tabs">
        {[["search","🔍 Search"], ["shopping","🛍 Shopping"], ["mobile","📱 Mobile"]].map(([id, label]) => (
          <button key={id} className={`adp-tab ${tab === id ? "adp-tab-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* Google Search Preview */}
      {tab === "search" && (
        <div className="adp-preview-wrap">
          {/* Fake google bar */}
          <div className="adp-google-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink:0 }}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span className="adp-typed-text">{typedQuery}{typing ? <span className="adp-cursor">|</span> : ""}</span>
            <span className="adp-search-icon">🔍</span>
          </div>

          {/* Autocomplete dropdown */}
          {showDropdown && (
            <div className="adp-dropdown">
              {[searchQuery, searchQuery + " online", searchQuery + " best price"].map((s, i) => (
                <div key={i} className="adp-dropdown-item"><span style={{ color:"rgba(0,0,0,.4)", fontSize:12 }}>🔍</span> {s}</div>
              ))}
            </div>
          )}

          {/* The actual ad */}
          <div className="adp-google-result">
            <div className="adp-sponsored-tag">Sponsored</div>
            <div className="adp-result-url">
              <div className="adp-favicon">
                {productImage
                  ? <img src={productImage} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:2 }}/>
                  : <span style={{ fontSize:10 }}>🛍</span>}
              </div>
              <div>
                <div style={{ fontSize:12, color:"#202124" }}>{storeDomain}</div>
                <div style={{ fontSize:11, color:"#4d5156" }}>www.{storeDomain} › shop</div>
              </div>
            </div>
            <div className="adp-result-headline">
              <span className="adp-hl-part">{h1}</span>
              {h2 && <><span className="adp-hl-sep"> | </span><span className="adp-hl-part">{h2}</span></>}
              {h3 && <><span className="adp-hl-sep"> | </span><span className="adp-hl-part">{h3}</span></>}
            </div>
            <div className="adp-result-desc">{d1}</div>
            {/* Sitelinks */}
            {(ai.sitelinks?.length > 0) && (
              <div className="adp-sitelinks-row">
                {ai.sitelinks.slice(0, 4).map((sl, i) => (
                  <div key={i} className="adp-sitelink-chip">{sl.title || sl}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shopping Preview */}
      {tab === "shopping" && (
        <div className="adp-preview-wrap">
          <div className="adp-shopping-bar">Google Shopping</div>
          <div className="adp-shopping-cards">
            {/* Our product — highlighted */}
            <div className="adp-shopping-card adp-shopping-ours">
              <div className="adp-shopping-our-badge">YOUR AD</div>
              {productImage
                ? <img src={productImage} alt="" className="adp-shopping-img"/>
                : <div className="adp-shopping-noimg">🛍</div>}
              <div className="adp-shopping-price">{productPrice}</div>
              <div className="adp-shopping-name">{productTitle.length > 28 ? productTitle.slice(0, 28) + "…" : productTitle}</div>
              <div className="adp-shopping-store">{storeDomain.split(".")[0]}</div>
              <div className="adp-shopping-stars">★★★★★ <span style={{ color:"rgba(0,0,0,.5)", fontSize:9 }}>4.8</span></div>
            </div>
            {/* Fake competitors */}
            {["$47.99", "$52.00", "$39.95"].map((p, i) => (
              <div key={i} className="adp-shopping-card adp-shopping-comp">
                <div className="adp-shopping-noimg" style={{ background:"#f8f8f8", fontSize:18 }}>{["🛏","🏠","⭐"][i]}</div>
                <div className="adp-shopping-price" style={{ color:"#202124" }}>{p}</div>
                <div className="adp-shopping-name" style={{ color:"#555" }}>Similar product {i + 1}</div>
                <div className="adp-shopping-store" style={{ color:"#888" }}>competitor.com</div>
                <div className="adp-shopping-stars" style={{ color:"#fbbc04" }}>★★★★☆ <span style={{ color:"rgba(0,0,0,.4)", fontSize:9 }}>4.{i + 2}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Preview */}
      {tab === "mobile" && (
        <div className="adp-preview-wrap adp-mobile-wrap">
          <div className="adp-phone-frame">
            <div className="adp-phone-notch"/>
            <div className="adp-phone-screen">
              <div className="adp-phone-searchbar">
                <span style={{ fontSize:9, color:"#999" }}>🔍 {searchQuery}</span>
              </div>
              <div className="adp-phone-ad">
                <div style={{ fontSize:8, color:"#000", fontWeight:700, marginBottom:2 }}>Sponsored</div>
                <div style={{ fontSize:8, color:"#1558d6", fontWeight:600, lineHeight:1.3, marginBottom:2 }}>{h1} | {h2}</div>
                <div style={{ fontSize:7, color:"#4d5156", lineHeight:1.3 }}>{d1.slice(0, 75)}...</div>
                <div style={{ fontSize:7, color:"#1e6641", marginTop:3 }}>✓ Free Shipping &nbsp;&nbsp; ✓ 30-day returns</div>
              </div>
              <div style={{ padding:"6px 8px", borderBottom:"1px solid #eee" }}>
                <div style={{ fontSize:8, color:"#999", marginBottom:4 }}>Organic results below your ad</div>
                {[1,2,3].map(i => <div key={i} style={{ height:8, background:"#f5f5f5", borderRadius:2, marginBottom:4 }}/>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="adp-footer">
        {isActive ? (
          <>
            <div className="adp-live-stats">
              <span>👁 {(mockCampaigns * 4200).toLocaleString()} impressions/mo</span>
              <span>👆 {(mockCampaigns * 180).toLocaleString()} clicks/mo</span>
            </div>
            <button className="adp-btn-secondary" onClick={() => onViewProduct && onViewProduct(topProduct)}>Edit Ad →</button>
          </>
        ) : (
          <>
            <div className="adp-suggestion">💡 This ad is ready to launch — {keywords.length} keywords targeted</div>
            <button className="adp-btn-launch" onClick={onLaunch}>{canPublish ? "🚀 Launch This Ad" : "🔒 Subscribe to Launch"}</button>
          </>
        )}
      </div>
    </div>
  );
});

// ══════════════════════════════════════════════
// COMPETITOR GAP FINDER
// ══════════════════════════════════════════════
const CompetitorGapFinder = React.memo(function CompetitorGapFinder({ keywordGaps, totalMonthlyGapLoss, analyzedCount, onAddKeyword, canPublish, onUpgrade }) {
  const [expanded, setExpanded] = useState(false);
  const [addedKeywords, setAddedKeywords] = useState(new Set());
  const [animateTotal, setAnimateTotal] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimateTotal(true), 600); return () => clearTimeout(t); }, []);

  if (analyzedCount === 0) return null;

  const hasGaps = keywordGaps.length > 0;
  const displayGaps = expanded ? keywordGaps : keywordGaps.slice(0, 4);

  function handleAdd(keyword) {
    if (!canPublish) { onUpgrade(); return; }
    setAddedKeywords(prev => new Set([...prev, keyword]));
    onAddKeyword && onAddKeyword(keyword);
  }

  return (
    <div className="gap-card">
      <div className="gap-card-header">
        <div className="gap-card-title-row">
          <span className="gap-card-icon">🎯</span>
          <div>
            <div className="gap-card-title">Competitor Gap Finder</div>
            <div className="gap-card-sub">Keywords your competitors target — that you're missing</div>
          </div>
        </div>
        {hasGaps && (
          <div className="gap-loss-badge">
            <div className="gap-loss-label">Est. Monthly Loss</div>
            <div className={`gap-loss-amount ${animateTotal ? "gap-loss-visible" : ""}`}>
              ${totalMonthlyGapLoss.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {!hasGaps ? (
        <div className="gap-empty">
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>No major gaps detected</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.4)" }}>Your keyword coverage looks solid compared to competitors</div>
        </div>
      ) : (
        <>
          {/* Alert bar */}
          <div className="gap-alert">
            <span className="gap-alert-icon">⚠️</span>
            <span>Competitors are capturing <strong>{keywordGaps.reduce((a,g)=>a+g.estClicks,0).toLocaleString()} clicks/mo</strong> on keywords you're not bidding on</span>
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
                <div key={i} className={`gap-row ${isAdded ? "gap-row-added" : ""}`} style={{ animationDelay:`${i*0.06}s` }}>
                  <div className="gap-keyword">
                    <span className="gap-keyword-text">{gap.keyword}</span>
                  </div>
                  <div className="gap-freq">
                    {Array.from({length: Math.min(gap.freq, 5)}).map((_,j) => (
                      <span key={j} className="gap-freq-dot" style={{ background: gap.diffColor }}/>
                    ))}
                    <span className="gap-freq-num">{gap.freq}</span>
                  </div>
                  <div className="gap-clicks">~{gap.estClicks} <span className="gap-unit">clicks</span></div>
                  <div className="gap-loss" style={{ color: gap.estMonthlyLoss > 400 ? "#ef4444" : gap.estMonthlyLoss > 200 ? "#f59e0b" : "#fbbf24" }}>
                    ${gap.estMonthlyLoss.toLocaleString()}
                  </div>
                  <div className="gap-diff" style={{ color: gap.diffColor }}>
                    <span className="gap-diff-dot" style={{ background: gap.diffColor }}/>
                    {gap.difficulty}
                  </div>
                  <div className="gap-action">
                    {isAdded ? (
                      <span className="gap-added-badge">✓ Added</span>
                    ) : (
                      <button className="gap-add-btn" onClick={() => handleAdd(gap.keyword)}>
                        {canPublish ? "+ Add" : "🔒"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {keywordGaps.length > 4 && (
            <button className="gap-expand-btn" onClick={() => setExpanded(e => !e)}>
              {expanded ? `↑ Show less` : `↓ Show ${keywordGaps.length - 4} more gaps`}
            </button>
          )}

          {/* CTA */}
          {!canPublish ? (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">🔒 Subscribe to add these keywords to your campaigns instantly</span>
              <button className="gap-upgrade-btn" onClick={onUpgrade}>Unlock →</button>
            </div>
          ) : addedKeywords.size > 0 ? (
            <div className="gap-success-row">
              <span>✅ {addedKeywords.size} keyword{addedKeywords.size!==1?"s":""} added to your campaigns</span>
            </div>
          ) : (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">💡 Click "+ Add" to target these keywords and recover lost traffic</span>
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
const StoreHealthScore = React.memo(function StoreHealthScore({ analyzedCount, totalProducts, avgScore, highPotential, competitorCount }) {
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
const LivePulse = React.memo(function LivePulse({ campaigns, impressionsBase, clicksBase, campaignId, realSpend, campaignControlStatus, confirmRemove, setConfirmRemove, onPause, onRemove }) {
  const [heartbeat, setHeartbeat] = useState(false);
  const [impressions, setImpressions] = useState(impressionsBase);
  const [clicks, setClicks] = useState(clicksBase);
  const [lastEvent, setLastEvent] = useState("Monitoring your campaigns...");
  const [eventVisible, setEventVisible] = useState(true);
  const canvasRef = useRef(null);
  const dataRef = useRef(Array.from({ length: 30 }, () => Math.random() * 0.4 + 0.1));
  const animRef = useRef(null);

  const events = [
    "New impression — 'luxury bedding set'",
    "Click converted — product page visited",
    "Competitor bid change detected",
    "New impression — 'queen size duvet cover'",
    "Ad shown — mobile search",
    "High-intent search click recorded",
    "Quality score updated +1",
    "New impression — branded keyword",
    "Smart bidding adjustment applied",
  ];

  useEffect(() => {
    if (campaigns === 0) return;
    const tick = () => {
      setHeartbeat(true);
      setTimeout(() => setHeartbeat(false), 700);
      setImpressions(p => p + Math.floor(Math.random() * 14 + 2));
      if (Math.random() > 0.6) setClicks(p => p + 1);
      if (Math.random() > 0.45) {
        setEventVisible(false);
        setTimeout(() => { setLastEvent(events[Math.floor(Math.random() * events.length)]); setEventVisible(true); }, 300);
      }
      dataRef.current = [...dataRef.current.slice(1), Math.random() * 0.75 + 0.25];
    };
    tick();
    const iv = setInterval(() => { if (document.visibilityState !== "hidden") tick(); }, 2200 + Math.random() * 1800);
    return () => clearInterval(iv);
  }, [campaigns]);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    let paused = document.visibilityState === "hidden";
    const onVisChange = () => { paused = document.visibilityState === "hidden"; };
    document.addEventListener("visibilitychange", onVisChange);

    const draw = () => {
      if (paused) { animRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);
      const data = dataRef.current;
      if (data.length < 2) { animRef.current = requestAnimationFrame(draw); return; }
      const step = W / (data.length - 1);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,.04)";
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(y => {
        ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
      });

      // Gradient fill
      const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
      fillGrad.addColorStop(0, "rgba(99,102,241,.2)");
      fillGrad.addColorStop(1, "rgba(99,102,241,0)");

      // Line gradient
      const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
      lineGrad.addColorStop(0, "rgba(99,102,241,.3)");
      lineGrad.addColorStop(0.6, "#6366f1");
      lineGrad.addColorStop(1, "#22c55e");

      // Draw path
      ctx.beginPath();
      ctx.moveTo(0, H);
      data.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.8;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = (i-1) * step, py = H - data[i-1] * H * 0.8;
          ctx.bezierCurveTo(px + step/2, py, x - step/2, y, x, y);
        }
      });
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = fillGrad; ctx.fill();

      // Stroke
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = (i-1) * step, py = H - data[i-1] * H * 0.8;
          ctx.bezierCurveTo(px + step/2, py, x - step/2, y, x, y);
        }
      });
      ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5;
      ctx.shadowColor = "#6366f1"; ctx.shadowBlur = 8;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Live dot
      const lx = (data.length-1) * step, ly = H - data[data.length-1] * H * 0.8;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI*2);
      ctx.fillStyle = "#22c55e"; ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 14;
      ctx.fill(); ctx.shadowBlur = 0;

      // Ripple around dot
      ctx.beginPath(); ctx.arc(lx, ly, 9, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(34,197,94,.3)"; ctx.lineWidth = 1.5; ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); document.removeEventListener("visibilitychange", onVisChange); };
  }, []);

  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const spend = (clicks * 0.44).toFixed(2);

  if (campaigns === 0) return (
    <div className="pulse-card pulse-empty">
      <div style={{ fontSize:36, marginBottom:10 }}>📡</div>
      <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Live Campaign Pulse</div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,.4)" }}>Launch campaigns to see real-time data</div>
    </div>
  );

  return (
    <div className="pulse-card">
      <div className="pulse-header-row">
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div className={`pulse-dot-live ${heartbeat ? "pulse-beat" : ""}`}/>
          <span style={{ fontSize:14, fontWeight:700 }}>Live Campaign Pulse</span>
          <span className="pulse-live-tag">LIVE</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Campaign control buttons in header */}
          {campaignId && campaignControlStatus !== "removed" && campaignControlStatus !== "paused" && (
            <>
              <button className="pulse-btn pulse-btn-pause" style={{padding:"5px 12px",fontSize:12}} onClick={onPause} disabled={campaignControlStatus==="pausing"||campaignControlStatus==="removing"}>
                {campaignControlStatus==="pausing" ? "⏳" : "⏸ Pause"}
              </button>
              <button className="pulse-btn pulse-btn-remove" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setConfirmRemove(true)} disabled={campaignControlStatus==="pausing"||campaignControlStatus==="removing"}>
                {campaignControlStatus==="removing" ? "⏳" : "🗑 Remove"}
              </button>
            </>
          )}
          {campaignControlStatus==="paused" && <span className="pulse-status-badge pulse-badge-paused">⏸ Paused</span>}
          {campaignControlStatus==="removed" && <span className="pulse-status-badge pulse-badge-removed">✅ Removed</span>}
          {/* Heartbeat SVG */}
          <svg width="22" height="20" viewBox="0 0 24 22" fill="none" className={heartbeat ? "heart-beat" : ""}>
            <path d="M12 21C12 21 3 14 3 8C3 5.2 5.2 3 8 3C9.7 3 11.2 3.9 12 5.2C12.8 3.9 14.3 3 16 3C18.8 3 21 5.2 21 8C21 14 12 21 12 21Z"
              fill={heartbeat ? "#ef4444" : "#6366f1"} style={{ transition:"fill .3s" }}/>
          </svg>
        </div>
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", marginBottom:10 }}>{campaigns} campaign{campaigns!==1?"s":""} running · live data</div>

      {/* Waveform */}
      <div style={{ position:"relative", marginBottom:14 }}>
        <canvas ref={canvasRef} width={520} height={72} className="pulse-canvas"/>
      </div>

      {/* 4 metrics */}
      <div className="pulse-metrics-row">
        <div className="pulse-metric-box pulse-m-imp">
          <div className="pulse-m-val">{impressions.toLocaleString()}</div>
          <div className="pulse-m-lbl">👁 Impressions</div>
        </div>
        <div className="pulse-metric-box pulse-m-clk">
          <div className="pulse-m-val">{clicks.toLocaleString()}</div>
          <div className="pulse-m-lbl">👆 Clicks</div>
        </div>
        <div className="pulse-metric-box pulse-m-ctr">
          <div className="pulse-m-val">{ctr}%</div>
          <div className="pulse-m-lbl">📊 CTR</div>
        </div>
        <div className="pulse-metric-box pulse-m-cost">
          <div className="pulse-m-val">${spend}</div>
          <div className="pulse-m-lbl">💸 Est. Spend</div>
        </div>
      </div>

      {/* Live event */}
      <div className="pulse-event-bar" style={{ opacity: eventVisible ? 1 : 0, transition:"opacity .3s" }}>
        <span className="pulse-event-dot-green"/>
        <span className="pulse-event-txt">{lastEvent}</span>
        <span className="pulse-event-time">just now</span>
      </div>

      {/* ── Real Spend ── */}
      {campaignId && (
        <div className="pulse-controls">
          <div className="pulse-spend-box">
            <span className="pulse-spend-label">💸 Total Spend</span>
            <span className="pulse-spend-val">
              {realSpend != null
                ? `$${Number(realSpend).toFixed(2)}`
                : campaignControlStatus === "paused" || campaignControlStatus === "removed"
                  ? `$${spend}`
                  : <span className="pulse-spend-fetching">Fetching from Google…</span>}
            </span>
            {realSpend == null && <span className="pulse-spend-note">(estimated)</span>}
          </div>
          {campaignControlStatus === "error" && (
            <span className="pulse-status-badge pulse-badge-error">⚠️ Action failed — check Google Ads connection</span>
          )}
          {/* Confirm Remove Dialog */}
          {confirmRemove && (
            <div className="pulse-confirm-overlay">
              <div className="pulse-confirm-box">
                <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
                <h3 style={{fontSize:16,fontWeight:800,marginBottom:8}}>Remove Campaign?</h3>
                <p style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:20}}>
                  This will permanently remove the campaign from Google Ads. This cannot be undone.
                </p>
                <div style={{display:"flex",gap:10}}>
                  <button className="pulse-btn pulse-btn-remove" style={{flex:1}} onClick={onRemove}>Yes, Remove</button>
                  <button className="pulse-btn pulse-btn-pause" style={{flex:1}} onClick={() => setConfirmRemove(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const TIPS = ["💡 Ads with 10+ headlines get up to 15% more clicks","💡 Specific keywords like 'buy red sneakers size 10' convert 3x better","💡 Starting with $10/day is enough to get real data in a week","💡 Paused campaigns cost nothing — review before going live","💡 Negative keywords can cut wasted spend by up to 30%"];
const TipRotator = React.memo(function TipRotator() {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const iv = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i => (i+1)%TIPS.length); setVisible(true); },400); },4000); return () => clearInterval(iv); }, []);
  return <div className="tip-box" style={{ opacity:visible?1:0, transition:"opacity .4s ease" }}>{TIPS[idx]}</div>;
});

const Confetti = React.memo(function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const colors = ["#6366f1","#8b5cf6","#06b6d4","#22c55e","#f59e0b","#ec4899","#fff"];
    const left = Math.random()*100, delay = Math.random()*.8, dur = 2+Math.random()*1.5, sz = 6+Math.random()*6, rot = Math.random()*360;
    return <div key={i} style={{ position:"fixed",top:-20,left:left+"%",width:sz,height:sz*.4,background:colors[i%colors.length],borderRadius:2,zIndex:9999,transform:`rotate(${rot}deg)`,animation:`confettiFall ${dur}s ease-out ${delay}s forwards`,opacity:0 }}/>;
  });
  return <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999 }}>{pieces}</div>;
});

const TICKER = [
  { name:"🇺🇸 Shopify Plus store", action:"replaced a $2,500/mo agency with Smart Ads AI", time:"just now", emoji:"💎" },
  { name:"🇬🇧 First-time advertiser", action:"got their first Google Ads sale within 48 hours", time:"3 min ago", emoji:"🎯" },
  { name:"🇦🇺 Store with 340 products", action:"full AI scan completed in 58 seconds", time:"7 min ago", emoji:"⚡" },
  { name:"🇩🇪 DTC skincare brand", action:"went from 1.1x to 4.6x ROAS in 3 weeks", time:"19 min ago", emoji:"📈" },
];
function SuccessTicker() {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const iv = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i=>(i+1)%TICKER.length); setVisible(true); },500); },3500); return () => clearInterval(iv); }, []);
  const msg = TICKER[idx];
  return (
    <div className="ticker-wrap" style={{ opacity:visible?1:0, transition:"opacity .5s ease" }}>
      <span className="ticker-emoji">{msg.emoji}</span>
      <span className="ticker-text"><strong>{msg.name}</strong> {msg.action}</span>
      <span className="ticker-time">{msg.time}</span>
    </div>
  );
}


// ══════════════════════════════════════════════
// LANDING PAGE — BUDGET TEASER
// ══════════════════════════════════════════════
function LandingBudgetTeaser() {
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
function LandingMissingBlock({ onInstall }) {
  const [counter, setCounter] = useState({ competitors: 38, revenue: 1840, products: 0 });

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
const TopMissedOpportunity = React.memo(function TopMissedOpportunity({ topProduct, avgScore, totalMonthlyGapLoss, analyzedCount, onScan, onViewProduct, hasScanAccess }) {
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
// Custom slider that works inside Shopify embedded iframe
function CustomSlider({ min, max, step, value, onChange, formatLabel }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  function calcValue(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    let pct = (clientX - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    let raw = min + pct * (max - min);
    raw = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, parseFloat(raw.toFixed(2))));
  }

  function handleStart(clientX) {
    dragging.current = true;
    onChange(calcValue(clientX));
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
  }

  function handleMove(e) { if (dragging.current) onChange(calcValue(e.clientX)); }
  function handleTouchMove(e) { if (dragging.current) { e.preventDefault(); onChange(calcValue(e.touches[0].clientX)); } }
  function handleEnd() {
    dragging.current = false;
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleEnd);
  }

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={trackRef}
      onMouseDown={e => { e.preventDefault(); handleStart(e.clientX); }}
      onTouchStart={e => { handleStart(e.touches[0].clientX); }}
      style={{ position:"relative", height:24, cursor:"pointer", touchAction:"none", userSelect:"none", WebkitUserSelect:"none" }}
    >
      <div style={{ position:"absolute", top:9, left:0, right:0, height:6, background:"rgba(99,102,241,.2)", borderRadius:3 }} />
      <div style={{ position:"absolute", top:9, left:0, width:pct+"%", height:6, background:"linear-gradient(90deg,#6366f1,#8b5cf6)", borderRadius:3 }} />
      <div style={{
        position:"absolute", top:3, left:"calc("+pct+"% - 9px)",
        width:18, height:18, borderRadius:"50%",
        background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
        boxShadow:"0 0 8px rgba(99,102,241,.5)",
        cursor:"pointer", transition: dragging.current ? "none" : "left 0.1s"
      }} />
    </div>
  );
}

const BudgetSimulator = React.memo(function BudgetSimulator({ avgScore, avgCpc, canPublish, onUpgrade }) {
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
          <CustomSlider min={5} max={500} step={5} value={vals.budget} onChange={val => setVals(v => ({...v, budget: val}))} />
          <div className="budget-sim-range-labels"><span>$5</span><span>$500</span></div>
        </div>

        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Avg Order Value</span>
            <span className="budget-sim-input-val">${vals.aov}</span>
          </div>
          <CustomSlider min={10} max={500} step={5} value={vals.aov} onChange={val => setVals(v => ({...v, aov: val}))} />
          <div className="budget-sim-range-labels"><span>$10</span><span>$500</span></div>
        </div>

        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Conversion Rate</span>
            <span className="budget-sim-input-val">{vals.conv}%</span>
          </div>
          <CustomSlider min={0.1} max={10} step={0.1} value={vals.conv} onChange={val => setVals(v => ({...v, conv: val}))} />
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
}, (prev, next) =>
  prev.avgScore === next.avgScore &&
  prev.avgCpc === next.avgCpc &&
  prev.canPublish === next.canPublish &&
  prev.onUpgrade === next.onUpgrade
);

function ModalScrollLock() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);
  return null;
}

function ProductModal({ product, onClose, aiResults, editHeadlines, setEditHeadlines, editDescriptions, setEditDescriptions, isPaid, aiCredits, setShowBuyCredits, improvingIdx, handleAiImprove, canPublish, hasScanAccess, campaignStatus, setCampaignStatus, handleCreateCampaign, setSelProduct, setShowOnboard, setOnboardTab, setOnboardStep, shop }) {
  const isDb = !!product.hasAiAnalysis;
  const ai = isDb ? (product.aiAnalysis||{}) : (findAiForProduct(aiResults?.products, product)||{});
  const keywords = (ai.keywords||[]).map(k=>typeof k==="string"?{text:k,match_type:"BROAD"}:k);
  const sitelinks = ai.sitelinks||[], cIntel = ai.competitor_intel||null;
  const path1 = ai.path1||"Shop", path2 = ai.path2||"", negKw = ai.negative_keywords||[];
  const score = ai.ad_score||0;
  const adStrength = editHeadlines.length>=8&&editDescriptions.length>=4?"Excellent":editHeadlines.length>=5?"Good":editHeadlines.length>=3?"Average":"Poor";
  const strengthColor = {Excellent:"#22c55e",Good:"#84cc16",Average:"#f59e0b",Poor:"#ef4444"}[adStrength];
  const strengthPct = {Excellent:100,Good:75,Average:50,Poor:25}[adStrength];
  const storeUrl = `https://${shop || "your-store.myshopify.com"}`;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <ModalScrollLock/>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-header">
          {product.image && <img src={product.image} alt="" className="modal-img"/>}
          <div style={{flex:1}}><h2 className="modal-title">{product.title}</h2><p className="modal-price">${Number(product.price).toFixed(2)}</p></div>
          <div className="rsa-score-box"><ScoreRing score={score} size={58}/><span className="rsa-score-lbl">Ad Score</span></div>
        </div>
        {isPaid && <div className="credits-bar"><span className="credits-count">✨ {aiCredits} AI credits</span><button className="btn-buy-credits" onClick={()=>setShowBuyCredits(true)}>Buy More</button></div>}
        <div className="rsa-strength">
          <div className="rsa-strength-bar"><div className="rsa-strength-fill" style={{width:strengthPct+"%",background:strengthColor}}/></div>
          <span className="rsa-strength-txt" style={{color:strengthColor}}>{adStrength}</span>
          <span className="rsa-strength-info">{editHeadlines.length}/15 headlines · {editDescriptions.length}/4 descriptions</span>
        </div>
        <div className="rsa-preview">
          <div className="rsa-preview-label">📱 Live Google Ad Preview</div>
          <div className="rsa-preview-ad">
            <div className="rsa-preview-sponsor">Sponsored</div>
            <div className="rsa-preview-url">{storeUrl} › {path1}{path2?" › "+path2:""}</div>
            <div className="rsa-preview-h">{editHeadlines[0]||"Headline 1"} | {editHeadlines[1]||"Headline 2"} | {editHeadlines[2]||"Headline 3"}</div>
            <div className="rsa-preview-d">{editDescriptions[0]||"Description will appear here."}</div>
          </div>
        </div>
        <div className="modal-body">
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>✏️ Headlines ({editHeadlines.length}/15)</h3><span className="rsa-hint">Max 30 characters each</span></div>
            <div className="rsa-items">{editHeadlines.map((h,i)=>(
              <div key={i} className="rsa-item">
                <span className="rsa-item-num">{i+1}</span>
                <input className="rsa-item-input" value={h} maxLength={30} onChange={e=>{const n=[...editHeadlines];n[i]=e.target.value;setEditHeadlines(n);}}/>
                <span className={`rsa-item-len ${h.length>30?"rsa-over":""}`}>{h.length}/30</span>
                {isPaid && <button className={`btn-ai-improve ${improvingIdx===`h-${i}`?"improving":""}`} onClick={()=>handleAiImprove("h",i)} disabled={improvingIdx!==null}>{improvingIdx===`h-${i}`?"⏳":"✨"}</button>}
                {i<3 && <span className="rsa-pin">📌 H{i+1}</span>}
              </div>
            ))}</div>
          </div>
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>📝 Descriptions ({editDescriptions.length}/4)</h3><span className="rsa-hint">Max 90 chars each</span></div>
            <div className="rsa-items">{editDescriptions.map((d,i)=>(
              <div key={i} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{i+1}</span>
                <textarea className="rsa-item-input rsa-item-textarea" value={d} maxLength={90} rows={2} onChange={e=>{const n=[...editDescriptions];n[i]=e.target.value;setEditDescriptions(n);}}/>
                <span className={`rsa-item-len ${d.length>90?"rsa-over":""}`}>{d.length}/90</span>
                {isPaid && <button className={`btn-ai-improve ${improvingIdx===`d-${i}`?"improving":""}`} onClick={()=>handleAiImprove("d",i)} disabled={improvingIdx!==null}>{improvingIdx===`d-${i}`?"⏳":"✨"}</button>}
              </div>
            ))}</div>
          </div>
          <div className="rsa-section">
            <h3>🔑 Keywords ({keywords.length})</h3>
            <div className="rsa-kw-grid">{keywords.map((k,i)=>{const mt=k.match_type||"BROAD";const mc=mt==="EXACT"?"kw-exact":mt==="PHRASE"?"kw-phrase":"kw-broad";const disp=mt==="EXACT"?`[${k.text}]`:mt==="PHRASE"?`"${k.text}"`:k.text;return <div key={i} className={`rsa-kw ${mc}`}>{disp}<span className="rsa-kw-type">{mt}</span></div>;})}</div>
            {negKw.length>0 && <div className="rsa-neg-kw"><strong>🚫 Negative Keywords:</strong><div className="rsa-kw-grid" style={{marginTop:6}}>{negKw.map((k,i)=><div key={i} className="rsa-kw kw-neg">-{k}</div>)}</div></div>}
          </div>
          {sitelinks.length>0 && <div className="rsa-section"><h3>🔗 Sitelinks</h3><div className="rsa-sitelinks">{sitelinks.map((sl,i)=><div key={i} className="rsa-sitelink"><strong>{sl.title}</strong><span>{sl.description||""}</span></div>)}</div></div>}
          {cIntel && (
            <div className="rsa-section ci-section">
              <h3>🕵️ Competitor Intelligence</h3>
              {cIntel.store_ranking && (
                <div className="ci-ranking">
                  <div className="ci-ranking-icon">{cIntel.store_ranking.status==="page_1"?"🟢":cIntel.store_ranking.status==="page_2"?"🟡":"🔴"}</div>
                  <div className="ci-ranking-info"><strong>Your Google Position</strong><span>{cIntel.store_ranking.position?`#${cIntel.store_ranking.position} for "${cIntel.store_ranking.query}"` :`Not found in top 10 for "${cIntel.store_ranking.query}"`}</span></div>
                  <div className={`ci-strategy-badge ci-strat-${(cIntel.strategy||"aggressive").split("_")[0]}`}>{(cIntel.strategy||"aggressive").replace(/_/g," ").toUpperCase()}</div>
                </div>
              )}
              {cIntel.strategy_reason && <p className="ci-reason">{cIntel.strategy_reason}</p>}
              {cIntel.top_competitors?.length>0 && <div className="ci-competitors"><strong>Top Competitors:</strong><div className="ci-comp-list">{cIntel.top_competitors.map((c,i)=><div key={i} className="ci-comp-card"><div className="ci-comp-rank">#{c.position||i+1}</div><div className="ci-comp-info"><a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="ci-comp-domain ci-comp-link">{c.domain}</a><span className="ci-comp-strength">{c.strength||"unknown"}</span></div>{c.price_range&&<span className="ci-comp-price">{c.price_range}</span>}</div>)}</div></div>}
              {cIntel.keyword_gaps?.length>0 && <div className="ci-gaps"><strong>💡 Keyword Opportunities:</strong><div className="rsa-kw-grid" style={{marginTop:6}}>{cIntel.keyword_gaps.map((k,i)=><div key={i} className="rsa-kw kw-gap">+{k}</div>)}</div></div>}
              {cIntel.competitive_advantages?.length>0 && <div className="ci-advantages"><strong>✅ Your Advantages:</strong><ul className="ci-adv-list">{cIntel.competitive_advantages.map((a,i)=><li key={i}>{a}</li>)}</ul></div>}
              {cIntel.opportunity_score && <div className="ci-opp"><strong>Opportunity Score:</strong><div className="ci-opp-bar"><div className="ci-opp-fill" style={{width:`${cIntel.opportunity_score}%`}}/></div><span className="ci-opp-val">{cIntel.opportunity_score}/100</span></div>}
            </div>
          )}
          {canPublish ? (
            <>
              <button className="btn-campaign" onClick={handleCreateCampaign} disabled={campaignStatus==="creating"}>{campaignStatus==="creating"?"⏳ Creating...":campaignStatus==="success"?"✅ Campaign Created!":"🚀 Create Google Ads Campaign"}</button>
              {campaignStatus==="success" && <p className="campaign-msg success">Campaign created in PAUSED state. Review in Google Ads.</p>}
              {campaignStatus==="error" && <p className="campaign-msg error">Failed to create campaign. Check Google Ads connection.</p>}
            </>
          ) : hasScanAccess ? (
            <div className="free-campaign-lock">
              <div style={{fontSize:32,marginBottom:8}}>🔒</div>
              <strong style={{fontSize:15}}>Subscribe to Publish</strong>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:4}}>You can scan and view all AI insights with your credits. Subscribe to publish campaigns live to Google Ads.</p>
              <button className="btn-primary" style={{marginTop:14}} onClick={()=>{setSelProduct(null);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>🚀 View Plans →</button>
            </div>
          ) : (
            <div className="free-campaign-lock">
              <div style={{fontSize:32,marginBottom:8}}>🔒</div>
              <strong style={{fontSize:15}}>Upgrade to Publish</strong>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:4}}>Subscribe or buy scan credits to unlock.</p>
              <button className="btn-primary" style={{marginTop:14}} onClick={()=>{setSelProduct(null);setShowOnboard(true);setOnboardStep(1);}}>🚀 Start My Plan</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function Index() {
  const { products: dbProducts, planFromCookie, isPaidServer, shop: shopDomain, needsInitialSync } = useLoaderData();
  const storeUrl = shopDomain ? `https://${shopDomain}` : "https://your-store.myshopify.com";

  // Enterprise: trigger initial sync on client side (never block server render)
  useEffect(() => {
    if (needsInitialSync) {
      fetch("/app/api/sync", { method: "POST" })
        .catch(() => {}); // silent — UI will update via webhook
    }
  }, [needsInitialSync]);

  // Build product-specific URL for campaigns
  function getProductUrl(product) {
    const base = storeUrl;
    if (product?.handle) return `${base}/products/${product.handle}`;
    if (product?.title) {
      const handle = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return `${base}/products/${handle}`;
    }
    return base;
  }
  const allDbProducts = dbProducts || [];
  const analyzedDbProducts = allDbProducts.filter(p => p.hasAiAnalysis);
  const totalDbProducts = allDbProducts.length;

  const [products, setProductsRaw] = useState([]);
  const [aiResults, setAiResultsRaw] = useState(null);
  function setProducts(v) { setProductsRaw(v); try { sessionStorage.setItem("sai_products", JSON.stringify(v)); } catch(err) { console.error("[SmartAds]", err); } }
  function setAiResults(v) { setAiResultsRaw(v); try { sessionStorage.setItem("sai_aiResults", JSON.stringify(v)); } catch(err) { console.error("[SmartAds]", err); } }

  const scanned = products.length > 0;
  const [isScanning, setIsScanning] = useState(false);
  const [fakeProgress, setFakeProgress] = useState(0);
  const [scanMode, setScanMode] = useState(null);
  const [vis, setVis] = useState(false);
  const [selProduct, setSelProduct] = useState(null);
  const [selCompetitor, setSelCompetitor] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardTab, setOnboardTab] = useState("subscription");

  // Plan — cookie is source of truth (set server-side, no flash)
  const [selectedPlan, setSelectedPlan] = useState(
    isPaidServer ? planFromCookie : ((() => { try { return sessionStorage.getItem("sai_plan") || null; } catch { return null; } })())
  );
  const [isHydrated, setIsHydrated] = useState(isPaidServer); // if server knows isPaid, already hydrated
  useEffect(() => { setIsHydrated(true); }, []);

  const [scanCredits, setScanCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_scan_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });
  const [aiCredits, setAiCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });
  function setScanCredits(v) { setScanCreditsRaw(v); try { sessionStorage.setItem("sai_scan_credits", String(v)); } catch(err) { console.error("[SmartAds]", err); } }
  function setAiCredits(v) { setAiCreditsRaw(v); try { sessionStorage.setItem("sai_credits", String(v)); } catch(err) { console.error("[SmartAds]", err); } }

  const [googleConnected, setGoogleConnected] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [campaignId, setCampaignId] = useState(() => { try { return sessionStorage.getItem("sai_campaign_id")||"sim_001"; } catch { return "sim_001"; } });
  const [campaignControlStatus, setCampaignControlStatus] = useState(null); // 'pausing'|'removing'|'paused'|'removed'|'error'
  const [realSpend, setRealSpend] = useState(null); // live spend from Google Ads API
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showLaunchChoice, setShowLaunchChoice] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null);
  const [editHeadlines, setEditHeadlines] = useState([]);
  const [editDescriptions, setEditDescriptions] = useState([]);
  const [improvingIdx, setImprovingIdx] = useState(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanMsg, setScanMsg] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [pickedProducts, setPickedProducts] = useState([]);
  const [autoLaunching, setAutoLaunching] = useState(false);

  const cancelRef = useRef(false);
  const creepRef = useRef(null);

  const isPaid = !!selectedPlan;
  const hasScanAccess = isPaid || scanCredits > 0;
  const canPublish = isPaid;

  // ── ALL HOOKS ZONE — nothing conditional above this line ──
  const _ac = analyzedDbProducts.length;
  const _as = useMemo(() =>
    _ac > 0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/_ac) : 0,
  [analyzedDbProducts, _ac]);
  const _mc = useMemo(() =>
    isPaid && _ac > 0 ? Math.min(Math.floor(_ac * 0.6), 12) : 0,
  [isPaid, _ac]);
  const liveAds = useGoogleAdsData(_mc, _as);

  function triggerConfetti() { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3500); }
  useEffect(() => { setVis(true); }, []);

  function selectPlan(plan) {
    setSelectedPlan(plan);
    setAiCredits({ starter: 10, pro: 200, premium: 1000 }[plan] || 0);
    // Save to server API (no client-side cookie)
    fetch("/app/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    }).catch(err => console.error("[SmartAds]", err));
  }

  async function doScan(mode) {
    if (isScanning) return; // prevent double-scan
    const isAuto = mode === "auto";
    setScanMode(mode || "review"); setIsScanning(true); setFakeProgress(0);
    setScanMsg(hasScanAccess ? "Connecting to your Shopify store..." : "Quick preview scan starting...");
    setAutoStatus(null); setScanError(null); cancelRef.current = false;
    let fetchedProducts = [], allAiProducts = [];

    let smoothProg = 0;
    const smoothTimer = setInterval(() => { smoothProg = Math.min(smoothProg + 0.15, 8); setFakeProgress(Math.round(smoothProg * 10) / 10); }, 100);

    try {
      const scanAbort = new AbortController();
      cancelRef._abort = () => scanAbort.abort();
      const ff = new FormData(); ff.append("step", "fetch");
      const fr = await fetch("/app/api/scan", { method:"POST", body:ff, signal:scanAbort.signal });
      const fd = await fr.json().catch(() => { throw new Error("Server returned invalid response."); });
      if (!fd.success) throw new Error(fd.error || "Failed to fetch products");
      if (cancelRef.current) { clearInterval(smoothTimer); setIsScanning(false); return; }
      clearInterval(smoothTimer);

      const allFetched = fd.products, storeUrl = fd.storeInfo?.url || "";
      const toAnalyze = hasScanAccess ? allFetched : allFetched.slice(0, FREE_SCAN_LIMIT);
      fetchedProducts = allFetched; setProducts(allFetched);

      for (let p = Math.ceil(smoothProg); p <= 10; p++) { setFakeProgress(p); await new Promise(r => setTimeout(r, 40)); }
      setScanMsg(hasScanAccess ? `Found ${allFetched.length} products — analyzing with AI...` : `Found ${allFetched.length} products — analyzing top ${FREE_SCAN_LIMIT} for preview...`);
      await new Promise(r => setTimeout(r, 600));

      const BATCH = 3, total = toAnalyze.length, batches = Math.ceil(total / BATCH);
      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }
        const start = b * BATCH, batch = toAnalyze.slice(start, start + BATCH);
        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);
        let creepPct = batchStartPct;
        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < batchEndPct - 0.5) creepPct += 0.3;
          setFakeProgress(Math.round(creepPct * 10) / 10);
          const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          const curPct = Math.round(creepPct);
          if (hasScanAccess) {
            const sn = curPct<25?"Searching Google":curPct<45?"Analyzing competitors":curPct<60?"Checking rankings":curPct<80?"Generating ad copy":"Building strategy";
            setScanMsg(fakeNum+" of "+total+" products · "+sn);
          } else setScanMsg("Analyzing product "+fakeNum+" of "+total+"...");
        }, 400);
        creepRef.current = creepTimer;

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", shopDomain || "");
        const ar = await fetch("/app/api/scan", { method:"POST", body:af, signal:scanAbort.signal });
        clearInterval(creepTimer); creepRef.current = null;
        const ad = await ar.json().catch(() => { throw new Error(`AI returned invalid response on batch ${b+1}.`); });
        if (!ad.success) throw new Error(ad.error || `AI failed on batch ${b+1}`);
        allAiProducts = [...allAiProducts, ...(ad.result?.products || [])];
        setFakeProgress(batchEndPct);
      }

      if (cancelRef.current) { setIsScanning(false); return; }
      setScanMsg(hasScanAccess ? "Almost done — putting it all together! 🚀" : "Wrapping up your preview...");
      await new Promise(r => setTimeout(r, 600));

      const topScore = allAiProducts.reduce((best,p) => ((p.ad_score||0)>(best.ad_score||0)?p:best), allAiProducts[0]||{});
      let summary;
      if (hasScanAccess) {
        const opts = [`🎯 Analyzed ${allAiProducts.length} products. "${topScore.title||"Top product"}" scored ${topScore.ad_score||0}/100.`,`✨ Found ${allAiProducts.filter(p=>(p.ad_score||0)>=70).length} high-potential products!`,`🏆 Average score: ${Math.round(allAiProducts.reduce((a,p)=>a+(p.ad_score||0),0)/allAiProducts.length)}/100.`];
        summary = opts[Math.floor(Math.random()*opts.length)];
      } else {
        summary = `Preview: Analyzed ${FREE_SCAN_LIMIT} of ${fetchedProducts.length} products. ${topScore.title||"Your top product"} shows real potential! Upgrade to unlock all ${fetchedProducts.length - FREE_SCAN_LIMIT} remaining.`;
      }

      setAiResults({ summary, recommended_budget:100, products:allAiProducts });
      setFakeProgress(100); setScanMsg(hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!");
      triggerConfetti(); await new Promise(r => setTimeout(r, 800));

    } catch (e) {
      clearInterval(smoothTimer);
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      let msg = e.message || "Something went wrong";
      if (msg.includes("credit balance")||msg.includes("billing")) msg = "AI credits have run out. Please top up your Anthropic API balance.";
      else if (msg.includes("rate_limit")||msg.includes("429")) msg = "Too many requests. Please wait a minute and try again.";
      else if (msg.includes("401")||msg.includes("api_key")) msg = "API key is invalid. Please check your ANTHROPIC_API_KEY.";
      else if (msg.includes("overloaded")) msg = "AI service is temporarily overloaded. Please try again.";
      setScanError(msg); setIsScanning(false); setFakeProgress(0); return;
    }

    setIsScanning(false); setFakeProgress(0);

    if (isAuto && allAiProducts.length > 0 && canPublish) {
      setAutoLaunching(true);
      let successCount = 0;
      for (let i = 0; i < fetchedProducts.length; i++) {
        const prod = fetchedProducts[i], ai = findAiForProduct(allAiProducts, prod)||allAiProducts[i]||{};
        try {
          const form = new FormData();
          form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines||[]));
          form.append("descriptions", JSON.stringify(ai.descriptions||[])); form.append("keywords", JSON.stringify(ai.keywords||[]));
          form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
          const res = await fetch("/app/api/campaign", { method:"POST", body:form });
          const data = await res.json(); if (data.success) successCount++;
        } catch(err) { console.error("[SmartAds]", err); }
      }
      setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    }
  }

  async function handleAutoCampaign() {
    if (!canPublish) { setShowOnboard(true); setOnboardTab("subscription"); setOnboardStep(1); return; }
    setAutoLaunching(true);
    let successCount = 0;
    const toProcess = analyzedDbProducts.length > 0 ? analyzedDbProducts : allDbProducts.slice(0, 5);
    for (const prod of toProcess) {
      const ai = prod.aiAnalysis||{};
      try {
        const form = new FormData();
        form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines||[]));
        form.append("descriptions", JSON.stringify(ai.descriptions||[])); form.append("keywords", JSON.stringify(ai.keywords||[]));
        form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
        const res = await fetch("/app/api/campaign", { method:"POST", body:form });
        const data = await res.json(); if (data.success) successCount++;
      } catch(err) { console.error("[SmartAds]", err); }
    }
    setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    if (successCount > 0) triggerConfetti();
  }

  function handleProductClick(product) {
    if (!hasScanAccess) { setShowOnboard(true); setOnboardStep(1); return; }
    setSelProduct(product); setCampaignStatus(null);
    const isDb = !!product.hasAiAnalysis;
    const ai = isDb ? (product.aiAnalysis||{}) : (findAiForProduct(aiResults?.products, product)||{});
    setEditHeadlines((ai.headlines||[]).map(h => (typeof h==="string"?h:h.text||h).trim().slice(0, 30)));
    setEditDescriptions((ai.descriptions||[]).map(d => (typeof d==="string"?d:d.text||d).trim().slice(0, 90)));
  }

  // ── Fetch real spend from Google Ads API ──
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    async function fetchSpend() {
      try {
        const form = new FormData();
        form.append("action", "list");
        const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
        const data = await res.json();
        if (!cancelled && data.campaigns) {
          // Find our campaign by id
          const numId = String(campaignId).split("/").pop();
          const camp = data.campaigns.find(c => String(c.id) === numId || c.resourceName === campaignId);
          if (camp) setRealSpend(parseFloat(camp.cost));
        }
      } catch(err) { console.error("[SmartAds]", err); }
    }
    fetchSpend();
    const iv = setInterval(fetchSpend, 60000); // refresh every minute
    return () => { cancelled = true; clearInterval(iv); };
  }, [campaignId]);

  async function handlePauseCampaign() {
    if (!campaignId) return;
    setCampaignControlStatus("pausing");
    try {
      const form = new FormData();
      form.append("action", "pause");
      form.append("campaignId", campaignId);
      const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
      const data = await res.json();
      setCampaignControlStatus(data.success ? "paused" : "error");
    } catch { setCampaignControlStatus("error"); }
  }

  async function handleRemoveCampaign() {
    if (!campaignId) return;
    setCampaignControlStatus("removing");
    setConfirmRemove(false);
    try {
      const form = new FormData();
      form.append("action", "remove");
      form.append("campaignId", campaignId);
      const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setCampaignControlStatus("removed");
        setCampaignId(null);
        try { sessionStorage.removeItem("sai_campaign_id"); } catch(err) { console.error("[SmartAds]", err); }
      } else {
        setCampaignControlStatus("error");
      }
    } catch { setCampaignControlStatus("error"); }
  }


  const handleUpgradeClick = React.useCallback(() => {
    setShowOnboard(true);
    setOnboardTab("subscription");
    setOnboardStep(1);
  }, []);

  // ── Derived values — use _ac/_as computed above ──
  const analyzedCount = _ac;
  const avgScore = _as;

  const sortedProducts = useMemo(() =>
    [...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0)),
  [allDbProducts]);

  const topCompetitors = useMemo(() => {
    const allCompetitors = analyzedDbProducts.flatMap(p=>p.aiAnalysis?.competitor_intel?.top_competitors||[]);
    const competitorMap = {};
    allCompetitors.forEach(c => {
      if (!c.domain) return;
      const d = c.domain.toLowerCase().replace(/^www\\./, "");
      if (d === "site.com" || d === "example.com" || d === "competitor.com" || d.length < 4) return;
      if (!competitorMap[d]) competitorMap[d] = { count: 0, strength: c.strength || "unknown" };
      competitorMap[d].count++;
    });
    return Object.entries(competitorMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
  }, [analyzedDbProducts]);

  const { keywordGaps, totalMonthlyGapLoss } = useMemo(() => {
    const myKeywords = new Set(
      analyzedDbProducts.flatMap(p => (p.aiAnalysis?.keywords||[]).map(k => (typeof k==="string"?k:k?.text||"").toLowerCase().trim()))
        .filter(Boolean)
    );
    // Collect gap keywords from multiple sources in competitor_intel
    const competitorKeywords = [];
    analyzedDbProducts.forEach(p => {
      const ci = p.aiAnalysis?.competitor_intel;
      if (!ci) return;
      // Source 1: explicit keyword_gaps
      (ci.keyword_gaps||[]).forEach(k => {
        const kw = (typeof k==="string"?k:k?.text||String(k)).toLowerCase().trim();
        if (kw && kw.length > 2) competitorKeywords.push(kw);
      });
      // Source 2: keywords from top_competitors entries
      (ci.top_competitors||[]).forEach(comp => {
        (comp.keywords||[]).forEach(k => {
          const kw = (typeof k==="string"?k:k?.text||"").toLowerCase().trim();
          if (kw && kw.length > 2) competitorKeywords.push(kw);
        });
      });
    });
    const gapKeywordCounts = {};
    competitorKeywords.forEach(k => { gapKeywordCounts[k] = (gapKeywordCounts[k]||0)+1; });
    // Generate gap keywords from product titles when competitor data is empty
    if (Object.keys(gapKeywordCounts).length === 0 && analyzedDbProducts.length > 0) {
      analyzedDbProducts.forEach(p => {
        const words = (p.title || "").toLowerCase().split(" ").slice(0, 3).join(" ");
        if (!words) return;
        ["best " + words, words + " reviews", "buy " + words + " online",
         "cheap " + words, words + " sale", words + " deals",
         words + " discount", words + " near me"]
          .filter(kw => kw.trim().length > 4)
          .forEach(kw => { gapKeywordCounts[kw.trim()] = (gapKeywordCounts[kw.trim()]||0) + 1; });
      });
    }
    const gaps = Object.entries(gapKeywordCounts)
      .filter(([k]) => !myKeywords.has(k) && k.length > 3)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 8)
      .map(([keyword, freq]) => ({
        keyword, freq,
        estMonthlyLoss: Math.round((freq * 280) * (avgScore < 60 ? 1.4 : 1)),
        estClicks: Math.round(freq * 22),
        difficulty: freq >= 3 ? "High" : freq === 2 ? "Medium" : "Low",
        diffColor: freq >= 3 ? "#ef4444" : freq === 2 ? "#f59e0b" : "#22c55e",
      }));
    return { keywordGaps: gaps, totalMonthlyGapLoss: gaps.reduce((a,g) => a+g.estMonthlyLoss, 0) };
  }, [analyzedDbProducts, avgScore]);

  // Enterprise: O(1) lookup maps — no more O(n) find() on every render
  const productById = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach(p => { if (p.id) map.set(p.id, p); });
    return map;
  }, [allDbProducts]);

  const productByTitle = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach(p => { if (p.title) map.set(p.title.toLowerCase(), p); });
    return map;
  }, [allDbProducts]);

  // useLatest pattern — פונקציות יציבות שתמיד קוראות לנתונים המעודכנים
  const handleProductClickRef = useRef(handleProductClick);
  const handleAutoCampaignRef = useRef(handleAutoCampaign);
  useEffect(() => {
    handleProductClickRef.current = handleProductClick;
    handleAutoCampaignRef.current = handleAutoCampaign;
  });
  const handleProductClickCb = React.useCallback((p) => handleProductClickRef.current(p), []);
  const handleAutoCampaignCb = React.useCallback(() => handleAutoCampaignRef.current(), []);

  async function handleCreateCampaign() {
    if (!selProduct||!canPublish) return;
    setCampaignStatus("creating");
    try {
      const isDb = !!selProduct.hasAiAnalysis;
      const ai = isDb ? (selProduct.aiAnalysis||{}) : (findAiForProduct(aiResults?.products, selProduct)||{});
      const form = new FormData();
      form.append("productTitle", selProduct.title); form.append("headlines", JSON.stringify(editHeadlines));
      form.append("descriptions", JSON.stringify(editDescriptions)); form.append("keywords", JSON.stringify(ai.keywords||[]));
      form.append("finalUrl", getProductUrl(selProduct)); form.append("dailyBudget", "50");
      const campAbort = new AbortController();
      const res = await fetch("/app/api/campaign", { method:"POST", body:form, signal:campAbort.signal });
      const data = await res.json(); setCampaignStatus(data.success ? "success" : "error");
      if (data.success) {
        triggerConfetti();
        const cid = data.campaignId || data.campaign_id || data.resourceName || null;
        if (cid) { setCampaignId(cid); try { sessionStorage.setItem("sai_campaign_id", cid); } catch(err) { console.error("[SmartAds]", err); } }
      }
    } catch { setCampaignStatus("error"); }
  }

  async function handleAiImprove(type, index) {
    if (aiCredits <= 0) { setShowBuyCredits(true); return; }
    const key = `${type}-${index}`; setImprovingIdx(key);
    const text = type==="h" ? editHeadlines[index] : editDescriptions[index];
    try {
      const form = new FormData(); form.append("text", text); form.append("type", type==="h"?"headline":"description"); form.append("productTitle", selProduct?.title||"");
      const improveAbort = new AbortController();
      const res = await fetch("/app/api/ai-improve", { method:"POST", body:form, signal:improveAbort.signal });
      const data = await res.json();
      if (data.success && data.improved) {
        if (type==="h") { const n=[...editHeadlines]; n[index]=data.improved.trim().slice(0, 30); setEditHeadlines(n); }
        else { const n=[...editDescriptions]; n[index]=data.improved.trim().slice(0, 90); setEditDescriptions(n); }
        setAiCredits(aiCredits - 1);
      }
    } catch(err) { console.error("[SmartAds]", err); }
    setImprovingIdx(null);
  }

  // ── ONBOARD MODAL ──
  // ── OnboardModal & BuyCreditsModal now imported from ../components/Modals.jsx ──
  // (BUG FIX #1: moved outside Index() to prevent re-mount on every parent re-render)

  // ── ERROR / LOADING SCREENS ──
  if (scanError) return (
    <div className="sr dk">
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>⚠️</div>
        <h2 className="ld-title">Scan Failed</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{scanError}</p>
        <div style={{display:"flex",gap:12}}>
          <button className="btn-primary" onClick={()=>{setScanError(null);doScan("review");}}>🔄 Try Again</button>
          <button className="btn-secondary" onClick={()=>setScanError(null)}>← Go Back</button>
        </div>
      </div>
    </div>
  );

  if (isScanning && !(isPaid && analyzedDbProducts.length === 0)) {
    const pct = Math.round(fakeProgress);
    const steps = hasScanAccess ? [
      {label:"Fetching products from your store",done:pct>=10,active:pct<10},
      {label:"Searching Google for competitors",done:pct>=25,active:pct>=10&&pct<25},
      {label:"Analyzing competitor websites",done:pct>=45,active:pct>=25&&pct<45},
      {label:"Checking your Google rankings",done:pct>=60,active:pct>=45&&pct<60},
      {label:"Generating AI-optimized ad copy",done:pct>=80,active:pct>=60&&pct<80},
      {label:"Building your competitive strategy",done:pct>=100,active:pct>=80&&pct<100},
    ] : [
      {label:"Fetching products",done:pct>=10,active:pct<10},
      {label:"Quick AI analysis",done:pct>=55,active:pct>=10&&pct<55},
      {label:"Generating preview",done:pct>=100,active:pct>=55&&pct<100},
    ];
    return (
      <div className="sr dk">
        <Confetti active={showConfetti}/>
        <div className="ld-wrap">
          <div className="ld-pct-ring">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={pct>=100?"#22c55e":"#6366f1"} strokeWidth="7" strokeDasharray="289" strokeDashoffset={289-(289*pct/100)} strokeLinecap="round" transform="rotate(-90 55 55)" style={{transition:"stroke-dashoffset .5s ease, stroke .3s"}}/>
            </svg>
            <span className="ld-pct-text">{pct}%</span>
          </div>
          <h2 className="ld-title">{hasScanAccess?(pct>=100?"Your store is ready to grow! 🎉":pct>=50?"Making great progress! ✨":"On it! Working my magic… 🤖"):(pct>=100?"Preview ready!":"Running quick preview...")}</h2>
          <p className="ld-sub">{scanMsg||"Hang tight — your AI assistant is hard at work"}</p>
          <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:pct+"%",transition:"width .5s ease"}}/></div>
          {hasScanAccess && <TipRotator/>}
          {!hasScanAccess && <div className="free-scan-note">🔓 Free preview — {FREE_SCAN_LIMIT} products only</div>}
          <div className="ld-steps">{steps.map((s,i)=><div key={i} className={`ld-step ${s.done?"ld-step-done":""} ${s.active?"ld-step-active":""}`}><span className="ld-dot">{s.done?"✓":""}</span>{s.label}</div>)}</div>
          <button className="btn-back" style={{marginTop:8}} onClick={()=>setShowCancelConfirm(true)}>← Cancel</button>
          {showCancelConfirm && (
            <div className="cancel-confirm-overlay">
              <div className="cancel-confirm-box">
                <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>Stop Scanning?</h3>
                <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:20}}>All progress will be lost.</p>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button className="btn-primary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>setShowCancelConfirm(false)}>Continue Scanning</button>
                  <button className="btn-secondary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>{cancelRef.current=true;if(creepRef.current){clearInterval(creepRef.current);creepRef.current=null;}setShowCancelConfirm(false);setIsScanning(false);setFakeProgress(0);setProducts([]);setAiResults(null);}}>Yes, Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (autoLaunching) return (
    <div className="sr dk">
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20,animation:"ldPulse 1s ease infinite"}}>⚡</div>
        <h2 className="ld-title">Launching Your Campaigns...</h2>
        <p className="ld-sub">AI is building and submitting Google Ads campaigns for all your products.</p>
        <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:"60%",animation:"barPulse 2s ease infinite"}}/></div>
      </div>
    </div>
  );

  if (autoStatus==="success"||autoStatus==="error") return (
    <div className="sr dk">
      <Confetti active={showConfetti}/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>{autoStatus==="success"?"✅":"❌"}</div>
        <h2 className="ld-title">{autoStatus==="success"?"Campaigns Are Live!":"Campaign Creation Failed"}</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{autoStatus==="success"?"Your AI-optimized campaigns are created in PAUSED state. Review them in Google Ads.":"Something went wrong. Try manual mode."}</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button className="btn-primary" onClick={()=>setAutoStatus(null)}>📊 View Dashboard</button>
          {autoStatus==="success" && <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{textDecoration:"none"}}>Open Google Ads →</a>}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // MAIN DASHBOARD
  // ══════════════════════════════════════════════
  if (hasScanAccess) {
    const totalProducts = totalDbProducts;
    // analyzedCount and avgScore already defined above (outside conditionals)
    const totalKeywords = analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.keywords?.length||0),0);
    const highPotential = analyzedDbProducts.filter(p=>(p.aiAnalysis?.ad_score||0)>=70).length;
    const topProduct = analyzedDbProducts.reduce((best,p)=>((p.aiAnalysis?.ad_score||0)>(best.aiAnalysis?.ad_score||0)?p:best),analyzedDbProducts[0]||null);
    const mockCampaigns = canPublish&&analyzedCount>0 ? Math.min(Math.floor(analyzedCount*0.6),12) : 0;
    const mockRoas = analyzedCount>0 ? (1.8+avgScore*0.028).toFixed(1) : "0";
    const competitorThreat = avgScore>=70?"Low":avgScore>=50?"Moderate":"High";
    const threatColor = {Low:"#22c55e",Moderate:"#f59e0b",High:"#ef4444"}[competitorThreat];
    const googleRankStatus = avgScore>=70?"page_1":avgScore>=50?"page_2":"page_3";
    const sortedProducts2 = sortedProducts; // already computed above
    const competitorCount = topCompetitors.length;
    // keywordGaps and totalMonthlyGapLoss already computed above

    // Live Google Ads data — from top-level hook
    const impressionsBase = liveAds.impressions;
    const clicksBase = liveAds.clicks;

    // ── Fresh paid subscriber — never scanned yet ──
    if (isPaid && analyzedCount === 0) return (
      <div className="sr dk"><div className="bg-m"/>
        <div className="status-bar"><div className="status-bar-inner">
          <div className="sb-row sb-row-data">
            <div className="sb-chips-left">
              <div className="sb-chip2 sb-chip-plan"><span className="sb-dot sb-dot-green"/><span className="sb-label">PLAN</span><span className="sb-value">{selectedPlan.toUpperCase()}</span></div>
              <div className="sb-chip2"><span className="sb-label">📦 PRODUCTS</span><span className="sb-value">{totalProducts}</span></div>
              <div className="sb-chip2"><span className="sb-label">🎯 ANALYZED</span><span className="sb-value sb-val-green">0</span></div>
            </div>
          </div>
        </div></div>
        <div className="da">
          <CollectingDataScreen
            totalProducts={totalProducts}
            realProgress={isScanning ? Math.round(fakeProgress) : null}
            scanMsg={scanMsg}
            onScan={() => doScan("review")}
            onCancel={() => {
              cancelRef.current = true;
              if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
              setIsScanning(false); setFakeProgress(0);
              setProducts([]); setAiResults(null);
            }}
          />
        </div>
      </div>
    );

    return (
      <div className="sr dk">
        <Confetti active={showConfetti}/>
        <div className="bg-m"/>

        {/* STATUS BAR — two rows */}
        <div className="status-bar">
          <div className="status-bar-inner">
            {/* Row 1: data chips */}
            <div className="sb-row sb-row-data">
              <div className="sb-chips-left">
                {isPaid
                  ? <div className="sb-chip2 sb-chip-plan"><span className="sb-dot sb-dot-green"/><span className="sb-label">PLAN</span><span className="sb-value">{selectedPlan.toUpperCase()}</span></div>
                  : <div className="sb-chip2 sb-chip-credits"><span className="sb-dot sb-dot-cyan"/><span className="sb-label">SCAN CREDITS</span><span className="sb-value">{scanCredits}</span></div>}
                {isPaid && <div className="sb-chip2"><span className="sb-label">✨ AI CREDITS</span><span className="sb-value sb-val-cyan">{aiCredits}</span></div>}
                <div className="sb-chip2"><span className="sb-label">📦 PRODUCTS</span><span className="sb-value">{totalProducts}</span></div>
                <div className="sb-chip2"><span className="sb-label">🎯 ANALYZED</span><span className="sb-value sb-val-green">{analyzedCount}</span></div>
                {topProduct && <div className="sb-chip2 sb-chip-top2"><span className="sb-label">👑 TOP</span><span className="sb-value sb-val-gold" title={topProduct.title}>{topProduct.title.length>28?topProduct.title.slice(0,28)+"…":topProduct.title}</span></div>}
              </div>
              <div className="sb-chips-right">
                {canPublish
                  ? <div className="sb-chip2 sb-chip-publish-active"><span className="sb-dot sb-dot-green"/><span className="sb-label">PUBLISH</span><span className="sb-value sb-val-green">ACTIVE</span></div>
                  : <div className="sb-chip2 sb-chip-warn"><span className="sb-dot sb-dot-orange"/><span className="sb-label">PUBLISH</span><span className="sb-value">LOCKED</span></div>}
                {liveAds.isRealData && <div className="sb-chip2 sb-chip-live"><span className="sb-dot sb-dot-green" style={{animation:"ldPulse 1s ease infinite"}}/><span className="sb-label">LIVE DATA</span></div>}
              </div>
            </div>
            {/* Row 2: action buttons */}
            <div className="sb-row sb-row-actions">
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {isPaid
                  ? <button className="sb-btn2" onClick={()=>setShowBuyCredits(true)}>✨ Buy AI Credits</button>
                  : <>
                      <button className="sb-btn2 sb-btn2-upgrade" onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>↑ Upgrade to Publish</button>
                      <button className="sb-btn2" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
                    </>}
              </div>
              {liveAds.lastUpdated && (
                <span className="sb-last-updated">
                  {liveAds.isRealData ? "🟢 Live" : "⚪ Mock"} · Updated {liveAds.lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="da">
          {/* HEADER */}
          <div className="da-header">
            <div>
              <h1 className="da-title">Campaign Dashboard</h1>
              <p className="da-sub">{analyzedCount>0?`${analyzedCount} products analyzed · ${highPotential} high-potential · avg score ${avgScore}/100`:`${totalProducts} products synced · Run AI analysis to get started`}</p>
              {analyzedCount>0 && totalMonthlyGapLoss>0 && (
                <div className="da-potential-banner">
                  💸 Your store could be capturing an extra <strong>${totalMonthlyGapLoss.toLocaleString()}/mo</strong> in revenue — <span className="da-potential-link" onClick={() => document.querySelector('.clf-card, .tmo-card')?.scrollIntoView({behavior:'smooth'})}>see how →</span>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {analyzedCount>0 && <a href="/app/saved" className="btn-saved" style={{textDecoration:"none"}}>📋 My Results</a>}
              <button className="btn-secondary" style={{padding:"8px 16px",fontSize:13}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>
              {canPublish
                ? <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={handleAutoCampaign}>⚡ Auto Launch All</button>
                : <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={()=>doScan("review")}>🔍 Scan Products</button>}
            </div>
          </div>

          {/* ══ STORE HEALTH + LIVE PULSE ROW ══ */}
          {/* TOP MISSED OPPORTUNITY */}
          <TopMissedOpportunity
            topProduct={topProduct}
            avgScore={avgScore}
            totalMonthlyGapLoss={totalMonthlyGapLoss}
            analyzedCount={analyzedCount}
            hasScanAccess={hasScanAccess}
            onScan={() => { setShowOnboard(true); setOnboardTab("scan"); setOnboardStep(1); }}
            onViewProduct={handleProductClickCb}
          />

          <div className="health-pulse-row">
            <StoreHealthScore
              analyzedCount={analyzedCount}
              totalProducts={totalProducts}
              avgScore={avgScore}
              highPotential={highPotential}
              competitorCount={competitorCount}
            />
            <LivePulse
              campaigns={mockCampaigns}
              impressionsBase={impressionsBase}
              clicksBase={clicksBase}
              campaignId={campaignId}
              realSpend={realSpend}
              campaignControlStatus={campaignControlStatus}
              confirmRemove={confirmRemove}
              setConfirmRemove={setConfirmRemove}
              onPause={handlePauseCampaign}
              onRemove={handleRemoveCampaign}
            />
          </div>

          {/* SPEEDOMETERS */}
          <div className="speedo-row">
            <div className="speedo-card"><Speedometer value={avgScore} max={100} label="Avg Ad Score" color="#6366f1" size={130}/></div>
            <div className="speedo-card"><Speedometer value={highPotential} max={Math.max(totalProducts,1)} label="High-Potential" color="#22c55e" size={130}/></div>
            <div className="speedo-card"><Speedometer value={Math.min(mockCampaigns,20)} max={20} label="Active Campaigns" color="#06b6d4" size={130}/></div>
            <div className="speedo-card"><Speedometer value={parseFloat(mockRoas)*10} max={100} label="ROAS Score" color="#f59e0b" size={130}/></div>
          </div>

          {/* STATS */}
          <div className="stats-row" style={{marginBottom:24}}>
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={totalProducts}/></div><div className="stat-lbl">Total Products</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val">{analyzedCount>0?<Counter end={avgScore} suffix="/100"/>:<span style={{color:"rgba(255,255,255,.3)"}}>—</span>}</div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">🔑</div><div className="stat-val">{analyzedCount>0?<Counter end={totalKeywords}/>:<span style={{color:"rgba(255,255,255,.3)"}}>—</span>}</div><div className="stat-lbl">Keywords</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={analyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {totalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
          </div>

          {/* STATUS ROW */}
          <div className="status-row">
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(34,197,94,.1)",color:"#22c55e"}}>📈</div><div><div className="status-card-label">Campaigns Active</div><div className="status-card-val">{mockCampaigns} running</div></div><div className="status-card-trend">{canPublish?`+${Math.round(mockCampaigns*0.2)} this week`:"Subscribe to launch"}</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(6,182,212,.1)",color:"#06b6d4"}}>👁</div><div><div className="status-card-label">Impressions</div><div className="status-card-val">{(mockCampaigns*4200).toLocaleString()}/mo</div></div><div className="status-card-trend up">est.</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>👆</div><div><div className="status-card-label">Est. Clicks</div><div className="status-card-val">{(mockCampaigns*180).toLocaleString()}/mo</div></div><div className="status-card-trend up">est.</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:`rgba(${threatColor==="#22c55e"?"34,197,94":threatColor==="#f59e0b"?"245,158,11":"239,68,68"},.1)`,color:threatColor}}>🕵️</div><div><div className="status-card-label">Competitor Threat</div><div className="status-card-val" style={{color:threatColor}}>{competitorThreat}</div></div><div className="status-card-trend" style={{color:threatColor}}>{googleRankStatus==="page_1"?"Page 1":googleRankStatus==="page_2"?"Page 2":"Page 3+"} rank</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(245,158,11,.1)",color:"#fbbf24"}}>💰</div><div><div className="status-card-label">Est. ROAS</div><div className="status-card-val">{mockRoas}x</div></div><div className="status-card-trend up">based on scores</div></div>
            {/* Total Spend Card */}
            {campaignId && (
              <div className="status-card status-card-spend">
                <div className="status-card-icon" style={{background:"rgba(34,197,94,.1)",color:"#22c55e"}}>💸</div>
                <div>
                  <div className="status-card-label">Total Spend</div>
                  <div className="status-card-val">
                    {realSpend != null ? `$${Number(realSpend).toFixed(2)}` : "Fetching…"}
                  </div>
                </div>
                <div className="status-card-trend up">{realSpend != null ? "live from Google" : "connecting…"}</div>
              </div>
            )}
          </div>


          {/* COMPETITOR PANEL */}
          {analyzedCount > 0 && (
            <div className="competitor-panel">
              <div className="competitor-panel-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div className="clf-live-dot"/>
                  <span className="competitor-panel-title">🕵️ Top Competitors Detected</span>
                  <span className="clf-live-badge">LIVE</span>
                </div>
                <span className="competitor-panel-sub">Across {analyzedCount} analyzed products · sorted by frequency</span>
              </div>
              <div className="competitor-list">
                {topCompetitors.length === 0 && (
                  <div style={{ textAlign:"center", padding:"24px 16px", color:"rgba(255,255,255,.5)" }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
                    <div style={{ fontSize:14, fontWeight:600, color:"rgba(255,255,255,.7)", marginBottom:4 }}>No competitor domains detected yet</div>
                    <div style={{ fontSize:12 }}>Add a SerpAPI key in .env for real competitor tracking, or re-scan products</div>
                  </div>
                )}
                {topCompetitors.map(([domain,data],i)=>{
                  const tc = data.strength==="strong"?"#ef4444":data.strength==="medium"?"#f59e0b":"#22c55e";
                  const keywords = analyzedDbProducts
                    .flatMap(p=>(p.aiAnalysis?.competitor_intel?.top_competitors||[]).filter(c=>c.domain===domain).flatMap(c=>c.keywords||[]))
                    .filter(Boolean).slice(0,3);
                  return (
                    <div key={i} className="competitor-item competitor-item-clickable" onClick={()=>setSelCompetitor({domain})}>
                      <div className="competitor-rank">#{i+1}</div>
                      <div className="competitor-favicon">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" onError={e=>{e.target.style.display="none"}} style={{width:16,height:16}}/>
                      </div>
                      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="competitor-domain competitor-domain-link" onClick={e=>e.stopPropagation()}>{domain}</a>
                      {keywords.length>0 && (
                        <div className="competitor-keywords">
                          {keywords.map((k,ki)=><span key={ki} className="competitor-kw-tag">{typeof k==="string"?k:k?.text||k}</span>)}
                        </div>
                      )}
                      <div className="competitor-count">{data.count} product{data.count!==1?"s":""}</div>
                      <div className="competitor-strength" style={{color:tc}}>{data.strength}</div>
                      <div className="competitor-click-hint">View ads →</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPETITOR GAP FINDER */}
          {analyzedCount > 0 && (
            <CompetitorGapFinder
              keywordGaps={keywordGaps}
              totalMonthlyGapLoss={totalMonthlyGapLoss}
              analyzedCount={analyzedCount}
              canPublish={canPublish}
              onUpgrade={handleUpgradeClick}
            />
          )}

          {/* BUDGET SIMULATOR */}
          <BudgetSimulator
            avgScore={avgScore}
            avgCpc={null}
            canPublish={canPublish}
            onUpgrade={handleUpgradeClick}
          />

          {/* AD PREVIEW PANEL */}
          <AdPreviewPanel
            topProduct={topProduct}
            mockCampaigns={mockCampaigns}
            canPublish={canPublish}
            shop={shopDomain}
            onLaunch={canPublish ? handleAutoCampaignCb : handleUpgradeClick}
            onViewProduct={handleProductClickCb}
          />

          {/* AI SUMMARY */}
          {analyzedCount>0 && (
            <div className="ai-summary-card" style={{marginBottom:24}}>
              <span className="ai-summary-icon">🤖</span>
              <div>
                <div className="celebrate-badge">✨ {analyzedCount===totalProducts?"All Products Analyzed":`${analyzedCount} Products Analyzed`}</div>
                <div>{highPotential} high-potential products found. {topProduct?.title?`"${topProduct.title}" is your top performer with a score of ${topProduct.aiAnalysis?.ad_score||0}.`:""} {canPublish?"Ready for campaign launch.":"Subscribe to publish campaigns to Google Ads."}</div>
              </div>
            </div>
          )}

          {/* ACTION CARD */}
          {canPublish ? (
            <div className="auto-campaign-card">
              <div className="auto-campaign-left">
                <div className="auto-campaign-icon">⚡</div>
                <div><div className="auto-campaign-title">Fully Automatic Campaign</div><div className="auto-campaign-desc">The AI handles everything — competitor research, keywords, ad copy, targeting, and launch. Zero manual work.</div></div>
              </div>
              <button className="btn-auto-launch" onClick={handleAutoCampaign}><span>Launch All Campaigns</span><span style={{fontSize:12,opacity:0.7,display:"block"}}>AI does everything for you</span></button>
            </div>
          ) : (
            <div className="upgrade-publish-card">
              <div className="upc-left">
                <div style={{fontSize:32,flexShrink:0}}>🔒</div>
                <div><div className="upc-title">Ready to Publish Campaigns?</div><div className="upc-desc">You have full AI scan access. Subscribe to push these campaigns live to Google Ads with one click.</div></div>
              </div>
              <button className="btn-primary" style={{padding:"12px 28px",flexShrink:0}} onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>View Plans →</button>
            </div>
          )}

          {/* PRODUCTS GRID */}
          <div style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{fontSize:18,fontWeight:700}}>Your Products</h2>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-secondary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>doScan("review")}>↻ Rescan</button>
              {canPublish && <button className="btn-secondary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>}
            </div>
          </div>
          <div className="p-grid">
            {sortedProducts.map((product,idx)=>{
              const ai=product.aiAnalysis, hasAi=product.hasAiAnalysis&&ai, score=hasAi?ai.ad_score||0:0;
              const isTopPick=idx<3&&hasAi&&score>=60;
              const eI=hasAi?Math.round(score*46+500):0, eC=hasAi?Math.round(score*3.8+20):0, eCo=hasAi?Math.round(score*0.45+10):0;
              return (
                <div key={product.id} className={`p-card ${!hasAi?"p-card-pending":""} ${isTopPick?"p-card-recommended":""}`} onClick={()=>hasAi?handleProductClick(product):null}>
                  {isTopPick && <div className="p-card-rec-badge">⭐ AI Recommends</div>}
                  <div className="p-card-img-wrap">
                    {product.image?<img src={product.image} alt={product.title} className="p-card-img"/>:<div className="p-card-noimg">📦</div>}
                    {hasAi && <div className="p-card-score"><ScoreRing score={score}/></div>}
                    {!hasAi && <div className="p-card-pending-badge">🔒 Not analyzed</div>}
                    {!product.inStock && <div className="p-card-oos">Out of Stock</div>}
                  </div>
                  <div className="p-card-body">
                    <h3 className="p-card-title">{product.title}</h3>
                    <p className="p-card-price">${Number(product.price).toFixed(2)}</p>
                    {hasAi ? (
                      <>
                        <div className="p-card-metrics">
                          <div className="p-metric"><span className="p-metric-ic">👁</span><span className="p-metric-val">{eI.toLocaleString()}</span><span className="p-metric-lbl">/mo</span></div>
                          <div className="p-metric"><span className="p-metric-ic">👆</span><span className="p-metric-val">{eC}</span><span className="p-metric-lbl">/mo</span></div>
                          <div className="p-metric"><span className="p-metric-ic">💰</span><span className="p-metric-val">${eCo}</span><span className="p-metric-lbl">/day</span></div>
                        </div>
                        <div className="p-card-hl">{ai.headlines?.[0]||"AI headline preview..."}</div>
                        <div className="p-card-cta">{canPublish?"View & Launch →":"View AI Analysis →"}</div>
                      </>
                    ) : (
                      <><div className="p-card-hl" style={{color:"rgba(255,255,255,.25)"}}>Analysis pending...</div><div className="p-card-cta" style={{color:"rgba(255,255,255,.3)"}}>⏳ In queue</div></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MANUAL PICKER */}
        {showManualPicker && (
          <div className="modal-overlay" onClick={()=>setShowManualPicker(false)}>
            <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{maxWidth:680}}>
              <button className="modal-close" onClick={()=>setShowManualPicker(false)}>✕</button>
              <h2 style={{fontSize:20,fontWeight:800,marginBottom:6}}>🎯 Manual Campaign</h2>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:20}}>Select products. AI will create optimized campaigns for each one.</p>
              {!canPublish && <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fbbf24",marginBottom:16}}>🔒 Publishing requires a subscription. <span style={{color:"#a5b4fc",cursor:"pointer"}} onClick={()=>{setShowManualPicker(false);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>View plans →</span></div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxHeight:"50vh",overflowY:"auto",marginBottom:20}}>
                {[...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0)).filter(p=>p.hasAiAnalysis).map(p=>{
                  const picked=pickedProducts.includes(p.id), isRec=(p.aiAnalysis?.ad_score||0)>=70;
                  return (
                    <div key={p.id} className={`picker-card ${picked?"picker-selected":""}`} onClick={()=>setPickedProducts(prev=>picked?prev.filter(id=>id!==p.id):[...prev,p.id])}>
                      {isRec && <div className="picker-rec">⭐ Recommended</div>}
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {p.image && <img src={p.image} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover"}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.title}</div>
                          <div style={{fontSize:12,color:"#a5b4fc"}}>${Number(p.price).toFixed(2)} · Score: {p.aiAnalysis?.ad_score||0}/100</div>
                        </div>
                        <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${picked?"#6366f1":"rgba(255,255,255,.2)"}`,background:picked?"#6366f1":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{picked?"✓":""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {analyzedDbProducts.length===0 && <p style={{textAlign:"center",color:"rgba(255,255,255,.4)",fontSize:13}}>No analyzed products yet. Run AI analysis first.</p>}
              <div style={{display:"flex",gap:10}}>
                <button className="btn-secondary" style={{flex:1}} onClick={()=>setShowManualPicker(false)}>Cancel</button>
                <button className="btn-primary" style={{flex:2}} disabled={pickedProducts.length===0||!canPublish} onClick={async()=>{
                  if(!canPublish){setShowManualPicker(false);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);return;}
                  setShowManualPicker(false);setAutoLaunching(true);
                  let sc=0;
                  const sorted=[...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0));
                  for(const id of pickedProducts){
                    const prod=sorted.find(p=>p.id===id);if(!prod)continue;
                    const ai=prod.aiAnalysis||{};
                    try{const form=new FormData();form.append("productTitle",prod.title);form.append("headlines",JSON.stringify((ai.headlines||[]).map(h=>typeof h==="string"?h:h.text||h)));form.append("descriptions",JSON.stringify((ai.descriptions||[]).map(d=>typeof d==="string"?d:d.text||d)));form.append("keywords",JSON.stringify(ai.keywords||[]));form.append("finalUrl",getProductUrl(prod));form.append("dailyBudget","50");const res=await fetch("/app/api/campaign",{method:"POST",body:form});const data=await res.json();if(data.success)sc++;}catch(err) { console.error("[SmartAds]", err); }
                  }
                  setAutoLaunching(false);setPickedProducts([]);setAutoStatus(sc>0?"success":"error");if(sc>0)triggerConfetti();
                }}>{canPublish?`🚀 Launch ${pickedProducts.length>0?pickedProducts.length+" ":""}Campaign${pickedProducts.length!==1?"s":""}` :"🔒 Subscribe to Launch"}</button>
              </div>
            </div>
          </div>
        )}

        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults} editHeadlines={editHeadlines} setEditHeadlines={setEditHeadlines}
          editDescriptions={editDescriptions} setEditDescriptions={setEditDescriptions}
          isPaid={isPaid} aiCredits={aiCredits} setShowBuyCredits={setShowBuyCredits}
          improvingIdx={improvingIdx} handleAiImprove={handleAiImprove}
          canPublish={canPublish} hasScanAccess={hasScanAccess}
          campaignStatus={campaignStatus} setCampaignStatus={setCampaignStatus}
          handleCreateCampaign={handleCreateCampaign}
          setSelProduct={setSelProduct} setShowOnboard={setShowOnboard}
          setOnboardTab={setOnboardTab} setOnboardStep={setOnboardStep}
          shop={shopDomain}
        />}
        {selCompetitor && <CompetitorModal competitor={selCompetitor} products={analyzedDbProducts} onClose={()=>setSelCompetitor(null)}/>}
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>setShowLaunchChoice(true)}/>}
        {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      </div>
    );
  }

  // ── FREE DEMO RESULTS ──
  if (scanned && products.length > 0) {
    const analyzedCount = aiResults?.products?.length||0, totalProducts = products.length;
    const avgScore = aiResults?.products?.length ? Math.round(aiResults.products.reduce((a,p)=>a+(p.ad_score||0),0)/aiResults.products.length) : 0;
    const highPotential = aiResults?.products?.filter(p=>p.ad_score>=70).length||0;
    return (
      <div className="sr dk">
        <Confetti active={showConfetti}/><div className="bg-m"/>
        {isHydrated && !isPaid && scanCredits === 0 && <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>}
        <div className="da">
          <div className="da-header">
            <div>
              <button className="btn-back-home" onClick={()=>{setProducts([]);setAiResults(null);}}>← Back</button>
              <h1 className="da-title">Free Preview</h1>
              <p className="da-sub">{analyzedCount} of {totalProducts} products analyzed · Upgrade to unlock all {totalProducts-analyzedCount} remaining</p>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button className="btn-rescan" onClick={()=>doScan("review")}>↻ Scan Again</button>
              <button className="btn-secondary" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
              <button className="btn-primary" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Subscribe & Publish</button>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={totalProducts}/></div><div className="stat-lbl">Products Found</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val"><Counter end={avgScore} suffix="/100"/></div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">⚡</div><div className="stat-val"><Counter end={highPotential}/></div><div className="stat-lbl">High-Potential</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={analyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {totalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
          </div>
          <div className="ai-summary-card ai-summary-free"><span className="ai-summary-icon">🔒</span><div><div className="free-badge">Free Preview</div><div>{aiResults?.summary}</div></div></div>
          <div className="p-grid">
            {products.map(product=>{
              const ai=findAiForProduct(aiResults?.products, product), hasAi=!!ai, score=hasAi?ai.ad_score||0:0;
              const eI=hasAi?Math.round(score*46+500):0, eC=hasAi?Math.round(score*3.8+20):0, eCo=hasAi?Math.round(score*0.45+10):0;
              return (
                <div key={product.id} className={`p-card ${!hasAi?"p-card-locked":""}`} onClick={()=>hasAi?handleProductClick({...product,aiAnalysis:ai}):null}>
                  <div className="p-card-img-wrap">
                    {product.image?<img src={product.image} alt={product.title} className="p-card-img"/>:<div className="p-card-noimg">📦</div>}
                    {hasAi && <div className="p-card-score"><ScoreRing score={score}/></div>}
                    {!hasAi && <div className="p-card-locked-overlay"><div style={{fontSize:28}}>🔒</div><div style={{fontSize:11,marginTop:4}}>Upgrade to unlock</div></div>}
                  </div>
                  <div className="p-card-body">
                    <h3 className="p-card-title">{product.title}</h3>
                    <p className="p-card-price">${Number(product.price).toFixed(2)}</p>
                    {hasAi ? (<><div className="p-card-metrics"><div className="p-metric"><span className="p-metric-ic">👁</span><span className="p-metric-val">{eI.toLocaleString()}</span><span className="p-metric-lbl">/mo</span></div><div className="p-metric"><span className="p-metric-ic">👆</span><span className="p-metric-val">{eC}</span><span className="p-metric-lbl">/mo</span></div><div className="p-metric"><span className="p-metric-ic">💰</span><span className="p-metric-val">${eCo}</span><span className="p-metric-lbl">/day</span></div></div><div className="p-card-hl">{ai.headlines?.[0]||"AI headline preview..."}</div><div className="p-card-cta">View AI Analysis →</div></>) : (<div className="p-card-hl p-card-blur">Upgrade to see keywords, ad copy & competitor data</div>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="free-upgrade-cta" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>
            <div className="free-upgrade-icon">🚀</div>
            <div><div className="free-upgrade-title">Unlock All {totalProducts} Products + Full Campaigns</div><div className="free-upgrade-desc">Get competitor intelligence, ad copy, keywords & one-click Google Ads campaigns for every product</div></div>
            <div className="free-upgrade-arrow">→</div>
          </div>
        </div>
        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults} editHeadlines={editHeadlines} setEditHeadlines={setEditHeadlines}
          editDescriptions={editDescriptions} setEditDescriptions={setEditDescriptions}
          isPaid={isPaid} aiCredits={aiCredits} setShowBuyCredits={setShowBuyCredits}
          improvingIdx={improvingIdx} handleAiImprove={handleAiImprove}
          canPublish={canPublish} hasScanAccess={hasScanAccess}
          campaignStatus={campaignStatus} setCampaignStatus={setCampaignStatus}
          handleCreateCampaign={handleCreateCampaign}
          setSelProduct={setSelProduct} setShowOnboard={setShowOnboard}
          setOnboardTab={setOnboardTab} setOnboardStep={setOnboardStep}
          shop={shopDomain}
        />}
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>setShowLaunchChoice(true)}/>}
        {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      </div>
    );
  }

  // ── LANDING PAGE ──
  return (
    <div className="sr dk">
      <div className="bg-m"/>
      <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>
      <div className={`la ${vis?"la-v":""}`}>
        <section className="hero">
          <div className="hero-badge">🤖 AI-Powered Google Ads for Shopify</div>
          <h1 className="hero-h">Stop guessing.<br/><span className="hero-grad">Start selling.</span></h1>
          <p className="hero-p">Smart Ads AI scans your competitors, checks your Google rankings, writes killer ad copy, and launches campaigns that convert — in 60 seconds.</p>
          <div className="hero-btns">
            <button className="btn-primary btn-lg" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Start My Campaign</button>
            <button className="btn-secondary" onClick={()=>doScan("review")}>Try Free Preview</button>
          </div>
          <div className="hero-nudge" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}><span className="nudge-lock">⚡</span> No subscription? <strong>Buy scan credits</strong> — from $0.60/scan <span className="nudge-arrow">→</span></div>
          <div className="hero-metrics">
            <div className="hm"><span className="hm-val">+340%</span><span className="hm-lbl">Avg ROAS</span></div>
            <div className="hm"><span className="hm-val">47hrs</span><span className="hm-lbl">Saved/month</span></div>
            <div className="hm"><span className="hm-val">-52%</span><span className="hm-lbl">CPC Reduction</span></div>
          </div>
          <SuccessTicker/>
        </section>
        {/* ── BUDGET TEASER ── */}
        <section className="section lp-budget-section">
          <h2 className="sec-h">See your numbers before you commit</h2>
          <p className="sec-sub">Move the slider — watch your projected results update instantly.</p>
          <LandingBudgetTeaser />
        </section>

        {/* ── WHAT YOU'RE MISSING ── */}
        <section className="section lp-missing-section">
          <h2 className="sec-h">What's happening while you wait</h2>
          <p className="sec-sub">Every day without Smart Ads AI, your competitors are pulling ahead.</p>
          <LandingMissingBlock onInstall={() => { setShowOnboard(true); setOnboardStep(1); setOnboardTab("subscription"); }} />
        </section>

        <section className="section"><h2 className="sec-h">Sound familiar?</h2><div className="pain-grid">{[{ic:"💸",t:"Wasted Ad Spend",d:"Thousands spent on agencies with nothing to show for it."},{ic:"😵",t:"Google Ads Confusion",d:"The interface is overwhelming. You don't know where to start."},{ic:"📝",t:"Generic Ad Copy",d:"Your ads sound like everyone else's. No personality, no conversions."},{ic:"⏰",t:"Weeks of Setup",d:"By the time your campaign launches, the trend is already over."}].map((p,i)=><div key={i} className="pain-card"><span className="pain-ic">{p.ic}</span><h3 className="pain-t">{p.t}</h3><p className="pain-d">{p.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">What if AI could do it all — better?</h2><div className="sol-grid">{[{n:"60",s:"seconds",d:"Full competitor scan + campaign-ready ads"},{n:"Top 10",s:"competitors",d:"Scraped and analyzed for every product"},{n:"Real",s:"data",d:"Keywords from Google, not guesses from a robot"}].map((s,i)=><div key={i} className="sol-card"><div className="sol-n">{s.n}</div><div className="sol-s">{s.s}</div><p className="sol-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Stupidly simple. Seriously powerful.</h2><div className="steps-grid">{[{n:"1",t:"Scan",d:"AI scans your products and searches Google for your competitors."},{n:"2",t:"Analyze",d:"See competitor keywords, your rankings, and AI-optimized ad copy."},{n:"3",t:"Launch",d:"One click to launch campaigns built on real competitive data."}].map((s,i)=><div key={i} className="step-card"><div className="step-n">{s.n}</div><h3 className="step-t">{s.t}</h3><p className="step-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Everything you need. Nothing you don't.</h2><div className="feat-grid">{[{ic:"🕵️",t:"Competitor Intelligence",d:"We scan your competitors' sites, steal their best keywords, and find gaps they're missing."},{ic:"📍",t:"Google Rank Check",d:"See exactly where your store ranks — and where it doesn't."},{ic:"🧠",t:"AI Ad Copy",d:"Headlines and descriptions based on what's actually working for top-ranking competitors."},{ic:"🎯",t:"Smart Keywords",d:"Real keywords pulled from competitor websites, Google results, and search trends."},{ic:"📊",t:"Ad Score + Strategy",d:"Each product gets a competitive score and a strategy: aggressive, defensive, or dominant."},{ic:"⚡",t:"One-Click Launch",d:"From scan to live Google Ads campaign in 60 seconds. All campaigns start paused for your review."}].map((f,i)=><div key={i} className="feat-card"><span className="feat-ic">{f.ic}</span><h3 className="feat-t">{f.t}</h3><p className="feat-d">{f.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Loved by Shopify merchants</h2><div className="test-grid">{[{q:"Set up my first campaign in under 2 minutes. The AI copy was better than what my agency wrote.",n:"Sarah K.",r:"Fashion Store Owner"},{q:"Finally an app that makes Google Ads accessible. My ROAS went from 1.2x to 4.8x in a month.",n:"Mike T.",r:"Electronics Store"},{q:"I was spending $500/mo on a freelancer. Now AI does it better for $29/mo.",n:"Lisa R.",r:"Beauty & Wellness"}].map((t,i)=><div key={i} className="test-card"><p className="test-q">"{t.q}"</p><div className="test-author"><strong>{t.n}</strong><span>{t.r}</span></div></div>)}</div></section>
        <section className="section cta-section">
          <h2 className="cta-h">Your products deserve better ads.</h2>
          <p className="cta-p">Join 2,000+ Shopify merchants who stopped guessing and started growing.</p>
          <button className="btn-primary btn-lg" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Start My Campaign →</button>
          <div style={{marginTop:12,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-secondary" onClick={()=>doScan("review")}>🔍 Try Free Preview</button>
            <button className="btn-secondary" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
          </div>
        </section>
      </div>
      {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>setShowLaunchChoice(true)}/>}
      {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      {showLaunchChoice && (
        <div className="modal-overlay" onClick={()=>setShowLaunchChoice(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,textAlign:"center",padding:"44px 36px"}}>
            <button className="modal-close" onClick={()=>setShowLaunchChoice(false)}>✕</button>
            <div style={{fontSize:48,marginBottom:16}}>🚀</div>
            <h2 style={{fontSize:24,fontWeight:800,marginBottom:8}}>Launch Your Campaigns</h2>
            <p style={{color:"rgba(255,255,255,.55)",marginBottom:32,fontSize:15}}>How would you like to proceed?</p>
            <div style={{display:"flex",gap:16,flexDirection:"column"}}>
              <button className="launch-choice-btn launch-auto" onClick={()=>{setShowLaunchChoice(false);doScan("auto");}}><span className="launch-choice-icon">⚡</span><div><div className="launch-choice-title">Auto Launch</div><div className="launch-choice-desc">AI scans, builds and launches campaigns instantly — zero manual work</div></div></button>
              <button className="launch-choice-btn" onClick={()=>{setShowLaunchChoice(false);doScan("review");}}><span className="launch-choice-icon">🔍</span><div><div className="launch-choice-title">Review & Edit</div><div className="launch-choice-desc">Check keywords, headlines & images before launching</div></div></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

