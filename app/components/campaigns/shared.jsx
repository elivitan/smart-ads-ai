import { useState, useCallback, useEffect } from "react";

export function roasColor(roas) {
  if (roas >= 3) return { color:"#10b981", bg:"rgba(16,185,129,.12)", label:"Excellent" };
  if (roas >= 2) return { color:"#f59e0b", bg:"rgba(245,158,11,.12)", label:"Good" };
  if (roas > 0)  return { color:"#ef4444", bg:"rgba(239,68,68,.12)", label:"Low" };
  return { color:"#94a3b8", bg:"rgba(148,163,184,.1)", label:"No data" };
}


export function statusDot(status) {
  if (status === "ENABLED") return "#10b981";
  if (status === "PENDING_REVIEW") return "#f59e0b";
  if (status === "PAUSED") return "#94a3b8";
  return "#ef4444";
}

/* ── Launch Dialog ── */

/* ── Budget Slider (custom div-based for Shopify iframe) ── */
export function BudgetSlider({ value, onChange }) {
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

/* ── CharCounter input ── */
export function CharInput({ defaultValue, maxLen, tag, placeholder }) {
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

/* ── Revenue Attribution ── */
export function RevenueAttribution() {
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

/* ── AI Confidence Score ── */
export function AIConfidenceScore() {
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

/* ── Spend Timeline (7-day mini chart) ── */
export function SpendTimeline() {
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

/* ── Keyword Suggestions ── */
export function KeywordSuggestions({ onAdd }) {
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

/* ── Danger Zone ── */
export function DangerZone({ keywords }) {
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

/* ── Headline A/B Testing ── */
export function HeadlineABTest({ headlines }) {
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


/* ── Competitor Intelligence (campaign-specific) ── */

/* ── Competitor Intelligence (campaign-specific) ── */
export function CompetitorIntelligence({ keywords }) {
  const competitors = [
    { name:"BeddingCo", domain:"beddingco.com", estSpend:"$2,100/mo", overlap:72, threat:"high",
      keywords:[
        { text:"luxury bedding sets", theirBid:1.40, yourBid:1.20, status:"outbid" },
        { text:"cotton duvet cover", theirBid:0.85, yourBid:0.95, status:"winning" },
      ]
    },
    { name:"SleepHaven", domain:"sleephaven.com", estSpend:"$1,400/mo", overlap:45, threat:"medium",
      keywords:[
        { text:"bamboo pillow case", theirBid:0.90, yourBid:0.80, status:"outbid" },
        { text:"soft bedding online", theirBid:0.50, yourBid:0.60, status:"winning" },
      ]
    },
  ];
  const threatColor = { high:"#ef4444", medium:"#f59e0b", low:"#10b981" };
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F575}\uFE0F"} Competitor Intelligence</div>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {competitors.map((comp, ci) => (
          <div key={ci} style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"rgba(255,255,255,.6)" }}>{comp.name[0]}</div>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:"#fff" }}>{comp.name}</div>
                  <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>{comp.domain}</div>
                </div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,.5)" }}>Est. spend</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#fff" }}>{comp.estSpend}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12,color:"rgba(255,255,255,.5)" }}>Overlap</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"#6366f1" }}>{comp.overlap}%</div>
                </div>
                <span style={{ fontSize:10,fontWeight:700,color:threatColor[comp.threat],background:threatColor[comp.threat]+"18",padding:"3px 8px",borderRadius:5,textTransform:"uppercase" }}>{comp.threat}</span>
              </div>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {comp.keywords.map((kw, ki) => (
                <div key={ki} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,.02)",borderRadius:8,fontSize:13 }}>
                  <span style={{ flex:1,color:"rgba(255,255,255,.7)" }}>{kw.text}</span>
                  <span style={{ color:"rgba(255,255,255,.4)",fontSize:12 }}>They: ${kw.theirBid.toFixed(2)}</span>
                  <span style={{ color:"#6366f1",fontSize:12,fontWeight:600 }}>You: ${kw.yourBid.toFixed(2)}</span>
                  <span style={{ fontSize:10,fontWeight:700,color:kw.status==="winning"?"#10b981":"#ef4444",background:kw.status==="winning"?"rgba(16,185,129,.12)":"rgba(239,68,68,.12)",padding:"2px 8px",borderRadius:5 }}>{kw.status==="winning"?"WINNING":"OUTBID"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Search Terms Report ── */

/* ── Search Terms Report ── */
export function SearchTermsReport() {
  const terms = [
    { term:"luxury bedding sets queen", clicks:45, conversions:3, status:"active", ctr:5.2 },
    { term:"best cotton duvet cover", clicks:32, conversions:2, status:"active", ctr:4.1 },
    { term:"bamboo sheets king size", clicks:28, conversions:1, status:"active", ctr:3.8 },
    { term:"cheap bedding sets", clicks:18, conversions:0, status:"negative", ctr:0.4 },
    { term:"bedding wholesale bulk", clicks:12, conversions:0, status:"negative", ctr:0.2 },
  ];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F4DD}"} Search Terms Report</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:14 }}>Actual search queries that triggered your ads</div>
      <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
        {terms.map((t, i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:t.status==="negative"?"rgba(239,68,68,.04)":"rgba(255,255,255,.02)",border:"1px solid "+(t.status==="negative"?"rgba(239,68,68,.12)":"rgba(255,255,255,.04)"),borderRadius:10 }}>
            <span style={{ flex:1,fontSize:13,color:t.status==="negative"?"#fca5a5":"#fff",fontWeight:500,textDecoration:t.status==="negative"?"line-through":"none" }}>{t.term}</span>
            <span style={{ fontSize:12,color:"rgba(255,255,255,.4)",minWidth:70 }}>{t.clicks} clicks</span>
            <span style={{ fontSize:12,color:t.conversions>0?"#10b981":"rgba(255,255,255,.3)",fontWeight:t.conversions>0?700:400,minWidth:50 }}>{t.conversions} conv</span>
            <span style={{ fontSize:12,color:"rgba(255,255,255,.4)",minWidth:55 }}>{t.ctr}% CTR</span>
            {t.status==="negative" ? (
              <span style={{ fontSize:10,fontWeight:700,color:"#ef4444",background:"rgba(239,68,68,.12)",padding:"2px 8px",borderRadius:5 }}>BLOCKED</span>
            ) : (
              <span style={{ fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.12)",padding:"2px 8px",borderRadius:5 }}>ACTIVE</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Quality Score Card ── */

/* ── Quality Score Card ── */
export function QualityScoreCard({ score }) {
  const s = score || 7;
  const color = s >= 8 ? "#10b981" : s >= 5 ? "#f59e0b" : "#ef4444";
  const label = s >= 8 ? "Above Average" : s >= 5 ? "Average" : "Below Average";
  const factors = [
    { name:"Ad Relevance", rating: s >= 8 ? "Above avg" : "Average", good: s >= 7 },
    { name:"Landing Page", rating: s >= 7 ? "Above avg" : s >= 5 ? "Average" : "Below avg", good: s >= 5 },
    { name:"Expected CTR", rating: s >= 8 ? "Above avg" : "Average", good: s >= 7 },
  ];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{2B50}"} Quality Score</div>
      <div style={{ display:"flex",alignItems:"center",gap:20 }}>
        <div style={{ width:64,height:64,borderRadius:16,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          <span style={{ fontSize:32,fontWeight:900,color:color }}>{s}</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14,fontWeight:700,color:"#fff",marginBottom:8 }}>{label}</div>
          <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
            {factors.map((f, i) => (
              <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                <span style={{ fontSize:12,color:"rgba(255,255,255,.5)" }}>{f.name}</span>
                <span style={{ fontSize:12,fontWeight:600,color:f.good?"#10b981":"#f59e0b" }}>{f.rating}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Competitor Ad Copy ── */

/* ── Competitor Ad Copy ── */
export function CompetitorAdCopy() {
  const ads = [
    {
      brand:"BeddingCo", url:"beddingco.com",
      headline:"Premium Bedding Sets — 50% Off Today",
      description:"Shop luxury bedding at unbeatable prices. Egyptian cotton, silk & more. Free delivery.",
    },
    {
      brand:"SleepHaven", url:"sleephaven.com",
      headline:"Organic Bedding — Sleep Better Tonight",
      description:"100% organic cotton bedding. Hypoallergenic & eco-friendly. Shop the #1 rated brand.",
    },
  ];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F441}\uFE0F"} Competitor Ad Copy</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:14 }}>What your competitors are running on Google</div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {ads.map((ad, i) => (
          <div key={i} style={{ background:"#fff",borderRadius:10,padding:"16px 18px" }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:6 }}>
              <span style={{ fontSize:10,fontWeight:700,color:"#202124",border:"1px solid #202124",borderRadius:3,padding:"0 4px",lineHeight:"14px" }}>Ad</span>
              <span style={{ fontSize:12,color:"#4d5156",fontFamily:"arial,sans-serif" }}>{ad.url}</span>
            </div>
            <div style={{ fontSize:16,color:"#1a0dab",fontFamily:"arial,sans-serif",marginBottom:4,lineHeight:1.3 }}>{ad.headline}</div>
            <div style={{ fontSize:13,color:"#4d5156",fontFamily:"arial,sans-serif",lineHeight:1.5 }}>{ad.description}</div>
            <div style={{ marginTop:8,fontSize:11,color:"rgba(255,255,255,.4)",background:"rgba(99,102,241,.06)",borderRadius:6,padding:"6px 10px",display:"inline-block" }}>
              <span style={{ color:"#6366f1",fontWeight:600 }}>{"\u{1F4A1}"} Tip:</span> <span style={{ color:"rgba(255,255,255,.5)" }}>{i===0?"They use discount language — consider emphasizing quality over price":"They focus on organic — highlight your material variety"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Negative Keywords ── */

/* ── Negative Keywords ── */
export function NegativeKeywords() {
  const negatives = [
    { text:"cheap", reason:"AI blocked — attracts low-intent traffic" },
    { text:"wholesale", reason:"AI blocked — not retail customers" },
    { text:"free", reason:"AI blocked — low purchase intent" },
    { text:"DIY", reason:"AI blocked — not product buyers" },
  ];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>{"\u{1F6AB}"} Negative Keywords ({negatives.length})</div>
      <div style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:12 }}>These terms are blocked from triggering your ads</div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
        {negatives.map((n, i) => (
          <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.12)",borderRadius:8 }}>
            <span style={{ fontSize:13,color:"#fca5a5",fontWeight:600,textDecoration:"line-through" }}>{n.text}</span>
            <span style={{ fontSize:11,color:"rgba(255,255,255,.3)" }}>{n.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Campaign Settings Card ── */

/* ── Campaign Settings Card ── */
export function CampaignSettings({ campaign }) {
  const finalUrl = campaign.finalUrl || "https://textilura.com";
  const paths = campaign.displayPath || ["shop"];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u2699\uFE0F"} Campaign Settings</div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
        <div style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:4 }}>Final URL</div>
          <div style={{ fontSize:13,color:"#6366f1",fontWeight:600,wordBreak:"break-all" }}>{finalUrl}</div>
        </div>
        <div style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:4 }}>Display Path</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:600 }}>textilura.com / {paths.join(" / ")}</div>
        </div>
        <div style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:4 }}>Campaign Type</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:600 }}>Search — Responsive Search Ads</div>
        </div>
        <div style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:4 }}>Bidding Strategy</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:600 }}>{campaign.type==="auto"?"Maximize Conversions":"Manual CPC"}</div>
        </div>
        <div style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:4 }}>Network</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:600 }}>Google Search + Search Partners</div>
        </div>
        <div style={{ padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)" }}>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginBottom:4 }}>Target Location</div>
          <div style={{ fontSize:13,color:"rgba(255,255,255,.7)",fontWeight:600 }}>United States</div>
        </div>
      </div>
    </div>
  );
}

