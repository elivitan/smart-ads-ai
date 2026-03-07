import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { useState } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const mockCampaigns = [
    {
      id: "camp_001", name: "Summer Bedding Collection", type: "auto", status: "PENDING_REVIEW",
      createdAt: "2026-03-05T10:00:00Z", budget: 25,
      products: [{ id:"p1",title:"Luxury Cotton Duvet Cover" },{ id:"p2",title:"Bamboo Pillow Set" },{ id:"p3",title:"Microfiber Sheet Set" }],
      keywords: [{ text:"luxury bedding sets",bid:1.2 },{ text:"cotton duvet cover queen",bid:0.95 },{ text:"bamboo pillow case",bid:0.8 },{ text:"microfiber sheets king",bid:0.75 },{ text:"soft bedding online",bid:0.6 }],
      headlines: ["Premium Bedding — Shop Now","Luxury Cotton Sheets & Covers","Free Shipping on All Orders"],
      descriptions: ["Transform your bedroom with our luxury bedding collection. Soft, durable, and beautiful.","Shop premium cotton duvets, bamboo pillows & more. Fast US shipping."],
      performance: { impressions:4200, clicks:180, roas:2.8, spend:312, today_clicks:12, today_spend:18 },
    },
    {
      id: "camp_002", name: "Winter Pillows — Manual", type: "manual", status: "ENABLED",
      createdAt: "2026-03-01T08:00:00Z", budget: 40,
      products: [{ id:"p4",title:"Memory Foam Pillow King" },{ id:"p5",title:"Down Alternative Pillow" }],
      keywords: [{ text:"memory foam pillow",bid:1.5 },{ text:"best pillow for neck pain",bid:1.1 },{ text:"king size pillow set",bid:0.9 },{ text:"down alternative pillow",bid:0.7 }],
      headlines: ["Best Pillows for Deep Sleep","Memory Foam King Pillows","Free US Shipping Over $50"],
      descriptions: ["Wake up refreshed with our premium memory foam pillows. Designed for all sleep positions.","Shop our full pillow collection. Trusted by 10,000+ sleepers. Fast delivery."],
      performance: { impressions:8900, clicks:410, roas:3.4, spend:520, today_clicks:28, today_spend:31 },
    },
  ];
  return { campaigns: mockCampaigns };
};

function roasColor(roas) {
  if (roas >= 3) return { color:"#10b981", bg:"#d1fae5", label:"Excellent" };
  if (roas >= 2) return { color:"#f59e0b", bg:"#fef3c7", label:"Good" };
  if (roas > 0)  return { color:"#ef4444", bg:"#fee2e2", label:"Low" };
  return { color:"#94a3b8", bg:"#f1f5f9", label:"No data" };
}

function statusDot(status) {
  if (status === "ENABLED") return "#10b981";
  if (status === "PENDING_REVIEW") return "#f59e0b";
  if (status === "PAUSED") return "#94a3b8";
  return "#ef4444";
}

function LaunchDialog({ onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,10,26,.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:24,padding:36,maxWidth:500,width:"90%",boxShadow:"0 24px 80px rgba(0,0,0,.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:48,height:48,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16 }}>🚀</div>
        <h2 style={{ fontSize:22,fontWeight:800,color:"#1a1a2e",marginBottom:6,marginTop:0 }}>Create New Campaign</h2>
        <p style={{ fontSize:14,color:"#64748b",marginBottom:24 }}>Choose how you want to build your next campaign:</p>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid #6366f1",background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",cursor:"pointer" }} onClick={onClose}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>⚡</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:2 }}>Auto Launch</div><div style={{ fontSize:13,color:"#64748b" }}>AI scans, builds and launches campaigns instantly</div></div>
            <div style={{ marginLeft:"auto",color:"#6366f1",fontSize:18 }}>→</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid #e2e8f0",background:"#f8fafc",cursor:"pointer" }} onClick={onClose}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#0891b2,#0284c7)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>🔍</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:2 }}>Review & Edit</div><div style={{ fontSize:13,color:"#64748b" }}>Check keywords, headlines & images before launching</div></div>
            <div style={{ marginLeft:"auto",color:"#64748b",fontSize:18 }}>→</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop:16,width:"100%",padding:"11px",background:"none",border:"1px solid #e2e8f0",borderRadius:12,color:"#94a3b8",fontSize:14,cursor:"pointer",fontFamily:"inherit" }}>Cancel</button>
      </div>
    </div>
  );
}

