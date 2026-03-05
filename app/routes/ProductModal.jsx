import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

import { ScoreRing, ModalScrollLock } from "./SmallComponents.jsx";

function ProductModal({ product, onClose, aiResults, editHeadlines, setEditHeadlines, editDescriptions, setEditDescriptions, isPaid, aiCredits, setShowBuyCredits, improvingIdx, handleAiImprove, canPublish, hasScanAccess, campaignStatus, setCampaignStatus, handleCreateCampaign, setSelProduct, setShowOnboard, setOnboardTab, setOnboardStep, shop }) {
  const isDb = !!product.hasAiAnalysis;
  const ai = isDb ? (product.aiAnalysis||{}) : (aiResults?.products?.find(ap=>ap.title===product.title)||{});
  const keywords = (ai.keywords||[]).map(k=>typeof k==="string"?{text:k,match_type:"BROAD"}:k);
  const sitelinks = ai.sitelinks||[], cIntel = ai.competitor_intel||null;
  const path1 = ai.path1||"Shop", path2 = ai.path2||"", negKw = ai.negative_keywords||[];
  const longHeadlines = (ai.long_headlines||ai.longHeadlines||[]).map(h => typeof h==="string"?h:(h?.text||"")).filter(Boolean);
  const recBid = ai.recommended_bid||null;
  const targetDemo = ai.target_demographics||null;
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
          <span className="rsa-strength-info">{editHeadlines.length}/15 headlines · {editDescriptions.length}/4 descriptions{longHeadlines.length>0?` · ${longHeadlines.length}/5 long headlines`:""}</span>
        </div>
        {(recBid || targetDemo) && <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
          {recBid && <div style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:"8px 14px",fontSize:12}}><span style={{color:"rgba(255,255,255,.5)"}}>Recommended Bid: </span><strong style={{color:"#a5b4fc"}}>${recBid.toFixed(2)}</strong></div>}
          {targetDemo && <div style={{background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.15)",borderRadius:10,padding:"8px 14px",fontSize:12}}><span style={{color:"rgba(255,255,255,.5)"}}>Target: </span><strong style={{color:"#86efac"}}>{targetDemo}</strong></div>}
        </div>}
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
                <input className="rsa-item-input" value={h} maxLength={30} onChange={e=>{const n=[...editHeadlines];n[i]=e.target.value.slice(0,30);setEditHeadlines(n);}}/>
                <span className={`rsa-item-len ${h.length>30?"rsa-over":""}`}>{h.length}/30</span>
                {isPaid && <button className={`btn-ai-improve ${improvingIdx===`h-${i}`?"improving":""}`} onClick={()=>handleAiImprove("h",i)} disabled={improvingIdx!==null}>{improvingIdx===`h-${i}`?"⏳":"✨"}</button>}
                {i<3 && <span className="rsa-pin">📌 H{i+1}</span>}
              </div>
            ))}</div>
          </div>
          {longHeadlines.length>0 && <div className="rsa-section">
            <div className="rsa-section-head"><h3>Long Headlines ({longHeadlines.length}/5)</h3><span className="rsa-hint">Max 90 chars · Performance Max</span></div>
            <div className="rsa-items">{longHeadlines.map((lh,li)=>(
              <div key={li} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{li+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(99,102,241,.05)",padding:"8px 10px",borderRadius:8,fontSize:13,color:"rgba(255,255,255,.8)",minHeight:36,display:"flex",alignItems:"center"}}>{lh}</div>
                <span className={"rsa-item-len "+(lh.length>90?"rsa-over":"")}>{lh.length}/90</span>
              </div>
            ))}</div>
          </div>}
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>📝 Descriptions ({editDescriptions.length}/4)</h3><span className="rsa-hint">Max 90 chars each</span></div>
            <div className="rsa-items">{editDescriptions.map((d,i)=>(
              <div key={i} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{i+1}</span>
                <textarea className="rsa-item-input rsa-item-textarea" value={d} maxLength={90} rows={2} onChange={e=>{const n=[...editDescriptions];n[i]=e.target.value.slice(0,90);setEditDescriptions(n);}}/>
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



// Single CSS injection — renders once, never duplicated

export { ProductModal };