/* ── Enhanced Products with Performance ── */

/* ── Enhanced Products with Performance ── */
export function ProductsPerformance({ products }) {
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F6CD}\uFE0F"} Product Performance ({products.length})</div>
      <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
        {products.map(prod => {
          const rc = prod.roas >= 1.5 ? { color:"#10b981",label:"Profitable" } : prod.roas >= 1 ? { color:"#f59e0b",label:"Break-even" } : { color:"#ef4444",label:"Losing" };
          return (
            <div key={prod.id} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12 }}>
              <div style={{ width:42,height:42,borderRadius:10,background:"linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.08))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0 }}>{"\u{1F6CF}\uFE0F"}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:600,color:"#fff",marginBottom:3 }}>{prod.title}</div>
                <div style={{ display:"flex",gap:12,fontSize:12,color:"rgba(255,255,255,.4)" }}>
                  <span>{prod.clicks || 0} clicks</span>
                  <span>{"$"}{prod.spend || 0} spent</span>
                </div>
              </div>
              <div style={{ textAlign:"right",flexShrink:0 }}>
                <div style={{ fontSize:16,fontWeight:800,color:rc.color }}>{prod.revenue ? "$"+prod.revenue : "—"}</div>
                <div style={{ fontSize:11,color:rc.color,fontWeight:600 }}>{prod.roas ? prod.roas.toFixed(1)+"x ROAS" : "No data"}</div>
              </div>
              <span style={{ fontSize:10,fontWeight:700,color:rc.color,background:rc.color+"15",padding:"3px 8px",borderRadius:5,flexShrink:0 }}>{rc.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ── Ad Extensions Editor (MANUAL mode) ── */

/* ── Ad Extensions Editor (MANUAL mode) ── */
export function AdExtensionsEditor() {
  const [sitelinks, setSitelinks] = useState([
    { title:"Shop Now", url:"/collections/all" },
    { title:"Free Shipping", url:"/pages/shipping" },
    { title:"New Arrivals", url:"/collections/new" },
    { title:"Best Sellers", url:"/collections/best-sellers" },
  ]);
  const [callouts, setCallouts] = useState([
    "Free Shipping Over $75", "30-Day Returns", "US-Based Support", "Premium Quality"
  ]);
  const [newCallout, setNewCallout] = useState("");

  const addCallout = () => {
    const text = newCallout.trim();
    if (!text || callouts.length >= 10) return;
    setCallouts([...callouts, text]);
    setNewCallout("");
  };

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:18 }}>
      {/* Sitelinks */}
      <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
          <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>{"\u{1F517}"} Sitelink Extensions ({sitelinks.length}/4)</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>Max 25 chars each</div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {sitelinks.map((sl, i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12 }}>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:4 }}>
                <input value={sl.title} onChange={e => { const u=[...sitelinks]; u[i]={...u[i],title:e.target.value}; setSitelinks(u); }}
                  style={{ fontSize:14,fontWeight:600,color:"#6366f1",background:"transparent",border:"none",outline:"none",fontFamily:"inherit",padding:0 }}
                  placeholder="Link text" />
                <input value={sl.url} onChange={e => { const u=[...sitelinks]; u[i]={...u[i],url:e.target.value}; setSitelinks(u); }}
                  style={{ fontSize:12,color:"rgba(255,255,255,.4)",background:"transparent",border:"none",outline:"none",fontFamily:"inherit",padding:0 }}
                  placeholder="/path" />
              </div>
              <button onClick={() => setSitelinks(sitelinks.filter((_,j)=>j!==i))} style={{ width:28,height:28,borderRadius:8,background:"rgba(239,68,68,.1)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{"\u00D7"}</button>
            </div>
          ))}
        </div>
      </div>

      {/* Callout Extensions */}
      <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
          <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>{"\u{1F4E2}"} Callout Extensions ({callouts.length})</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)" }}>Max 25 chars each</div>
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:8,marginBottom:12 }}>
          {callouts.map((c, i) => (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:"rgba(99,102,241,.08)",border:"1px solid rgba(99,102,241,.15)",borderRadius:8 }}>
              <span style={{ fontSize:13,color:"#a5b4fc",fontWeight:500 }}>{c}</span>
              <button onClick={() => setCallouts(callouts.filter((_,j)=>j!==i))} style={{ background:"none",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:14,padding:0,lineHeight:1 }}>{"\u00D7"}</button>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <input value={newCallout} onChange={e => setNewCallout(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addCallout()}
            placeholder="Add callout (e.g. Free Returns)..." maxLength={25}
            style={{ flex:1,fontSize:14,border:"2px dashed rgba(255,255,255,.12)",borderRadius:12,padding:"10px 14px",fontFamily:"inherit",outline:"none",color:"#fff",background:"rgba(255,255,255,.04)" }} />
          <button onClick={addCallout} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>{"\uFF0B"} Add</button>
        </div>
      </div>
    </div>
  );
}

