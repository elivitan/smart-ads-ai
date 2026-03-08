filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\MarketAlert.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

old1 = "setIntel(prev => prev ? prev : {"
new1 = "setIntel(prev => (prev && !prev._quickOnly) ? prev : {"
if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Fix 1 OK")
else:
    print("Fix 1 not found")

old2 = "fetchQuickSignal();\n  }, []);"
new2 = "if (!intel || intel._quickOnly) fetchQuickSignal();\n  }, []);"
if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Fix 2 OK")
else:
    print("Fix 2 not found")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("DONE")
