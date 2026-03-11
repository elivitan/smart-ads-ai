import React, { startTransition } from "react";

// ══════════════════════════════════════════════
// ONBOARD MODAL — extracted from Index() to prevent remount on every re-render
// BUG FIX: When defined inside Index(), React recreated these on every state change,
// causing modals to lose state, flash, and break interaction.
// ══════════════════════════════════════════════

export const OnboardModal = React.memo(function OnboardModal({
  onClose,
  onboardTab,
  setOnboardTab,
  onboardStep,
  setOnboardStep,
  selectedPlan,
  selectPlan,
  googleConnected,
  setGoogleConnected,
  scanCredits,
  setScanCredits,
  onLaunchChoice,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal onboard-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="onboard-tabs">
          <button
            className={`onboard-tab ${onboardTab === "subscription" ? "active" : ""}`}
            onClick={() => {
              setOnboardTab("subscription");
              setOnboardStep(1);
            }}
          >
            📋 Subscription Plans
          </button>
          <button
            className={`onboard-tab ${onboardTab === "credits" ? "active" : ""}`}
            onClick={() => setOnboardTab("credits")}
          >
            ⚡ Buy Scan Credits
          </button>
        </div>
        {onboardTab === "credits" ? (
          <div className="onboard-content">
            <h2 className="onboard-title">Buy Scan Credits</h2>
            <p className="onboard-sub">
              No subscription needed. Each credit = one full product scan with
              competitor intelligence & AI ad copy.
            </p>
            <div className="scan-credit-packages">
              {[
                { amt: 10, price: "$9.99", per: "$0.99/scan" },
                { amt: 50, price: "$34.99", per: "$0.70/scan", best: true },
                { amt: 100, price: "$59.99", per: "$0.60/scan" },
              ].map((pkg, i) => (
                <div
                  key={i}
                  className={`scan-credit-pkg ${pkg.best ? "scp-popular" : ""}`}
                  onClick={() => {
                    setScanCredits(scanCredits + pkg.amt);
                    onClose();
                  }}
                >
                  {pkg.best && <div className="scp-badge">BEST VALUE</div>}
                  <div className="scp-amount">{pkg.amt}</div>
                  <div className="scp-label">scans</div>
                  <div className="scp-price">{pkg.price}</div>
                  <div className="scp-per">{pkg.per}</div>
                </div>
              ))}
            </div>
            <div className="onboard-credits-info">
              <div className="oci-row">✅ Full AI analysis per product</div>
              <div className="oci-row">✅ Competitor intelligence included</div>
              <div className="oci-row">✅ Ad copy & keywords generated</div>
              <div className="oci-row">
                🔒 Publishing to Google Ads requires subscription
              </div>
            </div>
            <div className="onboard-credits-tip">
              💡 Want unlimited scans + publishing?{" "}
              <span onClick={() => setOnboardTab("subscription")}>
                Compare subscription plans →
              </span>
            </div>
          </div>
        ) : onboardStep === 1 ? (
          <div className="onboard-content">
            <div className="onboard-progress">
              <div className="onboard-step-dot active">1</div>
              <div className="onboard-line" />
              <div className="onboard-step-dot">2</div>
            </div>
            <h2 className="onboard-title">Choose Your Plan</h2>
            <p className="onboard-sub">
              Start with 7 days free. Cancel anytime.
            </p>
            <div className="plan-cards plan-cards-3">
              {[
                {
                  id: "starter",
                  name: "Starter",
                  price: "$29",
                  features: [
                    "Up to 25 products",
                    "5 active campaigns",
                    "AI ad copy generation",
                    "10 AI credits/mo",
                    "Publish to Google Ads",
                  ],
                },
                {
                  id: "pro",
                  name: "Pro",
                  price: "$79",
                  badge: "MOST POPULAR",
                  features: [
                    "Unlimited products",
                    "Unlimited campaigns",
                    "Advanced AI optimization",
                    "200 AI credits/mo",
                    "Competitor analysis",
                    "Publish to Google Ads",
                  ],
                },
                {
                  id: "premium",
                  name: "Premium",
                  price: "$149",
                  badge: "👑 PREMIUM",
                  badgeGold: true,
                  features: [
                    "Everything in Pro",
                    "1,000 AI credits/mo",
                    "Priority AI processing",
                    "Dedicated support",
                    "Multi-store support",
                  ],
                },
              ].map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card ${selectedPlan === plan.id ? "plan-selected" : ""}`}
                  onClick={() => startTransition(() => selectPlan(plan.id))}
                >
                  {plan.badge && (
                    <div
                      className={`plan-badge ${plan.badgeGold ? "plan-badge-gold" : ""}`}
                    >
                      {plan.badge}
                    </div>
                  )}
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-price">
                    {plan.price}
                    <span>/mo</span>
                  </div>
                  <ul className="plan-features">
                    {plan.features.map((f, i) => (
                      <li key={i}>✓ {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button
              className="btn-onboard"
              disabled={!selectedPlan}
              onClick={() => setOnboardStep(2)}
            >
              Continue →
            </button>
          </div>
        ) : (
          <div className="onboard-content">
            <div className="onboard-progress">
              <div className="onboard-step-dot active">1</div>
              <div className="onboard-line active" />
              <div className="onboard-step-dot active">2</div>
            </div>
            <h2 className="onboard-title">Connect Google Ads</h2>
            <p className="onboard-sub">
              Link your Google Ads account to start creating campaigns.
            </p>
            <div className="google-connect-box">
              <div className="google-logo">
                <svg width="40" height="40" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              {googleConnected ? (
                <div className="google-connected">
                  <span className="google-check">✓</span> Google Ads Connected
                </div>
              ) : (
                <button
                  className="btn-google"
                  onClick={() =>
                    setTimeout(() => setGoogleConnected(true), 1500)
                  }
                >
                  Connect Google Ads
                </button>
              )}
              <div className="google-trust">
                <span>🔒 Secure OAuth 2.0</span>
                <span>🚫 No passwords stored</span>
              </div>
            </div>
            {googleConnected && (
              <button
                className="btn-onboard"
                onClick={() => {
                  onClose();
                  onLaunchChoice();
                }}
              >
                🚀 Start Scanning My Store
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const BuyCreditsModal = React.memo(function BuyCreditsModal({
  onClose,
  aiCredits,
  setAiCredits,
}) {
  return (
    <div className="credits-modal-overlay" onClick={onClose}>
      <div className="credits-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
          AI Improvement Credits
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,.5)",
            marginBottom: 20,
          }}
        >
          Balance:{" "}
          <strong style={{ color: "#a5b4fc" }}>{aiCredits} credits</strong>
        </p>
        <div className="credits-packages">
          {[
            { amt: 50, price: "$4.99" },
            { amt: 200, price: "$14.99", best: true },
            { amt: 500, price: "$29.99" },
          ].map((pkg, i) => (
            <div
              key={i}
              className={`credit-pkg ${pkg.best ? "credit-pkg-popular" : ""}`}
              onClick={() => {
                setAiCredits(aiCredits + pkg.amt);
                onClose();
              }}
            >
              {pkg.best && <div className="credit-pkg-badge">BEST VALUE</div>}
              <div className="credit-pkg-amount">{pkg.amt}</div>
              <div className="credit-pkg-label">credits</div>
              <div className="credit-pkg-price">{pkg.price}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
