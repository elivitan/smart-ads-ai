import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { ScoreRing } from "./SmallComponents.jsx";

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
      {tab === "shopping" && (() => {
        const cIntel = ai.competitor_intel || {};
        const topComps = (cIntel.top_competitors || []).slice(0, 3);
        const fallbackComps = [
          { domain: "bedding-store.com", price_range: "$47.99", strength: "Large catalog" },
          { domain: "home-goods.com", price_range: "$52.00", strength: "Fast shipping" },
          { domain: "sleep-shop.com", price_range: "$39.95", strength: "Budget pricing" },
        ];
        const comps = topComps.length > 0 ? topComps : fallbackComps;
        const icons = ["🛏","🏠","⭐"];
        return (
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
            {/* Real competitors from AI analysis */}
            {comps.map((c, i) => (
              <div key={i} className="adp-shopping-card adp-shopping-comp">
                <div className="adp-shopping-noimg" style={{ background:"#f8f8f8", fontSize:18 }}>{icons[i] || "🏪"}</div>
                <div className="adp-shopping-price" style={{ color:"#202124" }}>{c.price_range || "$—"}</div>
                <div className="adp-shopping-name" style={{ color:"#555" }}>{c.strength || "Competitor"}</div>
                <div className="adp-shopping-store" style={{ color:"#888" }}>{c.domain || "competitor.com"}</div>
                {c.position && <div className="adp-shopping-stars" style={{ color:"#fbbc04" }}>Rank #{c.position}</div>}
              </div>
            ))}
          </div>
          {topComps.length > 0 && <div style={{ textAlign:"center", fontSize:10, color:"rgba(255,255,255,.3)", marginTop:6 }}>Data from SerpAPI competitor analysis</div>}
        </div>
        );
      })()}

      {/* Mobile Preview */}
      {tab === "mobile" && (
        <div className="adp-preview-wrap" style={{ display:"flex", justifyContent:"center", padding:"16px 0" }}>
          <div style={{ width:220, background:"#1a1a2e", borderRadius:24, padding:"8px 0", boxShadow:"0 8px 32px rgba(0,0,0,.4)", border:"2px solid rgba(255,255,255,.1)" }}>
            {/* Notch */}
            <div style={{ width:80, height:6, background:"rgba(255,255,255,.15)", borderRadius:3, margin:"4px auto 8px" }}/>
            {/* Screen */}
            <div style={{ background:"#fff", margin:"0 6px", borderRadius:12, overflow:"hidden" }}>
              {/* Search bar */}
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 10px", background:"#f1f3f4", borderBottom:"1px solid #e0e0e0" }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                <span style={{ fontSize:10, color:"#555", flex:1 }}>{searchQuery}</span>
                <span style={{ fontSize:10 }}>🔍</span>
              </div>
              {/* Ad */}
              <div style={{ padding:"10px 12px", borderBottom:"1px solid #eee" }}>
                <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:4 }}>
                  <span style={{ fontSize:9, fontWeight:700, color:"#000", background:"#f1f3f4", padding:"1px 4px", borderRadius:3 }}>Ad</span>
                  <span style={{ fontSize:9, color:"#4d5156" }}>{storeDomain}</span>
                </div>
                <div style={{ fontSize:12, color:"#1a0dab", fontWeight:600, lineHeight:1.3, marginBottom:4 }}>{h1} | {h2}</div>
                <div style={{ fontSize:10, color:"#4d5156", lineHeight:1.4 }}>{d1.slice(0, 90)}...</div>
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  <span style={{ fontSize:9, color:"#1e6641" }}>✓ Free Shipping</span>
                  <span style={{ fontSize:9, color:"#1e6641" }}>✓ 30-day returns</span>
                </div>
                {(ai.sitelinks?.length > 0) && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                    {ai.sitelinks.slice(0, 2).map((sl, i) => (
                      <span key={i} style={{ fontSize:9, color:"#1a0dab", padding:"2px 6px", background:"#f8f9fa", borderRadius:4 }}>{sl.title || sl}</span>
                    ))}
                  </div>
                )}
              </div>
              {/* Organic results placeholder */}
              <div style={{ padding:"10px 12px" }}>
                <div style={{ fontSize:9, color:"#999", marginBottom:6 }}>Organic results</div>
                {[1,2,3].map(i => (
                  <div key={i} style={{ marginBottom:8 }}>
                    <div style={{ height:6, width:"70%", background:"#f0f0f0", borderRadius:2, marginBottom:3 }}/>
                    <div style={{ height:8, background:"#e8e8e8", borderRadius:2, marginBottom:2 }}/>
                    <div style={{ height:6, width:"90%", background:"#f5f5f5", borderRadius:2 }}/>
                  </div>
                ))}
              </div>
            </div>
            {/* Home bar */}
            <div style={{ width:60, height:4, background:"rgba(255,255,255,.2)", borderRadius:2, margin:"8px auto 4px" }}/>
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

export { AdPreviewPanel };
