filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app.campaigns.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

old = 'fontSize:60,fontWeight:900,letterSpacing:"-3px"'
new = 'fontSize:42,fontWeight:800,letterSpacing:"-2px"'

if old not in content:
    print("ERROR: Could not find hero ROAS font size!")
else:
    content = content.replace(old, new, 1)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: ROAS hero font reduced from 60 to 42")
