path = r'app\routes\app.campaigns.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find CharInput component start and end
charinput_start = None
charinput_end = None
for i, line in enumerate(lines):
    if 'function CharInput' in line:
        charinput_start = i
    if charinput_start is not None and i > charinput_start and line.strip() == '}' and lines[i-1].strip() == ');}':
        # Actually let's find it differently
        pass

# Better approach: find the CharInput function by looking for the closing }
charinput_start = None
charinput_brace_count = 0
charinput_end = None
for i, line in enumerate(lines):
    if 'function CharInput' in line:
        charinput_start = i
        charinput_brace_count = 0
    if charinput_start is not None and i >= charinput_start:
        charinput_brace_count += line.count('{') - line.count('}')
        if charinput_brace_count == 0 and i > charinput_start:
            charinput_end = i + 1
            break

print(f"CharInput: lines {charinput_start+1} to {charinput_end}")

# Find CampaignDetail function start
detail_start = None
for i, line in enumerate(lines):
    if 'function CampaignDetail' in line:
        detail_start = i
        break

# Find CampaignDetail function end - it ends right before "/* ── Main Component ── */"
detail_end = None
for i, line in enumerate(lines):
    if 'Main Component' in line:
        detail_end = i
        break

print(f"CampaignDetail: lines {detail_start+1} to {detail_end}")

# Build new CharInput
new_charinput = '''/* ── CharCounter input (improved) ── */
function CharInput({ defaultValue, maxLen, tag, placeholder }) {
  const [val, setVal] = useState(defaultValue || "");
  const remaining = maxLen - val.length;
  const isClose = remaining <= 5;
  const isOver = remaining < 0;
  const Tag = tag || "input";
  const pct = Math.min(100, (val.length / maxLen) * 100);
  return (
    <div style={{ position:"relative",marginBottom:10 }}>
      <Tag
        value={val}
        onChange={e => setVal(e.target.value)}
        maxLength={maxLen}
        placeholder={placeholder || ""}
        rows={tag === "textarea" ? 3 : undefined}
        style={{
          width:"100%",fontSize:14,color:"#1a1a2e",
          border:"2px solid "+(isOver?"#ef4444":isClose?"#f59e0b":"#e2e8f0"),
          borderRadius:12,padding:tag==="textarea"?"12px 14px":"12px 14px",
          fontFamily:"inherit",boxSizing:"border-box",
          outline:"none",fontWeight:500,resize:"none",lineHeight:1.5,
          background:"#fff",
          transition:"border-color .15s,box-shadow .15s"
        }}
        onFocus={e => { e.target.style.borderColor = isOver?"#ef4444":"#6366f1"; e.target.style.boxShadow = "0 0 0 3px rgba(99,102,241,.1)"; }}
        onBlur={e => { e.target.style.borderColor = isOver?"#ef4444":isClose?"#f59e0b":"#e2e8f0"; e.target.style.boxShadow = "none"; }}
      />
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:6,padding:"0 2px" }}>
        <div style={{ flex:1,height:3,background:"#f1f5f9",borderRadius:2,overflow:"hidden" }}>
          <div style={{ width:pct+"%",height:"100%",background:isOver?"#ef4444":isClose?"#f59e0b":pct>50?"#6366f1":"#10b981",borderRadius:2,transition:"width .2s" }} />
        </div>
        <span style={{
          fontSize:12,fontWeight:700,marginLeft:10,
          color:isOver?"#ef4444":isClose?"#f59e0b":"#94a3b8"
        }}>
          {val.length}/{maxLen}
        </span>
      </div>
    </div>
  );
}

'''

