import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs } from "react-router";

interface KeywordsLoaderData {
  savedKeywords: unknown[];
}

export const loader = async ({ request }: LoaderFunctionArgs): Promise<Response | KeywordsLoaderData> => {
  await authenticate.admin(request);
  return { savedKeywords: [] };
};

export default function Keywords() {
  const [activeTab, setActiveTab] = useState("explore");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [seedKeyword, setSeedKeyword] = useState("");
  const [location, setLocation] = useState("United States");
  const [exploreResults, setExploreResults] = useState<Record<string, unknown> | null>(null);
  const [scanUrl, setScanUrl] = useState("");
  const [scanResults, setScanResults] = useState<Record<string, unknown> | null>(null);

  async function handleExplore() {
    if (!seedKeyword.trim()) return;
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append("actionType", "explore");
      form.append("keyword", seedKeyword.trim());
      form.append("location", location);
      const res = await fetch("/app/api/keywords", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) { setExploreResults(data); } else { setError(data.error); }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  }

  async function handleScan() {
    if (!scanUrl.trim()) return;
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append("actionType", "scan");
      form.append("url", scanUrl.trim());
      const res = await fetch("/app/api/keywords", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) { setScanResults(data); } else { setError(data.error); }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  }

  function CompBadge({ level }: { level: string }) {
    const colors = { Low: "#22c55e", Medium: "#f59e0b", High: "#ef4444" };
    return <span style={{ color: colors[level] || "#fff", fontWeight: 700, fontSize: "12px" }}>{level}</span>;
  }

  return (
    <div className="kw-page"><style>{CSS}</style>
      <h1 className="kw-h1">Keyword Research</h1>
      <p className="kw-sub">Discover high-performing keywords for your Google Ads campaigns</p>

      <div className="kw-tabs">
        {[
          { id: "explore", icon: "🔍", label: "Keyword Explorer", sub: "Find related keywords" },
          { id: "scan", icon: "🌐", label: "Scan Website", sub: "Extract keywords from any URL" },
          { id: "saved", icon: "📋", label: "My Keywords", sub: "View saved keywords & assets" },
        ].map(tab => (
          <button key={tab.id} className={`kw-tab ${activeTab === tab.id ? 'kw-tab-active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setError(null); }}>
            <span className="kw-tab-icon">{tab.icon}</span>
            <strong>{tab.label}</strong>
            <span className="kw-tab-sub">{tab.sub}</span>
          </button>
        ))}
      </div>

      {error && <div className="kw-error">{error}</div>}

      {loading && (
        <div className="kw-loading">
          <div className="kw-spinner"/>
          <div>
            <strong>{activeTab === "scan" ? "Scanning website..." : "Analyzing keywords..."}</strong>
            <p style={{fontSize:"13px",color:"rgba(255,255,255,.5)",marginTop:"4px"}}>AI is analyzing — this takes 15–30 seconds</p>
          </div>
        </div>
      )}

      {/* ── Keyword Explorer ── */}
      {activeTab === "explore" && !loading && (
        <div className="kw-section">
          <div className="kw-form">
            <div className="kw-field kw-field-grow">
              <label>SEED KEYWORD</label>
              <input type="text" value={seedKeyword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSeedKeyword(e.target.value)}
                placeholder="e.g. running shoes, organic skincare..."
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleExplore()} />
            </div>
            <div className="kw-field">
              <label>LOCATION</label>
              <select value={location} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLocation(e.target.value)}>
                <option>United States</option><option>United Kingdom</option><option>Canada</option>
                <option>Australia</option><option>Germany</option><option>France</option>
                <option>Israel</option><option>Global</option>
              </select>
            </div>
            <button className="kw-btn" onClick={handleExplore} disabled={!seedKeyword.trim()}>🚀 Find Keywords</button>
          </div>

          {exploreResults && (
            <div className="kw-results">
              {exploreResults.seed && (
                <div className="kw-seed-card">
                  <h3>Seed: <span className="kw-hl">{exploreResults.seed.keyword}</span></h3>
                  <div className="kw-seed-metrics">
                    <div className="kw-mbox"><span className="kw-mval">{exploreResults.seed.monthly_volume?.toLocaleString()}</span><span className="kw-mlbl">Monthly Volume</span></div>
                    <div className="kw-mbox"><CompBadge level={exploreResults.seed.competition}/><span className="kw-mlbl">Competition</span></div>
                    <div className="kw-mbox"><span className="kw-mval">{exploreResults.seed.cpc_estimate}</span><span className="kw-mlbl">Est. CPC</span></div>
                    <div className="kw-mbox"><span className="kw-mval kw-green">{exploreResults.seed.trend}</span><span className="kw-mlbl">Trend</span></div>
                  </div>
                </div>
              )}

              {exploreResults.related_keywords?.length > 0 && (
                <div className="kw-card">
                  <h3>🔗 Related Keywords ({(exploreResults.related_keywords||[]).length})</h3>
                  <div className="kw-table-wrap">
                    <table className="kw-table">
                      <thead><tr><th>Keyword</th><th>Volume</th><th>Competition</th><th>CPC</th><th>Source</th></tr></thead>
                      <tbody>
                        {exploreResults.related_keywords.map((kw, i) => (
                          <tr key={i}><td className="kw-keyword">{kw.keyword}</td><td>{kw.monthly_volume?.toLocaleString()}</td><td><CompBadge level={kw.competition}/></td><td>{kw.cpc_estimate}</td><td className="kw-source">{kw.source}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {exploreResults.long_tail?.length > 0 && (
                <div className="kw-card">
                  <h3>🎯 Long-Tail Keywords ({(exploreResults.long_tail||[]).length})</h3>
                  <div className="kw-table-wrap">
                    <table className="kw-table">
                      <thead><tr><th>Keyword</th><th>Volume</th><th>Competition</th><th>CPC</th></tr></thead>
                      <tbody>
                        {exploreResults.long_tail.map((kw, i) => (
                          <tr key={i}><td className="kw-keyword">{kw.keyword}</td><td>{kw.monthly_volume?.toLocaleString()}</td><td><CompBadge level={kw.competition}/></td><td>{kw.cpc_estimate}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {exploreResults.questions?.length > 0 && (
                <div className="kw-card">
                  <h3>❓ Questions People Ask</h3>
                  <div className="kw-questions">
                    {exploreResults.questions.map((q, i) => <div key={i} className="kw-question">{q}</div>)}
                  </div>
                </div>
              )}

              {exploreResults.rising_trends?.length > 0 && (
                <div className="kw-card">
                  <h3>📈 Rising Trends</h3>
                  <div className="kw-trends">
                    {exploreResults.rising_trends.map((t, i) => (
                      <div key={i} className="kw-trend">
                        <span className="kw-keyword">{t.keyword}</span>
                        <span className="kw-green">{t.growth}</span>
                        <span className="kw-vol">{t.monthly_volume?.toLocaleString()}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exploreResults.ad_group_suggestions?.length > 0 && (
                <div className="kw-card">
                  <h3>📦 Ad Group Suggestions</h3>
                  <div className="kw-adgroups">
                    {exploreResults.ad_group_suggestions.map((g, i) => (
                      <div key={i} className="kw-adgroup">
                        <div className="kw-adgroup-head"><strong>{g.name}</strong><span>{g.estimated_cpc}</span></div>
                        <div className="kw-tags">{g.keywords.map((k, j) => <span key={j} className="kw-tag">{k}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Scan Website ── */}
      {activeTab === "scan" && !loading && (
        <div className="kw-section">
          <div className="kw-form">
            <div className="kw-field kw-field-grow">
              <label>WEBSITE URL</label>
              <input type="text" value={scanUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScanUrl(e.target.value)}
                placeholder="https://competitor-store.com"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleScan()} />
            </div>
            <button className="kw-btn" onClick={handleScan} disabled={!scanUrl.trim()}>🌐 Scan Website</button>
          </div>

          {scanResults && (
            <div className="kw-results">
              <div className="kw-seed-card">
                <h3>🌐 {scanResults.website}</h3>
                <p style={{color:"rgba(255,255,255,.5)",fontSize:"13px"}}>Industry: <strong style={{color:"#a5b4fc"}}>{scanResults.industry}</strong></p>
              </div>

              {scanResults.primary_keywords?.length > 0 && (
                <div className="kw-card">
                  <h3>🎯 Primary Keywords ({(scanResults.primary_keywords||[]).length})</h3>
                  <div className="kw-table-wrap">
                    <table className="kw-table">
                      <thead><tr><th>Keyword</th><th>Volume</th><th>Competition</th><th>CPC</th><th>Relevance</th></tr></thead>
                      <tbody>
                        {scanResults.primary_keywords.map((kw, i) => (
                          <tr key={i}><td className="kw-keyword">{kw.keyword}</td><td>{kw.monthly_volume?.toLocaleString()}</td><td><CompBadge level={kw.competition}/></td><td>{kw.cpc_estimate}</td><td>{kw.relevance}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scanResults.long_tail_keywords?.length > 0 && (
                <div className="kw-card">
                  <h3>🔗 Long-Tail Keywords</h3>
                  <div className="kw-table-wrap">
                    <table className="kw-table">
                      <thead><tr><th>Keyword</th><th>Volume</th><th>Competition</th><th>CPC</th></tr></thead>
                      <tbody>
                        {scanResults.long_tail_keywords.map((kw, i) => (
                          <tr key={i}><td className="kw-keyword">{kw.keyword}</td><td>{kw.monthly_volume?.toLocaleString()}</td><td><CompBadge level={kw.competition}/></td><td>{kw.cpc_estimate}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {scanResults.negative_keywords?.length > 0 && (
                <div className="kw-card">
                  <h3>🚫 Negative Keywords (save budget)</h3>
                  <div className="kw-tags">{scanResults.negative_keywords.map((k, i) => <span key={i} className="kw-tag kw-tag-red">{k}</span>)}</div>
                </div>
              )}

              {scanResults.competitor_gaps?.length > 0 && (
                <div className="kw-card">
                  <h3>💡 Competitor Gaps</h3>
                  <div className="kw-trends">
                    {scanResults.competitor_gaps.map((g, i) => (
                      <div key={i} className="kw-trend">
                        <span className="kw-keyword">{g.keyword}</span>
                        <span className="kw-green">{g.opportunity}</span>
                        <span className="kw-vol">{g.monthly_volume?.toLocaleString()}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── My Keywords ── */}
      {activeTab === "saved" && (
        <div className="kw-section">
          <div className="kw-empty">
            <div className="kw-empty-icon">📋</div>
            <h3>No saved keywords yet</h3>
            <p>Use Keyword Explorer or Scan Website to discover keywords. Saved keywords will appear here.</p>
            <button className="kw-btn" onClick={() => setActiveTab("explore")}>🔍 Start Exploring</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
.kw-page{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#0a0a1a;color:#fff;min-height:100vh;padding:28px 32px;max-width:1100px;margin:0 auto}
.kw-h1{font-size:28px;font-weight:800;margin-bottom:4px}
.kw-sub{font-size:14px;color:rgba(255,255,255,.5);margin-bottom:24px}

/* TABS */
.kw-tabs{display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap}
.kw-tab{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 20px;cursor:pointer;text-align:left;color:#fff;font-family:inherit;transition:all .2s;display:flex;flex-direction:column;gap:2px;flex:1;min-width:160px}
.kw-tab:hover{border-color:rgba(99,102,241,.4)}
.kw-tab-active{border-color:#6366f1;background:rgba(99,102,241,.1)}
.kw-tab-icon{font-size:18px}
.kw-tab strong{font-size:14px}
.kw-tab-sub{font-size:11px;color:rgba(255,255,255,.4)}

/* FORM */
.kw-form{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap}
.kw-field{display:flex;flex-direction:column;gap:6px}
.kw-field label{font-size:11px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.5px}
.kw-field input,.kw-field select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-family:inherit;font-size:14px;outline:none;transition:border .2s}
.kw-field input:focus,.kw-field select:focus{border-color:#6366f1}
.kw-field-grow{flex:1;min-width:200px}
.kw-field select{min-width:140px}
.kw-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.kw-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(99,102,241,.4)}
.kw-btn:disabled{opacity:.4;cursor:not-allowed;transform:none}

/* ERROR */
.kw-error{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:12px 18px;border-radius:10px;font-size:13px;margin-bottom:18px}

/* LOADING */
.kw-loading{display:flex;align-items:center;gap:16px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:14px;padding:24px;margin-bottom:18px;justify-content:center}
.kw-spinner{width:36px;height:36px;border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:kwSpin 1s linear infinite}
@keyframes kwSpin{to{transform:rotate(360deg)}}

/* RESULTS */
.kw-results{display:flex;flex-direction:column;gap:16px;margin-top:20px}
.kw-seed-card{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:14px;padding:20px}
.kw-seed-card h3{font-size:16px;margin-bottom:14px}
.kw-hl{color:#a5b4fc}
.kw-seed-metrics{display:flex;gap:12px;flex-wrap:wrap}
.kw-mbox{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 16px;text-align:center;flex:1;min-width:100px;display:flex;flex-direction:column;gap:4px}
.kw-mval{font-size:18px;font-weight:800;color:#fff}
.kw-mlbl{font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase}
.kw-green{color:#22c55e}

/* CARDS */
.kw-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px}
.kw-card h3{font-size:15px;font-weight:700;margin-bottom:14px}

/* TABLE */
.kw-table-wrap{overflow-x:auto}
.kw-table{width:100%;border-collapse:collapse;font-size:13px}
.kw-table th{text-align:left;padding:8px 12px;color:rgba(255,255,255,.4);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid rgba(255,255,255,.08)}
.kw-table td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:rgba(255,255,255,.7)}
.kw-table tr:hover td{background:rgba(255,255,255,.02)}
.kw-keyword{color:#fff;font-weight:600}
.kw-source{color:#a5b4fc;font-size:11px;font-weight:600}

/* TAGS */
.kw-tags{display:flex;flex-wrap:wrap;gap:6px}
.kw-tag{background:rgba(99,102,241,.12);color:#a5b4fc;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;border:1px solid rgba(99,102,241,.2)}
.kw-tag-red{background:rgba(239,68,68,.1);color:#fca5a5;border-color:rgba(239,68,68,.2)}

/* QUESTIONS */
.kw-questions{display:flex;flex-direction:column;gap:6px}
.kw-question{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 14px;font-size:13px;color:rgba(255,255,255,.7)}

/* TRENDS */
.kw-trends{display:flex;flex-direction:column;gap:8px}
.kw-trend{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 14px}
.kw-vol{font-size:12px;color:rgba(255,255,255,.4);margin-left:auto}

/* AD GROUPS */
.kw-adgroups{display:flex;flex-direction:column;gap:10px}
.kw-adgroup{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px}
.kw-adgroup-head{display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px}
.kw-adgroup-head span{color:#a5b4fc;font-weight:600}

/* EMPTY */
.kw-empty{text-align:center;padding:60px 20px;background:rgba(255,255,255,.03);border:2px dashed rgba(255,255,255,.1);border-radius:16px}
.kw-empty-icon{font-size:40px;margin-bottom:14px}
.kw-empty h3{font-size:18px;font-weight:700;margin-bottom:6px}
.kw-empty p{font-size:13px;color:rgba(255,255,255,.5);max-width:400px;margin:0 auto 18px}

@media(max-width:768px){
.kw-tabs{flex-direction:column}
.kw-form{flex-direction:column}
.kw-seed-metrics{flex-direction:column}
}
`;