/* ── Final URL & Display Path Editor ── */

/* ── Final URL & Display Path Editor ── */
export function UrlEditor({ campaign }) {
  const [finalUrl, setFinalUrl] = useState(campaign.finalUrl || "https://textilura.com");
  const [path1, setPath1] = useState(campaign.displayPath?.[0] || "");
  const [path2, setPath2] = useState(campaign.displayPath?.[1] || "");
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:16 }}>{"\u{1F310}"} URL Settings</div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        <div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:6 }}>Final URL</div>
          <input value={finalUrl} onChange={e => setFinalUrl(e.target.value)}
            style={{ width:"100%",fontSize:14,color:"#fff",background:"#0f0f23",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:12,padding:"10px 14px",fontFamily:"inherit",outline:"none",boxSizing:"border-box" }} />
        </div>
        <div>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:6 }}>Display Path</div>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:14,color:"rgba(255,255,255,.4)" }}>textilura.com /</span>
            <input value={path1} onChange={e => setPath1(e.target.value)} placeholder="path1" maxLength={15}
              style={{ width:100,fontSize:14,color:"#6366f1",fontWeight:600,background:"#0f0f23",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:8,padding:"8px 10px",fontFamily:"inherit",outline:"none" }} />
            <span style={{ fontSize:14,color:"rgba(255,255,255,.4)" }}>/</span>
            <input value={path2} onChange={e => setPath2(e.target.value)} placeholder="path2" maxLength={15}
              style={{ width:100,fontSize:14,color:"#6366f1",fontWeight:600,background:"#0f0f23",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:8,padding:"8px 10px",fontFamily:"inherit",outline:"none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Campaign Status Bar ── */

/* ── Campaign Status Bar ── */
export function CampaignStatusBar({ status, paused, onPause, onResume, onDelete }) {
  const statusMap = {
    ENABLED: { color:"#10b981", bg:"rgba(16,185,129,.12)", label:"Live — Serving Ads", icon:"\u{1F7E2}" },
    PENDING_REVIEW: { color:"#f59e0b", bg:"rgba(245,158,11,.12)", label:"Pending Google Review", icon:"\u23F3" },
    PAUSED: { color:"#94a3b8", bg:"rgba(148,163,184,.12)", label:"Paused — Not Serving", icon:"\u23F8\uFE0F" },
    REMOVED: { color:"#ef4444", bg:"rgba(239,68,68,.12)", label:"Removed", icon:"\u{1F5D1}\uFE0F" },
  };
  const current = paused ? statusMap.PAUSED : statusMap[status] || statusMap.ENABLED;
  return (
    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 18px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14 }}>
      <div style={{ display:"flex",alignItems:"center",gap:8,flex:1 }}>
        <span style={{ fontSize:16 }}>{current.icon}</span>
        <div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:1 }}>Campaign Status</div>
          <div style={{ fontSize:14,fontWeight:700,color:current.color }}>{current.label}</div>
        </div>
      </div>
      <div style={{ display:"flex",gap:8 }}>
        {!paused ? (
          <button onClick={onPause} style={{ fontSize:12,fontWeight:700,color:"#f59e0b",background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
            {"\u23F8\uFE0F"} Pause
          </button>
        ) : (
          <button onClick={onResume} style={{ fontSize:12,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.2)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
            {"\u25B6\uFE0F"} Resume
          </button>
        )}
        <button onClick={onDelete} style={{ fontSize:12,fontWeight:700,color:"#ef4444",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.15)",borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
          {"\u{1F5D1}\uFE0F"} Delete
        </button>
      </div>
    </div>
  );
}


/* ── AI Credits Bar ── */

/* ── AI Credits Bar ── */
export function AICreditsBar({ credits, maxCredits, plan }) {
  const pct = (credits / maxCredits) * 100;
  const isLow = credits <= 10;
  return (
    <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.06))",border:"1px solid rgba(99,102,241,.2)",borderRadius:14,padding:"14px 20px",display:"flex",alignItems:"center",gap:16 }}>
      <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>{"\u2728"}</div>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
          <div style={{ fontSize:13,fontWeight:700,color:"#a5b4fc" }}>AI Credits</div>
          <div style={{ fontSize:13,fontWeight:700,color:isLow?"#f59e0b":"#fff" }}>{credits} / {maxCredits} <span style={{ fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:500 }}>remaining</span></div>
        </div>
        <div style={{ height:4,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden" }}>
          <div style={{ width:pct+"%",height:"100%",background:isLow?"#f59e0b":"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:2,transition:"width .3s" }} />
        </div>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6 }}>
          <span style={{ fontSize:11,color:"rgba(255,255,255,.3)" }}>{plan} plan {"\u00B7"} Resets monthly</span>
          {isLow && <span style={{ fontSize:11,fontWeight:700,color:"#6366f1",cursor:"pointer" }}>Upgrade for more</span>}
        </div>
      </div>
    </div>
  );
}

/* ── AI Suggest Button (reusable) ── */

/* ── AI Suggest Button (reusable) ── */
export function AISuggestButton({ label, cost, credits, onClick }) {
  const disabled = credits < cost;
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      fontSize:11,fontWeight:700,
      color:disabled?"rgba(255,255,255,.25)":"#a5b4fc",
      background:disabled?"rgba(255,255,255,.03)":"rgba(99,102,241,.1)",
      border:"1px solid "+(disabled?"rgba(255,255,255,.06)":"rgba(99,102,241,.25)"),
      borderRadius:8,padding:"5px 12px",
      cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",
      display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",
      opacity:disabled?0.5:1,transition:"all .15s"
    }}>
      {"\u2728"} {label} <span style={{ fontSize:10,color:disabled?"rgba(255,255,255,.2)":"rgba(165,180,252,.5)" }}>({cost} cr)</span>
    </button>
  );
}