# Build new CampaignDetail
new_detail = '''/* ── Campaign Detail (main panel) ── */
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
    <div style={{ padding:"24px",overflowY:"auto",display:"flex",flexDirection:"column",gap:18 }}>

      {/* \u2500\u2500 HERO PANEL \u2500\u2500 */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",borderRadius:20,padding:"28px 32px",color:"#fff",position:"relative",overflow:"hidden" }}>
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
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <button onClick={() => setPaused(!paused)} style={{ fontSize:13,fontWeight:700,color:"#fff",background:paused?"#10b981":"rgba(255,255,255,.12)",border:"1px solid "+(paused?"#10b981":"rgba(255,255,255,.15)"),borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit",transition:"all .2s" }}>
              {paused ? "\u25B6 Resume" : "\u23F8 Pause"}
            </button>
            <button onClick={onSwitchMode} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"10px 18px",cursor:"pointer",fontFamily:"inherit" }}>
              {mode === "auto" ? "\u270F\uFE0F Manual" : "\U0001F916 Auto"}
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
            { value: p.clicks > 0 ? (p.clicks / p.impressions * 100).toFixed(1) + "%" : "\u2014", label: "CTR" },
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
        <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:12 }}>
          <span style={{ fontSize:20 }}>\u23F3</span>
          <div>
            <div style={{ fontSize:14,fontWeight:700,color:"#92400e" }}>Pending Google Review</div>
            <div style={{ fontSize:13,color:"#b45309" }}>Awaiting Google Ads approval \u2014 usually 1\u20132 business days.</div>
          </div>
        </div>
      )}

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 MANUAL MODE \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
      {mode === "manual" && (
        <>
          {/* Manual Control Banner */}
          <div style={{ background:"linear-gradient(135deg,#fff7ed,#ffedd5)",border:"2px solid #fed7aa",borderRadius:14,padding:"14px 20px",display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#f97316,#ea580c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:800 }}>\u270F\uFE0F</div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#c2410c" }}>Manual Control Mode</div>
              <div style={{ fontSize:12,color:"#ea580c" }}>You control budget, keywords, bids & ad copy directly</div>
            </div>
          </div>

          {/* 1. DAILY BUDGET */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"22px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>\U0001F4B0 Daily Budget</div>
            <div style={{ display:"flex",alignItems:"baseline",gap:6 }}>
              <span style={{ fontSize:20,fontWeight:700,color:"#6366f1" }}>$</span>
              <span style={{ fontSize:48,fontWeight:900,color:"#1a1a2e",letterSpacing:"-2px",lineHeight:1 }}>{budget}</span>
              <span style={{ fontSize:14,color:"#94a3b8",marginLeft:8 }}>/ day</span>
              <span style={{ fontSize:13,color:"#cbd5e1",marginLeft:4 }}>\u00B7 ~{"$"}{(budget * 30).toLocaleString()}/mo</span>
            </div>
            <BudgetSlider value={budget} onChange={setBudget} />
          </div>

          {/* 2. KEYWORDS */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"22px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>\U0001F511 Keywords ({keywords.length})</div>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {keywords.map((kw, i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:12 }}>
                  <span style={{ flex:1,fontSize:14,color:"#1a1a2e",fontWeight:600 }}>{kw.text}</span>
                  <div style={{ display:"flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,padding:"4px 8px" }}>
                    <span style={{ fontSize:12,color:"#94a3b8",fontWeight:600 }}>CPC $</span>
                    <input
                      type="number" step="0.05" min="0.05" max="50"
                      value={kw.bid}
                      onChange={e => updateBid(i, e.target.value)}
                      style={{ width:55,fontSize:14,fontWeight:700,color:"#6366f1",border:"none",background:"transparent",textAlign:"center",fontFamily:"inherit",outline:"none" }}
                    />
                  </div>
                  <button onClick={() => removeKeyword(i)} style={{ width:28,height:28,borderRadius:8,background:"#fee2e2",color:"#ef4444",border:"none",cursor:"pointer",fontSize:16,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontWeight:700 }}>\u00D7</button>
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
                style={{ flex:1,fontSize:14,border:"2px dashed #e2e8f0",borderRadius:12,padding:"10px 14px",fontFamily:"inherit",outline:"none",color:"#374151",background:"#fafafa" }}
              />
              <button onClick={addKeyword} style={{ fontSize:13,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,padding:"10px 20px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>\uFF0B Add</button>
            </div>
          </div>

          {/* 3. HEADLINES */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"22px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase" }}>\U0001F4E2 Headlines ({campaign.headlines.length})</div>
              <div style={{ fontSize:11,color:"#94a3b8" }}>Max 30 characters each</div>
            </div>
            {campaign.headlines.map((h, i) => (
              <CharInput key={"h"+i} defaultValue={h} maxLen={30} placeholder={"Headline " + (i+1)} />
            ))}
          </div>

          {/* 4. DESCRIPTIONS */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"22px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 }}>
              <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase" }}>\U0001F4C4 Descriptions ({campaign.descriptions.length})</div>
              <div style={{ fontSize:11,color:"#94a3b8" }}>Max 90 characters each</div>
            </div>
            {campaign.descriptions.map((d, i) => (
              <CharInput key={"d"+i} defaultValue={d} maxLen={90} tag="textarea" placeholder={"Description " + (i+1)} />
            ))}
          </div>
        </>
      )}

      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 AUTO MODE \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
      {mode === "auto" && (
        <>
          {/* AI Managed Banner */}
          <div style={{ background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",border:"2px solid #c7d2fe",borderRadius:14,padding:"16px 22px",display:"flex",alignItems:"center",gap:14 }}>
            <div style={{ width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",flexShrink:0 }}>\U0001F916</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15,fontWeight:700,color:"#4338ca" }}>AI-Managed Campaign</div>
              <div style={{ fontSize:13,color:"#6366f1",marginTop:2 }}>Smart Ads AI continuously optimizes your keywords, bids & ad copy for maximum ROAS</div>
            </div>
            <div style={{ background:"#6366f1",color:"#fff",fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:20,whiteSpace:"nowrap" }}>\u2713 Active</div>
          </div>

          {/* Campaign Assets Summary - 4 cards */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>\U0001F4CA Campaign Assets</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:12 }}>
              <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",borderRadius:14,padding:"18px 16px",textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#6366f1",marginBottom:4 }}>{campaign.keywords.length}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#8b5cf6",textTransform:"uppercase",letterSpacing:.5 }}>Keywords</div>
                <div style={{ fontSize:11,color:"#a78bfa",marginTop:4 }}>Auto-optimized</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,#eff6ff,#dbeafe)",borderRadius:14,padding:"18px 16px",textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#3b82f6",marginBottom:4 }}>{campaign.headlines.length}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#3b82f6",textTransform:"uppercase",letterSpacing:.5 }}>Headlines</div>
                <div style={{ fontSize:11,color:"#60a5fa",marginTop:4 }}>AI-generated</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:14,padding:"18px 16px",textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#16a34a",marginBottom:4 }}>{campaign.descriptions.length}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#16a34a",textTransform:"uppercase",letterSpacing:.5 }}>Descriptions</div>
                <div style={{ fontSize:11,color:"#4ade80",marginTop:4 }}>AI-crafted</div>
              </div>
              <div style={{ background:"linear-gradient(135deg,#fff7ed,#ffedd5)",borderRadius:14,padding:"18px 16px",textAlign:"center" }}>
                <div style={{ fontSize:28,fontWeight:900,color:"#ea580c",marginBottom:4 }}>{"$"}{campaign.budget}</div>
                <div style={{ fontSize:11,fontWeight:600,color:"#ea580c",textTransform:"uppercase",letterSpacing:.5 }}>Daily Budget</div>
                <div style={{ fontSize:11,color:"#fb923c",marginTop:4 }}>{"~$"}{(campaign.budget*30).toLocaleString()}/mo</div>
              </div>
            </div>
          </div>

          {/* AI Performance Insights */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>\u2728 AI Performance Insights</div>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",borderRadius:12,border:"1px solid #bbf7d0" }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"#16a34a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>\U0001F3AF</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#15803d" }}>Top Performing Keyword</div>
                  <div style={{ fontSize:13,color:"#16a34a",marginTop:2 }}>{campaign.keywords[0]?.text || "Analyzing..."} {"\u2014"} {"$"}{campaign.keywords[0]?.bid.toFixed(2)} CPC</div>
                </div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,#eff6ff,#dbeafe)",borderRadius:12,border:"1px solid #bfdbfe" }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>\U0001F4DD</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#1d4ed8" }}>Best Headline</div>
                  <div style={{ fontSize:13,color:"#3b82f6",marginTop:2 }}>{campaign.headlines[0] || "Testing variations..."}</div>
                </div>
              </div>
              <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"linear-gradient(135deg,#fefce8,#fef9c3)",borderRadius:12,border:"1px solid #fde68a" }}>
                <div style={{ width:32,height:32,borderRadius:8,background:"#eab308",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#fff",flexShrink:0 }}>\U0001F552</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:700,color:"#a16207" }}>Optimization Status</div>
                  <div style={{ fontSize:13,color:"#ca8a04",marginTop:2 }}>Last optimized: 2 hours ago {"\u00B7"} Next review: Tomorrow 9:00 AM</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent AI Actions */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:18 }}>\U0001F4CB Recent AI Actions</div>
            <div style={{ display:"flex",flexDirection:"column",gap:0 }}>
              {[
                { time:"2 hours ago", action:"Adjusted bid for \\"luxury bedding sets\\" from $1.10 to $1.20", icon:"\U0001F4B0" },
                { time:"Yesterday", action:"Added new headline: \\"Premium Bedding \u2014 Shop Now\\"", icon:"\U0001F4DD" },
                { time:"2 days ago", action:"Paused low-performing keyword: \\"cheap bedding\\"", icon:"\u23F8\uFE0F" },
                { time:"3 days ago", action:"Increased daily budget recommendation to $30/day", icon:"\U0001F4C8" },
              ].map((item, i) => (
                <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:12,padding:"12px 0",borderBottom:i < 3 ? "1px solid #f8fafc" : "none" }}>
                  <div style={{ width:28,height:28,borderRadius:7,background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:1 }}>{item.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,color:"#374151",fontWeight:500 }}>{item.action}</div>
                    <div style={{ fontSize:11,color:"#94a3b8",marginTop:3 }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* PRODUCTS (always read-only) */}
      <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>\U0001F6CD\uFE0F Products ({campaign.products.length})</div>
        <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
          {campaign.products.map(prod => (
            <div key={prod.id} style={{ display:"flex",alignItems:"center",gap:10,background:"#f8fafc",border:"1px solid #f1f5f9",borderRadius:12,padding:"10px 16px" }}>
              <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16 }}>\U0001F6CF\uFE0F</div>
              <span style={{ fontSize:13,fontWeight:600,color:"#374151" }}>{prod.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SAVE CHANGES (manual only) */}
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
            \U0001F4BE Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

'''

# Replace CharInput (lines charinput_start to charinput_end)
# Replace CampaignDetail (lines detail_start to detail_end)
# CharInput comes before CampaignDetail, so replace from end first

# Build new file
new_lines = []
new_lines.extend(lines[:charinput_start])  # everything before CharInput
new_lines.append(new_charinput)             # new CharInput
# skip old CharInput and old CampaignDetail
new_lines.append(new_detail)               # new CampaignDetail
new_lines.extend(lines[detail_end:])        # everything from Main Component onward

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

final = open(path, 'r', encoding='utf-8').read()
print(f"Done! File: {len(final):,} bytes, {final.count(chr(10))+1} lines")
print(f"Has CharInput: {'function CharInput' in final}")
print(f"Has CampaignDetail: {'function CampaignDetail' in final}")
print(f"Has BudgetSlider ref: {'BudgetSlider' in final}")
print(f"Has Manual Control: {'Manual Control Mode' in final}")
print(f"Has AI-Managed: {'AI-Managed Campaign' in final}")
print(f"Has Save Changes: {'Save Changes' in final}")
