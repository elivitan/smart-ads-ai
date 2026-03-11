import React from "react";
import { Confetti } from "../routes/SmallComponents.jsx";
import useAppStore from "../stores/useAppStore.js";

export function AutoLaunchingScreen({ cancelRef, StyleTag }) {
  const { setAutoLaunching, setShowDashboard } = useAppStore();
  return (
    <div className="sr dk"><StyleTag/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20,animation:"ldPulse 1s ease infinite"}}>\u26A1</div>
        <h2 className="ld-title">Launching Your Campaigns...</h2>
        <p className="ld-sub">AI is building and submitting Google Ads campaigns for all your products.</p>
        <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:"60%",animation:"barPulse 2s ease infinite"}}/></div>
        <button onClick={()=>{cancelRef.current=true;setAutoLaunching(false);setShowDashboard(false);}} style={{marginTop:24,padding:"10px 28px",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,color:"rgba(255,255,255,.7)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>\u2715 Cancel</button>
      </div>
    </div>
  );
}

export function AutoStatusScreen({ navigate, StyleTag }) {
  const { autoStatus, setAutoStatus, showConfetti } = useAppStore();
  return (
    <div className="sr dk"><StyleTag/>
      <Confetti active={showConfetti}/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>{autoStatus==="success"?"\u2705":"\u274C"}</div>
        <h2 className="ld-title">{autoStatus==="success"?"Campaigns Are Live!":"Campaign Creation Failed"}</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{autoStatus==="success"?"Your AI-optimized campaigns are created in PAUSED state. Review them in Google Ads.":"Something went wrong. Try manual mode."}</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button className="btn-primary" onClick={()=>{setAutoStatus(null);navigate("/app/campaigns");}}>\u{1F4CA} View Campaigns</button>
          {autoStatus==="success" && <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{textDecoration:"none"}}>Open Google Ads \u2192</a>}
        </div>
      </div>
    </div>
  );
}
