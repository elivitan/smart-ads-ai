import { useState, useEffect } from "react";
import { CharInput, BudgetSlider } from "./shared";
import { GoogleAdsPreview } from "./GoogleAdsPreview";


export function WizardProgress({ currentStep, totalSteps, steps }) {
  const pct = ((currentStep) / totalSteps) * 100;
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <span style={{ fontSize:13,fontWeight:700,color:"#fff" }}>Step {currentStep + 1} of {totalSteps}</span>
        <span style={{ fontSize:13,fontWeight:700,color:"#6366f1" }}>{Math.round(pct)}% complete</span>
      </div>
      <div style={{ height:6,background:"rgba(255,255,255,.06)",borderRadius:3,overflow:"hidden",marginBottom:12 }}>
        <div style={{ width:pct+"%",height:"100%",background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:3,transition:"width .4s ease" }} />
      </div>
      <div style={{ display:"flex",gap:4 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ flex:1,height:3,borderRadius:2,background:i<currentStep?"#6366f1":i===currentStep?"#8b5cf6":"rgba(255,255,255,.08)",transition:"background .3s" }} />
        ))}
      </div>
    </div>
  );
}



export function AIRecommendation({ text, tip }) {
  return (
    <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.05))",border:"1px solid rgba(99,102,241,.2)",borderRadius:14,padding:"16px 20px",marginBottom:20,display:"flex",gap:14 }}>
      <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>{"\u{1F9E0}"}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13,fontWeight:700,color:"#a5b4fc",marginBottom:4 }}>AI Recommendation</div>
        <div style={{ fontSize:14,color:"rgba(255,255,255,.7)",lineHeight:1.6 }}>{text}</div>
        {tip && <div style={{ fontSize:12,color:"rgba(255,255,255,.3)",marginTop:8,fontStyle:"italic" }}>{tip}</div>}
      </div>
    </div>
  );
}



export function GoogleGlossary({ terms }) {
  return (
    <div style={{ marginTop:20,padding:"12px 16px",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.04)",borderRadius:10 }}>
      <div style={{ fontSize:10,fontWeight:700,color:"rgba(255,255,255,.25)",letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>Google Ads terminology</div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:8 }}>
        {terms.map((t, i) => (
          <span key={i} style={{ fontSize:11,color:"rgba(255,255,255,.3)" }}>{t.simple} = <span style={{ color:"rgba(255,255,255,.2)",fontStyle:"italic" }}>{t.google}</span></span>
        ))}
      </div>
    </div>
  );
}



export function WizardNav({ step, totalSteps, onBack, onNext, onSaveDraft, nextLabel, nextDisabled }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:24,paddingTop:16,borderTop:"1px solid rgba(255,255,255,.06)" }}>
      <div style={{ display:"flex",gap:8 }}>
        {step > 0 && <button onClick={onBack} style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,.5)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit" }}>{"\u2190"} Back</button>}
        <button onClick={onSaveDraft} style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,.35)",background:"none",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 16px",cursor:"pointer",fontFamily:"inherit" }}>Save Draft</button>
      </div>
      <button onClick={nextDisabled?undefined:onNext} style={{ fontSize:14,fontWeight:700,color:nextDisabled?"rgba(255,255,255,.3)":"#fff",background:nextDisabled?"rgba(255,255,255,.06)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"12px 28px",cursor:nextDisabled?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:nextDisabled?"none":"0 4px 16px rgba(99,102,241,.3)" }}>
        {nextLabel || "Continue \u2192"}
      </button>
    </div>
  );
}


/* ── Confetti Animation ── */

