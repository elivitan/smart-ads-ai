import React, { useState, useCallback } from "react";
import { Link } from "react-router";
import { Counter, ScoreRing, Speedometer } from "../components/ui/SmallWidgets.jsx";
import { Confetti } from "../routes/SmallComponents.jsx";
import { AdPreviewPanel } from "../routes/AdPreviewPanel.jsx";
import { CompetitorModal } from "../components/CompetitorModal.jsx";
import { CompetitorGapFinder } from "../routes/CompetitorComponents.jsx";
import { StoreHealthScore, TopMissedOpportunity, BudgetSimulator } from "../routes/DashboardWidgets.jsx";
import { LivePulse } from "../components/dashboard/LivePulse.jsx";
import { ProductModal } from "../components/ProductModal.jsx";
import { MarketAlert } from "../routes/MarketAlert.jsx";
import { StoreAnalyticsWidget } from "../routes/StoreAnalytics.jsx";
import useAppStore from "../stores/useAppStore.js";

function LockedOverlay({ isPaid, onUpgrade, title, children }) {
  if (isPaid) return children || null;
  return (
    <div style={{position:"relative"}}>
      <div style={{filter:"blur(3px)",opacity:0.5,pointerEvents:"none"}}>{children}</div>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(10,10,26,.7)",borderRadius:16,zIndex:10,cursor:"pointer"}} onClick={onUpgrade}>
        <div style={{fontSize:36,marginBottom:8}}>🔒</div>
        <div style={{fontSize:15,fontWeight:700,color:"#fff",marginBottom:4}}>{title || "Premium Feature"}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginBottom:12}}>Subscribe to unlock this section</div>
        <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:600}}>Upgrade Now →</div>
      </div>
    </div>
  );
}

class WidgetErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err, info) { console.error(`[WidgetError] ${this.props.label}:`, err, info); }
  render() {
    if (this.state.hasError) return (
      <div style={{padding:16,background:"rgba(239,68,68,.1)",borderRadius:12,border:"1px solid rgba(239,68,68,.2)",margin:"8px 0"}}>
        <span style={{color:"#f87171",fontSize:13}}>\u26A0\uFE0F {this.props.label || "Widget"} failed to load</span>
      </div>
    );
    return this.props.children;
  }
}

