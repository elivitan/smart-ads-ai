filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app._index.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

old = """<div className="speedo-card"><Speedometer value={realCampaigns} max={20} label="Keyword Strength" color="#06b6d4" size={130}/></div>
            <div className="speedo-card"><Speedometer value={hasGoogleAds ? parseFloat(liveAds.roas||0)*10 : 0} max={100} label="Ad Readiness" color="#f59e0b" size={130}/></div>"""

new = """<div className="speedo-card"><Speedometer value={Math.min(Math.round(totalKeywords/analyzedCount*10)||0, 100)} max={100} label="Keyword Strength" color="#06b6d4" size={130}/></div>
            <div className="speedo-card"><Speedometer value={realCampaigns > 0 ? Math.min(realCampaigns * 25, 100) : (analyzedCount > 0 ? 25 : 0)} max={100} label="Ad Readiness" color="#f59e0b" size={130}/></div>"""

if old in content:
    content = content.replace(old, new, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Speedometers fixed")
    print("  - Keyword Strength: now based on keywords per product (136/17 = 80)")
    print("  - Ad Readiness: campaigns running = readiness level")
else:
    print("ERROR: Pattern not found")
