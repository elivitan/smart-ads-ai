import sys

# Patch app.campaigns.jsx — update useLoaderData + add simulated banner
filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\app.campaigns.jsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. Update useLoaderData destructuring ──
old_destructure = '  const { campaigns } = useLoaderData();'
new_destructure = '  const { campaigns, isSimulated, marketSignal } = useLoaderData();'

if old_destructure not in content:
    print("ERROR: Could not find useLoaderData destructuring!")
    print("Looking for:", repr(old_destructure))
    sys.exit(1)

content = content.replace(old_destructure, new_destructure, 1)

# ── 2. Add simulated data banner after the hero section ──
# Find the line with "active · Google Ads" and add banner after its parent div
old_active_line = '{campaigns.length} active {"·"} Google Ads'
if old_active_line not in content:
    print("WARNING: Could not find active campaigns line for banner placement")
    print("Skipping banner, but destructuring was updated")
else:
    # Add the simulated banner right before the CampaignSidebar
    old_sidebar = '<CampaignSidebar campaigns={campaigns}'
    new_sidebar = '''{isSimulated && (
          <div style={{ background:"rgba(255,180,0,.12)", border:"1px solid rgba(255,180,0,.25)", borderRadius:12, padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>⚡</span>
            <span style={{ fontSize:13, color:"rgba(255,180,0,.9)", fontWeight:500 }}>Demo Mode — Connect Google Ads for real data</span>
          </div>
        )}
        {marketSignal && (
          <div style={{ background: marketSignal.signal === "green" ? "rgba(0,200,100,.08)" : marketSignal.signal === "yellow" ? "rgba(255,200,0,.08)" : "rgba(255,60,60,.08)", border: "1px solid " + (marketSignal.signal === "green" ? "rgba(0,200,100,.2)" : marketSignal.signal === "yellow" ? "rgba(255,200,0,.2)" : "rgba(255,60,60,.2)"), borderRadius:12, padding:"10px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:16 }}>{marketSignal.signal === "green" ? "🟢" : marketSignal.signal === "yellow" ? "🟡" : "🔴"}</span>
            <span style={{ fontSize:13, color:"rgba(255,255,255,.7)", fontWeight:500 }}>{marketSignal.signal_label}{marketSignal.holiday ? ` — ${marketSignal.holiday.name} in ${marketSignal.holiday.daysUntil} days` : ""}</span>
            {marketSignal.budget_multiplier !== 1.0 && <span style={{ fontSize:12, color:"rgba(168,85,247,.8)", fontWeight:600, marginLeft:"auto" }}>Budget: {marketSignal.budget_multiplier}x</span>}
          </div>
        )}
        <CampaignSidebar campaigns={campaigns}'''

    if old_sidebar in content:
        content = content.replace(old_sidebar, new_sidebar, 1)
        print("  + Added simulated banner + market signal banner")
    else:
        print("WARNING: Could not find CampaignSidebar for banner placement")

# ── 3. Verify ──
if 'isSimulated, marketSignal' in content:
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Component updated!")
    print("  - useLoaderData now includes isSimulated + marketSignal")
else:
    print("ERROR: Verification failed!")
    sys.exit(1)