/* ── Confetti Animation ── */
export function ConfettiCelebration() {
  const colors = ["#6366f1","#8b5cf6","#10b981","#f59e0b","#ec4899","#3b82f6","#ef4444","#14b8a6"];
  const particles = Array.from({length:60}, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 4 + Math.random() * 8,
    rotation: Math.random() * 360,
    type: Math.random() > 0.5 ? "circle" : "rect",
  }));
  return (
    <div style={{ position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:10 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position:"absolute",
          left: p.x + "%",
          top: "-5%",
          width: p.type === "circle" ? p.size : p.size * 0.6,
          height: p.size,
          background: p.color,
          borderRadius: p.type === "circle" ? "50%" : "2px",
          transform: "rotate(" + p.rotation + "deg)",
          animation: "confettiFall " + p.duration + "s ease-in " + p.delay + "s forwards",
          opacity: 0.9,
        }} />
      ))}
    
        {onCancel && <button onClick={onCancel} style={{marginTop:24,padding:"10px 28px",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,color:"rgba(255,255,255,.5)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>✕ Cancel</button>}
      </div>
  );
}

/* ── Campaign Success Screen (shared by auto + manual) ── */

/* ── Campaign Success Screen (shared by auto + manual) ── */
export function CampaignSuccessScreen({ onViewCampaign, onGoToDashboard }) {
  return (
    <div style={{ position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:500,padding:40,textAlign:"center" }}>
      <ConfettiCelebration />
      {/* Success icon */}
      <div style={{ position:"relative",zIndex:2,width:96,height:96,borderRadius:24,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:28,boxShadow:"0 8px 32px rgba(16,185,129,.35)",animation:"successPop .5s ease" }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <div style={{ position:"relative",zIndex:2,fontSize:32,fontWeight:900,color:"#fff",marginBottom:8 }}>Campaign Created!</div>
      <div style={{ position:"relative",zIndex:2,fontSize:16,color:"rgba(255,255,255,.6)",marginBottom:6,lineHeight:1.6 }}>Your campaign has been submitted to Google for review.</div>
      <div style={{ position:"relative",zIndex:2,fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:12 }}>Google typically approves ads within 1-2 business days.</div>
      {/* What happens next */}
      <div style={{ position:"relative",zIndex:2,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"20px 24px",marginBottom:28,maxWidth:440,width:"100%",textAlign:"left" }}>
        <div style={{ fontSize:13,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:12 }}>What happens next:</div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:24,height:24,borderRadius:12,background:"rgba(99,102,241,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <span style={{ fontSize:12,fontWeight:800,color:"#6366f1" }}>1</span>
            </div>
            <span style={{ fontSize:13,color:"rgba(255,255,255,.6)" }}>Google reviews your ad (1-2 business days)</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:24,height:24,borderRadius:12,background:"rgba(99,102,241,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <span style={{ fontSize:12,fontWeight:800,color:"#6366f1" }}>2</span>
            </div>
            <span style={{ fontSize:13,color:"rgba(255,255,255,.6)" }}>Your ad starts showing on Google Search</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:24,height:24,borderRadius:12,background:"rgba(16,185,129,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <span style={{ fontSize:12,fontWeight:800,color:"#10b981" }}>3</span>
            </div>
            <span style={{ fontSize:13,color:"rgba(255,255,255,.6)" }}>You start getting clicks and sales!</span>
          </div>
        </div>
      </div>
      <div style={{ position:"relative",zIndex:2,display:"flex",gap:12 }}>
        <button onClick={onViewCampaign} style={{ fontSize:14,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"14px 28px",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(99,102,241,.3)" }}>
          View Campaign
        </button>
        <a href="/app" style={{ fontSize:14,fontWeight:700,color:"rgba(255,255,255,.5)",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"14px 24px",cursor:"pointer",fontFamily:"inherit",textDecoration:"none",display:"inline-flex",alignItems:"center" }}>
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}



export function CampaignCreatingAnimation({ onComplete, onCancel }) {
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState(0);
  const tasks = [
    { label:"Analyzing your products...", icon:"\u{1F50D}" },
    { label:"Building ad groups...", icon:"\u{1F4E6}" },
    { label:"Setting up keywords and bids...", icon:"\u{1F3AF}" },
    { label:"Creating ad copy variations...", icon:"\u270D\uFE0F" },
    { label:"Configuring targeting...", icon:"\u{1F465}" },
    { label:"Setting budget strategy...", icon:"\u{1F4B0}" },
    { label:"Submitting to Google Ads...", icon:"\u{1F680}" },
  ];
  useEffect(() => {
    let p = 0;
    let cancelled = false;
    /* Variable speed per phase - some tasks take longer */
    const speeds = [
      { until:8, interval:200 },   /* Analyzing products - slow start */
      { until:22, interval:180 },  /* Building ad groups */
      { until:40, interval:150 },  /* Keywords & bids - medium */
      { until:55, interval:160 },  /* Creating ad copy */
      { until:68, interval:200 },  /* Configuring targeting - slower */
      { until:82, interval:140 },  /* Budget strategy */
      { until:100, interval:250 }, /* Submitting to Google - slowest */
    ];
    let phase = 0;
    const tick = () => {
      if (cancelled) return;
      if (p >= 100) { setTimeout(() => onComplete && onComplete(), 1200); return; }
      while (phase < speeds.length - 1 && p >= speeds[phase].until) phase++;
      p += 1;
      setProgress(p);
      setCurrentTask(Math.min(Math.floor(p / 15), tasks.length - 1));
      setTimeout(tick, speeds[phase].interval + Math.random() * 80);
    };
    setTimeout(tick, 600); /* initial pause before starting */
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,padding:40,textAlign:"center" }}>
      <div style={{ position:"relative",width:120,height:120,marginBottom:32 }}>
        <svg width="120" height="120" style={{ transform:"rotate(-90deg)",animation:"pulse 2s ease infinite" }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="6" />
          <circle cx="60" cy="60" r="52" fill="none" stroke="#6366f1" strokeWidth="6" strokeLinecap="round" strokeDasharray={327} strokeDashoffset={327-(progress/100)*327} style={{ transition:"stroke-dashoffset .3s" }} />
        </svg>
        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <span style={{ fontSize:28,fontWeight:900,color:"#fff" }}>{progress}%</span>
        </div>
      </div>
      <div style={{ fontSize:22,fontWeight:800,color:"#fff",marginBottom:8 }}>Creating Your Campaign</div>
      <div style={{ fontSize:15,color:"rgba(255,255,255,.5)",marginBottom:32 }}>Please wait while we set everything up...</div>
      <div style={{ display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:400 }}>
        {tasks.map((task, i) => {
          const done = i < currentTask; const active = i === currentTask;
          return (
            <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:active?"rgba(99,102,241,.08)":"transparent",borderRadius:10 }}>
              <span style={{ fontSize:16,opacity:done||active?1:0.3 }}>{task.icon}</span>
              <span style={{ fontSize:13,color:done?"#10b981":active?"#fff":"rgba(255,255,255,.25)",fontWeight:active?700:400 }}>{task.label}</span>
              {done && <span style={{ marginLeft:"auto",fontSize:12,color:"#10b981",fontWeight:700 }}>{"\u2713"}</span>}
              {active && <span style={{ marginLeft:"auto",width:16,height:16,border:"2px solid #6366f1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .8s linear infinite" }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CampaignWizard({ campaign, onComplete, onCancel }) {
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [goal, setGoal] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [audience, setAudience] = useState({ age:"25-54", gender:"all", location:"United States" });
  const [budget, setBudget] = useState(30);
  const [wizKeywords] = useState([
    { text:"luxury bedding sets", bid:1.20, volume:"High" },
    { text:"cotton duvet cover queen", bid:0.95, volume:"Medium" },
    { text:"bamboo pillow case", bid:0.80, volume:"High" },
    { text:"microfiber sheets king", bid:0.75, volume:"Medium" },
    { text:"soft bedding online", bid:0.60, volume:"Low" },
  ]);
  const [wizHeadlines] = useState(["Premium Bedding \u2014 Shop Now","Luxury Cotton Sheets & Covers","Free Shipping on All Orders","Soft Duvet Covers From $49","Top-Rated Bedding Store","Transform Your Bedroom Today"]);
  const [wizDescriptions] = useState(["Transform your bedroom with our luxury bedding collection. Soft, durable, and beautiful.","Shop premium cotton duvets, bamboo pillows & more. Fast US shipping."]);
  const [finalUrl, setFinalUrl] = useState("https://textilura.com/collections/bedding");
  const [dp1, setDp1] = useState("shop");
  const [dp2, setDp2] = useState("bedding");

  const allProducts = [
    { id:"p1", title:"Luxury Cotton Duvet Cover", price:89, margin:42 },
    { id:"p2", title:"Bamboo Pillow Set", price:49, margin:28 },
    { id:"p3", title:"Microfiber Sheet Set", price:39, margin:22 },
    { id:"p4", title:"Memory Foam Pillow King", price:59, margin:32 },
    { id:"p5", title:"Down Alternative Pillow", price:45, margin:25 },
    { id:"p6", title:"Silk Pillowcase Set", price:34, margin:19 },
  ];

  const steps = ["Goal","Products","Audience","Budget","Keywords","Headlines","Descriptions","Links","Review"];
  const totalSteps = steps.length;
  const estClicks = Math.round(budget / 1.3);
  const estConv = Math.round(estClicks * 7 * 0.035);
  const estRev = estConv * 65;
  const estMonth = budget * 30;
  const score = Math.min(100, Math.round((goal?10:0) + Math.min(20,selectedProducts.length*7) + 5 + (budget>=15?10:0) + (budget>=30?5:0) + Math.min(15,wizKeywords.length*3) + Math.min(15,wizHeadlines.length*2.5) + Math.min(10,wizDescriptions.length*5) + (finalUrl?5:0)));

  if (creating) return <CampaignCreatingAnimation onComplete={() => {setCreating(false);setCreated(true);}} />;
  if (created) return (
    <CampaignSuccessScreen onViewCampaign={onComplete} />
  );

  return (
    <div style={{ padding:"24px 0",maxWidth:720,margin:"0 auto" }}>
      <WizardProgress currentStep={step} totalSteps={totalSteps} steps={steps} />

      {step===0 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>What do you want to achieve?</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>This helps us build the right strategy for you.</p>
        <AIRecommendation text="For a new store in the bedding niche, we recommend 'Get Sales' \u2014 it focuses your budget on people ready to buy." tip="Most successful Shopify stores start here." />
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {[{id:"sales",icon:"\u{1F4B0}",title:"Get Sales",desc:"Show ads to people ready to buy. Best for products $20+.",tag:"Recommended"},{id:"traffic",icon:"\u{1F465}",title:"Get Traffic",desc:"Bring visitors to build awareness and collect data."},{id:"leads",icon:"\u{1F4E7}",title:"Get Leads",desc:"Collect emails and signups for high-ticket items."}].map(g=>(
            <div key={g.id} onClick={()=>setGoal(g.id)} style={{ display:"flex",alignItems:"center",gap:16,padding:"18px 20px",background:goal===g.id?"rgba(99,102,241,.1)":"rgba(255,255,255,.03)",border:goal===g.id?"2px solid #6366f1":"2px solid rgba(255,255,255,.06)",borderRadius:16,cursor:"pointer",transition:"all .2s" }}>
              <div style={{ width:44,height:44,borderRadius:12,background:goal===g.id?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20 }}>{g.icon}</div>
              <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{g.title}</div><div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginTop:2}}>{g.desc}</div></div>
              {g.tag&&<span style={{fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.12)",padding:"3px 10px",borderRadius:6}}>{g.tag}</span>}
              {goal===g.id&&<div style={{width:20,height:20,borderRadius:10,background:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff"}}>{"\u2713"}</div>}
            </div>
          ))}
        </div>
        <GoogleGlossary terms={[{simple:"Get Sales",google:"Maximize Conversions"},{simple:"Get Traffic",google:"Maximize Clicks"}]} />
        {/* Quick Launch */}
        <div style={{ marginTop:16,textAlign:"center" }}>
          <button onClick={()=>setStep(8)} style={{ fontSize:13,fontWeight:600,color:"rgba(255,255,255,.4)",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",textUnderlineOffset:3 }}>
            Skip all steps — let AI build everything and review before launch
          </button>
        </div>

        <WizardNav step={0} totalSteps={totalSteps} onNext={()=>setStep(1)} onSaveDraft={()=>{}} nextDisabled={!goal} />
      </div>)}

      {step===1 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Choose products to advertise</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>Pick the products you want to show in your ads.</p>
        <AIRecommendation text="We recommend these 3 products \u2014 they have the highest profit margin and search demand in the US market." tip="Based on SerpAPI competitor data and your product catalog." />
        <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
          {allProducts.map(p=>{const sel=selectedProducts.includes(p.id);const rec=["p1","p2","p4"].includes(p.id);return(
            <div key={p.id} onClick={()=>setSelectedProducts(sel?selectedProducts.filter(x=>x!==p.id):[...selectedProducts,p.id])} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 18px",background:sel?"rgba(99,102,241,.08)":"rgba(255,255,255,.02)",border:sel?"1.5px solid rgba(99,102,241,.3)":"1.5px solid rgba(255,255,255,.06)",borderRadius:14,cursor:"pointer" }}>
              <div style={{ width:24,height:24,borderRadius:6,border:sel?"none":"2px solid rgba(255,255,255,.15)",background:sel?"#6366f1":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff" }}>{sel?"\u2713":""}</div>
              <div style={{ width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,rgba(99,102,241,.12),rgba(99,102,241,.06))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>{"\u{1F6CF}\uFE0F"}</div>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600,color:"#fff"}}>{p.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>${p.price} {"\u00B7"} ${p.margin} profit</div></div>
              {rec&&<span style={{fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.1)",padding:"3px 8px",borderRadius:5}}>AI Pick</span>}
            </div>
          );})}
        </div>
        <div style={{marginTop:12,fontSize:13,color:"rgba(255,255,255,.35)"}}>{selectedProducts.length} products selected</div>
        <WizardNav step={1} totalSteps={totalSteps} onBack={()=>setStep(0)} onNext={()=>setStep(2)} onSaveDraft={()=>{}} nextDisabled={selectedProducts.length===0} />
      </div>)}

      {step===2 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Who do you want to reach?</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>Tell us about your ideal customer.</p>
        <AIRecommendation text="For bedding in the US, your ideal buyer is women aged 25-54 interested in Home and Garden. We have pre-set this for you." />
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14 }}>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8}}>Location</div><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>{"\u{1F1FA}\u{1F1F8}"} United States</div></div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8}}>Age Range</div><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>25-54</div></div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8}}>Gender</div>
            <div style={{display:"flex",gap:8}}>{["all","female","male"].map(g=>(<button key={g} onClick={()=>setAudience({...audience,gender:g})} style={{fontSize:12,fontWeight:audience.gender===g?700:500,color:audience.gender===g?"#fff":"rgba(255,255,255,.35)",background:audience.gender===g?"#6366f1":"rgba(255,255,255,.06)",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize"}}>{g==="all"?"All":g}</button>))}</div>
          </div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}><div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8}}>Interests</div><span style={{fontSize:12,color:"#a5b4fc",background:"rgba(99,102,241,.1)",padding:"4px 10px",borderRadius:6}}>Home & Garden</span></div>
        </div>
        <GoogleGlossary terms={[{simple:"People you want to reach",google:"Target Audience"},{simple:"Interests",google:"Affinity Audiences"}]} />
        <WizardNav step={2} totalSteps={totalSteps} onBack={()=>setStep(1)} onNext={()=>setStep(3)} onSaveDraft={()=>{}} />
      </div>)}

      {step===3 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Set your daily ad budget</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>How much do you want to spend per day?</p>
        <AIRecommendation text={"For the US bedding market with "+selectedProducts.length+" products, we recommend $25-40/day. Below $15, Google won't get enough data to optimize."} tip="Your competitor BeddingCo spends ~$70/day. You can compete with $30/day using AI." />
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:4}}>
            <span style={{fontSize:24,fontWeight:700,color:"#6366f1"}}>$</span>
            <span style={{fontSize:64,fontWeight:900,color:"#fff",letterSpacing:"-3px",lineHeight:1}}>{budget}</span>
            <span style={{fontSize:16,color:"rgba(255,255,255,.35)"}}>/ day</span>
          </div>
        </div>
        <BudgetSlider value={budget} onChange={setBudget} />

        {/* Competitor budget comparison */}
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"14px 18px",marginTop:16}}>
          <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:10}}>How you compare to competitors:</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:budget,height:8,background:"linear-gradient(90deg,#6366f1,#8b5cf6)",borderRadius:4,transition:"flex .3s"}} />
            <div style={{flex:70-budget>0?70-budget:0,height:8,background:"rgba(239,68,68,.2)",borderRadius:4}} />
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:11,color:"#6366f1",fontWeight:600}}>You: ${budget}/day</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>BeddingCo: $70/day</span>
          </div>
        </div>

        <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:16,padding:20,marginTop:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"#34d399",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>What you can expect</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#fff"}}>~{estClicks}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>visitors/day</div><div style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>People clicking your ad</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#10b981"}}>~{estConv}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>sales/week</div><div style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>Estimated purchases</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#6366f1"}}>${estRev}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>revenue/week</div><div style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>From ad sales</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:24,fontWeight:900,color:"#f59e0b"}}>${estMonth}</div><div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>total/month</div><div style={{fontSize:10,color:"rgba(255,255,255,.2)"}}>Your ad spend</div></div>
          </div>
        </div>
        <GoogleGlossary terms={[{simple:"Daily ad budget",google:"Daily Budget"},{simple:"Sales",google:"Conversions"}]} />
        <WizardNav step={3} totalSteps={totalSteps} onBack={()=>setStep(2)} onNext={()=>setStep(4)} onSaveDraft={()=>{}} />
      </div>)}

      {step===4 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Words that trigger your ad</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>When people search these words on Google, they will see your ad.</p>
        <AIRecommendation text="We picked these keywords based on what your competitors advertise and what people actually search for." tip="BeddingCo spends ~$2,100/month on similar keywords. AI helps you compete with less." />
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {wizKeywords.map((kw,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12}}>
              <span style={{flex:1,fontSize:14,color:"#fff",fontWeight:500}}>{kw.text}</span>
              <span style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>${kw.bid.toFixed(2)} per click</span>
              <span style={{fontSize:10,fontWeight:700,color:kw.volume==="High"?"#10b981":kw.volume==="Medium"?"#f59e0b":"rgba(255,255,255,.3)",background:kw.volume==="High"?"rgba(16,185,129,.1)":kw.volume==="Medium"?"rgba(245,158,11,.1)":"rgba(255,255,255,.05)",padding:"3px 8px",borderRadius:5}}>{kw.volume} demand</span>
            </div>
          ))}
        </div>
        {/* Add keyword */}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <input placeholder="Add a keyword..." style={{flex:1,fontSize:14,border:"2px dashed rgba(255,255,255,.12)",borderRadius:12,padding:"10px 14px",fontFamily:"inherit",outline:"none",color:"#fff",background:"rgba(255,255,255,.04)"}} />
          <button style={{fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit"}}>+ Add</button>
        </div>

        <GoogleGlossary terms={[{simple:"Words that trigger your ad",google:"Keywords"},{simple:"Cost per click",google:"CPC"}]} />
        <WizardNav step={4} totalSteps={totalSteps} onBack={()=>setStep(3)} onNext={()=>setStep(5)} onSaveDraft={()=>{}} />
      </div>)}

      {step===5 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Write your ad headlines</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>The clickable blue titles people see. Google mixes them to find the best combo.</p>
        <AIRecommendation text="We wrote 6 headlines for you. Headlines with prices ('From $49') and offers ('Free Shipping') get 23% more clicks." tip="Google needs at least 3, recommends up to 15." />
        {wizHeadlines.map((h,i)=>(<CharInput key={"wh"+i} defaultValue={h} maxLen={30} placeholder={"Headline "+(i+1)} />))}
        <div style={{fontSize:13,color:"rgba(255,255,255,.35)",marginTop:4}}>{wizHeadlines.length} headlines</div>
        <GoogleGlossary terms={[{simple:"Headlines",google:"RSA Headlines"},{simple:"30 char limit",google:"Character limit"}]} />
        <WizardNav step={5} totalSteps={totalSteps} onBack={()=>setStep(4)} onNext={()=>setStep(6)} onSaveDraft={()=>{}} />
      </div>)}

      {step===6 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Write your ad descriptions</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>The text below your headline. Tell people why they should click.</p>
        <AIRecommendation text="Including 'Free Shipping' boosts clicks by 15% for US shoppers. Trust signals like '10,000+ customers' also help." />
        {wizDescriptions.map((d,i)=>(<CharInput key={"wd"+i} defaultValue={d} maxLen={90} tag="textarea" placeholder={"Description "+(i+1)} />))}
        <div style={{fontSize:13,color:"rgba(255,255,255,.35)",marginTop:4}}>{wizDescriptions.length} descriptions</div>
        <WizardNav step={6} totalSteps={totalSteps} onBack={()=>setStep(5)} onNext={()=>setStep(7)} onSaveDraft={()=>{}} />
      </div>)}

      {step===7 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Set your landing page and extras</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>Where people go after clicking, plus extra links.</p>
        <AIRecommendation text="We set your landing page to your bedding collection. The extra links make your ad bigger and more clickable." />
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8}}>Landing page (where people go after clicking)</div>
            <input value={finalUrl} onChange={e=>setFinalUrl(e.target.value)} style={{width:"100%",fontSize:14,color:"#fff",background:"#0f0f23",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:10,padding:"10px 14px",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}} />
          </div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:8}}>Display URL path</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>textilura.com /</span>
              <input value={dp1} onChange={e=>setDp1(e.target.value)} maxLength={15} style={{width:90,fontSize:14,color:"#6366f1",fontWeight:600,background:"#0f0f23",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:8,padding:"8px 10px",fontFamily:"inherit",outline:"none"}} />
              <span style={{color:"rgba(255,255,255,.4)"}}>/</span>
              <input value={dp2} onChange={e=>setDp2(e.target.value)} maxLength={15} style={{width:90,fontSize:14,color:"#6366f1",fontWeight:600,background:"#0f0f23",border:"1.5px solid rgba(255,255,255,.12)",borderRadius:8,padding:"8px 10px",fontFamily:"inherit",outline:"none"}} />
            </div>
          </div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:10}}>Extra ad links</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Shop Now","Free Shipping","New Arrivals","Best Sellers"].map((l,i)=>(<span key={i} style={{fontSize:13,color:"#6366f1",background:"rgba(99,102,241,.08)",padding:"6px 14px",borderRadius:8,border:"1px solid rgba(99,102,241,.15)"}}>{l}</span>))}</div>
          </div>
          <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 18px"}}>
            <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:10}}>Selling points</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{["Free Shipping Over $75","30-Day Returns","US-Based Support","Premium Quality"].map((c,i)=>(<span key={i} style={{fontSize:13,color:"#a5b4fc",background:"rgba(99,102,241,.06)",padding:"6px 12px",borderRadius:8}}>{c}</span>))}</div>
          </div>
        </div>
        <GoogleGlossary terms={[{simple:"Landing page",google:"Final URL"},{simple:"Extra links",google:"Sitelink Extensions"},{simple:"Selling points",google:"Callout Extensions"}]} />
        <WizardNav step={7} totalSteps={totalSteps} onBack={()=>setStep(6)} onNext={()=>setStep(8)} onSaveDraft={()=>{}} />
      </div>)}

      {step===8 && (<div className="wizard-step">
        <h2 style={{ fontSize:24,fontWeight:800,color:"#fff",margin:"0 0 4px" }}>Review and launch your campaign</h2>
        <p style={{ fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:20 }}>Everything looks good! Here is your summary.</p>
        <div style={{background:"linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.05))",border:"1px solid rgba(99,102,241,.2)",borderRadius:16,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",gap:20}}>
          <div style={{position:"relative",width:80,height:80,flexShrink:0}}>
            <svg width="80" height="80" style={{transform:"rotate(-90deg)"}}><circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="6"/><circle cx="40" cy="40" r="34" fill="none" stroke={score>=80?"#10b981":score>=60?"#f59e0b":"#ef4444"} strokeWidth="6" strokeLinecap="round" strokeDasharray={214} strokeDashoffset={214-(score/100)*214}/></svg>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:22,fontWeight:900,color:"#fff"}}>{score}</span></div>
          </div>
          <div><div style={{fontSize:16,fontWeight:700,color:"#fff"}}>Campaign Score: {score>=80?"Excellent":score>=60?"Good":"Needs work"}</div><div style={{fontSize:13,color:"rgba(255,255,255,.5)",marginTop:4}}>{score>=80?"Ready to launch!":"Add more headlines or increase budget to improve."}</div></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {[{l:"Goal",v:goal==="sales"?"Get Sales":goal==="traffic"?"Get Traffic":"Get Leads"},{l:"Products",v:selectedProducts.length+" selected"},{l:"Budget",v:"$"+budget+"/day (~$"+estMonth+"/mo)"},{l:"Keywords",v:wizKeywords.length+" keywords"},{l:"Headlines",v:wizHeadlines.length+" headlines"},{l:"Descriptions",v:wizDescriptions.length+" descriptions"}].map((item,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12}}>
              <div><div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>{item.l}</div><div style={{fontSize:14,fontWeight:600,color:"#fff"}}>{item.v}</div></div>
            </div>
          ))}
        </div>
        {/* Ad Preview */}
        <GoogleAdsPreview headlines={wizHeadlines} descriptions={wizDescriptions} />

        <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:14,padding:"16px 20px",marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:700,color:"#34d399",marginBottom:10}}>What you can expect</div>
          <div style={{fontSize:14,color:"rgba(255,255,255,.6)",lineHeight:1.8}}>
            With ${budget}/day: <strong style={{color:"#fff"}}>~{estClicks} visitors/day</strong>, <strong style={{color:"#10b981"}}>~{estConv} sales/week</strong>, <strong style={{color:"#6366f1"}}>~${estRev} revenue/week</strong>
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"16px 20px",marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)",marginBottom:10}}>Monthly Cost</div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}><span style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>Google Ads budget</span><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>${estMonth}/mo</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}><span style={{fontSize:13,color:"rgba(255,255,255,.5)"}}>Smart Ads AI subscription</span><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>$29/mo</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}><span style={{fontSize:14,fontWeight:700,color:"#fff"}}>Total</span><span style={{fontSize:14,fontWeight:700,color:"#6366f1"}}>${estMonth+29}/mo</span></div>
        </div>
        <WizardNav step={8} totalSteps={totalSteps} onBack={()=>setStep(7)} onNext={()=>setCreating(true)} onSaveDraft={()=>{}} nextLabel={"\u{1F680} Launch Campaign"} />
      </div>)}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

