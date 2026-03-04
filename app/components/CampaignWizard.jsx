import { useState, useEffect, useReducer, useRef } from "react";
import {
  wizardReducer,
  INITIAL_STATE,
  updateField,
  prefillFromAI,
} from "../utils/wizardReducer.js";
import { normalizeStrategy } from "../utils/normalizeStrategy.js";
import LaunchProgress from "./LaunchProgress.jsx";

/**
 * Campaign Creation Wizard
 * Matches Google Ads campaign creation flow
 * 7 Steps: Goal ג†’ Type ג†’ Bidding ג†’ Settings ג†’ Assets ג†’ Budget ג†’ Review
 */

const STEPS = [
  { id: "goal", label: "Your Goal", icon: "נ¯" },
  { id: "type", label: "Where to Advertise", icon: "נ“¢" },
  { id: "bidding", label: "Budget Strategy", icon: "נ’°" },
  { id: "settings", label: "Who Sees Your Ads", icon: "נ" },
  { id: "assets", label: "Your Ad Content", icon: "נ–¼ן¸" },
  { id: "budget", label: "Daily Budget", icon: "נ“" },
  { id: "tracking", label: "Track Sales", icon: "נ“ˆ" },
  { id: "review", label: "Review & Launch", icon: "נ€" },
];

const GOALS = [
  {
    id: "sales",
    icon: "נ›’",
    title: "Get More Sales",
    desc: "People will buy products directly from your store",
    googleTerm: "Sales",
  },
  {
    id: "leads",
    icon: "נ‘¥",
    title: "Get Leads & Signups",
    desc: "People will fill out forms or contact you",
    googleTerm: "Leads",
  },
  {
    id: "traffic",
    icon: "נ",
    title: "More Store Visitors",
    desc: "Bring more people to browse your website",
    googleTerm: "Website Traffic",
  },
  {
    id: "awareness",
    icon: "נ“£",
    title: "Get Your Brand Known",
    desc: "Show your brand to as many people as possible",
    googleTerm: "Awareness",
  },
];

const CAMPAIGN_TYPES = [
  {
    id: "pmax",
    icon: "ג¡",
    title: "Maximum Reach",
    subtitle: "Performance Max",
    desc: "AI shows your ads everywhere ג€” Google Search, YouTube, Gmail, Maps, and millions of websites. Best for most stores.",
    channels: ["Search", "YouTube", "Display", "Gmail", "Maps"],
    recommended: true,
  },
  {
    id: "search",
    icon: "נ”",
    title: "Search Only",
    subtitle: "Search Campaign",
    desc: "Text ads appear when people search for your products on Google. Best for specific products or small budgets.",
    channels: ["Google Search"],
  },
  {
    id: "shopping",
    icon: "נ›ן¸",
    title: "Product Shopping Ads",
    subtitle: "Shopping Campaign",
    desc: "Show your product photos + prices directly in Google search results. Requires Google Merchant Center.",
    channels: ["Google Shopping"],
  },
  {
    id: "display",
    icon: "נ–¼ן¸",
    title: "Banner Ads on Websites",
    subtitle: "Display Campaign",
    desc: "Visual banner ads shown across 3 million+ websites and apps.",
    channels: ["Websites", "Apps"],
  },
  {
    id: "video",
    icon: "נ¬",
    title: "YouTube Video Ads",
    subtitle: "Video Campaign",
    desc: "Video ads that play before or during YouTube videos.",
    channels: ["YouTube"],
  },
];

const BIDDING_STRATEGIES = [
  {
    id: "max_conversions",
    title: "Most Sales for My Budget",
    subtitle: "Maximize Conversions",
    desc: "Google's AI will try to get you the most purchases possible within your daily budget. Best for most stores.",
    recommended: true,
  },
  {
    id: "max_conv_value",
    title: "Highest Revenue",
    subtitle: "Maximize Conversion Value",
    desc: "Instead of counting sales, Google focuses on making you the most money. Great if your products have different prices.",
  },
  {
    id: "max_clicks",
    title: "Most Visitors",
    subtitle: "Maximize Clicks",
    desc: "Get as many people as possible to visit your store. Good for new stores that want traffic first.",
  },
  {
    id: "target_cpa",
    title: "Set a Cost Per Sale",
    subtitle: "Target CPA",
    desc: "You decide the maximum you're willing to pay for each sale. Example: 'I want each sale to cost me no more than $15'.",
    hasInput: true,
    inputLabel: "Max cost per sale ($)",
  },
  {
    id: "target_roas",
    title: "Set a Return Target",
    subtitle: "Target ROAS",
    desc: "You set a target like '300%' meaning for every $1 spent on ads, you want $3 in sales.",
    hasInput: true,
    inputLabel: "Target return (%)",
  },
];

const LOCATIONS = [
  { id: "all", label: "Worldwide ג€” Sell to anyone, anywhere", icon: "נ" },
  { id: "us_ca", label: "United States & Canada", icon: "נ‡÷נ‡¸" },
  { id: "us", label: "United States only", icon: "נ‡÷נ‡¸" },
  { id: "il", label: "Israel", icon: "נ‡®נ‡±" },
  { id: "eu", label: "Europe (EU countries)", icon: "נ‡×נ‡÷" },
  { id: "uk", label: "United Kingdom", icon: "נ‡¬נ‡§" },
  { id: "custom", label: "Choose specific countries or cities", icon: "נ“" },
];

