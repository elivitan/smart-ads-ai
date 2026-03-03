import os

def fix_file(path, replacements):
    if not os.path.exists(path):
        print(f"  SKIP - file not found: {path}")
        return
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    changed = False
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            changed = True
            print(f"  FIXED: {old[:60]}...")
        else:
            print(f"  SKIP (not found): {old[:60]}...")
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  SAVED: {path}")
    else:
        print(f"  NO CHANGES: {path}")

print("=" * 50)
print("FIX 1: Speedometer - duplicate text + missing </svg>")
print("=" * 50)
fix_file("app/routes/app._index.jsx", [
    # Remove first duplicate text line
    (
        '<text x={cx} y={cy-14} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">{animated}</text>\n        <text x={cx} y={cy-8} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">{animated}</text>\n      <span',
        '<text x={cx} y={cy-10} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">{animated}</text>\n      </svg>\n      <span'
    ),
])

print()
print("=" * 50)
print("FIX 2: CampaignWizard - const inside destructuring")
print("=" * 50)
fix_file("app/components/CampaignWizard.jsx", [
    (
        """  editHeadlines: rawEditHeadlines,
  setEditHeadlines,
  // Enforce 30-char max on headlines from DB
  const editHeadlines = (rawEditHeadlines || []).map(h => h.trim().slice(0, 30));
  editDescriptions,
  setEditDescriptions,
  editSitelinks,
  setEditSitelinks,
  aiCredits,
  setAiCredits,
  improvingIdx,
  handleAiImprove,
  onClose,
  onLaunch,
}) {
  const strategy = normalizeStrategy(aiStrategy);""",
        """  editHeadlines: rawEditHeadlines,
  setEditHeadlines,
  editDescriptions,
  setEditDescriptions,
  editSitelinks,
  setEditSitelinks,
  aiCredits,
  setAiCredits,
  improvingIdx,
  handleAiImprove,
  onClose,
  onLaunch,
}) {
  // Enforce 30-char max on headlines from DB
  const editHeadlines = (rawEditHeadlines || []).map(h => h.trim().slice(0, 30));
  const strategy = normalizeStrategy(aiStrategy);"""
    ),
])

print()
print("=" * 50)
print("FIX 3: Headlines not sliced to 30 chars on load")
print("=" * 50)
for filepath in ["app/routes/app._index.jsx", "app/routes/_index.jsx"]:
    print(f"\n  --- {filepath} ---")
    fix_file(filepath, [
        (
            '.map(h => typeof h==="string"?h:h.text||h));',
            '.map(h => (typeof h==="string"?h:h.text||h).trim().slice(0, 30)));'
        ),
        (
            '.map(d => typeof d==="string"?d:d.text||d));',
            '.map(d => (typeof d==="string"?d:d.text||d).trim().slice(0, 90)));'
        ),
        (
            'n[index]=data.improved; setEditHeadlines',
            'n[index]=data.improved.trim().slice(0, 30); setEditHeadlines'
        ),
        (
            'n[index]=data.improved; setEditDescriptions',
            'n[index]=data.improved.trim().slice(0, 90); setEditDescriptions'
        ),
    ])

print()
print("=" * 50)
print("FIX 4: Math.random() inside useMemo (useDashboardData)")
print("=" * 50)
fix_file("app/hooks/useDashboardData.js", [
    (
        """  const { keywordGaps, totalMonthlyGapLoss } = useMemo(() => {
    const gaps = [];
    analyzedDbProducts.forEach(p => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return;
      (intel.keyword_gaps || []).forEach(kw => {
        const keyword = typeof kw === "string" ? kw : kw?.keyword || kw?.text || "";
        if (!keyword) return;
        const estLoss = Math.round((avgScore || 50) * 0.8 + Math.random() * 200);""",
        """  const { keywordGaps, totalMonthlyGapLoss } = useMemo(() => {
    const gaps = [];
    function simpleHash(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    }
    analyzedDbProducts.forEach(p => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return;
      (intel.keyword_gaps || []).forEach(kw => {
        const keyword = typeof kw === "string" ? kw : kw?.keyword || kw?.text || "";
        if (!keyword) return;
        const hash = simpleHash(keyword + (p.title || ""));
        const estLoss = Math.round((avgScore || 50) * 0.8 + (hash % 200));"""
    ),
])

print()
print("=" * 50)
print("FIX 5: ErrorBoundary - removeToast missing from deps")
print("=" * 50)
fix_file("app/components/ui/ErrorBoundary.jsx", [
    (
        """  const addToast = useCallback((message, type = "info", duration = 5000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);""",
        """  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", duration = 5000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);"""
    ),
])

print()
print("=" * 50)
print("ALL FIXES APPLIED!")
print("=" * 50)
