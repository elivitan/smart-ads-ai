import { useLoaderData } from "react-router";
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
      headlines: ["Premium Bedding — Shop Now","Luxury Cotton Sheets & Covers","Free Shipping on All Orders"],
      descriptions: [
        "Transform your bedroom with our luxury bedding collection. Soft, durable, and beautiful.",
        "Shop premium cotton duvets, bamboo pillows & more. Fast US shipping."
      ],
      performance: { impressions:4200, clicks:180, roas:2.8, spend:312, today_clicks:12, today_spend:18 },
    },
    {
      id: "camp_002", name: "Winter Pillows — Manual", type: "manual", status: "ENABLED",
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
      <div style={{ background:"#1a1a2e",borderRadius:24,padding:36,maxWidth:500,width:"90%",boxShadow:"0 24px 80px rgba(0,0,0,.25)" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:48,height:48,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16 }}>{"\u{1F680}"}</div>
        <h2 style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:6,marginTop:0 }}>Create New Campaign</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24 }}>Choose how you want to build your next campaign:</p>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid #6366f1",background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.08))",cursor:"pointer" }} onClick={onClose}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{"⚡"}</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#fff",marginBottom:2 }}>Auto Launch</div><div style={{ fontSize:13,color:"rgba(255,255,255,.5)" }}>AI scans, builds and launches campaigns instantly</div></div>
            <div style={{ marginLeft:"auto",color:"#6366f1",fontSize:18 }}>{"→"}</div>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:16,padding:"20px",borderRadius:16,border:"2px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.04)",cursor:"pointer" }} onClick={onClose}>
            <div style={{ width:44,height:44,background:"linear-gradient(135deg,#0891b2,#0284c7)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{"🔍"}</div>
            <div><div style={{ fontSize:15,fontWeight:700,color:"#fff",marginBottom:2 }}>Review & Edit</div><div style={{ fontSize:13,color:"rgba(255,255,255,.5)" }}>Check keywords, headlines & images before launching</div></div>
            <div style={{ marginLeft:"auto",color:"rgba(255,255,255,.4)",fontSize:18 }}>{"→"}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ marginTop:16,width:"100%",padding:"11px",background:"none",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,color:"rgba(255,255,255,.4)",fontSize:14,cursor:"pointer",fontFamily:"inherit" }}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Sidebar ── */
