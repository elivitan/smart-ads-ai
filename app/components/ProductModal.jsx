import React, { useEffect } from "react";
import { ScoreRing } from "./ui/SmallWidgets.jsx";

function ModalScrollLock() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);
  return null;
}

function ProductModal({ product, onClose, aiResults, shop }) {
  const isDb = !!product.hasAiAnalysis;
  const ai = isDb ? (product.aiAnalysis||{}) : (aiResults?.products?.find(ap=>ap.title===product.title)||{});
  const headlines = (ai.headlines||[]).map(h => typeof h === "string" ? h : h?.text || h).filter(Boolean);
  const descriptions = (ai.descriptions||[]).map(d => typeof d === "string" ? d : d?.text || d).filter(Boolean);
  const keywords = (ai.keywords||[]).map(k=>typeof k==="string"?{text:k,match_type:"BROAD"}:k);
  const sitelinks = ai.sitelinks||[], cIntel = ai.competitor_intel||null;
  const path1 = ai.path1||"Shop", path2 = ai.path2||"", negKw = ai.negative_keywords||[];
  const longHeadlines = (ai.long_headlines||ai.longHeadlines||[]).map(h => typeof h==="string"?h:(h?.text||"")).filter(Boolean);
  const recBid = ai.recommended_bid||null;
  const targetDemo = ai.target_demographics||null;
  const score = ai.ad_score||0;
  const adStrength = headlines.length>=8&&descriptions.length>=4?"Excellent":headlines.length>=5?"Good":headlines.length>=3?"Average":"Poor";
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
        <div className="rsa-strength">
          <div className="rsa-strength-bar"><div className="rsa-strength-fill" style={{width:strengthPct+"%",background:strengthColor}}/></div>
          <span className="rsa-strength-txt" style={{color:strengthColor}}>{adStrength}</span>
          <span className="rsa-strength-info">{headlines.length} headlines · {descriptions.length} descriptions{longHeadlines.length>0?` · ${longHeadlines.length} long headlines`:""}</span>
        </div>
        {(recBid || targetDemo) && <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
          {recBid && <div style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:"8px 14px",fontSize:12}}><span style={{color:"rgba(255,255,255,.5)"}}>Recommended Bid: </span><strong style={{color:"#a5b4fc"}}>${recBid.toFixed(2)}</strong></div>}
          {targetDemo && <div style={{background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.15)",borderRadius:10,padding:"8px 14px",fontSize:12}}><span style={{color:"rgba(255,255,255,.5)"}}>Target: </span><strong style={{color:"#86efac"}}>{targetDemo}</strong></div>}
        </div>}

        <div className="rsa-preview">
          <div className="rsa-preview-label">📱 Google Ad Preview</div>
          <div className="rsa-preview-ad">
            <div className="rsa-preview-sponsor">Sponsored</div>
            <div className="rsa-preview-url">{storeUrl} › {path1}{path2?" › "+path2:""}</div>
            <div className="rsa-preview-h">{headlines[0]||"Headline 1"} | {headlines[1]||"Headline 2"} | {headlines[2]||"Headline 3"}</div>
            <div className="rsa-preview-d">{descriptions[0]||"Description will appear here."}</div>
          </div>
        </div>
        <div className="modal-body">
          {/* READ-ONLY Headlines */}
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>Headlines ({headlines.length})</h3></div>
            <div className="rsa-items">{headlines.map((h,i)=>(
              <div key={i} className="rsa-item">
                <span className="rsa-item-num">{i+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"7px 10px",fontSize:13,color:"rgba(255,255,255,.8)",minHeight:32,display:"flex",alignItems:"center"}}>{h}</div>
              </div>
            ))}</div>
          </div>

          {/* READ-ONLY Long Headlines */}
          {longHeadlines.length>0 && <div className="rsa-section">
            <div className="rsa-section-head"><h3>Long Headlines ({longHeadlines.length})</h3></div>
            <div className="rsa-items">{longHeadlines.map((lh,li)=>(
              <div key={li} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{li+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"rgba(255,255,255,.8)",minHeight:36,display:"flex",alignItems:"center"}}>{lh}</div>
              </div>
            ))}</div>
          </div>}

          {/* READ-ONLY Descriptions */}
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>Descriptions ({descriptions.length})</h3></div>
            <div className="rsa-items">{descriptions.map((d,i)=>(
              <div key={i} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{i+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"rgba(255,255,255,.8)",minHeight:36,display:"flex",alignItems:"center"}}>{d}</div>
              </div>
            ))}</div>
          </div>

          {/* Keywords */}
          <div className="rsa-section">
            <h3>🔑 Keywords ({keywords.length})</h3>
            <div className="rsa-kw-grid">{keywords.map((k,i)=>{const mt=k.match_type||"BROAD";const mc=mt==="EXACT"?"kw-exact":mt==="PHRASE"?"kw-phrase":"kw-broad";const disp=mt==="EXACT"?`[${k.text}]`:mt==="PHRASE"?`"${k.text}"`:k.text;return <div key={i} className={`rsa-kw ${mc}`}>{disp}<span className="rsa-kw-type">{mt}</span></div>;})}</div>
            {negKw.length>0 && <div className="rsa-neg-kw"><strong>🚫 Negative Keywords:</strong><div className="rsa-kw-grid" style={{marginTop:6}}>{negKw.map((k,i)=><div key={i} className="rsa-kw kw-neg">-{k}</div>)}</div></div>}
          </div>

          {/* Sitelinks */}
          {sitelinks.length>0 && <div className="rsa-section"><h3>🔗 Sitelinks</h3><div className="rsa-sitelinks">{sitelinks.map((sl,i)=><div key={i} className="rsa-sitelink"><strong>{sl.title}</strong><span>{sl.description||""}</span></div>)}</div></div>}

          {/* Competitor Intelligence */}
          {cIntel && (
            <div className="rsa-section ci-section">
              <h3>🕵️ Competitor Intelligence</h3>
              {cIntel.strategy_reason && <p className="ci-reason">{cIntel.strategy_reason}</p>}
              {cIntel.top_competitors?.length>0 && <div className="ci-competitors"><strong>Top Competitors:</strong><div className="ci-comp-list">{cIntel.top_competitors.map((c,i)=><div key={i} className="ci-comp-card"><div className="ci-comp-rank">#{c.position||i+1}</div><div className="ci-comp-info"><a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="ci-comp-domain ci-comp-link">{c.domain}</a><span className="ci-comp-strength">{c.strength||"unknown"}</span></div>{c.price_range&&<span className="ci-comp-price">{c.price_range}</span>}</div>)}</div></div>}
              {cIntel.keyword_gaps?.length>0 && <div className="ci-gaps"><strong>💡 Keyword Opportunities:</strong><div className="rsa-kw-grid" style={{marginTop:6}}>{cIntel.keyword_gaps.map((k,i)=><div key={i} className="rsa-kw kw-gap">+{k}</div>)}</div></div>}
              {cIntel.competitive_advantages?.length>0 && <div className="ci-advantages"><strong>✅ Your Advantages:</strong><ul className="ci-adv-list">{cIntel.competitive_advantages.map((a,i)=><li key={i}>{a}</li>)}</ul></div>}
              {cIntel.opportunity_score && <div className="ci-opp"><strong>Opportunity Score:</strong><div className="ci-opp-bar"><div className="ci-opp-fill" style={{width:`${cIntel.opportunity_score}%`}}/></div><span className="ci-opp-val">{cIntel.opportunity_score}/100</span></div>}
            </div>
          )}

          {/* CTA: Go to Campaigns */}
          <a href="/app/campaigns" className="btn-campaign" style={{display:"block",textAlign:"center",textDecoration:"none",marginTop:8}}>📋 Go to Campaigns →</a>
        </div>
      </div>
    </div>
  );
}

export { ProductModal };
