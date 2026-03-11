import React from "react";

interface LaunchChoiceDialogProps {
  show: boolean;
  onClose: () => void;
  launchLoading: string | null;
  setLaunchLoading: (mode: string | null) => void;
  navigate: (path: string) => void;
}

export function LaunchChoiceDialog({ show, onClose, launchLoading, setLaunchLoading, navigate }: LaunchChoiceDialogProps) {
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!show) return null;
  const handleLaunch = (mode: string, intent: string): void => {
    setLaunchLoading(mode);
    timerRef.current = setTimeout(() => { navigate("/app/campaigns?intent=" + intent); }, 600);
  };
  const handleCancel = (): void => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setLaunchLoading(null);
    onClose();
  };
  return (
    <div onClick={launchLoading ? undefined : handleCancel} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{background:"#1e1e2e",borderRadius:20,maxWidth:520,width:"90%",textAlign:"center",padding:"44px 36px",position:"relative",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        {!launchLoading && <button onClick={handleCancel} style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,.1)",border:"none",color:"#fff",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{"\u2715"}</button>}
        {launchLoading ? (<><div style={{fontSize:48,marginBottom:16}}>{launchLoading==="auto"?"\u26A1":"\uD83C\uDFAF"}</div><h2 style={{fontSize:24,fontWeight:800,marginBottom:8,color:"#fff"}}>{launchLoading==="auto"?"Launching...":"Loading Wizard..."}</h2><div style={{margin:"24px auto",width:40,height:40,border:"3px solid rgba(255,255,255,.15)",borderTopColor:"#8b5cf6",borderRadius:"50%",animation:"spin 1s linear infinite"}}></div><p style={{color:"rgba(255,255,255,.45)",fontSize:14}}>Preparing your campaigns...</p><button onClick={handleCancel} style={{marginTop:20,padding:"8px 24px",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,color:"rgba(255,255,255,.5)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button></>) : (<><div style={{fontSize:48,marginBottom:16}}>{"\uD83D\uDE80"}</div>
        <h2 style={{fontSize:24,fontWeight:800,marginBottom:8,color:"#fff"}}>Launch Your Campaigns</h2>
        <p style={{color:"rgba(255,255,255,.55)",marginBottom:32,fontSize:15}}>How would you like to proceed?</p>
        <div style={{display:"flex",gap:16,flexDirection:"column"}}>
          <button onClick={()=>handleLaunch("auto","autoLaunch")} style={{display:"flex",alignItems:"center",gap:14,padding:"18px 22px",borderRadius:14,border:"1px solid rgba(124,58,237,.4)",background:"linear-gradient(135deg,rgba(124,58,237,.15),rgba(99,102,241,.1))",cursor:"pointer",textAlign:"left",color:"#fff",fontFamily:"inherit"}}><span style={{fontSize:28,flexShrink:0}}>{"\u26A1"}</span><div><div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Auto Launch</div><div style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>AI builds and launches campaigns automatically</div></div></button>
          <button onClick={()=>handleLaunch("manual","wizard")} style={{display:"flex",alignItems:"center",gap:14,padding:"18px 22px",borderRadius:14,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",cursor:"pointer",textAlign:"left",color:"#fff",fontFamily:"inherit"}}><span style={{fontSize:28,flexShrink:0}}>{"\uD83C\uDFAF"}</span><div><div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Manual Campaign</div><div style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>Step-by-step wizard: goals, keywords, headlines, budget & launch</div></div></button>
          <button onClick={()=>navigate("/app/campaigns")} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 22px",borderRadius:14,border:"1px solid rgba(255,255,255,.08)",background:"transparent",cursor:"pointer",textAlign:"left",color:"rgba(255,255,255,.6)",fontFamily:"inherit",textDecoration:"none",fontSize:13,fontWeight:600,justifyContent:"center"}}>{"\uD83D\uDCCB"} View Existing Campaigns {"\u2192"}</button>
        </div></>)}
      </div>
    </div>
  );
}
