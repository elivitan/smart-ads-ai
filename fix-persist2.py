filepath = r"C:\Users\אלי\smart-ads-ai-backup\app\routes\MarketAlert.jsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the useState lines to use window cache
old_states = """const [intel, setIntel] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [showDetails, setShowDetails] = useState(false);"""

new_states = """const [intel, _setIntel] = useState(() => typeof window !== "undefined" && window.__marketIntel ? window.__marketIntel : null);
  const [rawData, _setRawData] = useState(() => typeof window !== "undefined" && window.__marketRaw ? window.__marketRaw : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(() => typeof window !== "undefined" && window.__marketTime ? new Date(window.__marketTime) : null);
  const [showDetails, setShowDetails] = useState(() => typeof window !== "undefined" && window.__marketIntel && !window.__marketIntel._quickOnly);

  function setIntel(val) {
    const resolved = typeof val === "function" ? val(intel) : val;
    if (typeof window !== "undefined") window.__marketIntel = resolved;
    _setIntel(resolved);
  }
  function setRawData(val) {
    if (typeof window !== "undefined") window.__marketRaw = val;
    _setRawData(val);
  }"""

if "const [intel, setIntel] = useState(null);" in content:
    content = content.replace(old_states, new_states, 1)

    # Also cache lastFetch
    old_fetch = "setLastFetch(new Date());"
    new_fetch = "const now = new Date(); if (typeof window !== 'undefined') window.__marketTime = now.toISOString(); setLastFetch(now);"
    content = content.replace(old_fetch, new_fetch)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Market data now persists across rerenders")
else:
    print("ERROR: Could not find state declarations")
