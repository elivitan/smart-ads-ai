import re

path = r'app\routes\app.campaigns.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ── Fix 1: Replace all broken Unicode escapes with actual emoji ──
emoji_map = {
    '"\\U0001F680"': '"\U0001F680"',
    '"\\U0001F50D"': '"\U0001F50D"',
    '"\\U0001F4B0"': '"\U0001F4B0"',
    '"\\U0001F511"': '"\U0001F511"',
    '"\\U0001F4E2"': '"\U0001F4E2"',
    '"\\U0001F4C4"': '"\U0001F4C4"',
    '"\\U0001F6CD\\uFE0F"': '"\U0001F6CD\uFE0F"',
    '"\\U0001F6CF\\uFE0F"': '"\U0001F6CF\uFE0F"',
    '"\\U0001F4BE"': '"\U0001F4BE"',
    '"\\U0001F916"': '"\U0001F916"',
    '"\\u26A1"': '"\u26A1"',
    '"\\u23F3"': '"\u23F3"',
    '"\\u00D7"': '"\u00D7"',
    '"\\uFF0B"': '"\uFF0B"',
    '"\\u2014"': '"\u2014"',
    '"\\u00B7"': '"\u00B7"',
    '"\\u25B6"': '"\u25B6"',
    '"\\u23F8"': '"\u23F8"',
    '"\\u270F\\uFE0F"': '"\u270F\uFE0F"',
    '"\\u2192"': '"\u2192"',
    '"\\u2013"': '"\u2013"',
}

for old, new in emoji_map.items():
    content = content.replace(old, new)

# Also fix any remaining raw escape sequences that might appear without quotes
raw_escapes = {
    '\\U0001F680': '\U0001F680',
    '\\U0001F50D': '\U0001F50D',
    '\\U0001F4B0': '\U0001F4B0',
    '\\U0001F511': '\U0001F511',
    '\\U0001F4E2': '\U0001F4E2',
    '\\U0001F4C4': '\U0001F4C4',
    '\\U0001F6CD': '\U0001F6CD',
    '\\U0001F6CF': '\U0001F6CF',
    '\\U0001F4BE': '\U0001F4BE',
    '\\U0001F916': '\U0001F916',
    '\\u26A1': '\u26A1',
    '\\u23F3': '\u23F3',
    '\\u00D7': '\u00D7',
    '\\uFF0B': '\uFF0B',
    '\\u2014': '\u2014',
    '\\u00B7': '\u00B7',
    '\\u25B6': '\u25B6',
    '\\u23F8': '\u23F8',
    '\\u270F': '\u270F',
    '\\uFE0F': '\uFE0F',
    '\\u2192': '\u2192',
    '\\u2013': '\u2013',
}

for old, new in raw_escapes.items():
    content = content.replace(old, new)

# ── Fix 2: Better AUTO mode visual - add blue "AI MANAGED" header bar ──
# Find the auto mode section and add a prominent header
old_auto_keywords = '''      {/* ═══════════════ AUTO MODE ═══════════════ */}
      {mode === "auto" && (
        <>
          {/* Keywords read-only grid */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>'''

new_auto_keywords = '''      {/* ═══════════════ AUTO MODE ═══════════════ */}
      {mode === "auto" && (
        <>
          {/* AI Managed Banner */}
          <div style={{ background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",border:"2px solid #c7d2fe",borderRadius:14,padding:"14px 20px",display:"flex",alignItems:"center",gap:12 }}>
            <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",fontWeight:800 }}>\U0001F916</div>
            <div>
              <div style={{ fontSize:14,fontWeight:700,color:"#4338ca" }}>AI-Managed Campaign</div>
              <div style={{ fontSize:12,color:"#6366f1" }}>Keywords, bids & ad copy are optimized automatically by Smart Ads AI</div>
            </div>
          </div>

          {/* Keywords read-only grid */}
          <div style={{ background:"#fff",border:"1px solid #f1f5f9",borderRadius:16,padding:"20px 24px",boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ fontSize:11,fontWeight:700,color:"#94a3b8",letterSpacing:1.5,textTransform:"uppercase",marginBottom:14 }}>'''

content = content.replace(old_auto_keywords, new_auto_keywords)

# ── Fix 3: Better MANUAL mode visual - add orange "YOU CONTROL" header ──
old_manual_start = '''      {/* ═══════════════ MANUAL MODE ═══════════════ */}
      {mode === "manual" && (
        <>
          {/* \u2500\u2500 1. DAILY BUDGET \u2500\u2500 */}'''

new_manual_start = '''      {/* ═══════════════ MANUAL MODE ═══════════════ */}
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

          {/* \u2500\u2500 1. DAILY BUDGET \u2500\u2500 */}'''

content = content.replace(old_manual_start, new_manual_start)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    final = f.read()

print(f"Done! File size: {len(final):,} bytes")
print(f"Lines: {final.count(chr(10)) + 1}")
print(f"Has robot emoji: {chr(0x1F916) in final}")
print(f"Has AI-Managed: {'AI-Managed Campaign' in final}")
print(f"Has Manual Control: {'Manual Control Mode' in final}")