export default function CampaignWizard({
  product,
  aiData,
  aiStrategy,
  storeInfo,
  editHeadlines: rawEditHeadlines,
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
  const editHeadlines = (rawEditHeadlines || []).map((h) =>
    h.trim().slice(0, 30),
  );
  const strategy = normalizeStrategy(aiStrategy);
  const [step, setStep] = useState(0);
  const [config, dispatch] = useReducer(wizardReducer, INITIAL_STATE);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  // Pre-fill from AI data
  useEffect(() => {
    if (product && aiData) {
      dispatch(prefillFromAI(product, aiData));
    }
  }, [product, aiData]);

  const updateConfig = (key, val) => dispatch(updateField(key, val));
  const currentStep = STEPS[step];
  const canNext = validateStep();

  function validateStep() {
    switch (STEPS[step]?.id) {
      case "goal":
        return !!config.goal;
      case "type":
        return !!config.campaignType;
      case "bidding":
        return !!config.bidding;
      case "settings":
        return !!config.locations;
      case "assets":
        return editHeadlines.length >= 3 && editDescriptions.length >= 1;
      case "budget":
        return config.budgetAmount && parseFloat(config.budgetAmount) > 0;
      case "tracking":
        return config.skipTracking || !!config.conversionType;
      case "review":
        return true;
      default:
        return true;
    }
  }
  const [launchState, setLaunchState] = useState("idle");
  const [launchError, setLaunchError] = useState(null);
  const [launchSteps, setLaunchSteps] = useState([]);
  const idempotencyRef = useRef(null);

  async function handleLaunch() {
    if (launchState === "launching") return;
    if (!idempotencyRef.current)
      idempotencyRef.current = `wiz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setLaunchState("launching");
    setLaunchError(null);
    setLaunchSteps([{ state: "QUEUED", ts: new Date().toISOString() }]);
    const payload = {
      ...config,
      productTitle: product?.title,
      headlines: editHeadlines,
      descriptions: editDescriptions,
      sitelinks: editSitelinks,
      keywords: aiData?.keywords || [],
      negative_keywords: aiData?.negative_keywords || [],
      imageUrls:
        product?.images?.map((i) => i.src || i.url).filter(Boolean) || [],
      videoUrls: config.videoUrls
        ? config.videoUrls
            .split(",")
            .map((u) => u.trim())
            .filter(Boolean)
        : [],
      idempotencyKey: idempotencyRef.current,
    };
    try {
      setLaunchSteps((s) => [
        ...s,
        { state: "CREATING", ts: new Date().toISOString() },
      ]);
      const res = await fetch("/app/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      if (data.success) {
        setLaunchState("success");
        setLaunchSteps(
          data.steps || [{ state: "ENABLED", ts: new Date().toISOString() }],
        );
        onLaunch(payload, data);
      } else {
        setLaunchState("failed");
        setLaunchError(data.error || "Campaign creation failed");
      }
    } catch (err) {
      setLaunchState("failed");
      setLaunchError(err.message);
    }
  }
  function handleRetryLaunch() {
    idempotencyRef.current = null;
    handleLaunch();
  }

  return (
    <div className="wiz-overlay" onClick={onClose}>
      <div className="wiz-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ג•
        </button>

        {/* Stepper */}
        <div className="wiz-stepper">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`wiz-step-item ${i === step ? "wiz-step-active" : i < step ? "wiz-step-done" : ""}`}
              onClick={() => i < step && setStep(i)}
            >
              <div className="wiz-step-num">{i < step ? "ג“" : i + 1}</div>
              <span className="wiz-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="wiz-content">
          {/* ג”€ג”€ג”€ג”€ STEP 1: GOAL ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "goal" && (
            <div className="wiz-section">
              <h2 className="wiz-title">What do you want to achieve?</h2>
              <p className="wiz-sub">
                This helps Google optimize your ads for the right outcome.
              </p>
              {strategy && (
                <div className="wiz-ai-rec">
                  <div className="wiz-ai-rec-badge">נ₪– AI Recommendation</div>
                  <div className="wiz-ai-rec-text">
                    Based on your store analysis:{" "}
                    <strong>
                      {GOALS.find((g) => g.id === strategy.goal)?.title ||
                        strategy.goal}
                    </strong>
                    <span className="wiz-ai-rec-reason">
                      {strategy.goalReason}
                    </span>
                  </div>
                  {config.goal !== strategy.goal && (
                    <button
                      className="wiz-ai-rec-btn"
                      onClick={() => updateConfig("goal", strategy.goal)}
                    >
                      Apply Recommendation
                    </button>
                  )}
                </div>
              )}
              <div className="wiz-cards-grid">
                {GOALS.map((g) => (
                  <div
                    key={g.id}
                    className={`wiz-card ${config.goal === g.id ? "wiz-card-sel" : ""} ${strategy?.goal === g.id ? "wiz-card-rec" : ""}`}
                    onClick={() => updateConfig("goal", g.id)}
                  >
                    {strategy?.goal === g.id && (
                      <div className="wiz-rec-badge">
                        נ₪– Recommended for you
                      </div>
                    )}
                    <span className="wiz-card-icon">{g.icon}</span>
                    <h3 className="wiz-card-title">{g.title}</h3>
                    {g.googleTerm && (
                      <span className="wiz-card-subtitle">
                        Google calls this: "{g.googleTerm}"
                      </span>
                    )}
                    <p className="wiz-card-desc">{g.desc}</p>
                  </div>
                ))}
              </div>
              {config.goal === "sales" && (
                <div className="wiz-info-box">
                  <strong>Recommended conversion goals for Sales:</strong>
                  <div className="wiz-conv-goals">
                    <div className="wiz-conv-goal">
                      <span className="wiz-conv-icon">נ›’</span> Purchases
                      (website)
                    </div>
                    <div className="wiz-conv-goal">
                      <span className="wiz-conv-icon">נ“§</span> Other (account
                      default)
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 2: CAMPAIGN TYPE ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "type" && (
            <div className="wiz-section">
              <h2 className="wiz-title">Where should your ads appear?</h2>
              <p className="wiz-sub">
                Choose where people will see your ads on Google.
              </p>
              {strategy && (
                <div className="wiz-ai-rec">
                  <div className="wiz-ai-rec-badge">נ₪– AI Recommendation</div>
                  <div className="wiz-ai-rec-text">
                    Best for your store:{" "}
                    <strong>
                      {CAMPAIGN_TYPES.find(
                        (t) => t.id === strategy.campaignType,
                      )?.title || strategy.campaignType}
                    </strong>
                    <span className="wiz-ai-rec-reason">
                      {strategy.campaignTypeReason}
                    </span>
                  </div>
                  {config.campaignType !== strategy.campaignType && (
                    <button
                      className="wiz-ai-rec-btn"
                      onClick={() =>
                        updateConfig("campaignType", strategy.campaignType)
                      }
                    >
                      Apply Recommendation
                    </button>
                  )}
                </div>
              )}
              <div className="wiz-cards-grid wiz-cards-wide">
                {CAMPAIGN_TYPES.map((t) => (
                  <div
                    key={t.id}
                    className={`wiz-card ${config.campaignType === t.id ? "wiz-card-sel" : ""} ${strategy?.campaignType === t.id ? "wiz-card-rec" : ""}`}
                    onClick={() => updateConfig("campaignType", t.id)}
                  >
                    {strategy?.campaignType === t.id && (
                      <div className="wiz-rec-badge">
                        נ₪– Recommended for you
                      </div>
                    )}
                    <span className="wiz-card-icon">{t.icon}</span>
                    <h3 className="wiz-card-title">{t.title}</h3>
                    {t.subtitle && (
                      <span className="wiz-card-subtitle">{t.subtitle}</span>
                    )}
                    <p className="wiz-card-desc">{t.desc}</p>
                    <div className="wiz-channels">
                      {t.channels.map((c) => (
                        <span key={c} className="wiz-channel">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 3: BIDDING ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "bidding" && (
            <div className="wiz-section">
              <h2 className="wiz-title">
                How should Google spend your budget?
              </h2>
              <p className="wiz-sub">
                This tells Google what to optimize for when showing your ads.
              </p>
              {strategy && (
                <div className="wiz-ai-rec">
                  <div className="wiz-ai-rec-badge">נ₪– AI Recommendation</div>
                  <div className="wiz-ai-rec-text">
                    Best for your store:{" "}
                    <strong>
                      {BIDDING_STRATEGIES.find((b) => b.id === strategy.bidding)
                        ?.title || strategy.bidding}
                    </strong>
                    <span className="wiz-ai-rec-reason">
                      {strategy.biddingReason}
                    </span>
                  </div>
                  {config.bidding !== strategy.bidding && (
                    <button
                      className="wiz-ai-rec-btn"
                      onClick={() => updateConfig("bidding", strategy.bidding)}
                    >
                      Apply Recommendation
                    </button>
                  )}
                </div>
              )}
              <div className="wiz-bidding-list">
                {BIDDING_STRATEGIES.map((b) => (
                  <div
                    key={b.id}
                    className={`wiz-bid-item ${config.bidding === b.id ? "wiz-bid-sel" : ""}`}
                    onClick={() => updateConfig("bidding", b.id)}
                  >
                    <div className="wiz-bid-radio">
                      {config.bidding === b.id ? "ג—‰" : "ג—‹"}
                    </div>
                    <div className="wiz-bid-info">
                      <div className="wiz-bid-title">
                        {b.title}
                        {strategy?.bidding === b.id && (
                          <span className="wiz-bid-rec">נ₪– Recommended</span>
                        )}
                        {b.subtitle && (
                          <span className="wiz-bid-sub">{b.subtitle}</span>
                        )}
                      </div>
                      <div className="wiz-bid-desc">{b.desc}</div>
                      {b.hasInput && config.bidding === b.id && (
                        <div className="wiz-bid-input-wrap">
                          <label>{b.inputLabel}</label>
                          <input
                            type="number"
                            value={config.biddingTarget}
                            onChange={(e) =>
                              updateConfig("biddingTarget", e.target.value)
                            }
                            placeholder="0.00"
                            className="wiz-input-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="wiz-info-box">
                <strong>Customer Acquisition</strong>
                <p>
                  Bid for new customers with matching bidding adjustments to
                  help you acquire new customers.
                </p>
              </div>
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 4: SETTINGS ג€” WHO SEES YOUR ADS ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "settings" && (
            <div className="wiz-section">
              <h2 className="wiz-title">Who should see your ads?</h2>
              <p className="wiz-sub">
                Choose where your ads will show and what languages your
                customers speak.
              </p>

              <div className="wiz-form-group">
                <label className="wiz-form-label">Campaign Name</label>
                <p className="wiz-form-hint">
                  A name for you to identify this campaign ג€” customers won't
                  see it.
                </p>
                <input
                  className="wiz-input"
                  value={config.campaignName}
                  onChange={(e) => updateConfig("campaignName", e.target.value)}
                  placeholder="My Campaign"
                />
              </div>

              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  נ“ Where should your ads appear?
                </label>
                <p className="wiz-form-hint">
                  Choose which countries/regions will see your ads. Pick the
                  areas where your customers are located or where you can ship
                  to.
                </p>
                {strategy && (
                  <div className="wiz-ai-rec wiz-ai-rec-sm">
                    <span className="wiz-ai-rec-badge">
                      נ₪– AI Recommendation
                    </span>
                    <span className="wiz-ai-rec-text">
                      <strong>
                        {LOCATIONS.find((l) => l.id === strategy.locations?.[0])
                          ?.label ||
                          strategy.locations?.join(", ") ||
                          "Based on your store"}
                      </strong>
                      <span className="wiz-ai-rec-reason">
                        {strategy.locationsReason}
                      </span>
                    </span>
                    {strategy.locations?.[0] &&
                      config.locations !== strategy.locations[0] && (
                        <button
                          className="wiz-ai-rec-btn"
                          onClick={() =>
                            updateConfig("locations", strategy.locations[0])
                          }
                        >
                          Apply
                        </button>
                      )}
                  </div>
                )}
                <div className="wiz-loc-list">
                  {LOCATIONS.map((loc) => (
                    <label
                      key={loc.id}
                      className={`wiz-loc-item ${config.locations === loc.id ? "wiz-loc-sel" : ""}`}
                    >
                      <input
                        type="radio"
                        name="location"
                        checked={config.locations === loc.id}
                        onChange={() => updateConfig("locations", loc.id)}
                      />
                      <span className="wiz-loc-icon">{loc.icon}</span>
                      <span className="wiz-loc-label">{loc.label}</span>
                      {strategy?.locations?.[0] === loc.id && (
                        <span className="wiz-loc-rec">נ₪– Recommended</span>
                      )}
                    </label>
                  ))}
                </div>
                {config.locations === "custom" && (
                  <div className="wiz-custom-loc">
                    <input
                      className="wiz-input"
                      value={config.customLocation}
                      onChange={(e) =>
                        updateConfig("customLocation", e.target.value)
                      }
                      placeholder="Type a country, state, city, or zip code..."
                    />
                    <p className="wiz-form-hint" style={{ marginTop: 6 }}>
                      נ’¡ Examples: "New York", "California", "London", "90210",
                      "Germany"
                    </p>
                  </div>
                )}
              </div>

              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  נ—£ן¸ What languages do your customers speak?
                </label>
                <p className="wiz-form-hint">
                  Google will show your ads to people who use these languages.
                  Make sure your ads are written in the languages you select.
                </p>
                {strategy && strategy.languages && (
                  <div className="wiz-ai-rec wiz-ai-rec-sm">
                    <span className="wiz-ai-rec-badge">
                      נ₪– AI Recommendation
                    </span>
                    <span className="wiz-ai-rec-text">
                      <strong>
                        {strategy.languages
                          .map(
                            (l) =>
                              ({
                                en: "English",
                                he: "Hebrew",
                                es: "Spanish",
                                fr: "French",
                                de: "German",
                                ar: "Arabic",
                                ru: "Russian",
                                zh: "Chinese",
                                ja: "Japanese",
                                pt: "Portuguese",
                              })[l] || l,
                          )
                          .join(", ")}
                      </strong>
                    </span>
                    <button
                      className="wiz-ai-rec-btn"
                      onClick={() =>
                        updateConfig("languages", [...strategy.languages])
                      }
                    >
                      Apply
                    </button>
                  </div>
                )}
                <div className="wiz-tag-list">
                  {config.languages.map((lang, i) => (
                    <span key={i} className="wiz-tag">
                      {{
                        en: "English",
                        he: "Hebrew",
                        es: "Spanish",
                        fr: "French",
                        de: "German",
                        ar: "Arabic",
                        ru: "Russian",
                        zh: "Chinese",
                        ja: "Japanese",
                        pt: "Portuguese",
                      }[lang] || lang}{" "}
                      <button
                        onClick={() =>
                          updateConfig(
                            "languages",
                            config.languages.filter((_, j) => j !== i),
                          )
                        }
                      >
                        ג•
                      </button>
                    </span>
                  ))}
                  <select
                    className="wiz-select-sm"
                    onChange={(e) => {
                      if (
                        e.target.value &&
                        !config.languages.includes(e.target.value)
                      )
                        updateConfig("languages", [
                          ...config.languages,
                          e.target.value,
                        ]);
                      e.target.value = "";
                    }}
                  >
                    <option value="">+ Add language</option>
                    <option value="en">English</option>
                    <option value="he">Hebrew</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ar">Arabic</option>
                    <option value="ru">Russian</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </div>
              </div>

              {strategy?.audienceDescription && (
                <div className="wiz-info-box">
                  <strong>נ¯ Your Target Audience</strong>
                  <p>{strategy.audienceDescription}</p>
                </div>
              )}
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 5: ASSETS ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "assets" && (
            <div className="wiz-section">
              <h2 className="wiz-title">Your Ad Content</h2>
              <p className="wiz-sub" style={{ marginBottom: 8 }}>
                This is what people will see in your ads. The more content you
                add, the better Google can optimize.
              </p>

              {/* Ad Strength */}
              <div className="wiz-adstrength">
                <span className="wiz-adstrength-label">Ad Strength</span>
                <div className="wiz-adstrength-bar">
                  <div
                    className="wiz-adstrength-fill"
                    style={{
                      width: `${Math.min(100, (editHeadlines.length / 15) * 50 + (editDescriptions.length / 4) * 30 + (editSitelinks.filter((s) => s.title).length > 0 ? 20 : 0))}%`,
                      background:
                        editHeadlines.length >= 10
                          ? "#22c55e"
                          : editHeadlines.length >= 5
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  />
                </div>
                <span
                  className="wiz-adstrength-txt"
                  style={{
                    color:
                      editHeadlines.length >= 10
                        ? "#22c55e"
                        : editHeadlines.length >= 5
                          ? "#f59e0b"
                          : "#ef4444",
                  }}
                >
                  {editHeadlines.length >= 10
                    ? "Excellent"
                    : editHeadlines.length >= 5
                      ? "Good"
                      : "Poor"}
                </span>
                <div className="wiz-adstrength-checklist">
                  <span
                    className={editHeadlines.length > 0 ? "wiz-check-ok" : ""}
                  >
                    Headlines
                  </span>
                  <span
                    className={
                      editDescriptions.length > 0 ? "wiz-check-ok" : ""
                    }
                  >
                    Descriptions
                  </span>
                  <span className={config.businessName ? "wiz-check-ok" : ""}>
                    Business
                  </span>
                  <span
                    className={
                      editSitelinks.some((s) => s.title) ? "wiz-check-ok" : ""
                    }
                  >
                    Sitelinks
                  </span>
                </div>
              </div>

              {/* Brand */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">Branding Guidelines</label>
                <div className="wiz-form-row">
                  <div className="wiz-form-col">
                    <label className="wiz-form-sublabel">
                      Business Name (required)
                    </label>
                    <input
                      className="wiz-input"
                      value={config.businessName}
                      onChange={(e) =>
                        updateConfig("businessName", e.target.value)
                      }
                      placeholder="Your business name"
                      maxLength={25}
                    />
                    <span className="wiz-char-count">
                      {config.businessName.length}/25
                    </span>
                  </div>
                  <div className="wiz-form-col">
                    <label className="wiz-form-sublabel">
                      Logo (3-5 images recommended)
                    </label>
                    <div className="wiz-upload-zone">
                      <span>נ“· Upload logos</span>
                      <p>Square 1:1 (1200x1200) + Landscape 4:1 (1200x300)</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Final URL */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">Final URL</label>
                <input
                  className="wiz-input"
                  value={config.finalUrl}
                  onChange={(e) => updateConfig("finalUrl", e.target.value)}
                  placeholder="https://yourstore.com"
                />
              </div>

              {/* Headlines */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  Headlines ({editHeadlines.length}/15)
                </label>
                <p className="wiz-form-hint">
                  Max 30 characters each. Google recommends 15 for best results.
                </p>
                <div className="wiz-asset-list">
                  {editHeadlines.map((h, i) => (
                    <div key={i} className="wiz-asset-row">
                      <span className="wiz-asset-num">{i + 1}</span>
                      <input
                        className="wiz-input"
                        value={h}
                        maxLength={30}
                        onChange={(e) => {
                          const n = [...editHeadlines];
                          n[i] = e.target.value;
                          setEditHeadlines(n);
                        }}
                        placeholder={`Headline ${i + 1}`}
                      />
                      <span
                        className={`wiz-char-count ${h.length > 30 ? "wiz-over" : ""}`}
                      >
                        {h.length}/30
                      </span>
                      <button
                        className="wiz-btn-ai"
                        onClick={() => handleAiImprove("h", i)}
                        disabled={improvingIdx !== null}
                        title="AI Improve"
                      >
                        {improvingIdx === `h-${i}` ? "ג³" : "ג¨"}
                      </button>
                    </div>
                  ))}
                  {editHeadlines.length < 15 && (
                    <button
                      className="wiz-btn-add"
                      onClick={() => setEditHeadlines([...editHeadlines, ""])}
                    >
                      + Add headline
                    </button>
                  )}
                </div>
              </div>

              {/* Descriptions */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  Descriptions ({editDescriptions.length}/4)
                </label>
                <p className="wiz-form-hint">Max 90 characters each.</p>
                <div className="wiz-asset-list">
                  {editDescriptions.map((d, i) => (
                    <div key={i} className="wiz-asset-row">
                      <span className="wiz-asset-num">{i + 1}</span>
                      <textarea
                        className="wiz-input wiz-textarea"
                        value={d}
                        maxLength={90}
                        rows={2}
                        onChange={(e) => {
                          const n = [...editDescriptions];
                          n[i] = e.target.value;
                          setEditDescriptions(n);
                        }}
                        placeholder={`Description ${i + 1}`}
                      />
                      <span
                        className={`wiz-char-count ${d.length > 90 ? "wiz-over" : ""}`}
                      >
                        {d.length}/90
                      </span>
                      <button
                        className="wiz-btn-ai"
                        onClick={() => handleAiImprove("d", i)}
                        disabled={improvingIdx !== null}
                      >
                        {improvingIdx === `d-${i}` ? "ג³" : "ג¨"}
                      </button>
                    </div>
                  ))}
                  {editDescriptions.length < 4 && (
                    <button
                      className="wiz-btn-add"
                      onClick={() =>
                        setEditDescriptions([...editDescriptions, ""])
                      }
                    >
                      + Add description
                    </button>
                  )}
                </div>
              </div>

              {/* Images */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">Images</label>
                <p className="wiz-form-hint">
                  At least 1 square (1:1) + 1 landscape (1.91:1). Recommended:
                  4+ unique images.
                </p>
                <div className="wiz-upload-grid">
                  {product?.image && (
                    <div className="wiz-upload-thumb">
                      <img src={product.image} alt="" />
                      <span className="wiz-thumb-label">From Shopify</span>
                    </div>
                  )}
                  <div className="wiz-upload-zone wiz-upload-add">
                    <span>+</span>
                    <p>Upload image</p>
                    <p className="wiz-upload-specs">JPG/PNG, max 5MB</p>
                  </div>
                </div>
              </div>

              {/* Videos */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">Videos (optional)</label>
                <p className="wiz-form-hint">
                  YouTube video URLs. Min 10 seconds. Google may auto-generate
                  if none provided.
                </p>
                <input
                  className="wiz-input"
                  placeholder="https://youtube.com/watch?v=..."
                  value={config.videoUrls || ""}
                  onChange={(e) => updateConfig("videoUrls", e.target.value)}
                />
              </div>

              {/* Callouts */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  Callouts ({config.callouts.filter((c) => c).length}/4)
                </label>
                <p className="wiz-form-hint">
                  Short highlights like "Free Shipping", "24/7 Support". Max 25
                  chars each.
                </p>
                <div className="wiz-asset-list">
                  {config.callouts.map((c, i) => (
                    <div key={i} className="wiz-asset-row">
                      <input
                        className="wiz-input"
                        value={c}
                        maxLength={25}
                        onChange={(e) => {
                          const n = [...config.callouts];
                          n[i] = e.target.value;
                          updateConfig("callouts", n);
                        }}
                        placeholder={`Callout ${i + 1}`}
                      />
                      <span className="wiz-char-count">{c.length}/25</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Structured Snippets */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">Structured Snippets</label>
                <p className="wiz-form-hint">
                  Categorized list of products/services.
                </p>
                <div className="wiz-snippet-wrap">
                  <select
                    className="wiz-select"
                    value={config.structuredSnippetHeader}
                    onChange={(e) =>
                      updateConfig("structuredSnippetHeader", e.target.value)
                    }
                  >
                    <option value="Types">Types</option>
                    <option value="Brands">Brands</option>
                    <option value="Styles">Styles</option>
                    <option value="Services">Service catalog</option>
                    <option value="Destinations">Destinations</option>
                    <option value="Models">Models</option>
                    <option value="Courses">Courses</option>
                  </select>
                  <div className="wiz-asset-list">
                    {config.structuredSnippetValues.map((v, i) => (
                      <input
                        key={i}
                        className="wiz-input"
                        value={v}
                        maxLength={25}
                        onChange={(e) => {
                          const n = [...config.structuredSnippetValues];
                          n[i] = e.target.value;
                          updateConfig("structuredSnippetValues", n);
                        }}
                        placeholder={`Value ${i + 1}`}
                      />
                    ))}
                    {config.structuredSnippetValues.length < 10 && (
                      <button
                        className="wiz-btn-add"
                        onClick={() =>
                          updateConfig("structuredSnippetValues", [
                            ...config.structuredSnippetValues,
                            "",
                          ])
                        }
                      >
                        + Add value
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sitelinks */}
              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  Sitelinks ({editSitelinks.length}/6)
                </label>
                <div className="wiz-sitelinks-grid">
                  {editSitelinks.map((sl, i) => (
                    <div key={i} className="wiz-sl-card">
                      <div className="wiz-sl-head">
                        <span>Sitelink {i + 1}</span>
                        <button
                          onClick={() => {
                            const n = [...editSitelinks];
                            n.splice(i, 1);
                            setEditSitelinks(n);
                          }}
                        >
                          ג•
                        </button>
                      </div>
                      <input
                        className="wiz-input"
                        value={sl.title}
                        maxLength={25}
                        onChange={(e) => {
                          const n = [...editSitelinks];
                          n[i] = { ...n[i], title: e.target.value };
                          setEditSitelinks(n);
                        }}
                        placeholder="Title (25 chars)"
                      />
                      <input
                        className="wiz-input"
                        value={sl.description}
                        maxLength={35}
                        onChange={(e) => {
                          const n = [...editSitelinks];
                          n[i] = { ...n[i], description: e.target.value };
                          setEditSitelinks(n);
                        }}
                        placeholder="Description (35 chars)"
                      />
                      <input
                        className="wiz-input"
                        value={sl.url}
                        onChange={(e) => {
                          const n = [...editSitelinks];
                          n[i] = { ...n[i], url: e.target.value };
                          setEditSitelinks(n);
                        }}
                        placeholder="/page-url"
                      />
                    </div>
                  ))}
                  {editSitelinks.length < 6 && (
                    <button
                      className="wiz-btn-add"
                      onClick={() =>
                        setEditSitelinks([
                          ...editSitelinks,
                          { title: "", description: "", url: "/" },
                        ])
                      }
                    >
                      + Add sitelink
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 6: BUDGET ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "budget" && (
            <div className="wiz-section">
              <h2 className="wiz-title">How much do you want to spend?</h2>
              <p className="wiz-sub">
                Set your daily advertising budget. You can change this anytime.
              </p>

              {strategy && (
                <div className="wiz-ai-rec">
                  <div className="wiz-ai-rec-badge">נ₪– AI Recommendation</div>
                  <div className="wiz-ai-rec-text">
                    <strong>${strategy.budget.recommended}/day</strong> is
                    recommended for your store
                    <span className="wiz-ai-rec-reason">
                      {strategy.budget.reason}
                    </span>
                  </div>
                </div>
              )}

              <div className="wiz-form-group">
                <label className="wiz-form-label">Budget type</label>
                <div className="wiz-radio-list">
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="budgetType"
                      checked={config.budgetType === "daily"}
                      onChange={() => updateConfig("budgetType", "daily")}
                    />
                    <span>
                      Daily budget ג€” spend up to this amount each day
                    </span>
                  </label>
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="budgetType"
                      checked={config.budgetType === "total"}
                      onChange={() => updateConfig("budgetType", "total")}
                    />
                    <span>
                      Total budget ג€” spend this total amount over the campaign
                    </span>
                  </label>
                </div>
              </div>

              <div className="wiz-budget-tiers">
                {strategy ? (
                  <>
                    <div
                      className={`wiz-budget-card ${config.budgetAmount === String(strategy.budget.min) ? "wiz-budget-sel" : ""}`}
                      onClick={() =>
                        updateConfig(
                          "budgetAmount",
                          String(strategy.budget.min),
                        )
                      }
                    >
                      <div className="wiz-budget-tier-label">
                        נ± Start Small
                      </div>
                      <div className="wiz-budget-val">
                        ${strategy.budget.min}
                      </div>
                      <div className="wiz-budget-type">
                        {config.budgetType === "daily" ? "per day" : "total"}
                      </div>
                      <div className="wiz-budget-est">
                        <div>
                          ~
                          {Math.round(
                            (strategy.projections.clicks || 100) * 0.5,
                          )}{" "}
                          clicks/mo
                        </div>
                        <div>Good for testing</div>
                      </div>
                    </div>
                    <div
                      className={`wiz-budget-card wiz-budget-popular ${config.budgetAmount === String(strategy.budget.recommended) ? "wiz-budget-sel" : ""}`}
                      onClick={() =>
                        updateConfig(
                          "budgetAmount",
                          String(strategy.budget.recommended),
                        )
                      }
                    >
                      <div className="wiz-budget-rec">נ₪– Recommended</div>
                      <div className="wiz-budget-val">
                        ${strategy.budget.recommended}
                      </div>
                      <div className="wiz-budget-type">
                        {config.budgetType === "daily" ? "per day" : "total"}
                      </div>
                      <div className="wiz-budget-est">
                        <div>
                          ~{strategy.projections.clicks || 100} clicks/mo
                        </div>
                        <div>
                          ~{strategy.projections.conversions || 5} sales/mo
                        </div>
                        <div>
                          Est. return: {strategy.projections.roas || 3}x
                        </div>
                      </div>
                    </div>
                    <div
                      className={`wiz-budget-card ${config.budgetAmount === String(strategy.budget.aggressive) ? "wiz-budget-sel" : ""}`}
                      onClick={() =>
                        updateConfig(
                          "budgetAmount",
                          String(strategy.budget.aggressive),
                        )
                      }
                    >
                      <div className="wiz-budget-tier-label">נ€ Grow Fast</div>
                      <div className="wiz-budget-val">
                        ${strategy.budget.aggressive}
                      </div>
                      <div className="wiz-budget-type">
                        {config.budgetType === "daily" ? "per day" : "total"}
                      </div>
                      <div className="wiz-budget-est">
                        <div>
                          ~
                          {Math.round((strategy.projections.clicks || 100) * 2)}{" "}
                          clicks/mo
                        </div>
                        <div>Maximum growth</div>
                      </div>
                    </div>
                  </>
                ) : aiData?.estimated_metrics?.monthly_cost_estimate ? (
                  <div
                    className={`wiz-budget-card ${config.budgetAmount === String(Math.round(aiData.estimated_metrics.monthly_cost_estimate / 30)) ? "wiz-budget-sel" : ""}`}
                    onClick={() =>
                      updateConfig(
                        "budgetAmount",
                        String(
                          Math.round(
                            aiData.estimated_metrics.monthly_cost_estimate / 30,
                          ),
                        ),
                      )
                    }
                  >
                    <div className="wiz-budget-rec">Recommended</div>
                    <div className="wiz-budget-val">
                      $
                      {Math.round(
                        aiData.estimated_metrics.monthly_cost_estimate / 30,
                      )}
                    </div>
                    <div className="wiz-budget-type">
                      {config.budgetType === "daily" ? "per day" : "total"}
                    </div>
                  </div>
                ) : null}
                <div className="wiz-budget-card">
                  <div className="wiz-budget-custom-label">
                    גן¸ Enter your own amount
                  </div>
                  <div className="wiz-budget-input-wrap">
                    <span className="wiz-budget-currency">$</span>
                    <input
                      type="number"
                      className="wiz-budget-input"
                      value={config.budgetAmount}
                      onChange={(e) =>
                        updateConfig("budgetAmount", e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="wiz-budget-type">
                    {config.budgetType === "daily" ? "per day" : "total"}
                  </div>
                </div>
              </div>

              {config.budgetAmount && parseFloat(config.budgetAmount) > 0 && (
                <div className="wiz-budget-summary">
                  <div className="wiz-budget-row">
                    <span>נ“… Weekly cost estimate</span>
                    <strong>
                      $
                      {(
                        parseFloat(config.budgetAmount) *
                        (config.budgetType === "daily" ? 7 : 1)
                      ).toFixed(2)}
                    </strong>
                  </div>
                  <div className="wiz-budget-row">
                    <span>נ“† Monthly cost estimate</span>
                    <strong>
                      $
                      {(
                        parseFloat(config.budgetAmount) *
                        (config.budgetType === "daily" ? 30.4 : 1)
                      ).toFixed(2)}
                    </strong>
                  </div>
                  {strategy?.projections?.roas && (
                    <div className="wiz-budget-row">
                      <span>נ’° Estimated return</span>
                      <strong>
                        $
                        {(
                          parseFloat(config.budgetAmount) *
                          (config.budgetType === "daily" ? 30.4 : 1) *
                          strategy.projections.roas
                        ).toFixed(2)}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  How long should this campaign run?
                </label>
                <div className="wiz-radio-list">
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="duration"
                      checked={config.budgetDuration === "ongoing"}
                      onChange={() => updateConfig("budgetDuration", "ongoing")}
                    />
                    <span>Keep running until I stop it</span>
                  </label>
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="duration"
                      checked={config.budgetDuration === "end_date"}
                      onChange={() =>
                        updateConfig("budgetDuration", "end_date")
                      }
                    />
                    <span>Stop on a specific date</span>
                  </label>
                </div>
                {config.budgetDuration === "end_date" && (
                  <input
                    type="date"
                    className="wiz-input"
                    value={config.budgetEndDate}
                    onChange={(e) =>
                      updateConfig("budgetEndDate", e.target.value)
                    }
                  />
                )}
              </div>

              <div className="wiz-info-box wiz-info-warn">
                <strong>נ’¡ Good to know:</strong> Your monthly charge won't
                exceed your daily budget ֳ— days in the month. Some days Google
                may spend a bit more, other days less ג€” but it evens out.
              </div>

              {strategy?.warnings?.length > 0 && (
                <div className="wiz-info-box wiz-info-warn">
                  <strong>ג ן¸ Things to keep in mind:</strong>
                  {strategy.warnings.map((w, i) => (
                    <p key={i} style={{ margin: "4px 0" }}>
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 7: CONVERSION TRACKING ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "tracking" && (
            <div className="wiz-section">
              <h2 className="wiz-title">Track your sales from ads</h2>
              <p className="wiz-sub">
                This lets you see exactly how many sales your ads are
                generating, so you know what's working.
              </p>

              <div className="wiz-tracking-status">
                <div className="wiz-tracking-icon">נ“ˆ</div>
                <div className="wiz-tracking-info">
                  <h4>Google Conversion Tag</h4>
                  <p>
                    We'll set up a conversion action in Google Ads and provide
                    you with a tracking snippet to install on your Shopify
                    store.
                  </p>
                </div>
              </div>

              <div className="wiz-form-group">
                <label className="wiz-form-label">
                  What do you want to track?
                </label>
                <div className="wiz-radio-list">
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="convType"
                      checked={config.conversionType === "purchase"}
                      onChange={() =>
                        updateConfig("conversionType", "purchase")
                      }
                    />
                    <span>נ›’ Purchases (recommended for e-commerce)</span>
                  </label>
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="convType"
                      checked={config.conversionType === "add_to_cart"}
                      onChange={() =>
                        updateConfig("conversionType", "add_to_cart")
                      }
                    />
                    <span>נ›ן¸ Add to Cart</span>
                  </label>
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="convType"
                      checked={config.conversionType === "lead"}
                      onChange={() => updateConfig("conversionType", "lead")}
                    />
                    <span>נ“‹ Lead / Sign-up</span>
                  </label>
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="convType"
                      checked={config.conversionType === "page_view"}
                      onChange={() =>
                        updateConfig("conversionType", "page_view")
                      }
                    />
                    <span>נ‘ן¸ Page View</span>
                  </label>
                </div>
              </div>

              <div className="wiz-form-group">
                <label className="wiz-form-label">Conversion Value</label>
                <p className="wiz-form-hint">
                  How should we count the value of each conversion?
                </p>
                <div className="wiz-radio-list">
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="convValue"
                      checked={config.conversionValueType === "dynamic"}
                      onChange={() =>
                        updateConfig("conversionValueType", "dynamic")
                      }
                    />
                    <span>
                      Use dynamic values from Shopify (actual order amount)
                    </span>
                  </label>
                  <label className="wiz-radio-item">
                    <input
                      type="radio"
                      name="convValue"
                      checked={config.conversionValueType === "fixed"}
                      onChange={() =>
                        updateConfig("conversionValueType", "fixed")
                      }
                    />
                    <span>Use a fixed value per conversion</span>
                  </label>
                </div>
                {config.conversionValueType === "fixed" && (
                  <div className="wiz-bid-input-wrap">
                    <label>Default value ($)</label>
                    <input
                      type="number"
                      className="wiz-input-sm"
                      value={config.conversionFixedValue || ""}
                      onChange={(e) =>
                        updateConfig("conversionFixedValue", e.target.value)
                      }
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>

              <div className="wiz-info-box">
                <strong>נ“‹ What happens after launch:</strong>
                <p>
                  1. We'll create a conversion action in your Google Ads account
                </p>
                <p>
                  2. You'll receive a tracking snippet to add to Shopify
                  (Settings ג†’ Checkout ג†’ Additional scripts)
                </p>
                <p>
                  3. Google will start tracking conversions within 24-48 hours
                </p>
                <p>4. You can verify the setup in the Campaign Dashboard</p>
              </div>

              <div className="wiz-info-box wiz-info-warn">
                <strong>נ’¡ Tip:</strong> If you already have Google Tag Manager
                installed, you can skip this step and configure tracking there
                instead.
                <div style={{ marginTop: 8 }}>
                  <label className="wiz-radio-item">
                    <input
                      type="checkbox"
                      checked={config.skipTracking}
                      onChange={(e) =>
                        updateConfig("skipTracking", e.target.checked)
                      }
                    />
                    <span>
                      I already have conversion tracking set up ג€” skip this
                      step
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ג”€ג”€ג”€ג”€ STEP 8: REVIEW ג”€ג”€ג”€ג”€ */}
          {currentStep.id === "review" && (
            <div className="wiz-section">
              <h2 className="wiz-title">Review & Launch</h2>
              <p className="wiz-sub">
                Here's a summary of your campaign. Review everything before
                launching.
              </p>
              {launchState !== "idle" && (
                <LaunchProgress
                  launch={{
                    state: launchState,
                    steps: launchSteps,
                    error: launchError,
                    currentStep: launchSteps[launchSteps.length - 1]?.state,
                    progress:
                      launchState === "success"
                        ? 100
                        : launchState === "failed"
                          ? 0
                          : 50,
                    campaignId: null,
                    isLoading: launchState === "launching",
                    isFailed: launchState === "failed",
                    isPartial: false,
                    isSuccess: launchState === "success",
                    retry: handleRetryLaunch,
                    reset: () => {
                      setLaunchState("idle");
                      setLaunchError(null);
                      setLaunchSteps([]);
                    },
                    stepInfo: {},
                  }}
                />
              )}

              {strategy?.confidence && (
                <div className="wiz-ai-rec">
                  <div className="wiz-ai-rec-badge">
                    נ₪– AI Confidence: {strategy.confidence}%
                  </div>
                  <div className="wiz-ai-rec-text">
                    <span className="wiz-ai-rec-reason">
                      {strategy.confidenceReason}
                    </span>
                  </div>
                </div>
              )}

              {strategy?.quickWins?.length > 0 && (
                <div className="wiz-info-box">
                  <strong>נ¯ Quick wins to boost performance:</strong>
                  {strategy.quickWins.map((w, i) => (
                    <p key={i} style={{ margin: "4px 0" }}>
                      ג€¢ {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="wiz-review-grid">
                <div className="wiz-review-card">
                  <h4>נ¯ Goal</h4>
                  <p>
                    {GOALS.find((g) => g.id === config.goal)?.title ||
                      config.goal}
                  </p>
                  <p className="wiz-review-detail">
                    {GOALS.find((g) => g.id === config.goal)?.googleTerm &&
                      `Google calls this: "${GOALS.find((g) => g.id === config.goal)?.googleTerm}"`}
                  </p>
                </div>
                <div className="wiz-review-card">
                  <h4>נ“¢ Where</h4>
                  <p>
                    {CAMPAIGN_TYPES.find((t) => t.id === config.campaignType)
                      ?.title || config.campaignType}
                  </p>
                  <p className="wiz-review-detail">
                    {
                      CAMPAIGN_TYPES.find((t) => t.id === config.campaignType)
                        ?.subtitle
                    }
                  </p>
                </div>
                <div className="wiz-review-card">
                  <h4>נ’° Strategy</h4>
                  <p>
                    {BIDDING_STRATEGIES.find((b) => b.id === config.bidding)
                      ?.title || config.bidding}
                  </p>
                  <p className="wiz-review-detail">
                    {
                      BIDDING_STRATEGIES.find((b) => b.id === config.bidding)
                        ?.subtitle
                    }
                  </p>
                  {config.biddingTarget && (
                    <p className="wiz-review-detail">
                      Target: ${config.biddingTarget}
                    </p>
                  )}
                </div>
                <div className="wiz-review-card">
                  <h4>נ“ Budget</h4>
                  <p>
                    ${config.budgetAmount}{" "}
                    {config.budgetType === "daily" ? "/day" : " total"}
                  </p>
                  <p className="wiz-review-detail">
                    {config.budgetDuration === "ongoing"
                      ? "Runs until you stop it"
                      : `Until ${config.budgetEndDate}`}
                  </p>
                  <p className="wiz-review-detail">
                    ~${(parseFloat(config.budgetAmount || 0) * 30.4).toFixed(0)}
                    /month
                  </p>
                </div>
                <div className="wiz-review-card">
                  <h4>נ“ Location</h4>
                  <p>
                    {LOCATIONS.find(
                      (l) => l.id === config.locations,
                    )?.label?.split("ג€”")[0] || config.locations}
                  </p>
                </div>
                <div className="wiz-review-card">
                  <h4>נ—£ן¸ Languages</h4>
                  <p>
                    {config.languages
                      .map(
                        (l) =>
                          ({
                            en: "English",
                            he: "Hebrew",
                            es: "Spanish",
                            fr: "French",
                            de: "German",
                            ar: "Arabic",
                            ru: "Russian",
                            zh: "Chinese",
                            ja: "Japanese",
                            pt: "Portuguese",
                          })[l] || l,
                      )
                      .join(", ")}
                  </p>
                </div>
              </div>

              <div className="wiz-review-section">
                <h4>Assets Summary</h4>
                <div className="wiz-review-assets">
                  <div className="wiz-review-asset">
                    <span className="wiz-review-count">
                      {editHeadlines.length}
                    </span>{" "}
                    Headlines
                  </div>
                  <div className="wiz-review-asset">
                    <span className="wiz-review-count">
                      {editDescriptions.length}
                    </span>{" "}
                    Descriptions
                  </div>
                  <div className="wiz-review-asset">
                    <span className="wiz-review-count">
                      {editSitelinks.filter((s) => s.title).length}
                    </span>{" "}
                    Sitelinks
                  </div>
                  <div className="wiz-review-asset">
                    <span className="wiz-review-count">
                      {config.callouts.filter((c) => c).length}
                    </span>{" "}
                    Callouts
                  </div>
                  <div className="wiz-review-asset">
                    <span className="wiz-review-count">
                      {(aiData?.keywords || []).length}
                    </span>{" "}
                    Keywords
                  </div>
                </div>
              </div>

              {/* Ad Preview */}
              <div className="wiz-preview-section">
                <h4>Ad Preview</h4>
                <div className="wiz-ad-preview">
                  <div className="wiz-ad-sponsor">Sponsored</div>
                  <div className="wiz-ad-url">
                    {config.finalUrl || "yourstore.com"}
                  </div>
                  <div className="wiz-ad-headline">
                    {editHeadlines[0] || "Headline 1"} |{" "}
                    {editHeadlines[1] || "Headline 2"} |{" "}
                    {editHeadlines[2] || "Headline 3"}
                  </div>
                  <div className="wiz-ad-desc">
                    {editDescriptions[0] ||
                      "Your ad description will appear here."}
                  </div>
                  {editSitelinks.filter((s) => s.title).length > 0 && (
                    <div className="wiz-ad-sitelinks">
                      {editSitelinks
                        .filter((s) => s.title)
                        .map((sl, i) => (
                          <span key={i} className="wiz-ad-sl">
                            {sl.title}
                          </span>
                        ))}
                    </div>
                  )}
                  {config.callouts.filter((c) => c).length > 0 && (
                    <div className="wiz-ad-callouts">
                      {config.callouts.filter((c) => c).join(" ֲ· ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="wiz-info-box">
                <strong>Campaign will be created in PAUSED state.</strong>
                <p>
                  You can review everything in Google Ads before activating.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wiz-footer">
          {step > 0 && (
            <button
              className="wiz-btn-back"
              onClick={() => {
                if (launchState !== "idle") {
                  setLaunchState("idle");
                  setLaunchError(null);
                  setLaunchSteps([]);
                }
                setStep((s) => s - 1);
              }}
            >
              ג† Back
            </button>
          )}
          <div className="wiz-footer-right">
            {step < STEPS.length - 1 ? (
              <button
                className="wiz-btn-next"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
              >
                Next ג†’
              </button>
            ) : (
              <button
                className="wiz-btn-launch"
                onClick={handleLaunch}
                disabled={
                  launchState === "launching" || launchState === "success"
                }
              >
                נ€ Publish Campaign
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ג”€ג”€ג”€ג”€ג”€ג”€ CSS ג”€ג”€ג”€ג”€ג”€ג”€ */
export const WIZARD_CSS = `
.wiz-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.wiz-container{background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:16px;width:95vw;max-width:900px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;position:relative}
.wiz-stepper{display:flex;gap:2px;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto}
.wiz-step-item{display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;font-size:11px;color:rgba(255,255,255,.35);cursor:default;white-space:nowrap;transition:all .2s}
.wiz-step-active{background:rgba(99,102,241,.15);color:#818cf8;font-weight:700}
.wiz-step-done{color:rgba(34,197,94,.7);cursor:pointer}
.wiz-step-done:hover{background:rgba(34,197,94,.08)}
.wiz-step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;border:2px solid currentColor}
.wiz-step-active .wiz-step-num{background:#818cf8;color:#0f0f1a;border-color:#818cf8}
.wiz-step-done .wiz-step-num{background:#22c55e;color:#0f0f1a;border-color:#22c55e}
.wiz-step-label{display:none}
@media(min-width:768px){.wiz-step-label{display:inline}}
.wiz-content{flex:1;overflow-y:auto;padding:24px}
.wiz-section{}
.wiz-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px}
.wiz-sub{font-size:13px;color:rgba(255,255,255,.4);margin-bottom:20px}
.wiz-cards-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px}
.wiz-cards-wide{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.wiz-card{background:rgba(255,255,255,.03);border:2px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;cursor:pointer;transition:all .2s;position:relative}
.wiz-card:hover{border-color:rgba(99,102,241,.3);background:rgba(99,102,241,.05)}
.wiz-card-sel{border-color:#818cf8;background:rgba(99,102,241,.1)}
.wiz-card-rec{border-color:rgba(34,197,94,.3)}
.wiz-rec-badge{position:absolute;top:8px;right:8px;font-size:9px;font-weight:700;background:rgba(34,197,94,.15);color:#22c55e;padding:2px 8px;border-radius:4px}
.wiz-card-icon{font-size:28px;display:block;margin-bottom:8px}
.wiz-card-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:4px}
.wiz-card-desc{font-size:11px;color:rgba(255,255,255,.4);line-height:1.4}
.wiz-channels{display:flex;gap:4px;margin-top:8px;flex-wrap:wrap}
.wiz-channel{font-size:9px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.4);padding:2px 6px;border-radius:3px}
.wiz-info-box{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.15);border-radius:10px;padding:12px;font-size:12px;color:rgba(255,255,255,.5);line-height:1.5;margin-top:12px}
.wiz-info-box strong{color:rgba(255,255,255,.7)}
.wiz-info-box p{margin:4px 0 0;color:rgba(255,255,255,.4)}
.wiz-info-warn{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.15)}
.wiz-conv-goals{display:flex;gap:10px;margin-top:8px}
.wiz-conv-goal{display:flex;align-items:center;gap:6px;font-size:12px;background:rgba(255,255,255,.04);padding:6px 12px;border-radius:8px}
.wiz-conv-icon{font-size:16px}
.wiz-bidding-list{display:flex;flex-direction:column;gap:8px}
.wiz-bid-item{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;cursor:pointer;transition:all .2s}
.wiz-bid-item:hover{border-color:rgba(99,102,241,.3)}
.wiz-bid-sel{border-color:#818cf8;background:rgba(99,102,241,.08)}
.wiz-bid-radio{font-size:16px;color:#818cf8;margin-top:2px}
.wiz-bid-info{flex:1}
.wiz-bid-title{font-size:13px;font-weight:700;color:#fff}
.wiz-bid-rec{font-size:9px;background:rgba(34,197,94,.15);color:#22c55e;padding:2px 6px;border-radius:3px;margin-left:6px;font-weight:800}
.wiz-bid-desc{font-size:11px;color:rgba(255,255,255,.4);margin-top:2px}
.wiz-bid-input-wrap{margin-top:8px;display:flex;align-items:center;gap:8px}
.wiz-bid-input-wrap label{font-size:11px;color:rgba(255,255,255,.4)}
.wiz-input-sm{width:100px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#fff;padding:6px 10px;font-size:13px}
.wiz-form-group{margin-bottom:20px}
.wiz-form-label{font-size:14px;font-weight:700;color:rgba(255,255,255,.7);margin-bottom:6px;display:block}
.wiz-form-sublabel{font-size:11px;font-weight:600;color:rgba(255,255,255,.4);margin-bottom:4px;display:block}
.wiz-form-hint{font-size:11px;color:rgba(255,255,255,.3);margin-bottom:8px}
.wiz-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.wiz-form-col{display:flex;flex-direction:column}
.wiz-input{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;padding:8px 12px;font-size:13px;transition:border-color .2s}
.wiz-input:focus{outline:none;border-color:#818cf8;background:rgba(99,102,241,.05)}
.wiz-textarea{resize:vertical;min-height:48px}
.wiz-select,.wiz-select-sm{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;padding:6px 10px;font-size:12px}
.wiz-char-count{font-size:10px;color:rgba(255,255,255,.25);white-space:nowrap}
.wiz-over{color:#ef4444}
.wiz-radio-list{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}
.wiz-radio-item{display:flex;align-items:center;gap:8px;font-size:13px;color:rgba(255,255,255,.6);cursor:pointer}
.wiz-radio-item input{accent-color:#818cf8}
.wiz-tag-list{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.wiz-tag{font-size:12px;background:rgba(99,102,241,.15);color:#818cf8;padding:4px 10px;border-radius:6px;display:flex;align-items:center;gap:4px}
.wiz-tag button{background:none;border:none;color:#818cf8;cursor:pointer;font-size:12px;padding:0}
.wiz-asset-list{display:flex;flex-direction:column;gap:6px}
.wiz-asset-row{display:flex;align-items:center;gap:6px}
.wiz-asset-num{font-size:10px;font-weight:800;color:rgba(255,255,255,.2);min-width:18px;text-align:center}
.wiz-btn-ai{background:linear-gradient(135deg,#f59e0b,#f97316);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:transform .15s;flex-shrink:0}
.wiz-btn-ai:hover{transform:scale(1.1)}
.wiz-btn-ai:disabled{opacity:.4;cursor:not-allowed;transform:none}
.wiz-btn-add{background:none;border:1px dashed rgba(99,102,241,.3);color:#818cf8;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;width:100%;text-align:center}
.wiz-btn-add:hover{background:rgba(99,102,241,.08);border-color:#818cf8}
.wiz-upload-grid{display:flex;gap:10px;flex-wrap:wrap}
.wiz-upload-thumb{width:100px;height:100px;border-radius:8px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,.1)}
.wiz-upload-thumb img{width:100%;height:100%;object-fit:cover}
.wiz-thumb-label{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.7);font-size:9px;color:rgba(255,255,255,.6);text-align:center;padding:2px}
.wiz-upload-zone{border:2px dashed rgba(255,255,255,.1);border-radius:10px;padding:16px;text-align:center;color:rgba(255,255,255,.3);font-size:12px;cursor:pointer;transition:all .2s;min-width:100px}
.wiz-upload-zone:hover{border-color:rgba(99,102,241,.3);background:rgba(99,102,241,.05)}
.wiz-upload-zone span{font-size:20px;display:block;margin-bottom:4px}
.wiz-upload-zone p{margin:2px 0;font-size:10px}
.wiz-upload-specs{color:rgba(255,255,255,.2)!important}
.wiz-upload-add{width:100px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px}
.wiz-snippet-wrap{display:flex;flex-direction:column;gap:8px}
.wiz-sitelinks-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.wiz-sl-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px}
.wiz-sl-head{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.35);font-weight:700}
.wiz-sl-head button{background:none;border:none;color:rgba(255,255,255,.25);cursor:pointer}
.wiz-adstrength{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;margin-bottom:20px}
.wiz-adstrength-label{font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px}
.wiz-adstrength-bar{height:6px;background:rgba(255,255,255,.08);border-radius:3px;margin:8px 0;overflow:hidden}
.wiz-adstrength-fill{height:100%;border-radius:3px;transition:width .4s}
.wiz-adstrength-txt{font-size:13px;font-weight:800}
.wiz-adstrength-checklist{display:flex;gap:12px;margin-top:8px;font-size:10px;color:rgba(255,255,255,.25)}
.wiz-check-ok{color:#22c55e}
.wiz-check-ok::before{content:"ג“ "}
.wiz-budget-tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.wiz-budget-card{background:rgba(255,255,255,.03);border:2px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:all .2s}
.wiz-budget-card:hover{border-color:rgba(99,102,241,.3)}
.wiz-budget-sel{border-color:#818cf8;background:rgba(99,102,241,.08)}
.wiz-budget-rec{font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,.12);padding:2px 8px;border-radius:4px;display:inline-block;margin-bottom:6px}
.wiz-budget-val{font-size:28px;font-weight:900;color:#fff}
.wiz-budget-type{font-size:12px;color:rgba(255,255,255,.4);margin-top:2px}
.wiz-budget-est{font-size:11px;color:rgba(255,255,255,.35);margin-top:8px;display:flex;flex-direction:column;gap:2px}
.wiz-budget-custom-label{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:6px}
.wiz-budget-input-wrap{display:flex;align-items:center;justify-content:center;gap:4px}
.wiz-budget-currency{font-size:22px;font-weight:800;color:rgba(255,255,255,.4)}
.wiz-budget-input{width:100px;background:none;border:none;border-bottom:2px solid rgba(255,255,255,.15);color:#fff;font-size:28px;font-weight:900;text-align:center;padding:4px}
.wiz-budget-input:focus{outline:none;border-color:#818cf8}
.wiz-budget-summary{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;margin-bottom:16px}
.wiz-budget-row{display:flex;justify-content:space-between;font-size:13px;color:rgba(255,255,255,.5);padding:4px 0}
.wiz-budget-row strong{color:#fff}
.wiz-review-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.wiz-review-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px}
.wiz-review-card h4{font-size:12px;color:rgba(255,255,255,.4);margin-bottom:4px}
.wiz-review-card p{font-size:13px;color:#fff;font-weight:600;margin:0}
.wiz-review-detail{font-size:11px;color:rgba(255,255,255,.35)!important;font-weight:400!important;margin-top:2px!important}
.wiz-review-section{margin-bottom:16px}
.wiz-review-section h4{font-size:14px;font-weight:700;color:rgba(255,255,255,.6);margin-bottom:8px}
.wiz-review-assets{display:flex;gap:12px;flex-wrap:wrap}
.wiz-review-asset{display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,.5)}
.wiz-review-count{font-size:18px;font-weight:900;color:#818cf8}
.wiz-preview-section{margin-bottom:16px}
.wiz-preview-section h4{font-size:14px;font-weight:700;color:rgba(255,255,255,.6);margin-bottom:8px}
.wiz-ad-preview{background:#fff;border-radius:10px;padding:16px;max-width:500px}
.wiz-ad-sponsor{font-size:10px;color:#555;font-weight:700;margin-bottom:2px}
.wiz-ad-url{font-size:12px;color:#202124;margin-bottom:4px}
.wiz-ad-headline{font-size:16px;color:#1a0dab;font-weight:600;line-height:1.3;margin-bottom:4px;cursor:pointer}
.wiz-ad-desc{font-size:13px;color:#545454;line-height:1.4}
.wiz-ad-sitelinks{display:flex;gap:12px;margin-top:8px;flex-wrap:wrap}
.wiz-ad-sl{font-size:12px;color:#1a0dab;cursor:pointer}
.wiz-ad-callouts{font-size:11px;color:#545454;margin-top:6px}
.wiz-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.2)}
.wiz-footer-right{margin-left:auto}
.wiz-btn-back{background:none;border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);padding:8px 18px;border-radius:8px;font-size:13px;cursor:pointer;transition:all .2s}
.wiz-btn-back:hover{border-color:rgba(255,255,255,.2);color:#fff}
.wiz-btn-next{background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s}
.wiz-btn-next:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.3)}
.wiz-btn-next:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.wiz-btn-launch{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;padding:12px 32px;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(34,197,94,.3)}
.wiz-btn-launch:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(34,197,94,.4)}
.wiz-tracking-status{display:flex;align-items:flex-start;gap:14px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:12px;padding:16px;margin-bottom:20px}
.wiz-tracking-icon{font-size:32px;flex-shrink:0}
.wiz-tracking-info h4{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px}
.wiz-tracking-info p{font-size:12px;color:rgba(255,255,255,.4);line-height:1.5;margin:0}

.wiz-ai-rec{background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(168,85,247,.08));border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.wiz-ai-rec-sm{padding:10px 14px;margin-bottom:10px}
.wiz-ai-rec-badge{font-size:10px;font-weight:800;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;padding:3px 10px;border-radius:20px;white-space:nowrap}
.wiz-ai-rec-text{flex:1;font-size:13px;color:rgba(255,255,255,.7);min-width:150px}
.wiz-ai-rec-text strong{color:#fff;display:block}
.wiz-ai-rec-reason{display:block;font-size:11px;color:rgba(255,255,255,.4);margin-top:2px}
.wiz-ai-rec-btn{background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#818cf8;font-size:11px;font-weight:700;padding:5px 14px;border-radius:6px;cursor:pointer;white-space:nowrap;transition:all .2s}
.wiz-ai-rec-btn:hover{background:rgba(99,102,241,.25);border-color:#818cf8}

.wiz-loc-list{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.wiz-loc-item{display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;cursor:pointer;transition:all .2s;font-size:13px;color:rgba(255,255,255,.6)}
.wiz-loc-item:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
.wiz-loc-sel{background:rgba(99,102,241,.08)!important;border-color:rgba(99,102,241,.3)!important;color:#fff}
.wiz-loc-icon{font-size:18px;flex-shrink:0}
.wiz-loc-label{flex:1}
.wiz-loc-rec{font-size:9px;font-weight:800;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(168,85,247,.15));color:#a78bfa;padding:2px 8px;border-radius:10px;white-space:nowrap}
.wiz-loc-item input[type="radio"]{display:none}
.wiz-custom-loc{margin-top:8px}

.wiz-card-subtitle{font-size:10px;color:rgba(255,255,255,.3);display:block;margin-top:-2px;margin-bottom:4px}
.wiz-bid-sub{font-size:9px;color:rgba(255,255,255,.25);margin-left:6px;font-weight:400}

.wiz-budget-popular{border-color:rgba(99,102,241,.3)!important;box-shadow:0 0 20px rgba(99,102,241,.1)}
.wiz-budget-tier-label{font-size:11px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:6px}

`;