function CampaignSidebar({ campaigns, selectedId, onSelect, onNew }) {
  return (
    <div style={{ background:"#0f0f23",borderRight:"1px solid rgba(255,255,255,.06)",padding:"16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:8 }}>
      <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:2,marginBottom:6,textTransform:"uppercase",paddingLeft:2 }}>Campaigns</div>
      {campaigns.map(c => {
        const sel = c.id === selectedId;
        const rc = roasColor(c.performance.roas);
        return (
          <div key={c.id} onClick={() => onSelect(c.id)} style={{ background:sel?"#1a1a2e":"transparent",border:sel?"1.5px solid rgba(255,255,255,.1)":"1.5px solid transparent",borderRadius:14,padding:"14px",cursor:"pointer",transition:"all .15s",boxShadow:sel?"0 2px 8px rgba(0,0,0,.2)":"none" }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8 }}>
              <span style={{ width:8,height:8,borderRadius:"50%",background:statusDot(c.status),display:"inline-block",flexShrink:0 }} />
              <span style={{ fontSize:13,fontWeight:700,color:"#fff",flex:1,lineHeight:1.3 }}>{c.name}</span>
              <span style={{ fontSize:10,fontWeight:700,color:c.type==="auto"?"#6366f1":"#0891b2",background:c.type==="auto"?"rgba(99,102,241,.15)":"rgba(8,145,178,.15)",padding:"2px 7px",borderRadius:5 }}>{c.type==="auto"?"AUTO":"MANUAL"}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6 }}>
              <div style={{ background:rc.bg,borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:rc.color }}>{c.performance.roas>0?(c.performance.roas+"x"):"—"}</div>
                <div style={{ fontSize:9,color:rc.color,fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>ROAS</div>
              </div>
              <div style={{ background:"rgba(255,255,255,.06)",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#fff" }}>{c.performance.clicks>0?c.performance.clicks.toLocaleString():"—"}</div>
                <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Clicks</div>
              </div>
              <div style={{ background:"rgba(255,255,255,.06)",borderRadius:8,padding:"7px 8px",textAlign:"center" }}>
                <div style={{ fontSize:15,fontWeight:800,color:"#fff" }}>{c.performance.spend>0?("$"+c.performance.spend):"—"}</div>
                <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.3 }}>Spend</div>
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={onNew} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",fontSize:13,color:"#6366f1",fontWeight:600,marginTop:4,padding:"11px",borderRadius:12,border:"2px dashed rgba(99,102,241,.4)",background:"none",cursor:"pointer",fontFamily:"inherit" }}>{"＋"} New campaign</button>
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
        style={{ position:"relative",height:8,background:"rgba(255,255,255,.1)",borderRadius:4,cursor:"pointer",zIndex:9999,touchAction:"none",userSelect:"none" }}>
        <div style={{ position:"absolute",left:0,top:0,height:"100%",width:pct+"%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:4 }} />
        <div onMouseDown={handleDrag} onTouchStart={handleDrag}
          style={{ position:"absolute",top:"50%",left:pct+"%",transform:"translate(-50%,-50%)",width:22,height:22,borderRadius:"50%",background:"#fff",border:"3px solid #6366f1",boxShadow:"0 2px 8px rgba(99,102,241,.3)",cursor:"grab",zIndex:10000,touchAction:"none" }} />
      </div>
      <div className="budget-sim-input-row" style={{ display:"flex",justifyContent:"space-between",marginTop:10,zIndex:9999,touchAction:"none" }}>
        {markers.map(m => (
          <button key={m} onClick={() => onChange(m)}
            style={{ fontSize:11,fontWeight:m===value?700:500,color:m===value?"#6366f1":"rgba(255,255,255,.35)",background:m===value?"rgba(99,102,241,.15)":"transparent",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit" }}>
            {"$"+m}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── CharCounter input ── */
function CharInput({ defaultValue, maxLen, tag, placeholder }) {
  const [val, setVal] = useState(defaultValue || "");
  const remaining = maxLen - val.length;
  const isFull = remaining === 0;
  const isOver = remaining < 0;
  const isNearLimit = remaining <= 2 && remaining > 0;
  const Tag = tag || "input";
  const pct = Math.min(100, (val.length / maxLen) * 100);
  /* Color logic: green < 80%, purple 80-93%, yellow 94-100%, red over */
  const barColor = isOver ? "#ef4444" : isFull ? "#f59e0b" : isNearLimit ? "#f59e0b" : pct > 80 ? "#6366f1" : "#10b981";
  const borderColor = isOver ? "#ef4444" : "rgba(255,255,255,.12)";
  const counterColor = isOver ? "#ef4444" : isNearLimit || isFull ? "#f59e0b" : "rgba(255,255,255,.3)";
  return (
    <div style={{ position:"relative",marginBottom:12 }}>
      <Tag
        value={val}
        onChange={e => setVal(e.target.value)}
        maxLength={maxLen}
        placeholder={placeholder || ""}
        rows={tag === "textarea" ? 3 : undefined}
        style={{
          width:"100%",fontSize:14,color:"#fff",
          border:"1.5px solid " + borderColor,
          borderRadius:12,padding:tag==="textarea"?"12px 14px":"10px 14px",
          fontFamily:"inherit",boxSizing:"border-box",
          outline:"none",fontWeight:500,resize:"none",lineHeight:1.5,
          background:"#0f0f23",
          transition:"border-color .15s,box-shadow .15s"
        }}
        onFocus={e => { e.target.style.borderColor = "#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,.08)"; }}
        onBlur={e => { e.target.style.borderColor = borderColor; e.target.style.boxShadow = "none"; }}
      />
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:5,padding:"0 2px" }}>
        <div style={{ flex:1,height:2,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden" }}>
          <div style={{ width:pct+"%",height:"100%",background:barColor,borderRadius:2,transition:"width .2s,background .2s",opacity:0.7 }} />
        </div>
        <span style={{ fontSize:11,fontWeight:600,marginLeft:10,color:counterColor }}>
          {val.length}/{maxLen}
        </span>
      </div>
    </div>
  );
}


/* ── Google Ads Live Preview ── */
function GoogleAdsPreview({ headlines, descriptions, url }) {
  const h1 = headlines[0] || "Your Headline Here";
  const h2 = headlines[1] || "";
  const h3 = headlines[2] || "";
  const desc1 = descriptions[0] || "Your ad description will appear here.";
  const desc2 = descriptions[1] || "";
  const displayUrl = url || "textilura.com";
  const titleParts = [h1, h2, h3].filter(Boolean);
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F50D}"} Google Ads Live Preview</div>
      {/* Google Search mock */}
      <div style={{ background:"#fff",borderRadius:12,padding:"24px",maxWidth:600 }}>
        {/* Search bar mock */}
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20,padding:"10px 16px",background:"#fff",border:"1px solid #dfe1e5",borderRadius:24,boxShadow:"0 1px 6px rgba(32,33,36,.18)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <span style={{ fontSize:14,color:"#202124",fontFamily:"arial,sans-serif" }}>luxury bedding sets</span>
        </div>
        {/* Sponsored label */}
        <div style={{ fontSize:12,color:"#70757a",fontFamily:"arial,sans-serif",marginBottom:12 }}>Sponsored</div>
        {/* Ad result */}
        <div style={{ marginBottom:4 }}>
          {/* Favicon + URL row */}
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
            <div style={{ width:26,height:26,borderRadius:13,background:"#f1f3f4",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <div style={{ width:18,height:18,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700 }}>T</div>
            </div>
            <div>
              <div style={{ fontSize:14,color:"#202124",fontFamily:"arial,sans-serif",lineHeight:1.2 }}>{displayUrl}</div>
              <div style={{ fontSize:12,color:"#4d5156",fontFamily:"arial,sans-serif" }}>{"https://"}{displayUrl}{" > shop > bedding"}</div>
            </div>
          </div>
          {/* Ad title */}
          <div style={{ fontSize:20,color:"#1a0dab",fontFamily:"arial,sans-serif",fontWeight:400,lineHeight:1.3,marginBottom:4,cursor:"pointer" }}>
            {titleParts.join(" | ")}
          </div>
          {/* Ad badge inline */}
          <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:6 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#202124",border:"1px solid #202124",borderRadius:3,padding:"0 4px",lineHeight:"16px" }}>Ad</span>
          </div>
          {/* Description */}
          <div style={{ fontSize:14,color:"#4d5156",fontFamily:"arial,sans-serif",lineHeight:1.58 }}>
            {desc1}{desc2 ? " " + desc2 : ""}
          </div>
          {/* Sitelinks mock */}
          <div style={{ display:"flex",gap:16,marginTop:12,flexWrap:"wrap" }}>
            {["Shop Now", "Free Shipping", "New Arrivals", "Best Sellers"].map((link, i) => (
              <span key={i} style={{ fontSize:13,color:"#1a0dab",fontFamily:"arial,sans-serif",cursor:"pointer" }}>{link}</span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ fontSize:11,color:"rgba(255,255,255,.25)",marginTop:12,textAlign:"center" }}>Preview of how your ad may appear on Google Search</div>
    </div>
  );
}


/* ── Revenue Attribution ── */
function RevenueAttribution() {
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F4B0}"} Revenue Attribution</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32,fontWeight:900,color:"#10b981",marginBottom:4 }}>12</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600 }}>Orders</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32,fontWeight:900,color:"#6366f1",marginBottom:4 }}>$840</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600 }}>Revenue</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:32,fontWeight:900,color:"#f59e0b",marginBottom:4 }}>$70</div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600 }}>Avg Order</div>
        </div>
      </div>
      <div style={{ marginTop:16,padding:"12px 16px",background:"rgba(16,185,129,.08)",borderRadius:10,border:"1px solid rgba(16,185,129,.15)",textAlign:"center" }}>
        <span style={{ fontSize:13,fontWeight:600,color:"#34d399" }}>{"\u{1F4C8}"} 12 orders {"\u00B7"} $840 revenue attributed to this campaign</span>
      </div>
    </div>
  );
}


/* ── AI Confidence Score ── */
function AIConfidenceScore() {
  const score = 87;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F3AF}"} AI Confidence Score</div>
      <div style={{ display:"flex",alignItems:"center",gap:24 }}>
        <div style={{ position:"relative",width:100,height:100,flexShrink:0 }}>
          <svg width="100" height="100" style={{ transform:"rotate(-90deg)" }}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" />
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#6366f1" strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
              style={{ transition:"stroke-dashoffset .8s ease" }} />
          </svg>
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <span style={{ fontSize:28,fontWeight:900,color:"#fff" }}>{score}%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:16,fontWeight:700,color:"#fff",marginBottom:6 }}>High Confidence</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.5)",lineHeight:1.5 }}>AI predicts <span style={{ color:"#6366f1",fontWeight:700 }}>3.5x ROAS</span> this month based on current performance trends</div>
        </div>
      </div>
    </div>
  );
}


/* ── Spend Timeline (7-day mini chart) ── */
function SpendTimeline() {
  const data = [
    { day:"Mon", spend:22 }, { day:"Tue", spend:28 }, { day:"Wed", spend:18 },
    { day:"Thu", spend:35 }, { day:"Fri", spend:31 }, { day:"Sat", spend:25 }, { day:"Sun", spend:19 },
  ];
  const maxSpend = Math.max(...data.map(d => d.spend));
  const total = data.reduce((s, d) => s + d.spend, 0);
  const avg = (total / data.length).toFixed(0);
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>{"\u{1F4C8}"} Spend Timeline (7 days)</div>
        <div style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>Avg: <span style={{ color:"#6366f1",fontWeight:700 }}>{"$"}{avg}/day</span></div>
      </div>
      <div style={{ display:"flex",alignItems:"flex-end",gap:12,height:100,padding:"0 4px" }}>
        {data.map((d, i) => {
          const h = Math.max(12, (d.spend / maxSpend) * 60);
          const isMax = d.spend === maxSpend;
          return (
            <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6 }}>
              <div style={{ fontSize:11,fontWeight:isMax?700:500,color:isMax?"#6366f1":"rgba(255,255,255,.4)" }}>{"$"}{d.spend}</div>
              <div style={{ width:"60%",maxWidth:40,height:h,background:isMax?"linear-gradient(180deg,#6366f1,#8b5cf6)":"linear-gradient(180deg,rgba(99,102,241,.5),rgba(99,102,241,.25))",borderRadius:6,minHeight:12,transition:"height .3s" }} />
              <div style={{ fontSize:10,color:isMax?"rgba(255,255,255,.6)":"rgba(255,255,255,.25)",fontWeight:600 }}>{d.day}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ── Keyword Suggestions ── */
function KeywordSuggestions({ onAdd }) {
  const suggestions = [
    { text:"silk pillowcase", cpc:0.45, volume:"High" },
    { text:"organic cotton sheets", cpc:0.85, volume:"Medium" },
    { text:"hotel quality bedding", cpc:0.65, volume:"High" },
    { text:"cooling pillow cover", cpc:0.55, volume:"Medium" },
  ];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\u{1F4A1}"} AI Keyword Suggestions</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {suggestions.map((s, i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.12)",borderRadius:12 }}>
            <span style={{ flex:1,fontSize:14,color:"#fff",fontWeight:600 }}>{s.text}</span>
            <span style={{ fontSize:12,color:"rgba(255,255,255,.4)" }}>{"$"}{s.cpc.toFixed(2)} CPC</span>
            <span style={{ fontSize:10,fontWeight:700,color:s.volume==="High"?"#10b981":"#f59e0b",background:s.volume==="High"?"rgba(16,185,129,.12)":"rgba(245,158,11,.12)",padding:"2px 8px",borderRadius:5 }}>{s.volume}</span>
            <button onClick={() => onAdd(s)} style={{ fontSize:12,fontWeight:700,color:"#6366f1",background:"rgba(99,102,241,.12)",border:"1px solid rgba(99,102,241,.25)",borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>+ Add</button>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ── Danger Zone ── */
function DangerZone({ keywords }) {
  const dangerous = [
    { text:"cheap bedding", cpc:2.10, issue:"High CPC, low conversion rate" },
    { text:"bed sheets", cpc:1.80, issue:"Very broad — low CTR (0.8%)" },
  ];
  if (dangerous.length === 0) return null;
  return (
    <div style={{ background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.2)",borderRadius:16,padding:"22px 24px" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"#ef4444",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\u26A0\uFE0F"} Danger Zone</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {dangerous.map((d, i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.12)",borderRadius:12 }}>
            <span style={{ fontSize:14,fontWeight:700,color:"#fca5a5",flex:1 }}>{d.text}</span>
            <span style={{ fontSize:12,color:"rgba(252,165,165,.6)" }}>{"$"}{d.cpc.toFixed(2)} CPC</span>
            <span style={{ fontSize:12,color:"#fca5a5",fontStyle:"italic" }}>{d.issue}</span>
            <button style={{ fontSize:11,fontWeight:700,color:"#ef4444",background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.25)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontFamily:"inherit" }}>Pause</button>
          </div>
        ))}
      </div>
    </div>
  );
}


/* ── Headline A/B Testing ── */
function HeadlineABTest({ headlines }) {
  const abData = [
    { headline: headlines[0] || "Headline A", clicks: 89, ctr: 4.2 },
    { headline: headlines[1] || "Headline B", clicks: 56, ctr: 2.8 },
    { headline: headlines[2] || "Headline C", clicks: 35, ctr: 1.9 },
  ];
  const maxClicks = Math.max(...abData.map(d => d.clicks));
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\u{1F52C}"} Headline A/B Performance</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {abData.map((d, i) => {
          const pct = (d.clicks / maxClicks) * 100;
          const isWinner = i === 0;
          return (
            <div key={i} style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12 }}>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                  <span style={{ fontSize:13,fontWeight:600,color:"#fff" }}>{d.headline}</span>
                  {isWinner && <span style={{ fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.12)",padding:"2px 7px",borderRadius:5 }}>WINNER</span>}
                </div>
                <div style={{ display:"flex",gap:12 }}>
                  <span style={{ fontSize:12,color:"rgba(255,255,255,.5)" }}>{d.clicks} clicks</span>
                  <span style={{ fontSize:12,fontWeight:700,color:isWinner?"#10b981":"rgba(255,255,255,.5)" }}>{d.ctr}% CTR</span>
                </div>
              </div>
              <div style={{ height:4,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden" }}>
                <div style={{ width:pct+"%",height:"100%",background:isWinner?"#10b981":"#6366f1",borderRadius:2,transition:"width .3s" }} />
              </div>
            </div>
          );
        })}
      </div>
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
    <div style={{ padding:"24px",overflowY:"auto",display:"flex",flexDirection:"column",gap:18,background:"#0a0a1a" }}>

      {/* ── HERO PANEL ── */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",borderRadius:20,padding:"28px 32px",color:"#fff",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(99,102,241,.08)" }} />
        <div style={{ position:"absolute",bottom:-40,right:80,width:120,height:120,borderRadius:"50%",background:"rgba(99,102,241,.05)" }} />

        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:16,position:"relative",zIndex:1 }}>
          <div>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase",marginBottom:10 }}>{campaign.name}</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:10,marginBottom:6 }}>
              <span style={{ fontSize:60,fontWeight:900,letterSpacing:"-3px",color:rc.color,lineHeight:1 }}>
                {p.roas > 0 ? (p.roas + "x") : "—"}
              </span>
              <span style={{ fontSize:18,fontWeight:700,color:"rgba(255,255,255,.4)" }}>ROAS</span>
              <span style={{
                fontSize:12,fontWeight:700,color:rc.color,background:rc.bg,
                padding:"4px 10px",borderRadius:20,marginLeft:4
              }}>{rc.label}</span>
            </div>
            <div style={{ fontSize:13,color:"rgba(255,255,255,.45)",fontWeight:500 }}>
              {"$"}{p.spend} total spend {"·"} {"$"}{campaign.budget}/day {"·"} {campaign.products.length} products
            </div>
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <button onClick={() => setPaused(!paused)} style={{ fontSize:13,fontWeight:700,color:"#fff",background:paused?"#10b981":"rgba(255,255,255,.12)",border:"1px solid "+(paused?"#10b981":"rgba(255,255,255,.15)"),borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",transition:"all .2s" }}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button onClick={onSwitchMode} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit" }}>
              {mode === "auto" ? "✏️ Manual" : "🤖 Auto"}
            </button>
          </div>
        </div>

        {/* TODAY STATS STRIP */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:24,paddingTop:20,borderTop:"1px solid rgba(255,255,255,.06)" }}>
          {[
            { value: p.today_clicks, label: "Today Clicks" },
            { value: "$" + p.today_spend, label: "Today Spend" },
            { value: p.clicks.toLocaleString(), label: "Total Clicks" },
            { value: p.impressions.toLocaleString(), label: "Impressions" },
            { value: p.clicks > 0 ? (p.clicks / p.impressions * 100).toFixed(1) + "%" : "—", label: "CTR" },
          ].map(m => (
            <div key={m.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:3 }}>{m.value}</div>
              <div style={{ fontSize:9,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:.5 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PENDING REVIEW BANNER */}
      {campaign.status === "PENDING_REVIEW" && (
        <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.06))",border:"1px solid rgba(245,158,11,.3)",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:20 }}>⏳</span>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:"#fbbf24" }}>Pending Google Review</div>
            <div style={{ fontSize:13,color:"rgba(251,191,35,.7)" }}>Awaiting Google Ads approval — usually 1–2 business days.</div>
          </div>
        </div>
      )}

      {/* ═══════════════ MANUAL MODE ═══════════════ */}
      {mode === "manual" && (
        <>
          {/* Manual Control Banner */}
          <div style={{ background:"linear-gradient(135deg,rgba(249,115,22,.12),rgba(249,115,22,.06))",border:"2px solid rgba(249,115,22,.25)",borderRadius:14,padding:"14px 20px",display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:800 }}>✏️</div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#fb923c" }}>Manual Control Mode</div>
              <div style={{ fontSize:12,color:"rgba(251,146,60,.7)" }}>You control budget, keywords, bids & ad copy directly</div>
            </div>
          </div>


          {/* Google Ads Live Preview — updates live as you edit */}
          <GoogleAdsPreview headlines={headlines} descriptions={descriptions} />

          {/* 1. DAILY BUDGET */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>💰 Daily Budget</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
              <span style={{ fontSize:20,fontWeight:700,color:"#6366f1" }}>$</span>
              <span style={{ fontSize:48,fontWeight:900,color:"#fff",letterSpacing:"-2px",lineHeight:1 }}>{budget}</span>
              <span style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginLeft:8 }}>/ day</span>
              <span style={{ fontSize:13,color:"rgba(255,255,255,.25)",marginLeft:4 }}>· ~{"$"}{(budget * 30).toLocaleString()}/mo</span>
            </div>
            <BudgetSlider value={budget} onChange={setBudget} />
          </div>

          {/* 2. KEYWORDS */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>🔑 Keywords ({keywords.length})</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {keywords.map((kw, i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12 }}>
                  <span style={{ flex:1,fontSize:14,color:"#fff",fontWeight:600 }}>{kw.text}</span>
                  <div style={{ display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"4px 8px" }}>
                    <span style={{ fontSize:12,color:"rgba(255,255,255,.4)",fontWeight:600 }}>CPC $</span>
                    <input
                      type="number" step="0.05" min="0.05" max="50"
                      value={kw.bid}
                      onChange={e => updateBid(i, e.target.value)}
                      style={{ width:55,fontSize:14,fontWeight:700,color:"#6366f1",border:"none",background:"transparent",textAlign:"center",fontFamily:"inherit",outline:"none" }}
                    />
                  </div>
                  <button onClick={() => removeKeyword(i)} style={{ width:28,height:28,borderRadius:8,background:"rgba(239,68,68,.15)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:16,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:700 }}>×</button>
                </div>
              ))}
            </div>
            {/* Add keyword */}
            <div style={{ display:"flex",gap:8,marginTop:12 }}>
              <input
                value={newKw}
                onChange={e => setNewKw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                placeholder="Add new keyword..."
                style={{ flex:1,fontSize:14,border:"2px dashed rgba(255,255,255,.12)",borderRadius:12,padding:"10px 14px",fontFamily:"inherit",outline:"none",color:"#fff",background:"rgba(255,255,255,.04)" }}
              />
              <button onClick={addKeyword} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>＋ Add</button>
            </div>
          </div>


          {/* Keyword Suggestions */}
          <KeywordSuggestions onAdd={(s) => setKeywords(kw => [...kw, { text: s.text, bid: s.cpc }])} />

          {/* Danger Zone */}
          <DangerZone keywords={keywords} />

          {/* 3. HEADLINES */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>📢 Headlines ({campaign.headlines.length})</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>Max 30 characters each</div>
            </div>
            {campaign.headlines.map((h, i) => (
              <CharInput key={"h"+i} defaultValue={h} maxLen={30} placeholder={"Headline " + (i+1)} />
            ))}
          </div>


          {/* Headline A/B Testing */}
          <HeadlineABTest headlines={headlines} />

          {/* 4. DESCRIPTIONS */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>📄 Descriptions ({campaign.descriptions.length})</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>Max 90 characters each</div>
            </div>
            {campaign.descriptions.map((d, i) => (
              <CharInput key={"d"+i} defaultValue={d} maxLen={90} tag="textarea" placeholder={"Description " + (i+1)} />
            ))}
          </div>

          {/* Revenue Attribution */}
          <RevenueAttribution />
        </>
      )}

      {/* ═══════════════ AUTO MODE ═══════════════ */}
      {mode === "auto" && (
        <>
          {/* AI Managed Banner */}
          <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.08))",border:"2px solid rgba(99,102,241,.3)",borderRadius:14,padding:"16px 22px",display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",flexShrink:0 }}>🤖</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15,fontWeight:700,color:"#a5b4fc" }}>AI-Managed Campaign</div>
              <div style={{ fontSize:13,color:"rgba(165,180,252,.7)",marginTop:2 }}>Smart Ads AI continuously optimizes your keywords, bids & ad copy for maximum ROAS</div>
            </div>
            <div style={{ background:"#6366f1",color:"#fff",fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:20,whiteSpace:"nowrap" }}>✓ Active</div>
          </div>


          {/* Google Ads Live Preview */}
          <GoogleAdsPreview headlines={campaign.headlines} descriptions={campaign.descriptions} />

          {/* Campaign Assets Summary - 4 cards */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>📊 Campaign Assets</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12 }}>
              <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(99,102,241,.15)" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#6366f1",marginBottom:4 }}>{campaign.keywords.length}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#8b5cf6",textTransform:"uppercase",letterSpacing:.5 }}>Keywords</div>
                <div style={{ fontSize:11,color:"#a78bfa",marginTop:4 }}>Auto-optimized</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,rgba(59,130,246,.15),rgba(59,130,246,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(59,130,246,.15)" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#3b82f6",marginBottom:4 }}>{campaign.headlines.length}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#3b82f6",textTransform:"uppercase",letterSpacing:.5 }}>Headlines</div>
                <div style={{ fontSize:11,color:"#60a5fa",marginTop:4 }}>AI-generated</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,rgba(22,163,106,.15),rgba(22,163,106,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(22,163,106,.15)" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#16a34a",marginBottom:4 }}>{campaign.descriptions.length}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#16a34a",textTransform:"uppercase",letterSpacing:.5 }}>Descriptions</div>
                <div style={{ fontSize:11,color:"#4ade80",marginTop:4 }}>AI-crafted</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,rgba(234,88,12,.15),rgba(234,88,12,.06))",borderRadius:14,padding:"18px 16px",textAlign:"center",border:"1px solid rgba(234,88,12,.15)" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#ea580c",marginBottom:4 }}>{"$"}{campaign.budget}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#ea580c",textTransform:"uppercase",letterSpacing:.5 }}>Daily Budget</div>
                <div style={{ fontSize:11,color:"#fb923c",marginTop:4 }}>{"~$"}{(campaign.budget*30).toLocaleString()}/mo</div>
              </div>
            </div>
          </div>


          {/* Revenue Attribution */}
          <RevenueAttribution />

          {/* AI Confidence Score */}
          <AIConfidenceScore />

          {/* AI Performance Insights */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>✨ AI Performance Insights</div>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,rgba(16,185,129,.12),rgba(16,185,129,.06))",borderRadius:12,border:"1px solid rgba(16,185,129,.2)" }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"#16a34a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>🎯</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#34d399" }}>Top Performing Keyword</div>
                  <div style={{ fontSize:13,color:"rgba(52,211,153,.7)",marginTop:2 }}>{campaign.keywords[0]?.text || "Analyzing..."} {"—"} {"$"}{campaign.keywords[0]?.bid.toFixed(2)} CPC</div>
                </div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,rgba(59,130,246,.12),rgba(59,130,246,.06))",borderRadius:12,border:"1px solid rgba(59,130,246,.2)" }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>📝</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#60a5fa" }}>Best Headline</div>
                  <div style={{ fontSize:13,color:"rgba(96,165,250,.7)",marginTop:2 }}>{campaign.headlines[0] || "Testing variations..."}</div>
                </div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,rgba(234,179,8,.12),rgba(234,179,8,.06))",borderRadius:12,border:"1px solid rgba(234,179,8,.2)" }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"#eab308",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>🕒</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#fbbf24" }}>Optimization Status</div>
                  <div style={{ fontSize:13,color:"rgba(251,191,35,.7)",marginTop:2 }}>Last optimized: 2 hours ago {"·"} Next review: Tomorrow 9:00 AM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent AI Actions */}
          <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>📋 Recent AI Actions</div>
            <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
              {[
                { time:"2 hours ago", action:"Adjusted bid for \"luxury bedding sets\" from $1.10 to $1.20", icon:"💰" },
                { time:"Yesterday", action:"Added new headline: \"Premium Bedding — Shop Now\"", icon:"📝" },
                { time:"2 days ago", action:"Paused low-performing keyword: \"cheap bedding\"", icon:"⏸️" },
                { time:"3 days ago", action:"Increased daily budget recommendation to $30/day", icon:"📈" },
              ].map((item, i) => (
                <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:12,padding:"12px 0",borderBottom:i < 3 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                  <div style={{ width:28,height:28,borderRadius:7,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:1 }}>{item.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,color:"rgba(255,255,255,.8)",fontWeight:500 }}>{item.action}</div>
                    <div style={{ fontSize:11,color:"rgba(255,255,255,.3)",marginTop:3 }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Spend Timeline */}
          <SpendTimeline />
        </>
      )}

      {/* PRODUCTS (always read-only) */}
      <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"20px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>🛍️ Products ({campaign.products.length})</div>
        <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
          {campaign.products.map(prod => (
            <div key={prod.id} style={{ display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"10px 16px" }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>🛏️</div>
              <span style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,.8)" }}>{prod.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SAVE CHANGES + DUPLICATE (manual only) */}
      {mode === "manual" && (
        <div style={{ display:"flex",justifyContent:"flex-end",gap:12,paddingBottom:12 }}>
          <button style={{
            fontSize:14,fontWeight:700,color:"rgba(255,255,255,.7)",
            background:"rgba(255,255,255,.06)",
            border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:"14px 24px",
            cursor:"pointer",fontFamily:"inherit",
            transition:"all .15s"
          }}>
            {"\u{1F4CB}"} Duplicate Campaign
          </button>
          <button style={{
            fontSize:15,fontWeight:700,color:"#fff",
            background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
            border:"none",borderRadius:14,padding:"14px 32px",
            cursor:"pointer",fontFamily:"inherit",
            boxShadow:"0 4px 20px rgba(99,102,241,.3)",
            transition:"transform .1s,box-shadow .1s"
          }}>
            {"\u{1F4BE}"} Save Changes
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
      <div style={{ padding:"40px",maxWidth:600,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",textAlign:"center",background:"#0a0a1a",minHeight:"100vh" }}>
        <div style={{ width:72,height:72,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 20px" }}>{"🚀"}</div>
        <h1 style={{ fontSize:28,fontWeight:800,color:"#fff",marginBottom:8 }}>No campaigns yet</h1>
        <p style={{ fontSize:15,color:"rgba(255,255,255,.5)",marginBottom:32,lineHeight:1.6 }}>Create your first Google Ads campaign and start driving traffic to your store.</p>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:15,fontWeight:700,padding:"14px 28px",border:"none",borderRadius:12,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(99,102,241,.3)" }}>{"＋"} Create First Campaign</button>
        {showLaunchDialog && <LaunchDialog onClose={() => setShowLaunchDialog(false)} />}
      </div>
    );
  }

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif",minHeight:"100vh",height:"auto",display:"flex",flexDirection:"column",background:"#0a0a1a" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .camp-fade{animation:fadeUp .25s ease forwards}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
        .budget-sim-slider{z-index:9999!important;touch-action:none!important;user-select:none!important}
        .budget-sim-input-row{z-index:9999!important;touch-action:none!important}
      `}</style>

      <div style={{ background:"#0a0a1a",borderBottom:"1px solid rgba(255,255,255,.08)",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:20,fontWeight:800,color:"#fff",margin:0,letterSpacing:"-0.5px" }}>Campaigns</h1>
          <p style={{ fontSize:12,color:"rgba(255,255,255,.4)",margin:"2px 0 0",fontWeight:500 }}>{campaigns.length} active {"·"} Google Ads</p>
        </div>
        <button onClick={() => setShowLaunchDialog(true)} style={{ display:"inline-flex",alignItems:"center",gap:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",fontSize:13,fontWeight:700,padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(99,102,241,.3)" }}>{"＋"} New Campaign</button>
      </div>

      <div className="camp-fade" style={{ display:"grid",gridTemplateColumns:"280px 1fr",flex:1,minHeight:0,overflow:"auto" }}>
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