/* ── AI Optimize All Button ── */

/* ── AI Optimize All Button ── */
export function AIOptimizeAllButton({ credits, onClick }) {
  const cost = 5;
  const disabled = credits < cost;
  return (
    <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.04))",border:"1px solid rgba(99,102,241,.15)",borderRadius:16,padding:"20px 24px",textAlign:"center" }}>
      <div style={{ fontSize:18,marginBottom:8 }}>{"\u{1F9E0}"}</div>
      <div style={{ fontSize:15,fontWeight:700,color:"#fff",marginBottom:4 }}>AI Optimize Entire Campaign</div>
      <div style={{ fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:16,lineHeight:1.5 }}>AI will analyze and improve your headlines, descriptions, keywords & bids based on performance data</div>
      <button onClick={disabled ? undefined : onClick} style={{
        fontSize:14,fontWeight:700,
        color:disabled?"rgba(255,255,255,.3)":"#fff",
        background:disabled?"rgba(255,255,255,.06)":"linear-gradient(135deg,#6366f1,#8b5cf6)",
        border:"none",borderRadius:12,padding:"12px 28px",
        cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",
        boxShadow:disabled?"none":"0 4px 20px rgba(99,102,241,.3)",
        transition:"all .15s"
      }}>
        {"\u2728"} Optimize All ({cost} credits)
      </button>
      {disabled && <div style={{ fontSize:12,color:"#f59e0b",marginTop:10 }}>Not enough credits. <span style={{ color:"#6366f1",cursor:"pointer",fontWeight:700 }}>Upgrade plan</span></div>}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   CAMPAIGN CREATION WIZARD - 9 step guided campaign builder
   ══════════════════════════════════════════════════════════════ */


