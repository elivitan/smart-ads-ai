filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app._index.jsx"
with open(filepath, "rb") as f:
    raw = f.read()
content = raw.decode("utf-8", errors="replace")

old = 'className="p-card-cta">{canPublish?"View & Launch'
if old not in content:
    print("ERROR: Pattern not found")
else:
    idx = content.index(old)
    line_start = content.rfind("\n", 0, idx) + 1
    line_end = content.index("\n", idx)
    old_line = content[line_start:line_end]
    print("Found line:", old_line.strip()[:80])
    
    new_line = '                        <div style={{display:"flex",gap:6,alignItems:"center"}}><a href="/app/campaigns" onClick={e=>e.stopPropagation()} className="p-card-cta" style={{flex:1,textDecoration:"none",color:"inherit"}}>Manage Campaigns</a></div>'
    
    content = content[:line_start] + new_line + "\n" + content[line_end:]
    with open(filepath, "wb") as f:
        f.write(content.encode("utf-8", errors="replace"))
    print("SUCCESS: Product card CTA now links to campaigns page")