function CampaignSidebar({ campaigns, selectedId, onSelect, onNew }) {
  return (
    <div style={{ background:"#fafafa",borderRight:"1px solid #f1f5f9",padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ fontSize:10,fontWeight:700,color:"#cbd5e1",letterSpacing:2,marginBottom:6,textTransform:"uppercase",paddingLeft:2 }}>Campaigns</div>
      {campaigns.map(c => {
        const sel = c.id === selectedId;
        const rc = roasColor(c.performance.roas);
        return (
          <div key={c.id} onClick={() => onSelect(c.id)} style={{ background:sel?"#fff":"transparent",border:sel?"1.5px solid #e2e8f0":"1.5px solid transparent",borderRadius:14,padding:"14px",cursor:"pointer",transition:"all .15s",boxShadow:sel?"0 2px 8px rgba(0,0,0,.06)":"none" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <span style={{ width:8,height:8,borderRadius:"50%",background:statusDot(c.status),display:"inline-block",flexShrink:0 }} />
              <span style={{ fontSize:13,fontWeight:700,color:"#1a1a2e",flex:1,lineHeight:1.3 }}>{c.name}</span>
              <span style={{ fontSize:10,fontWeight:700,color:c.type==="auto"?"#6366f1":"#0891b2",background:c.type==="auto"?"#ede9fe":"#e0f2fe",padding:"2px 7px",borderRadius:5 }}>{c.type==="auto"?"AUTO":"MANUAL"}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
              <div style={{ background:rc.bg,borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:rc.color }}>{c.performance.roas>0?(c.performance.roas+"x"):"—"}</div>
                <div style={{ fontSize:9,color:rc.color,fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>ROAS</div>
              </div>
              <div style={{ background:"#f8fafc",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#1a1a2e" }}>{c.performance.clicks>0?c.performance.clicks.toLocaleString():"—"}</div>
                <div style={{ fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Clicks</div>
              </div>
              <div style={{ background:"#f8fafc",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#1a1a2e" }}>{c.performance.spend>0?("$"+c.performance.spend):"—"}</div>
                <div style={{ fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Spend</div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={onNew} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",fontSize:13,color:"#6366f1",fontWeight:600,marginTop:4,padding:"11px",borderRadius:12,border:"2px dashed #c7d2fe",background:"none",cursor:"pointer",fontFamily:"inherit" }}>＋ New campaign</button>
    </div>
  );
}

function CampaignDetail({ campaign, onSwitchMode, mode }) {
  const p = campaign.performance;
  const rc = roasColor(p.roas);
  const [paused, setPaused] = useState(campaign.status === "PAUSED");
  const [showAssets, setShowAssets] = useState(mode === "manual");
  const [editingKw, setEditingKw] = useState(false);
  const [keywords, setKeywords] = useState(campaign.keywords);
  const [budget, setBudget] = useState(campaign.budget);

  return (
    <div style={{ padding:"28px",overflowY:"auto",display:"flex",flexDirection:"column",gap:20 }}>

      {/* Hero ROAS bar */}
      <div style={{ background:"linear-gradient(135deg,#1a1a2e,#2d2d4e)",borderRadius:20,padding:"28px 32px",color:"#fff",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-20,right:-20,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.03)" }} />
        <div style={{ position:"absolute",bottom:-30,right:60,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.03)" }} />
        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16 }}>
          <div>
            <div style={{ fontSize:12,fontWeight:600,color:"rgba(255,255,255,.5)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6 }}>{campaign.name}</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:8,marginBottom:4 }}>
              <span style={{ fontSize:56,fontWeight:900,letterSpacing:"-2px",color:rc.color,lineHeight:1 }}>{p.roas>0?(p.roas+"x"):"—"}</span>
              <span style={{ fontSize:16,fontWeight:600,color:"rgba(255,255,255,.5)" }}>ROAS</span>
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,.5)" }}>{rc.label} · ${p.spend} total spend</div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end" }}>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={() => setPaused(!paused)} style={{ fontSize:13,fontWeight:700,color:"#fff",background:paused?"#10b981":"rgba(255,255,255,.15)",border:"none",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",transition:"all .2s" }}>{paused?"▶ Resume":"⏸ Pause"}</button>
              <button onClick={onSwitchMode} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit" }}>{mode==="auto"?"✏️ Manual":"🤖 Auto"}</button>
            </div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>${campaign.budget}/day budget · {campaign.products.length} products</div>
          </div>
        </div>

        {/* Today strip */}
        <div style={{ display:"flex",gap:12,marginTop:24,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.08)" }}>
          {[
            { label:"Today Clicks", value:p.today_clicks },
            { label:"Today Spend", value:"$"+p.today_spend },
            { label:"Total Clicks", value:p.clicks.toLocaleString() },
            { label:"Impressions", value:p.impressions.toLocaleString() },
            { label:"CTR", value:p.clicks>0?(p.clicks/p.impressions*100).toFixed(1)+"%":"—" },
          ].map(m => (
            <div key={m.label} style={{ flex:1,textAlign:"center" }}>
              <div style={{ fontSize:20,fontWeight:800,color:"#fff",marginBottom:3 }}>{m.value}</div>
              <div style={{ fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status alert */}
      {campaign.status === "PENDING_REVIEW" && (
        <div style={{ background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:20 }}>⏳</span>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:"#92400e" }}>Pending Google Review</div>
            <div style={{ fontSize:13,color:"#b45309" }}>Awaiting Google Ads approval — usually 1–2 business days.</div>
          </div>
        </div>
      )}

      {/* Budget (manual only) */}
      {mode === "manual" && (
        <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>💰 Daily Budget</div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <span style={{ fontSize:24,fontWeight:800,color:"#6366f1" }}>$</span>
            <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} min={5} max={500} style={{ fontSize:36,fontWeight:900,color:"#1a1a2e",border:"none",background:"transparent",width:120,fontFamily:"inherit",outline:"none",letterSpacing:"-1px" }} />
            <span style={{ fontSize:15,color:"#94a3b8" }}>/ day · ~${budget*30}/mo</span>
          </div>
        </div>
      )}

      {/* Assets toggle */}
      <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
        <button onClick={() => mode !== "manual" && setShowAssets(!showAssets)} style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",background:"none",border:"none",cursor:mode==="manual"?"default":"pointer",fontFamily:"inherit" }}>
          <div style={{ fontSize:14,fontWeight:700,color:"#1a1a2e" }}>📝 Ad Assets — Keywords, Headlines & Descriptions</div>
          <span style={{ fontSize:18,color:"#94a3b8",transition:"transform .2s",transform:showAssets?"rotate(180deg)":"rotate(0deg)" }}>⌄</span>
        </button>
        {showAssets && (
          <div style={{ padding:"0 24px 24px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,borderTop:"1px solid #f1f5f9" }}>
            <div style={{ paddingTop:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase" }}>🔑 Keywords ({keywords.length})</div>
                {mode==="manual" && <button onClick={() => setEditingKw(!editingKw)} style={{ fontSize:12,color:"#6366f1",background:"#ede9fe",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"inherit",fontWeight:600 }}>{editingKw?"✓ Done":"✏️ Edit"}</button>}
              </div>
              {keywords.map((kw,i) => (
                <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",background:"#f8fafc",borderRadius:9,marginBottom:7 }}>
                  <span style={{ fontSize:13,color:"#374151",fontWeight:500 }}>{kw.text}</span>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <span style={{ fontSize:12,color:"#6366f1",fontWeight:700,background:"#ede9fe",padding:"2px 8px",borderRadius:6 }}>${kw.bid}</span>
                    {editingKw && mode==="manual" && <button onClick={() => setKeywords(keywords.filter((_,j)=>j!==i))} style={{ width:20,height:20,borderRadius:"50%",background:"#fee2e2",color:"#ef4444",border:"none",cursor:"pointer",fontSize:13,fontFamily:"inherit" }}>×</button>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ paddingTop:16 }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase",marginBottom:12 }}>📢 Headlines</div>
              {campaign.headlines.map((h,i) => mode==="manual"
                ? <input key={i} defaultValue={h} maxLength={30} style={{ width:"100%",fontSize:13,color:"#374151",border:"1px solid #e2e8f0",borderRadius:9,padding:"9px 12px",marginBottom:7,fontFamily:"inherit",boxSizing:"border-box",outline:"none",fontWeight:500 }} />
                : <div key={i} style={{ fontSize:13,color:"#374151",padding:"9px 12px",background:"#f0f9ff",borderRadius:9,marginBottom:7,borderLeft:"3px solid #6366f1",fontWeight:500 }}>{h}</div>
              )}
              <div style={{ fontSize:12,fontWeight:700,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase",marginBottom:12,marginTop:4 }}>📄 Descriptions</div>
              {campaign.descriptions.map((d,i) => mode==="manual"
                ? <textarea key={i} defaultValue={d} maxLength={90} rows={2} style={{ width:"100%",fontSize:13,color:"#374151",border:"1px solid #e2e8f0",borderRadius:9,padding:"9px 12px",marginBottom:7,fontFamily:"inherit",boxSizing:"border-box",resize:"none",outline:"none",lineHeight:1.5 }} />
                : <div key={i} style={{ fontSize:13,color:"#374151",lineHeight:1.6,padding:"9px 12px",background:"#f8fafc",borderRadius:9,marginBottom:7 }}>{d}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Products */}
      <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>🛍️ Products ({campaign.products.length})</div>
        <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
          {campaign.products.map(p => (
            <div key={p.id} style={{ display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:12,padding:"10px 16px" }}>
              <div style={{ width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🛏️</div>
              <span style={{ fontSize:13,fontWeight:600,color:"#374151" }}>{p.title}</span>
            </div>
          ))}
        </div>
      </div>

      {mode === "manual" && (
        <button style={{ alignSelf:"flex-end",fontSize:14,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"12px 28px",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 12px rgba(99,102,241,.3)" }}>💾 Save Changes</button>
      )}
    </div>
  );
}

export default function Campaigns() {
  const { campaigns } = useLoaderData();
  const [selectedId, setSelectedId] = useState(campaigns[0]?.id || null);
  const [viewMode, setViewMode] = useState({});
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);

  const selected = campaigns.find(c => c.id === selectedId);
  const currentMode = viewMode[selectedId] !== undefined ? viewMode[selectedId] : (selected?.type || "auto");

  if (!campaigns || campaigns.length === 0) {
    return (
      <div style={{ padding:"40px",maxWidth:600,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",textAlign:"center" }}>
        <div style={{ width:72,height:72,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px" }}>🚀</div>
        <h1 style={{ fontSize:28,fontWeight:800,color:"#1a1a2e",marginBottom:8 }}>No campaigns yet</h1>
        <p style={{ fontSize:15,color:"#64748b",marginBottom:32,lineHeight:1.6 }}>Create your first Google Ads campaign and start driving traffic to your store.</p>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:15,fontWeight:700,padding:"14px 28px",border:"none",borderRadius:12,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(99,102,241,.3)" }}>＋ Create First Campaign</button>
        {showLaunchDialog && <LaunchDialog onClose={() => setShowLaunchDialog(false)} />}
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif",height:"100%",display:"flex",flexDirection:"column" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .camp-fade{animation:fadeUp .25s ease forwards}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}
      `}</style>

      <div style={{ background:"#fff",borderBottom:"1px solid #f1f5f9",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:20,fontWeight:800,color:"#1a1a2e",margin:0,letterSpacing:"-0.5px" }}>Campaigns</h1>
          <p style={{ fontSize:12,color:"#94a3b8",margin:"2px 0 0",fontWeight:500 }}>{campaigns.length} active · Google Ads</p>
        </div>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(99,102,241,.3)" }}>＋ New Campaign</button>
      </div>

      <div className="camp-fade" style={{ display:"grid",gridTemplateColumns:"280px 1fr",flex:1,overflow:"hidden" }}>
        <CampaignSidebar campaigns={campaigns} selectedId={selectedId} onSelect={setSelectedId} onNew={() => setShowLaunchDialog(true)} />
        {selected && (
          <CampaignDetail
            key={selectedId}
            campaign={selected}
            mode={currentMode}
            onSwitchMode={() => setViewMode(v => ({...v,[selectedId]:currentMode==="auto"?"manual":"auto"}))}
          />
        )}
      </div>

      {showLaunchDialog && <LaunchDialog onClose={() => setShowLaunchDialog(false)} />}
    </div>
  );
}