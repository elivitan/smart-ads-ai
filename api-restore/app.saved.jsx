import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

function ScoreRing({ score, size = 54 }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ filter: `drop-shadow(0 0 6px ${color}44)` }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 1s ease" }}/>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fill={color} fontSize="13" fontWeight="800">{score}</text>
    </svg>
  );
}

export default function SavedCampaigns() {
  const [products, setProducts] = useState([]);
  const [aiResults, setAiResults] = useState(null);
  const [selProduct, setSelProduct] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score");
  const [lastScan, setLastScan] = useState(null);

  useEffect(() => {
    try {
      const p = sessionStorage.getItem("sai_products");
      const a = sessionStorage.getItem("sai_aiResults");
      const t = sessionStorage.getItem("sai_lastScan");
      if (p) setProducts(JSON.parse(p));
      if (a) setAiResults(JSON.parse(a));
      if (t) setLastScan(t);
    } catch {}
  }, []);

  const aiProds = aiResults?.products || [];

  // Merge products with AI results
  const merged = products.map((prod, idx) => {
    const ai = aiProds.find(ap => ap.title === prod.title) || aiProds[idx] || {};
    return { ...prod, ...ai, ad_score: ai.ad_score || 0 };
  });

  // Filter
  const filtered = merged.filter(p => {
    if (filter === "high") return p.ad_score >= 70;
    if (filter === "medium") return p.ad_score >= 40 && p.ad_score < 70;
    if (filter === "low") return p.ad_score < 40;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") return b.ad_score - a.ad_score;
    if (sortBy === "price") return parseFloat(b.price||0) - parseFloat(a.price||0);
    if (sortBy === "name") return a.title.localeCompare(b.title);
    return 0;
  });

  const avgScore = merged.length ? Math.round(merged.reduce((a,p)=>a+p.ad_score,0)/merged.length) : 0;
  const highCount = merged.filter(p=>p.ad_score>=70).length;

  if (!products.length) {
    return (
      <div className="sr dk"><style>{CSS}</style>
        <div className="empty-wrap">
          <div style={{fontSize:72,marginBottom:20}}>📋</div>
          <h2 className="empty-title">No Saved Results Yet</h2>
          <p className="empty-sub">Scan your store first to see AI recommendations here.<br/>Results are saved automatically after each scan.</p>
          <a href="/app" className="btn-primary" style={{textDecoration:"none",display:"inline-block",marginTop:24}}>
            🚀 Scan My Store
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="sr dk"><style>{CSS}</style>
      <div className="bg-m"/>

      <div className="sv-wrap">
        {/* Header */}
        <div className="sv-header">
          <div>
            <a href="/app" className="btn-back-home">← Back to Dashboard</a>
            <h1 className="sv-title">My Saved Recommendations</h1>
            <p className="sv-sub">
              {merged.length} products analyzed
              {lastScan && <span> · Last scan: {new Date(lastScan).toLocaleDateString("en-US", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
            </p>
          </div>
          <a href="/app" className="btn-rescan">↻ Re-scan Store</a>
        </div>

        {/* Stats */}
        <div className="sv-stats">
          <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val">{merged.length}</div><div className="stat-lbl">Products</div></div>
          <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val">{avgScore}/100</div><div className="stat-lbl">Avg Score</div></div>
          <div className="stat-card"><div className="stat-icon">⭐</div><div className="stat-val">{highCount}</div><div className="stat-lbl">High Potential</div></div>
          <div className="stat-card"><div className="stat-icon">🔑</div><div className="stat-val">{aiProds.reduce((a,p)=>a+(p.keywords?.length||0),0)}</div><div className="stat-lbl">Keywords</div></div>
        </div>

        {/* AI Summary */}
        {aiResults?.summary && (
          <div className="ai-summary-card">
            <span className="ai-summary-icon">🤖</span>
            <div>
              <div className="celebrate-badge">✨ AI Recommendations</div>
              <div>{aiResults.summary}</div>
            </div>
          </div>
        )}

        {/* Filters & Sort */}
        <div className="sv-controls">
          <div className="filter-tabs">
            {[
              { key:"all",   label:`All (${merged.length})` },
              { key:"high",  label:`⭐ High (${merged.filter(p=>p.ad_score>=70).length})` },
              { key:"medium",label:`🟡 Medium (${merged.filter(p=>p.ad_score>=40&&p.ad_score<70).length})` },
              { key:"low",   label:`🔴 Low (${merged.filter(p=>p.ad_score<40).length})` },
            ].map(f => (
              <button key={f.key} className={`filter-tab ${filter===f.key?"filter-active":""}`} onClick={()=>setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="sort-wrap">
            <span className="sort-label">Sort by:</span>
            <select className="sort-select" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="score">Ad Score</option>
              <option value="price">Price</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {/* Products Grid */}
        <div className="p-grid">
          {sorted.map((product, idx) => {
            const score = product.ad_score || 0;
            const strength = score>=80?"EXCELLENT":score>=60?"GOOD":score>=40?"AVERAGE":"POOR";
            const strengthColor = {EXCELLENT:"#22c55e",GOOD:"#84cc16",AVERAGE:"#f59e0b",POOR:"#ef4444"}[strength];
            return (
              <div key={product.id||idx} className="p-card" onClick={()=>setSelProduct(product)}>
                <div className="p-card-img-wrap">
                  {product.image
                    ? <img src={product.image} alt={product.title} className="p-card-img"/>
                    : <div className="p-card-noimg">📦</div>
                  }
                  <div className="p-card-score"><ScoreRing score={score}/></div>
                  <div className="p-card-strength-badge" style={{background:strengthColor+"22",color:strengthColor,border:`1px solid ${strengthColor}44`}}>
                    {strength}
                  </div>
                </div>
                <div className="p-card-body">
                  <h3 className="p-card-title">{product.title}</h3>
                  <p className="p-card-price">${Number(product.price||0).toFixed(2)}</p>
                  {product.headlines?.[0] && (
                    <div className="p-card-headline">"{product.headlines[0]}"</div>
                  )}
                  <div className="p-card-kw-preview">
                    {(product.keywords||[]).slice(0,3).map((k,i)=>(
                      <span key={i} className="p-kw-chip">
                        {typeof k==="string" ? k : k.text}
                      </span>
                    ))}
                  </div>
                  <div className="p-card-cta">View Full Analysis →</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Detail Modal */}
      {selProduct && (() => {
        const ai = aiProds.find(ap=>ap.title===selProduct.title) || selProduct;
        const keywords = (ai.keywords||[]).map(k=>typeof k==="string"?{text:k,match_type:"BROAD"}:k);
        const score = ai.ad_score || 0;
        return (
          <div className="modal-overlay" onClick={()=>setSelProduct(null)}>
            <div className="modal modal-wide" onClick={e=>e.stopPropagation()}>
              <button className="modal-close" onClick={()=>setSelProduct(null)}>✕</button>
              <div className="modal-header">
                {selProduct.image && <img src={selProduct.image} alt="" className="modal-img"/>}
                <div style={{flex:1}}>
                  <h2 className="modal-title">{selProduct.title}</h2>
                  <p className="modal-price">${Number(selProduct.price||0).toFixed(2)}</p>
                </div>
                <div className="rsa-score-box"><ScoreRing score={score} size={58}/><span className="rsa-score-lbl">Ad Score</span></div>
              </div>
              <div className="modal-body">
                {/* Headlines */}
                <div className="rsa-section">
                  <h3>✏️ AI Headlines ({(ai.headlines||[]).length})</h3>
                  <div className="rsa-items">
                    {(ai.headlines||[]).map((h,i)=>(
                      <div key={i} className="rsa-item">
                        <span className="rsa-item-num">{i+1}</span>
                        <span className="rsa-item-text">{h}</span>
                        <span className="rsa-item-len">{h.length}/30</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Descriptions */}
                <div className="rsa-section">
                  <h3>📝 AI Descriptions ({(ai.descriptions||[]).length})</h3>
                  <div className="rsa-items">
                    {(ai.descriptions||[]).map((d,i)=>(
                      <div key={i} className="rsa-item">
                        <span className="rsa-item-num">{i+1}</span>
                        <span className="rsa-item-text">{d}</span>
                        <span className="rsa-item-len">{d.length}/90</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Keywords */}
                <div className="rsa-section">
                  <h3>🔑 Keywords ({keywords.length})</h3>
                  <div className="rsa-kw-grid">
                    {keywords.map((k,i)=>{
                      const mt = k.match_type||"BROAD";
                      const cls = mt==="EXACT"?"kw-exact":mt==="PHRASE"?"kw-phrase":"kw-broad";
                      const display = mt==="EXACT"?`[${k.text}]`:mt==="PHRASE"?`"${k.text}"`:k.text;
                      return <div key={i} className={`rsa-kw ${cls}`}>{display}<span className="rsa-kw-type">{mt}</span></div>;
                    })}
                  </div>
                </div>
                {/* Meta */}
                <div className="rsa-section rsa-meta-row">
                  {ai.target_demographics && <div className="rsa-meta"><strong>🎯 Target:</strong> {ai.target_demographics}</div>}
                  {ai.recommended_bid && <div className="rsa-meta"><strong>💰 Rec. CPC:</strong> ${ai.recommended_bid}</div>}
                  {ai.ad_strength && <div className="rsa-meta"><strong>💪 Strength:</strong> {ai.ad_strength}</div>}
                </div>
                <a href="/app" className="btn-campaign" style={{textDecoration:"none",display:"block",textAlign:"center"}}>
                  ✏️ Edit & Launch Campaign
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
.sr{font-family:'Plus Jakarta Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.dk{background:#0a0a1a;color:#fff;min-height:100vh;position:relative;overflow-x:hidden}
.bg-m{position:absolute;top:0;left:0;right:0;min-height:100%;background:radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.15),transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(6,182,212,.1),transparent 50%),radial-gradient(ellipse at 50% 80%,rgba(139,92,246,.1),transparent 50%);pointer-events:none;z-index:0}
.empty-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;padding:40px 20px;text-align:center;position:relative;z-index:1}
.empty-title{font-size:24px;font-weight:800;margin-bottom:10px}
.empty-sub{font-size:15px;color:rgba(255,255,255,.5);line-height:1.6}
.sv-wrap{position:relative;z-index:1;padding:28px 32px;max-width:1100px;margin:0 auto}
.sv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.sv-title{font-size:26px;font-weight:800;background:linear-gradient(135deg,#fff,#c7d2fe);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.sv-sub{font-size:13px;color:rgba(255,255,255,.4)}
.btn-back-home{background:none;border:none;color:rgba(255,255,255,.5);font-family:inherit;font-size:13px;cursor:pointer;padding:0;margin-bottom:8px;transition:color .2s;display:block;text-decoration:none}
.btn-back-home:hover{color:#fff}
.btn-rescan{background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.3);padding:8px 18px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;transition:all .2s;text-decoration:none;display:inline-block}
.btn-rescan:hover{background:rgba(99,102,241,.25)}
.sv-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.stat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px;text-align:center}
.stat-icon{font-size:22px;margin-bottom:6px}
.stat-val{font-size:22px;font-weight:800}
.stat-lbl{font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.ai-summary-card{background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08));border:1px solid rgba(99,102,241,.25);border-radius:14px;padding:16px 20px;font-size:14px;color:rgba(255,255,255,.8);margin-bottom:24px;line-height:1.6;display:flex;align-items:flex-start;gap:10px}
.ai-summary-icon{font-size:22px;flex-shrink:0}
.celebrate-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#a5b4fc;font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;margin-bottom:6px}
.sv-controls{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.filter-tabs{display:flex;gap:8px;flex-wrap:wrap}
.filter-tab{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);padding:7px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;transition:all .2s}
.filter-tab:hover{background:rgba(255,255,255,.08);color:#fff}
.filter-active{background:rgba(99,102,241,.15)!important;border-color:rgba(99,102,241,.4)!important;color:#a5b4fc!important}
.sort-wrap{display:flex;align-items:center;gap:8px}
.sort-label{font-size:12px;color:rgba(255,255,255,.4)}
.sort-select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#fff;padding:7px 12px;border-radius:8px;font-family:inherit;font-size:12px;cursor:pointer;outline:none}
.p-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.p-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .3s ease,border-color .3s ease,box-shadow .3s ease}
.p-card:hover{transform:translate3d(0,-4px,0);border-color:rgba(99,102,241,.4);box-shadow:0 12px 40px rgba(99,102,241,.15)}
.p-card-img-wrap{position:relative;height:180px;background:#111;overflow:hidden}
.p-card-img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.p-card:hover .p-card-img{transform:scale(1.05)}
.p-card-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px}
.p-card-score{position:absolute;top:10px;right:10px}
.p-card-strength-badge{position:absolute;top:10px;left:10px;font-size:9px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:.5px}
.p-card-body{padding:16px}
.p-card-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-card-price{font-size:13px;color:#a5b4fc;font-weight:600;margin-bottom:10px}
.p-card-headline{font-size:12px;color:rgba(255,255,255,.5);font-style:italic;margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-card-kw-preview{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.p-kw-chip{background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.2);font-size:10px;padding:2px 7px;border-radius:4px;white-space:nowrap}
.p-card-cta{font-size:12px;font-weight:600;color:#a5b4fc}
.p-card:hover .p-card-cta{color:#c4b5fd}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#1a1a2e;border:1px solid rgba(255,255,255,.1);border-radius:20px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;padding:28px;position:relative}
.modal-wide{max-width:680px}
.modal-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.1);border:none;color:#fff;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .2s}
.modal-close:hover{background:rgba(255,255,255,.2)}
.modal-header{display:flex;gap:16px;align-items:center;margin-bottom:20px}
.modal-img{width:72px;height:72px;border-radius:12px;object-fit:cover}
.modal-title{font-size:20px;font-weight:700}
.modal-price{font-size:15px;color:#a5b4fc;font-weight:600;margin-top:4px}
.modal-body{display:flex;flex-direction:column;gap:18px}
.rsa-score-box{display:flex;flex-direction:column;align-items:center;gap:2px}
.rsa-score-lbl{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase}
.rsa-section{margin-bottom:4px}
.rsa-section h3{font-size:14px;font-weight:700;color:rgba(255,255,255,.85);margin-bottom:10px}
.rsa-items{display:flex;flex-direction:column;gap:6px}
.rsa-item{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px}
.rsa-item-num{font-size:11px;font-weight:800;color:rgba(99,102,241,.7);min-width:18px}
.rsa-item-text{flex:1;font-size:13px;color:rgba(255,255,255,.8)}
.rsa-item-len{font-size:10px;color:rgba(255,255,255,.3);white-space:nowrap}
.rsa-kw-grid{display:flex;flex-wrap:wrap;gap:6px}
.rsa-kw{padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
.kw-broad{background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.2)}
.kw-phrase{background:rgba(245,158,11,.1);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}
.kw-exact{background:rgba(34,197,94,.1);color:#86efac;border:1px solid rgba(34,197,94,.2)}
.rsa-kw-type{font-size:9px;opacity:.5;text-transform:uppercase}
.rsa-meta-row{display:flex;gap:16px;flex-wrap:wrap}
.rsa-meta{font-size:12px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);padding:8px 12px;border-radius:8px}
.rsa-meta strong{color:rgba(255,255,255,.7)}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .25s;box-shadow:0 4px 20px rgba(99,102,241,.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(99,102,241,.45)}
.btn-campaign{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s}
.btn-campaign:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,.4)}
@media(max-width:768px){
  .sv-stats{grid-template-columns:repeat(2,1fr)}
  .sv-wrap{padding:20px 16px}
  .p-grid{grid-template-columns:1fr}
}
`;
