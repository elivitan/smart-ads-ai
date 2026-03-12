import { useState } from "react";

interface GoogleAdsPreviewProps {
  headlines: string[];
  descriptions: string[];
  url?: string;
}

/* ── Google Ads Live Preview ── */
export function GoogleAdsPreview({ headlines, descriptions, url }) {
  const [activeTab, setActiveTab] = useState("desktop");
  const displayUrl = url || "textilura.com";
  const allHeadlines = headlines.length > 0 ? headlines : ["Your Headline Here"];
  const allDescs = descriptions.length > 0 ? descriptions : ["Your ad description will appear here."];

  /* Generate 3 random headline combinations like Google does */
  const combos = [
    [allHeadlines[0], allHeadlines[1], allHeadlines[2]].filter(Boolean),
    [allHeadlines[0], allHeadlines[3] || allHeadlines[1], allHeadlines[4] || allHeadlines[2]].filter(Boolean),
    [allHeadlines[2], allHeadlines[0], allHeadlines[5] || allHeadlines[1]].filter(Boolean),
  ];

  const tabs = [
    { id:"desktop", label:"Desktop" },
    { id:"mobile", label:"Mobile" },
    { id:"variations", label:"Variations" },
    { id:"extensions", label:"Extensions" },
  ];

  /* Reusable Google Search Ad block */
  const SearchAd = ({ titleParts, desc, mobile, callouts, sitelinks }) => (
    <div style={{ background:"#fff",borderRadius:mobile?10:12,padding:mobile?"16px":"24px",maxWidth:mobile?360:600,fontFamily:"arial,sans-serif" }}>
      {/* Search bar */}
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:mobile?14:20,padding:mobile?"8px 12px":"10px 16px",background:"#fff",border:"1px solid #dfe1e5",borderRadius:24,boxShadow:"0 1px 6px rgba(32,33,36,.18)" }}>
        <svg width={mobile?14:16} height={mobile?14:16} viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span style={{ fontSize:mobile?13:14,color:"#202124" }}>luxury bedding sets</span>
      </div>
      <div style={{ fontSize:mobile?11:12,color:"#70757a",marginBottom:mobile?8:12 }}>Sponsored</div>
      {/* Favicon + URL */}
      <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:mobile?4:6 }}>
        <div style={{ width:mobile?22:26,height:mobile?22:26,borderRadius:"50%",background:"#f1f3f4",display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ width:mobile?15:18,height:mobile?15:18,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:mobile?8:10,color:"#fff",fontWeight:700 }}>T</div>
        </div>
        <div>
          <div style={{ fontSize:mobile?13:14,color:"#202124",lineHeight:1.2 }}>{displayUrl}</div>
          <div style={{ fontSize:mobile?11:12,color:"#4d5156" }}>{"https://"}{displayUrl}{" > shop > bedding"}</div>
        </div>
      </div>
      {/* Title */}
      <div style={{ fontSize:mobile?17:20,color:"#1a0dab",fontWeight:400,lineHeight:1.3,marginBottom:4 }}>
        {titleParts.join(" | ")}
      </div>
      {/* Ad badge */}
      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:mobile?4:6 }}>
        <span style={{ fontSize:mobile?10:11,fontWeight:700,color:"#202124",border:"1px solid #202124",borderRadius:3,padding:"0 4px",lineHeight:"14px" }}>Ad</span>
      </div>
      {/* Description */}
      <div style={{ fontSize:mobile?13:14,color:"#4d5156",lineHeight:1.58 }}>{desc}</div>
      {/* Callouts */}
      {callouts && callouts.length > 0 && (
        <div style={{ fontSize:mobile?12:13,color:"#4d5156",marginTop:8 }}>
          {callouts.join(" · ")}
        </div>
      )}
      {/* Sitelinks */}
      {sitelinks && sitelinks.length > 0 && (
        <div style={{ display:mobile?"grid":"flex",gridTemplateColumns:mobile?"1fr 1fr":"none",gap:mobile?6:16,marginTop:mobile?10:12,flexWrap:"wrap" }}>
          {sitelinks.map((link, i) => (
            <div key={i} style={{ fontSize:mobile?12:13 }}>
              <div style={{ color:"#1a0dab",cursor:"pointer" }}>{link.title || link}</div>
              {link.desc && <div style={{ fontSize:11,color:"#4d5156",marginTop:2 }}>{link.desc}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ background:"#1a1a2e",border:"1px solid rgba(255,255,255,.08)",borderRadius:16,padding:"22px 24px",boxShadow:"0 2px 8px rgba(0,0,0,.2)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
        <div style={{ fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",letterSpacing:1.5,textTransform:"uppercase" }}>{"\u{1F50D}"} Google Ads Live Preview</div>
        <div style={{ display:"flex",gap:4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              fontSize:11,fontWeight:activeTab===t.id?700:500,
              color:activeTab===t.id?"#fff":"rgba(255,255,255,.35)",
              background:activeTab===t.id?"rgba(99,102,241,.2)":"transparent",
              border:activeTab===t.id?"1px solid rgba(99,102,241,.3)":"1px solid transparent",
              borderRadius:8,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit",transition:"all .15s"
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* Desktop View */}
      {activeTab === "desktop" && (
        <SearchAd
          titleParts={[allHeadlines[0], allHeadlines[1], allHeadlines[2]].filter(Boolean)}
          desc={allDescs.slice(0,2).join(" ")}
          sitelinks={[
            { title:"Shop Now", desc:"Browse our full collection" },
            { title:"Free Shipping", desc:"On orders over $75" },
            { title:"New Arrivals", desc:"Just landed this week" },
            { title:"Best Sellers", desc:"Top rated by customers" },
          ]}
          callouts={["Free Shipping Over $75","30-Day Returns","US-Based Support","Premium Quality"]}
        />
      )}

      {/* Mobile View */}
      {activeTab === "mobile" && (
        <div style={{ display:"flex",justifyContent:"center" }}>
          <div style={{ border:"3px solid #333",borderRadius:24,padding:"8px",background:"#000",maxWidth:390 }}>
            <div style={{ borderRadius:16,overflow:"hidden" }}>
              <SearchAd
                mobile
                titleParts={[allHeadlines[0], allHeadlines[1]].filter(Boolean)}
                desc={allDescs[0]}
                sitelinks={["Shop Now","Free Shipping","New Arrivals","Best Sellers"]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Headline Variations */}
      {activeTab === "variations" && (
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div style={{ fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:4 }}>Google automatically tests different headline combinations from your {allHeadlines.length} headlines:</div>
          {combos.map((combo, ci) => (
            <div key={ci} style={{ position:"relative" }}>
              {ci === 0 && <div style={{ position:"absolute",top:-8,right:8,fontSize:10,fontWeight:700,color:"#10b981",background:"rgba(16,185,129,.12)",padding:"2px 8px",borderRadius:5,zIndex:1 }}>TOP PERFORMER</div>}
              <SearchAd
                titleParts={combo}
                desc={allDescs[ci % allDescs.length]}
                sitelinks={["Shop Now","Free Shipping","New Arrivals","Best Sellers"]}
              />
            </div>
          ))}
        </div>
      )}

      {/* Extensions View */}
      {activeTab === "extensions" && (
        <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
          {/* Full extensions ad */}
          <SearchAd
            titleParts={[allHeadlines[0], allHeadlines[1], allHeadlines[2]].filter(Boolean)}
            desc={allDescs.slice(0,2).join(" ")}
            callouts={["Free Shipping Over $75","30-Day Returns","US-Based Support","Premium Quality"]}
            sitelinks={[
              { title:"Shop Now", desc:"Browse our full collection" },
              { title:"Free Shipping", desc:"On orders over $75" },
              { title:"New Arrivals", desc:"Just landed this week" },
              { title:"Best Sellers", desc:"Top rated by customers" },
            ]}
          />
          {/* Extensions breakdown */}
          <div style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"16px 18px" }}>
            <div style={{ fontSize:12,fontWeight:700,color:"rgba(255,255,255,.5)",marginBottom:12 }}>Active Extensions</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {[
                { name:"Sitelinks", count:4, status:"Active", color:"#10b981" },
                { name:"Callouts", count:4, status:"Active", color:"#10b981" },
                { name:"Structured Snippets", count:0, status:"Not set", color:"#f59e0b" },
                { name:"Price Extensions", count:0, status:"Not set", color:"#f59e0b" },
                { name:"Call Extension", count:0, status:"Not set", color:"#94a3b8" },
                { name:"Location", count:0, status:"Not set", color:"#94a3b8" },
              ].map((ext, i) => (
                <div key={i} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 10px",background:"rgba(255,255,255,.02)",borderRadius:8 }}>
                  <span style={{ fontSize:12,color:"rgba(255,255,255,.6)" }}>{ext.name}</span>
                  <span style={{ fontSize:11,fontWeight:600,color:ext.color }}>{ext.status}{ext.count > 0 ? " ("+ext.count+")" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize:11,color:"rgba(255,255,255,.2)",marginTop:12,textAlign:"center" }}>
        {activeTab === "desktop" ? "Desktop search result preview" : activeTab === "mobile" ? "Mobile search result preview" : activeTab === "variations" ? "Google tests these combinations automatically" : "Ad extensions enhance your ad visibility"}
      </div>
    </div>
  );
}


/* ── Revenue Attribution ── */
