import React from "react";
import { TipRotator, Confetti } from "../routes/SmallComponents.jsx";

export function ScanningScreen({
  fakeProgress, hasScanAccess, showConfetti, scanMsg, FREE_SCAN_LIMIT,
  showCancelConfirm, setShowCancelConfirm,
  cancelRef, creepRef,
  setIsScanning, setFakeProgress, setProducts, setAiResults, setShowDashboard,
  StyleTag
}) {
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
    <div className="sr dk"><StyleTag/>
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
              <button className="btn-secondary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>{cancelRef.current=true;if(creepRef.current){clearInterval(creepRef.current);creepRef.current=null;}setShowCancelConfirm(false);setIsScanning(false);setFakeProgress(0);setProducts([]);setAiResults(null);setShowDashboard(false);}}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
          </div>
  );
}
