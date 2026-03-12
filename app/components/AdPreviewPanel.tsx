import React, { useState } from "react";

import { ScoreRing } from "./SmallWidgets";

interface AiAnalysis {
  headlines?: (string | { text?: string })[];
  descriptions?: (string | { text?: string })[];
  keywords?: (string | { text?: string })[];
  ad_score?: number;
  sitelinks?: ({ title?: string } | string)[];
  competitor_intel?: {
    top_competitors?: CompetitorInfo[];
  };
}

interface CompetitorInfo {
  domain?: string;
  price_range?: string;
  strength?: string;
  position?: number;
}

interface Product {
  title?: string;
  price?: string | number;
  image?: string;
  aiAnalysis?: AiAnalysis;
  ai?: AiAnalysis;
}

interface AdPreviewPanelProps {
  topProduct: Product | null;
  mockCampaigns: number;
  canPublish: boolean;
  onLaunch: () => void;
  onViewProduct?: (product: Product) => void;
  shop?: string;
}

const AdPreviewPanel = React.memo(function AdPreviewPanel({ topProduct, mockCampaigns, canPublish, onLaunch, onViewProduct, shop }) {
  const [tab, setTab] = useState("search");

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
  const cIntel = ai.competitor_intel || {};
  const topComps = (cIntel.top_competitors || []).slice(0, 3);
  const fallbackComps = [
    { domain: "bedding-store.com", price_range: "$42.99", strength: "Large catalog" },
    { domain: "home-goods.com", price_range: "$55.00", strength: "Fast shipping" },
    { domain: "sleep-shop.com", price_range: "$38.95", strength: "Budget option" },
  ];
  const comps = topComps.length >= 3 ? topComps : topComps.length > 0 ? [...topComps, ...fallbackComps.slice(0, 3 - topComps.length)] : fallbackComps;

  const searchQuery = keywords[0] || "luxury bedding set queen";
  const h1 = headlines[0] || productTitle;
  const h2 = headlines[1] || "Free Shipping On Orders $50+";
  const h3 = headlines[2] || "Shop Now & Save";
  const d1 = descriptions[0] || `Discover ${productTitle}. Premium quality, unbeatable prices. Order today.`;

  const adStrengthLabel = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Average" : "Poor";
  const adStrengthColor = score >= 80 ? "#22c55e" : score >= 65 ? "#84cc16" : score >= 50 ? "#f59e0b" : "#ef4444";
  const comp1 = comps[0] || {};

  if (!topProduct) return (
    <div className="adp-card adp-empty">
      <div className="adp-empty-icon">{"📰"}</div>
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
            ? <span className="adp-badge adp-badge-live">{"●"} LIVE</span>
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
        {!isActive && (<div className="adp-not-live-badge">Not running</div>)}
      </div>

      {/* Tab switcher */}
      <div className="adp-tabs">
        {[["search","🔍 Search"],["shopping","🛍 Shopping"],["mobile","📱 Mobile"]].map(([id, label]) => (
          <button key={id} className={`adp-tab ${tab === id ? "adp-tab-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* === SEARCH TAB === */}
      {tab === "search" && (
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
          {/* LEFT — White card with search results (55% width) */}
          <div style={{flex:"0 0 58%",background:"#fff",borderRadius:12,overflow:"hidden"}}>
            {/* Google search bar */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderBottom:"1px solid #e8eaed",background:"#fff",minHeight:38}}>
              <svg width="16" height="16" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <span style={{fontSize:13,color:"#202124",flex:1}}>{searchQuery}</span>
              <span style={{fontSize:14}}>{"🔍"}</span>
            </div>

            <div style={{padding:"0 16px"}}>
              {/* YOUR AD */}
              <div style={{padding:"12px 0",borderBottom:"1px solid #ebebeb"}}>
                <div style={{display:"inline-block",fontSize:11,fontWeight:700,background:"#f1f3f4",color:"#202124",borderRadius:4,padding:"2px 6px",marginBottom:6}}>Sponsored</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{width:20,height:20,borderRadius:3,background:"#e8eaed",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                    {productImage ? <img src={productImage} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:10}}>{"🛍"}</span>}
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#202124"}}>{storeDomain}</div>
                    <div style={{fontSize:11,color:"#4d5156"}}>www.{storeDomain} {"›"} shop</div>
                  </div>
                </div>
                <div style={{fontSize:16,color:"#1a0dab",fontWeight:400,lineHeight:1.3,marginBottom:4,cursor:"pointer"}}>
                  {h1} | {h2} | {h3}
                </div>
                <div style={{fontSize:13,color:"#4d5156",lineHeight:1.5}}>{d1}</div>
                {(ai.sitelinks?.length > 0) && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                    {ai.sitelinks.slice(0,4).map((sl,i) => (
                      <div key={i} style={{padding:"4px 10px",border:"1px solid #dadce0",borderRadius:6,fontSize:11,color:"#1a0dab",cursor:"pointer"}}>{sl.title||sl}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* COMPETITOR AD */}
              <div style={{padding:"12px 0",borderBottom:"1px solid #ebebeb"}}>
                <div style={{display:"inline-block",fontSize:11,fontWeight:700,background:"#f1f3f4",color:"#202124",borderRadius:4,padding:"2px 6px",marginBottom:6}}>Sponsored</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{width:20,height:20,borderRadius:3,background:"#e8eaed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{"🏪"}</div>
                  <div>
                    <div style={{fontSize:12,color:"#202124"}}>{comp1.domain || "competitor-store.com"}</div>
                    <div style={{fontSize:11,color:"#4d5156"}}>www.{comp1.domain || "competitor-store.com"}</div>
                  </div>
                </div>
                <div style={{fontSize:16,color:"#1a0dab",fontWeight:400,lineHeight:1.3,marginBottom:4}}>
                  {comp1.strength || "Quality Products"} | Shop Now
                </div>
                <div style={{fontSize:13,color:"#4d5156"}}>{comp1.price_range ? "From "+comp1.price_range : "Great prices on top brands."}</div>
              </div>

              {/* ORGANIC RESULTS */}
              <div style={{padding:"12px 0"}}>
                <div style={{fontSize:11,color:"#70757a",marginBottom:8}}>Organic results</div>
                {[
                  {title:"Top 10 Best "+(keywords[0]||"products")+" (2025 Guide)",desc:"Expert-reviewed picks for every budget. Updated monthly with the latest options..."},
                  {title:"Compare "+(keywords[0]||"products")+" | Reviews & Ratings",desc:"Side-by-side comparison of top brands. Read real customer reviews before you buy..."},
                  {title:"How to Choose the Right "+(keywords[0]||"product"),desc:"Complete buying guide covers materials, sizes, care tips, and what to look for..."},
                ].map((r,i) => (
                  <div key={i} style={{marginBottom:10}}>
                    <div style={{fontSize:13,color:"#1a0dab",marginBottom:2,cursor:"pointer"}}>{r.title}</div>
                    <div style={{fontSize:12,color:"#4d5156",lineHeight:1.4}}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights bar */}
            <div style={{background:"#f8f9fa",borderTop:"1px solid #e8eaed",padding:"10px 16px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:adStrengthColor}}/>
                <span style={{fontSize:11,color:"#555"}}>Ad Score: <strong style={{color:adStrengthColor}}>{score}/100</strong></span>
              </div>
              <span style={{fontSize:11,color:"#999"}}>{"•"}</span>
              <span style={{fontSize:11,color:"#555"}}>{keywords.length} keywords targeted</span>
              <span style={{fontSize:11,color:"#999"}}>{"•"}</span>
              <span style={{fontSize:11,color:"#555"}}>{comps.length} competitors found</span>
              {comp1.price_range && (
                <>
                  <span style={{fontSize:11,color:"#999"}}>{"•"}</span>
                  <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>Your price: {productPrice} vs {comp1.price_range}</span>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — Knowledge Panel (on dark background, outside white card) */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{border:"1px solid rgba(255,255,255,.1)",borderRadius:12,overflow:"hidden",background:"rgba(255,255,255,.03)"}}>
              {/* Product image */}
              <div style={{width:"100%",height:140,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                {productImage
                  ? <img src={productImage} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                  : <span style={{fontSize:48,opacity:.3}}>{"🛍"}</span>}
              </div>
              {/* Product info */}
              <div style={{padding:"12px 14px"}}>
                <div style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,.9)",lineHeight:1.3,marginBottom:6}}>{productTitle}</div>
                <div style={{fontSize:18,fontWeight:700,color:"#a5b4fc",marginBottom:4}}>{productPrice}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:10}}>Available at {storeDomain.split(".")[0]}</div>
                {/* Rating */}
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:10}}>
                  <span style={{fontSize:12,color:"#fbbc04"}}>{"★★★★★"}</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>4.8</span>
                </div>
                {/* Quick facts */}
                <div style={{borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:10}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Quick facts</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Score</span>
                    <span style={{fontSize:11,fontWeight:700,color:adStrengthColor}}>{score}/100</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Keywords</span>
                    <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)"}}>{keywords.length} targeted</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Competitors</span>
                    <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)"}}>{comps.length} found</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SHOPPING TAB === */}
      {tab === "shopping" && (
        <div style={{background:"#fff",borderRadius:12,marginBottom:14,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:"#202124"}}>Google Shopping</span>
            <span style={{fontSize:11,color:"#70757a"}}>{comps.length+1} results for "{keywords[0]||"bedding"}"</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            <div style={{border:"2px solid #6366f1",borderRadius:10,padding:8,position:"relative",background:"#fff"}}>
              <div style={{position:"absolute",top:-8,left:8,background:"#6366f1",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10}}>YOUR AD</div>
              {productImage
                ? <img src={productImage} alt="" style={{width:"100%",height:80,objectFit:"contain",borderRadius:6,marginTop:4}}/>
                : <div style={{width:"100%",height:80,background:"#f0f0f0",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{"🛍"}</div>}
              <div style={{fontSize:14,fontWeight:700,color:"#d93025",marginTop:6}}>{productPrice}</div>
              <div style={{fontSize:11,color:"#202124",lineHeight:1.3,marginTop:2}}>{productTitle.length>28?productTitle.slice(0,28)+"…":productTitle}</div>
              <div style={{fontSize:10,color:"#70757a",marginTop:2}}>{storeDomain.split(".")[0]}</div>
              <div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>{"★★★★★"} <span style={{color:"rgba(0,0,0,.5)",fontSize:9}}>4.8</span></div>
            </div>
            {comps.map((c,i) => (
              <div key={i} style={{border:"1px solid #e0e0e0",borderRadius:10,padding:8,background:"#fff"}}>
                <div style={{width:"100%",height:80,background:"#f8f8f8",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{["🛏","🏠","⭐"][i]||"🏪"}</div>
                <div style={{fontSize:14,fontWeight:700,color:"#202124",marginTop:6}}>{c.price_range||"$—"}</div>
                <div style={{fontSize:11,color:"#555",lineHeight:1.3,marginTop:2}}>{c.strength||"Competitor"}</div>
                <div style={{fontSize:10,color:"#888",marginTop:2}}>{c.domain||"competitor.com"}</div>
                {c.position
                  ? <div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>Rank #{c.position}</div>
                  : <div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>{"★★★★☆"} <span style={{color:"rgba(0,0,0,.4)",fontSize:9}}>4.{3+i}</span></div>}
              </div>
            ))}
          </div>
          <div style={{marginTop:14,padding:"10px 14px",background:"#f8f9fa",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:"#333"}}><strong>Your price:</strong> {productPrice}</div>
            {comp1.price_range && <div style={{fontSize:12,color:"#666"}}><strong>Avg competitor:</strong> {comp1.price_range}</div>}
            <div style={{fontSize:11,padding:"3px 10px",borderRadius:12,background:"rgba(34,197,94,.1)",color:"#16a34a",fontWeight:600}}>{"✓"} Competitive</div>
          </div>
        </div>
      )}

      {/* === MOBILE TAB === */}
      {tab === "mobile" && (
        <div style={{display:"flex",justifyContent:"center",padding:"20px 0"}}>
          <div style={{width:260,background:"#1a1a2e",borderRadius:28,padding:"10px 0",boxShadow:"0 8px 32px rgba(0,0,0,.4)",border:"2px solid rgba(255,255,255,.1)"}}>
            <div style={{width:80,height:6,background:"rgba(255,255,255,.15)",borderRadius:3,margin:"4px auto 10px"}}/>
            <div style={{background:"#fff",margin:"0 8px",borderRadius:14,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:"#f1f3f4",borderBottom:"1px solid #e0e0e0"}}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                <span style={{fontSize:11,color:"#555",flex:1}}>{searchQuery}</span>
                <span style={{fontSize:12}}>{"🔍"}</span>
              </div>
              <div style={{padding:"10px 12px",borderBottom:"1px solid #eee"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                  <span style={{fontSize:9,fontWeight:700,color:"#000",background:"#f1f3f4",padding:"1px 5px",borderRadius:3}}>Ad</span>
                  <span style={{fontSize:9,color:"#4d5156"}}>{storeDomain}</span>
                </div>
                <div style={{fontSize:13,color:"#1a0dab",fontWeight:600,lineHeight:1.3,marginBottom:4}}>{h1} | {h2}</div>
                <div style={{fontSize:11,color:"#4d5156",lineHeight:1.4}}>{d1.slice(0,80)}...</div>
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  <span style={{fontSize:9,color:"#1e6641"}}>{"✓"} Free Shipping</span>
                  <span style={{fontSize:9,color:"#1e6641"}}>{"✓"} 30-day returns</span>
                </div>
                {(ai.sitelinks?.length > 0) && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                    {ai.sitelinks.slice(0,2).map((sl,i) => (
                      <span key={i} style={{fontSize:9,color:"#1a0dab",padding:"2px 6px",background:"#f8f9fa",borderRadius:4}}>{sl.title||sl}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{padding:"8px 12px",borderBottom:"1px solid #eee",opacity:.6}}>
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                  <span style={{fontSize:8,fontWeight:700,color:"#000",background:"#f1f3f4",padding:"1px 4px",borderRadius:3}}>Ad</span>
                  <span style={{fontSize:8,color:"#4d5156"}}>{comp1.domain||"competitor.com"}</span>
                </div>
                <div style={{fontSize:11,color:"#1a0dab",fontWeight:600,lineHeight:1.3}}>{comp1.strength||"Shop Now"} | {(comp1.domain||"competitor").split(".")[0]}</div>
                <div style={{fontSize:9,color:"#4d5156",marginTop:2}}>{comp1.price_range?"From "+comp1.price_range:"Great deals available"}</div>
              </div>
              <div style={{padding:"8px 12px"}}>
                <div style={{fontSize:9,color:"#999",marginBottom:6}}>Organic results</div>
                {[
                  "Best "+(keywords[0]||"products")+" 2025",
                  "Compare "+(keywords[0]||"products"),
                  "How to Choose "+(keywords[0]||"product"),
                ].map((t,i) => (
                  <div key={i} style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:"#1a0dab",marginBottom:1}}>{t}</div>
                    <div style={{height:6,width:"90%",background:"#f0f0f0",borderRadius:2}}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{width:60,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"10px auto 4px"}}/>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="adp-footer">
        {isActive ? (
          <>
            <div className="adp-live-stats">
              <span>{"👁"} {(mockCampaigns * 4200).toLocaleString()} impressions/mo</span>
              <span>{"👆"} {(mockCampaigns * 180).toLocaleString()} clicks/mo</span>
            </div>
            <button className="adp-btn-secondary" onClick={() => onViewProduct && onViewProduct(topProduct)}>Edit Ad {"→"}</button>
          </>
        ) : (
          <>
            <div className="adp-suggestion">{"💡"} This ad is ready to launch {"—"} {keywords.length} keywords targeted</div>
            <button className="adp-btn-launch" onClick={onLaunch}>{canPublish ? "🚀 Launch This Ad" : "🔒 Subscribe to Launch"}</button>
          </>
        )}
      </div>
    </div>
  );
});

export { AdPreviewPanel };
