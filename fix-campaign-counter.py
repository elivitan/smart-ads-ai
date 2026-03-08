import sys

filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app._index.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Add Campaign Counter above speedometers ──
old_speedo = """          {/* SPEEDOMETERS */}
          <div className="speedo-row">"""

campaign_counter = """          {/* CAMPAIGN COUNTER */}
          <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200,background:"linear-gradient(135deg,rgba(99,102,241,.12),rgba(168,85,247,.08))",border:"1px solid rgba(99,102,241,.2)",borderRadius:16,padding:"20px 24px",display:"flex",alignItems:"center",gap:16}}>
              <div style={{width:56,height:56,borderRadius:14,background:"rgba(99,102,241,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{"\uD83D\uDCE2"}</div>
              <div>
                <div style={{fontSize:32,fontWeight:900,color:"#fff",lineHeight:1}}>{campaignList.length}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontWeight:600,marginTop:2}}>TOTAL CAMPAIGNS</div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",flexDirection:"column",gap:4}}>
                {realCampaigns > 0 && <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 6px rgba(34,197,94,.5)"}}></div><span style={{fontSize:13,color:"#22c55e",fontWeight:600}}>{realCampaigns} Active</span></div>}
                {campaignList.filter(c=>c.status==="PAUSED").length > 0 && <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:"#f59e0b"}}></div><span style={{fontSize:13,color:"#f59e0b",fontWeight:600}}>{campaignList.filter(c=>c.status==="PAUSED").length} Paused</span></div>}
                {campaignList.length === 0 && <span style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>No campaigns yet</span>}
              </div>
            </div>
            {hasGoogleAds && <div style={{flex:1,minWidth:200,background:"linear-gradient(135deg,rgba(34,197,94,.1),rgba(6,182,212,.06))",border:"1px solid rgba(34,197,94,.15)",borderRadius:16,padding:"20px 24px",display:"flex",alignItems:"center",gap:16}}>
              <div style={{width:56,height:56,borderRadius:14,background:"rgba(34,197,94,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{"\uD83D\uDCB0"}</div>
              <div>
                <div style={{fontSize:32,fontWeight:900,color:"#22c55e",lineHeight:1}}>${liveAds.spend ? Number(liveAds.spend).toFixed(0) : "0"}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.5)",fontWeight:600,marginTop:2}}>TOTAL AD SPEND</div>
              </div>
              <div style={{marginLeft:"auto",textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:700,color:"#fff"}}>{liveAds.roas || "0"}x</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>ROAS</div>
              </div>
            </div>}
          </div>
          {/* SPEEDOMETERS */}
          <div className="speedo-row">"""

if old_speedo in content:
    content = content.replace(old_speedo, campaign_counter, 1)
    print("1. Campaign Counter added above speedometers")
else:
    print("ERROR: Could not find speedometer section")
    sys.exit(1)

# ── 2. Verify ──
if "TOTAL CAMPAIGNS" in content:
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: All patches applied")
else:
    print("ERROR: Verification failed")
    sys.exit(1)
