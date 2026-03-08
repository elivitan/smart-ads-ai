#!/usr/bin/env python3
# write-campaigns-v6.py
# Writes app/routes/app.campaigns.jsx with full v6 cockpit design
# Python triple-quoted strings don't interpret ${...} as template literals

content = r'''import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { useState, useCallback } from "react";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const mockCampaigns = [
    {
      id: "camp_001", name: "Summer Bedding Collection", type: "auto", status: "PENDING_REVIEW",
      createdAt: "2026-03-05T10:00:00Z", budget: 25,
      products: [
        { id:"p1", title:"Luxury Cotton Duvet Cover", image:null },
        { id:"p2", title:"Bamboo Pillow Set", image:null },
        { id:"p3", title:"Microfiber Sheet Set", image:null }
      ],
      keywords: [
        { text:"luxury bedding sets", bid:1.20 },
        { text:"cotton duvet cover queen", bid:0.95 },
        { text:"bamboo pillow case", bid:0.80 },
        { text:"microfiber sheets king", bid:0.75 },
        { text:"soft bedding online", bid:0.60 }
      ],
      headlines: ["Premium Bedding \u2014 Shop Now","Luxury Cotton Sheets & Covers","Free Shipping on All Orders"],
      descriptions: [
        "Transform your bedroom with our luxury bedding collection. Soft, durable, and beautiful.",
        "Shop premium cotton duvets, bamboo pillows & more. Fast US shipping."
      ],
      performance: { impressions:4200, clicks:180, roas:2.8, spend:312, today_clicks:12, today_spend:18 },
    },
    {
      id: "camp_002", name: "Winter Pillows \u2014 Manual", type: "manual", status: "ENABLED",
      createdAt: "2026-03-01T08:00:00Z", budget: 40,
      products: [
        { id:"p4", title:"Memory Foam Pillow King", image:null },
        { id:"p5", title:"Down Alternative Pillow", image:null }
      ],
      keywords: [
        { text:"memory foam pillow", bid:1.50 },
        { text:"best pillow for neck pain", bid:1.10 },
        { text:"king size pillow set", bid:0.90 },
        { text:"down alternative pillow", bid:0.70 }
      ],
      headlines: ["Best Pillows for Deep Sleep","Memory Foam King Pillows","Free US Shipping Over $50"],
      descriptions: [
        "Wake up refreshed with our premium memory foam pillows. Designed for all sleep positions.",
        "Shop our full pillow collection. Trusted by 10,000+ sleepers. Fast delivery."
      ],
      performance: { impressions:8900, clicks:410, roas:3.4, spend:520, today_clicks:28, today_spend:31 },
    },
  ];
  return { campaigns: mockCampaigns };
};

/* ── helpers ── */
function roasColor(roas) {
  if (roas >= 3) return { color:"#10b981", bg:"rgba(16,185,129,.12)", label:"Excellent" };
  if (roas >= 2) return { color:"#f59e0b", bg:"rgba(245,158,11,.12)", label:"Good" };
  if (roas > 0)  return { color:"#ef4444", bg:"rgba(239,68,68,.12)", label:"Low" };
  return { color:"#94a3b8", bg:"rgba(148,163,184,.1)", label:"No data" };
}

function statusDot(status) {
  if (status === "ENABLED") return "#10b981";
  if (status === "PENDING_REVIEW") return "#f59e0b";
  if (status === "PAUSED") return "#94a3b8";
  return "#ef4444";
}

/* ── Launch Dialog ── */
function LaunchDialog({ onClose }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,10,26,.75)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div style={{ background:"#fff",borderRadius:24,padding:36,maxWidth:500,width:"90%",boxShadow:"0 24px 80px rgba(0,0,0,.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:48,height:48,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16 }}>{"\u{1F680}"}</div>
        <h2 style={{ fontSize:22,fontWeight:800,color:"#1a1a2e",marginBottom:6,marginTop:0 }}>Create New Campaign</h2>
        <p style={{ fontSize:14,color:"#64748b",marginBottom:24 }}>Choose how you want to build your next campaign:</p>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid #6366f1",background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",cursor:"pointer" }} onClick={onClose}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{"\u26A1"}</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:2 }}>Auto Launch</div><div style={{ fontSize:13,color:"#64748b" }}>AI scans, builds and launches campaigns instantly</div></div>
            <div style={{ marginLeft:"auto",color:"#6366f1",fontSize:18 }}>{"\u2192"}</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid #e2e8f0",background:"#f8fafc",cursor:"pointer" }} onClick={onClose}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#0891b2,#0284c7)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{"\U0001F50D"}</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:2 }}>Review & Edit</div><div style={{ fontSize:13,color:"#64748b" }}>Check keywords, headlines & images before launching</div></div>
            <div style={{ marginLeft:"auto",color:"#64748b",fontSize:18 }}>{"\u2192"}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop:16,width:"100%",padding:"11px",background:"none",border:"1px solid #e2e8f0",borderRadius:12,color:"#94a3b8",fontSize:14,cursor:"pointer",fontFamily:"inherit" }}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Sidebar ── */
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
                <div style={{ fontSize:15,fontWeight:800,color:rc.color }}>{c.performance.roas>0?(c.performance.roas+"x"):"\u2014"}</div>
                <div style={{ fontSize:9,color:rc.color,fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>ROAS</div>
              </div>
              <div style={{ background:"#f8fafc",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#1a1a2e" }}>{c.performance.clicks>0?c.performance.clicks.toLocaleString():"\u2014"}</div>
                <div style={{ fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Clicks</div>
              </div>
              <div style={{ background:"#f8fafc",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#1a1a2e" }}>{c.performance.spend>0?("$"+c.performance.spend):"\u2014"}</div>
                <div style={{ fontSize:9,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Spend</div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={onNew} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",fontSize:13,color:"#6366f1",fontWeight:600,marginTop:4,padding:"11px",borderRadius:12,border:"2px dashed #c7d2fe",background:"none",cursor:"pointer",fontFamily:"inherit" }}>{"\uFF0B"} New campaign</button>
    </div>
  );
}

/* ── Budget Slider (custom div-based for Shopify iframe) ── */
function BudgetSlider({ value, onChange }) {
  const min = 5, max = 500;
  const pct = ((value - min) / (max - min)) * 100;
  const markers = [5, 25, 50, 100, 200, 500];

  const handleTrackClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const newVal = Math.round(min + (x / rect.width) * (max - min));
    onChange(Math.max(min, Math.min(max, newVal)));
  }, [onChange]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    const track = e.currentTarget.closest('.budget-sim-slider');
    if (!track) return;
    const move = (ev) => {
      const rect = track.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const newVal = Math.round(min + (x / rect.width) * (max - min));
      onChange(Math.max(min, Math.min(max, newVal)));
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
  }, [onChange]);

  return (
    <div style={{ marginTop:8 }}>
      <div className="budget-sim-slider" onClick={handleTrackClick}
        style={{ position:"relative",height:8,background:"#e2e8f0",borderRadius:4,cursor:"pointer",zIndex:9999,touchAction:"none",userSelect:"none" }}>
        <div style={{ position:"absolute",left:0,top:0,height:"100%",width:pct+"%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:4 }} />
        <div onMouseDown={handleDrag} onTouchStart={handleDrag}
          style={{ position:"absolute",top:"50%",left:pct+"%",transform:"translate(-50%,-50%)",width:22,height:22,borderRadius:"50%",background:"#fff",border:"3px solid #6366f1",boxShadow:"0 2px 8px rgba(99,102,241,.3)",cursor:"grab",zIndex:10000,touchAction:"none" }} />
      </div>
      <div className="budget-sim-input-row" style={{ display:"flex",justifyContent:"space-between",marginTop:10,zIndex:9999,touchAction:"none" }}>
        {markers.map(m => (
          <button key={m} onClick={() => onChange(m)}
            style={{ fontSize:11,fontWeight:m===value?700:500,color:m===value?"#6366f1":"#94a3b8",background:m===value?"#ede9fe":"transparent",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit" }}>
            {"$"+m}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── CharCounter input ── */
function CharInput({ defaultValue, maxLen, tag }) {
  const [val, setVal] = useState(defaultValue || "");
  const remaining = maxLen - val.length;
  const isClose = remaining <= 5;
  const isOver = remaining < 0;
  const Tag = tag || "input";
  return (
    <div style={{ position:"relative",marginBottom:8 }}>
      <Tag
        value={val}
        onChange={e => setVal(e.target.value)}
        maxLength={maxLen}
        rows={tag === "textarea" ? 2 : undefined}
        style={{
          width:"100%",fontSize:13,color:"#374151",border:"1px solid "+(isOver?"#ef4444":"#e2e8f0"),
          borderRadius:10,padding:"10px 52px 10px 12px",fontFamily:"inherit",boxSizing:"border-box",
          outline:"none",fontWeight:500,resize:"none",lineHeight:1.5,
          transition:"border-color .15s"
        }}
      />
      <span style={{
        position:"absolute",right:10,top:tag==="textarea"?10:11,
        fontSize:11,fontWeight:600,
        color:isOver?"#ef4444":isClose?"#f59e0b":"#94a3b8"
      }}>
        {val.length}/{maxLen}
      </span>
    </div>
  );
}

/* ── Campaign Detail (main panel) ── */
function CampaignDetail({ campaign, onSwitchMode, mode }) {
  const p = campaign.performance;
  const rc = roasColor(p.roas);
  const [paused, setPaused] = useState(campaign.status === "PAUSED");
  const [keywords, setKeywords] = useState(campaign.keywords);
  const [budget, setBudget] = useState(campaign.budget);
  const [newKw, setNewKw] = useState("");
  const [headlines, setHeadlines] = useState(campaign.headlines);
  const [descriptions, setDescriptions] = useState(campaign.descriptions);

  const addKeyword = () => {
    const text = newKw.trim();
    if (!text) return;
    setKeywords([...keywords, { text, bid: 0.50 }]);
    setNewKw("");
  };

  const updateBid = (index, newBid) => {
    const updated = [...keywords];
    updated[index] = { ...updated[index], bid: parseFloat(newBid) || 0 };
    setKeywords(updated);
  };

  const removeKeyword = (index) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  return (
    <div style={{ padding:"28px",overflowY:"auto",display:"flex",flexDirection:"column",gap:20 }}>

      {/* ── HERO PANEL ── */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",borderRadius:20,padding:"28px 32px",color:"#fff",position:"relative",overflow:"hidden" }}>
        {/* decorative circles */}
        <div style={{ position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(99,102,241,.08)" }} />
        <div style={{ position:"absolute",bottom:-40,right:80,width:120,height:120,borderRadius:"50%",background:"rgba(99,102,241,.05)" }} />

        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,position:"relative",zIndex:1 }}>
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:10 }}>{campaign.name}</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:10,marginBottom:6 }}>
              <span style={{ fontSize:60,fontWeight:900,letterSpacing:"-3px",color:rc.color,lineHeight:1 }}>
                {p.roas > 0 ? (p.roas + "x") : "\u2014"}
              </span>
              <span style={{ fontSize:18,fontWeight:700,color:"rgba(255,255,255,.4)" }}>ROAS</span>
              <span style={{
                fontSize:12,fontWeight:700,color:rc.color,background:rc.bg,
                padding:"4px 10px",borderRadius:20,marginLeft:4
              }}>{rc.label}</span>
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,.45)",fontWeight:500 }}>
              {"$"}{p.spend} total spend {"\u00B7"} {"$"}{campaign.budget}/day {"\u00B7"} {campaign.products.length} products
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end" }}>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={() => setPaused(!paused)} style={{ fontSize:13,fontWeight:700,color:"#fff",background:paused?"#10b981":"rgba(255,255,255,.12)",border:"1px solid "+(paused?"#10b981":"rgba(255,255,255,.15)"),borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",transition:"all .2s" }}>
                {paused ? "\u25B6 Resume" : "\u23F8 Pause"}
              </button>
              <button onClick={onSwitchMode} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit" }}>
                {mode === "auto" ? "\u270F\uFE0F Manual" : "\U0001F916 Auto"}
              </button>
            </div>
          </div>
        </div>

        {/* ── TODAY STATS STRIP ── */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:24,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.06)" }}>
          {[
            { value: p.today_clicks, label: "Today Clicks" },
            { value: "$" + p.today_spend, label: "Today Spend" },
            { value: p.clicks.toLocaleString(), label: "Total Clicks" },
            { value: p.impressions.toLocaleString(), label: "Impressions" },
            { value: p.clicks > 0 ? (p.clicks / p.impressions * 100).toFixed(1) + "%" : "\u2014", label: "CTR" },
          ].map(m => (
            <div key={m.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:3 }}>{m.value}</div>
              <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PENDING REVIEW BANNER ── */}
      {campaign.status === "PENDING_REVIEW" && (
        <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:20 }}>{"\u23F3"}</span>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:"#92400e" }}>Pending Google Review</div>
            <div style={{ fontSize:13,color:"#b45309" }}>Awaiting Google Ads approval {"\u2014"} usually 1{"\u2013"}2 business days.</div>
          </div>
        </div>
      )}

      {/* ═══════════════ MANUAL MODE ═══════════════ */}
      {mode === "manual" && (
        <>
          {/* ── 1. DAILY BUDGET ── */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F4B0"} Daily Budget</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
              <span style={{ fontSize:20,fontWeight:700,color:"#6366f1" }}>$</span>
              <span style={{ fontSize:48,fontWeight:900,color:"#1a1a2e",letterSpacing:"-2px",lineHeight:1 }}>{budget}</span>
              <span style={{ fontSize:14,color:"#94a3b8",marginLeft:8 }}>/ day</span>
              <span style={{ fontSize:13,color:"#cbd5e1",marginLeft:4 }}>{"\u00B7"} ~{"$"}{(budget * 30).toLocaleString()}/mo</span>
            </div>
            <BudgetSlider value={budget} onChange={setBudget} />
          </div>

          {/* ── 2. KEYWORDS ── */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase" }}>{"\U0001F511"} Keywords ({keywords.length})</div>
            </div>
            {keywords.map((kw, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<keywords.length-1?"1px solid #f8fafc":"none" }}>
                <span style={{ flex:1,fontSize:13,color:"#374151",fontWeight:500 }}>{kw.text}</span>
                <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                  <span style={{ fontSize:12,color:"#94a3b8" }}>CPC $</span>
                  <input
                    type="number" step="0.05" min="0.05" max="50"
                    value={kw.bid}
                    onChange={e => updateBid(i, e.target.value)}
                    style={{ width:60,fontSize:13,fontWeight:700,color:"#6366f1",border:"1px solid #e2e8f0",borderRadius:8,padding:"5px 8px",textAlign:"center",fontFamily:"inherit",outline:"none" }}
                  />
                </div>
                <button onClick={() => removeKeyword(i)} style={{ width:24,height:24,borderRadius:"50%",background:"#fee2e2",color:"#ef4444",border:"none",cursor:"pointer",fontSize:14,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{"\u00D7"}</button>
              </div>
            ))}
            {/* Add keyword */}
            <div style={{ display:"flex",gap:8,marginTop:12 }}>
              <input
                value={newKw}
                onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                placeholder="Add new keyword..."
                style={{ flex:1,fontSize:13,border:"1px solid #e2e8f0",borderRadius:10,padding:"9px 12px",fontFamily:"inherit",outline:"none",color:"#374151" }}
              />
              <button onClick={addKeyword} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:10,padding:"9px 16px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>{"\uFF0B"} Add</button>
            </div>
          </div>

          {/* ── 3. HEADLINES ── */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F4E2"} Headlines (3)</div>
            {campaign.headlines.map((h, i) => (
              <CharInput key={i} defaultValue={h} maxLen={30} />
            ))}
          </div>

          {/* ── 4. DESCRIPTIONS ── */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F4C4"} Descriptions (2)</div>
            {campaign.descriptions.map((d, i) => (
              <CharInput key={i} defaultValue={d} maxLen={90} tag="textarea" />
            ))}
          </div>
        </>
      )}

      {/* ═══════════════ AUTO MODE ═══════════════ */}
      {mode === "auto" && (
        <>
          {/* Keywords read-only grid */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F511"} Keywords ({campaign.keywords.length})</div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
              {campaign.keywords.map((kw, i) => (
                <div key={i} style={{ display:"inline-flex",alignItems:"center",gap:6,background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:10,padding:"7px 12px" }}>
                  <span style={{ fontSize:13,color:"#374151",fontWeight:500 }}>{kw.text}</span>
                  <span style={{ fontSize:11,color:"#6366f1",fontWeight:700,background:"#ede9fe",padding:"2px 6px",borderRadius:5 }}>{"$"}{kw.bid.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Headlines read-only */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F4E2"} Headlines</div>
            {campaign.headlines.map((h, i) => (
              <div key={i} style={{ fontSize:14,color:"#374151",padding:"10px 14px",background:"#f0f9ff",borderRadius:10,marginBottom:8,borderLeft:"3px solid #6366f1",fontWeight:600 }}>{h}</div>
            ))}
          </div>

          {/* Descriptions read-only */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F4C4"} Descriptions</div>
            {campaign.descriptions.map((d, i) => (
              <div key={i} style={{ fontSize:13,color:"#374151",lineHeight:1.7,padding:"10px 14px",background:"#f8fafc",borderRadius:10,marginBottom:8 }}>{d}</div>
            ))}
          </div>
        </>
      )}

      {/* ── PRODUCTS (always read-only) ── */}
      <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\U0001F6CD\uFE0F"} Products ({campaign.products.length})</div>
        <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
          {campaign.products.map(prod => (
            <div key={prod.id} style={{ display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:12,padding:"10px 16px" }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>{"\U0001F6CF\uFE0F"}</div>
              <span style={{ fontSize:13,fontWeight:600,color:"#374151" }}>{prod.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SAVE CHANGES (manual only) ── */}
      {mode === "manual" && (
        <div style={{ display:"flex",justifyContent:"flex-end",paddingBottom:12 }}>
          <button style={{
            fontSize:15,fontWeight:700,color:"#fff",
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            border:"none",borderRadius:14,padding:"14px 32px",
            cursor:"pointer",fontFamily:"inherit",
            boxShadow:"0 4px 20px rgba(99,102,241,.3)",
            transition:"transform .1s,box-shadow .1s"
          }}>
            {"\U0001F4BE"} Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
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
        <div style={{ width:72,height:72,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px" }}>{"\U0001F680"}</div>
        <h1 style={{ fontSize:28,fontWeight:800,color:"#1a1a2e",marginBottom:8 }}>No campaigns yet</h1>
        <p style={{ fontSize:15,color:"#64748b",marginBottom:32,lineHeight:1.6 }}>Create your first Google Ads campaign and start driving traffic to your store.</p>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:15,fontWeight:700,padding:"14px 28px",border:"none",borderRadius:12,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(99,102,241,.3)" }}>{"\uFF0B"} Create First Campaign</button>
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
        .budget-sim-slider{z-index:9999!important;touch-action:none!important;user-select:none!important}
        .budget-sim-input-row{z-index:9999!important;touch-action:none!important}
      `}</style>

      <div style={{ background:"#fff",borderBottom:"1px solid #f1f5f9",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:20,fontWeight:800,color:"#1a1a2e",margin:0,letterSpacing:"-0.5px" }}>Campaigns</h1>
          <p style={{ fontSize:12,color:"#94a3b8",margin:"2px 0 0",fontWeight:500 }}>{campaigns.length} active {"\u00B7"} Google Ads</p>
        </div>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(99,102,241,.3)" }}>{"\uFF0B"} New Campaign</button>
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
'''

# Write the file
import os
output_path = 'app.campaigns.jsx'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done! Wrote {os.path.getsize(output_path):,} bytes to {output_path}")
print(f"Lines: {content.count(chr(10)) + 1}")