export function DashboardView({
  analyzedDbProducts, totalProducts, analyzedCount, avgScore,
  topCompetitors, liveAds, keywordGaps, totalMonthlyGapLoss,
  shopDomain, allDbProducts, storeUrl, sortedProducts,
  onManualLaunch,
  doScan, handleProductClick, navigate,
  handlePauseCampaign, handleRemoveCampaign,
  StyleTag,
  mockCampaigns, mockRoas, competitorThreat, threatColor,
  googleRankStatus, competitorCount, impressionsBase, clicksBase,
  totalKeywords, highPotential, topProduct
}) {

  // ── Zustand Store ──
  const {
    showConfetti, showDashboard, setShowDashboard,
    selectedPlan, aiResults, 
    selCompetitor, setSelCompetitor, selProduct, setSelProduct,
    pickedProducts, setPickedProducts,
    campaignId, realSpend, campaignControlStatus, confirmRemove, setConfirmRemove,
    showOnboard, setShowOnboard, onboardTab, setOnboardTab,
    onboardStep, setOnboardStep, selectPlan,
    googleConnected, setGoogleConnected, scanCredits, setScanCredits,
    justSubscribed, setAutoScanMode,
    showLaunchChoice, setShowLaunchChoice, launchLoading, setLaunchLoading,
    showBuyCredits, setShowBuyCredits, aiCredits, setAiCredits,
  } = useAppStore();
  const isPaid = !!selectedPlan;
  const canPublish = isPaid;  const [showManualPicker, setShowManualPicker] = useState(false);
  const hasScanAccess = isPaid || scanCredits > 0;
  const handleUpgradeClick = useCallback(() => {
    setShowOnboard(true); setOnboardTab("subscription"); setOnboardStep(1);
  }, [setShowOnboard, setOnboardTab, setOnboardStep]);
  const handleProductClickCb = useCallback((p) => {
    if (handleProductClick) handleProductClick(p);
  }, [handleProductClick]);
  function getProductUrl(product) {
    const base = storeUrl || "https://your-store.myshopify.com";
    if (product?.handle) return base + "/products/" + product.handle;
    if (product?.title) return base + "/products/" + product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return base;
  }
  return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/>
        <div className="bg-m"/>

        {/* STATUS BAR — two rows */}
        <div style={{padding:"8px 32px 0",maxWidth:1600,margin:"0 auto",width:"100%",boxSizing:"border-box"}}>
          <button onClick={()=>setShowDashboard(false)} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",fontSize:13,cursor:"pointer",padding:"4px 0",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>← Back to Home</button>
        </div>
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
              {analyzedCount>0 && <Link to="/app/saved" className="btn-saved" style={{textDecoration:"none"}}>📋 My Results</Link>}
              <button className="btn-secondary" style={{padding:"8px 16px",fontSize:13}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>
              {canPublish
                ? <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={()=>{sessionStorage.setItem("campaignIntent","autoLaunch");navigate("/app/campaigns");}}>⚡ Auto Launch All</button>
                : <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={()=>doScan("review")}>🔍 Scan Products</button>}
            </div>
          </div>

          {/* ══ STORE HEALTH + LIVE PULSE ROW ══ */}
          {/* TOP MISSED OPPORTUNITY */}
          <WidgetErrorBoundary label="Top Missed Opportunity">
          <TopMissedOpportunity
            topProduct={topProduct}
            avgScore={avgScore}
            totalMonthlyGapLoss={totalMonthlyGapLoss}
            analyzedCount={analyzedCount}
            hasScanAccess={hasScanAccess}
            onScan={handleUpgradeClick}
            onViewProduct={handleProductClickCb}
          />
          </WidgetErrorBoundary>

          <WidgetErrorBoundary label="Health & Pulse">
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
          </WidgetErrorBoundary>

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

          
          {/* CAMPAIGN HERO CARD */}
          {isPaid && (
            <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(16,185,129,.06))",border:"1px solid rgba(34,197,94,.15)",borderRadius:16,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,#22c55e,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:"0 4px 16px rgba(34,197,94,.3)"}}>📈</div>
                <div>
                  <div style={{fontSize:32,fontWeight:800,color:"#fff",lineHeight:1}}>{mockCampaigns}</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.6)",marginTop:4}}>{mockCampaigns === 1 ? "Active Campaign" : "Active Campaigns"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:16,marginBottom:2}}>👁</div><div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.impressions ? liveAds.impressions.toLocaleString() : "—"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>Impressions</div></div>
                <div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:16,marginBottom:2}}>👆</div><div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.clicks ? liveAds.clicks.toLocaleString() : "—"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>Clicks</div></div>
                <div style={{textAlign:"center",minWidth:70}}><div style={{fontSize:16,marginBottom:2}}>💰</div><div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.roas ? liveAds.roas+"x" : "—"}</div><div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5}}>ROAS</div></div>
              </div>
              <button onClick={()=>setShowLaunchChoice(true)} style={{background:"linear-gradient(135deg,#22c55e,#10b981)",color:"#fff",padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:700,textDecoration:"none",boxShadow:"0 4px 12px rgba(34,197,94,.3)",whiteSpace:"nowrap",border:"none",cursor:"pointer",fontFamily:"inherit"}}>🚀 Launch Campaign →</button>
            </div>
          )}

          
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
          {/* MARKET INTELLIGENCE */}
          <WidgetErrorBoundary label="Market Intelligence">
          <LockedOverlay isPaid={isPaid} onUpgrade={handleUpgradeClick} title="Market Intelligence">
          <MarketAlert shopDomain={shopDomain}/>
          </LockedOverlay>
          </WidgetErrorBoundary>

          {/* STORE PERFORMANCE ANALYTICS */}
          <WidgetErrorBoundary label="Store Performance">
          <LockedOverlay isPaid={isPaid} onUpgrade={handleUpgradeClick} title="Store Performance Analytics">
          <StoreAnalyticsWidget/>
          </LockedOverlay>
          </WidgetErrorBoundary>




          {/* COMPETITOR PANEL */}
          {topCompetitors.length>0 && (
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
            <WidgetErrorBoundary label="Competitor Gap Finder">
            <CompetitorGapFinder
              keywordGaps={keywordGaps}
              totalMonthlyGapLoss={totalMonthlyGapLoss}
              analyzedCount={analyzedCount}
              canPublish={canPublish}
              onUpgrade={handleUpgradeClick}
            />
            </WidgetErrorBoundary>
          )}

          {/* BUDGET SIMULATOR */}
          <WidgetErrorBoundary label="Budget Simulator">
          <BudgetSimulator
            avgScore={avgScore}
            avgCpc={liveAds?.avgCpc || null}
            canPublish={canPublish}
            onUpgrade={handleUpgradeClick}
          />
          </WidgetErrorBoundary>

          {/* AD PREVIEW PANEL */}
          <WidgetErrorBoundary label="Ad Preview">
          <AdPreviewPanel
            topProduct={topProduct}
            mockCampaigns={mockCampaigns}
            canPublish={canPublish}
            shop={shopDomain}
            onLaunch={canPublish ? ()=>{sessionStorage.setItem("campaignIntent","autoLaunch");navigate("/app/campaigns");} : handleUpgradeClick}
            onViewProduct={handleProductClickCb}
          />
          </WidgetErrorBoundary>

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
              <button className="btn-auto-launch" onClick={()=>{sessionStorage.setItem("campaignIntent","autoLaunch");navigate("/app/campaigns");}}><span>Launch All Campaigns</span><span style={{fontSize:12,opacity:0.7,display:"block"}}>AI does everything for you</span></button>
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
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <button onClick={()=>setShowLaunchChoice(true)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",borderRadius:10,fontSize:13,fontWeight:600,textDecoration:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>🚀 Launch Campaign</button>
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
                <button className="btn-primary" style={{flex:2}} disabled={pickedProducts.length===0||!canPublish} onClick={()=>{
                  if(!canPublish){setShowManualPicker(false);handleUpgradeClick();return;}
                  setShowManualPicker(false);
                  if(onManualLaunch) onManualLaunch(pickedProducts);
                }}>{canPublish?`🚀 Launch ${pickedProducts.length>0?pickedProducts.length+" ":""}Campaign${pickedProducts.length!==1?"s":""}` :"🔒 Subscribe to Launch"}</button>
              </div>
            </div>
          </div>
        )}

        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults}
          shop={shopDomain}
        />}
        {selCompetitor && <CompetitorModal competitor={selCompetitor} products={analyzedDbProducts} onClose={()=>setSelCompetitor(null)}/>}
      </div>
  );
}
