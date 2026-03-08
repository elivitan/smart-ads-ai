filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app._index.jsx"
with open(filepath, "rb") as f:
    raw = f.read()
content = raw.decode("utf-8", errors="replace")

old = '''<div className="p-card-cta">{canPublish?"View & Launch \\u2192":"View AI Analysis \\u2192"}</div>'''
new = '''<div style={{display:"flex",gap:6}}><div className="p-card-cta" style={{flex:1}}>{canPublish?"View & Launch \\u2192":"View AI Analysis \\u2192"}</div>{canPublish && <a href="/app/campaigns" onClick={e=>e.stopPropagation()} style={{background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.3)",borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,color:"#a5b4fc",textDecoration:"none",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>{"\\uD83D\\uDCCA"} Campaigns</a>}</div>'''

if old in content:
    content = content.replace(old, new, 1)
    with open(filepath, "wb") as f:
        f.write(content.encode("utf-8", errors="replace"))
    print("SUCCESS: Added Campaigns link to product cards")
else:
    print("ERROR: Pattern not found")
    # Debug
    if "p-card-cta" in content:
        import re
        matches = [(m.start(), content[m.start():m.start()+100]) for m in re.finditer("p-card-cta", content)]
        for pos, txt in matches[:5]:
            print(f"  Found at {pos}: {txt}")