export function DateRangeSelector({ range, onChange }) {
  const options = ["Today","7 days","30 days","All time"];
  return (
    <div style={{ display:"flex",gap:4 }}>
      {options.map(r => (
        <button key={r} onClick={() => onChange(r)} style={{
          fontSize:11,fontWeight:range===r?700:500,
          color:range===r?"#fff":"rgba(255,255,255,.35)",
          background:range===r?"rgba(99,102,241,.2)":"transparent",
          border:range===r?"1px solid rgba(99,102,241,.3)":"1px solid transparent",
          borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit"
        }}>{r}</button>
      ))}
    </div>
  );
}

/* ── Performance Graph (clicks + spend over 7 days) ── */

/* ── Performance Graph (clicks + spend over 7 days) ── */
export function PerformanceGraph() {
  const data = [
    { day:"Mon", clicks:18, spend:22, conv:1 },
    { day:"Tue", clicks:24, spend:28, conv:2 },
    { day:"Wed", clicks:15, spend:18, conv:0 },
    { day:"Thu", clicks:32, spend:35, conv:3 },
    { day:"Fri", clicks:28, spend:31, conv:2 },
    { day:"Sat", clicks:22, spend:25, conv:1 },
    { day:"Sun", clicks:16, spend:19, conv:1 },
  ];
  const maxVal = Math.max(...data.map(d => Math.max(d.clicks, d.spend)));
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>Performance Trends</div>
        <div style={{ display:"flex",gap:16,fontSize:11 }}>
          <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:8,height:8,borderRadius:4,background:"#6366f1" }}/><span style={{ color:"rgba(255,255,255,.4)" }}>Clicks</span></span>
          <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:8,height:8,borderRadius:4,background:"#10b981" }}/><span style={{ color:"rgba(255,255,255,.4)" }}>Sales</span></span>
          <span style={{ display:"flex",alignItems:"center",gap:4 }}><span style={{ width:8,height:8,borderRadius:4,background:"#f59e0b" }}/><span style={{ color:"rgba(255,255,255,.4)" }}>Spend ($)</span></span>
        </div>
      </div>
      <div style={{ display:"flex",alignItems:"flex-end",gap:6,height:120 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4 }}>
            <div style={{ display:"flex",gap:3,alignItems:"flex-end",height:90 }}>
              <div style={{ width:8,background:"#6366f1",borderRadius:"3px 3px 0 0",height:Math.max(4,(d.clicks/maxVal)*80),transition:"height .3s" }} />
              <div style={{ width:8,background:"#10b981",borderRadius:"3px 3px 0 0",height:Math.max(4,(d.conv/3)*80),transition:"height .3s" }} />
              <div style={{ width:8,background:"#f59e0b",borderRadius:"3px 3px 0 0",height:Math.max(4,(d.spend/maxVal)*80),transition:"height .3s" }} />
            </div>
            <div style={{ fontSize:10,color:"rgba(255,255,255,.3)",fontWeight:600 }}>{d.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Campaign Alerts/Notifications ── */

/* ── Campaign Alerts/Notifications ── */
export function CampaignAlerts({ campaign }) {
  const alerts = [
    { type:"success", icon:"\u2705", text:"Ad approved by Google", time:"2 hours ago", color:"#10b981" },
    { type:"info", icon:"\u{1F389}", text:"First click received! Someone from New York searched 'luxury bedding'", time:"Yesterday", color:"#6366f1" },
    { type:"warning", icon:"\u26A0\uFE0F", text:"Budget depleted at 2:14 PM yesterday. Consider increasing to $35/day", time:"Yesterday", color:"#f59e0b" },
    { type:"info", icon:"\u{1F4C8}", text:"Quality Score improved from 7 to " + (campaign.performance.qualityScore || 8), time:"3 days ago", color:"#3b82f6" },
  ];
  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>Notifications</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",background:a.color+"08",border:"1px solid "+a.color+"18",borderRadius:10 }}>
            <span style={{ fontSize:14,flexShrink:0,marginTop:1 }}>{a.icon}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13,color:"rgba(255,255,255,.75)",fontWeight:500,lineHeight:1.5 }}>{a.text}</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.25)",marginTop:3 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Export Report Button ── */

/* ── Export Report Button ── */
export function ExportButton() {
  return (
    <button onClick={() => alert("Report export coming soon!")} style={{
      fontSize:12,fontWeight:600,color:"rgba(255,255,255,.5)",
      background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",
      borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",
      display:"flex",alignItems:"center",gap:6
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export
    </button>
  );
}
