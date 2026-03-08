path = r'app\routes\app.campaigns.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the AUTO MODE section start and end
auto_start = None
auto_end = None
for i, line in enumerate(lines):
    if 'AUTO MODE' in line and '\u2550' in line:
        auto_start = i
    if auto_start is not None and i > auto_start and 'PRODUCTS (always read-only)' in line:
        auto_end = i
        break

if auto_start is None or auto_end is None:
    print(f"ERROR: Could not find AUTO section. start={auto_start}, end={auto_end}")
    exit(1)

print(f"Found AUTO section: lines {auto_start+1} to {auto_end+1}")

new_auto = '''      {/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 AUTO MODE \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */}
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

          {/* Recent AI Actions - activity log */}
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

'''

# Replace lines from auto_start to auto_end (exclusive)
new_lines = lines[:auto_start] + [new_auto] + lines[auto_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

final = open(path, 'r', encoding='utf-8').read()
print(f"Done! File: {len(final):,} bytes, {final.count(chr(10))+1} lines")
print(f"Has Campaign Assets: {'Campaign Assets' in final}")
print(f"Has AI Performance: {'AI Performance Insights' in final}")
print(f"Has Recent AI Actions: {'Recent AI Actions' in final}")
