import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

const REAL_STEPS = [
  { label: "Fetching products from your store", icon: "📦", threshold: 5 },
  { label: "Searching Google for competitors", icon: "🔍", threshold: 20 },
  { label: "Analyzing competitor websites", icon: "🕵️", threshold: 40 },
  { label: "Checking your Google rankings", icon: "📍", threshold: 60 },
  { label: "Generating AI-optimized ad copy", icon: "🤖", threshold: 80 },
  { label: "Building your competitive strategy", icon: "📊", threshold: 98 },
];

const INTRO_PHASES = [
  { label: "Connecting to your Shopify store", icon: "🔗", duration: 1400 },
  { label: "Reading your product catalog", icon: "📦", duration: 1200 },
  { label: "Connecting AI analysis engine", icon: "🤖", duration: 1200 },
];

// ══════════════════════════════════════════════
// GOOGLE ADS LIVE DATA HOOK
// Tries real API first → falls back to mock
// When Google Ads is connected, data flows automatically
// ══════════════════════════════════════════════;

function CollectingDataScreen({
  totalProducts,
  onScan,
  realProgress,
  scanMsg,
  onCancel,
}) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [scanStarted, setScanStarted] = useState(false);
  const [dots, setDots] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Animated dots
  useEffect(() => {
    const iv = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      500,
    );
    return () => clearInterval(iv);
  }, []);

  // Run intro sequence, then trigger real scan
  useEffect(() => {
    let cancelled = false;
    async function run() {
      for (let i = 0; i < INTRO_PHASES.length; i++) {
        if (cancelled) return;
        setCurrentStep(i);
        const from = Math.round((i / INTRO_PHASES.length) * 15);
        const to = Math.round(((i + 1) / INTRO_PHASES.length) * 15);
        await animateProgress(from, to, INTRO_PHASES[i].duration);
        if (cancelled) return;
      }
      if (!scanStarted) {
        setScanStarted(true);
        onScan();
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  function animateProgress(from, to, duration) {
    return new Promise((resolve) => {
      const steps = to - from;
      if (steps <= 0) {
        setProgress(to);
        resolve();
        return;
      }
      const stepDuration = (duration || 1200) / steps;
      let current = from;
      const iv = setInterval(() => {
        current++;
        setProgress(current);
        if (current >= to) {
          clearInterval(iv);
          resolve();
        }
      }, stepDuration);
    });
  }

  // Once real scan starts, use realProgress
  const displayProgress =
    scanStarted && realProgress != null ? Math.max(15, realProgress) : progress;

  const isDone = displayProgress >= 100;

  // Current step label
  let currentLabel, currentIcon;
  if (!scanStarted) {
    const p = INTRO_PHASES[Math.min(currentStep, INTRO_PHASES.length - 1)];
    currentLabel = p?.label;
    currentIcon = p?.icon;
  } else {
    const activeStep =
      REAL_STEPS.findLast((s) => displayProgress >= s.threshold - 20) ||
      REAL_STEPS[0];
    currentLabel = isDone ? "Your store is ready!" : activeStep.label;
    currentIcon = activeStep.icon;
  }

  const title = isDone ? "Your store is ready! 🎉" : currentLabel + dots;
  const words = [
    "impressions",
    "clicks",
    "CTR",
    "ROAS",
    "keywords",
    "budget",
    "CPC",
    "conversions",
    "reach",
    "bids",
    "ads",
    "score",
  ];

  return (
    <div className="cds-wrap">
      <div className="cds-particles">
        {words.map((w, i) => (
          <div
            key={i}
            className="cds-particle"
            style={{
              left: `${8 + ((i * 8) % 84)}%`,
              top: `${15 + ((i * 11) % 70)}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3.5 + (i % 3) * 0.8}s`,
            }}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="cds-center">
        <div className="cds-radar">
          <div className="cds-ring cds-ring-1" />
          <div className="cds-ring cds-ring-2" />
          <div className="cds-ring cds-ring-3" />
          <div
            className="cds-radar-dot"
            style={
              isDone
                ? { background: "#22c55e", boxShadow: "0 0 24px #22c55e" }
                : {}
            }
          />
          {!isDone && <div className="cds-radar-sweep" />}
          {isDone && <div className="cds-done-check">✓</div>}
          {totalProducts > 0 && (
            <div className="cds-radar-counter">
              <span className="cds-radar-num">{totalProducts}</span>
              <span className="cds-radar-denom"> products</span>
            </div>
          )}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">
          {isDone
            ? `${totalProducts} products analyzed — your dashboard is ready`
            : scanStarted && scanMsg
              ? scanMsg
              : `Setting up your AI campaign intelligence for ${totalProducts} products`}
        </div>

        <div className="cds-progress-wrap">
          <div className="cds-progress-bar">
            <div
              className="cds-progress-fill"
              style={{ width: `${displayProgress}%` }}
            />
            <div
              className="cds-progress-glow"
              style={{ left: `${Math.min(displayProgress, 98)}%` }}
            />
          </div>
          <div className="cds-progress-pct">{displayProgress}%</div>
        </div>

        <div className="cds-steps">
          {(scanStarted ? REAL_STEPS : INTRO_PHASES).map((p, i) => {
            let done, active;
            if (scanStarted) {
              // Determine active step from scanMsg content
              const msgLower = (scanMsg || "").toLowerCase();
              const stepKeywords = [
                ["fetching", "store", "found"],
                ["google", "competitor", "search"],
                ["analyzing", "website"],
                ["ranking", "rank"],
                ["ai", "copy", "headline", "generat", "analyzing product"],
                ["strategy", "campaign", "together", "ready", "done"],
              ];
              let activeIdx = 0;
              for (let k = 0; k < stepKeywords.length; k++) {
                if (stepKeywords[k].some((kw) => msgLower.includes(kw)))
                  activeIdx = k;
              }
              if (displayProgress >= 100) activeIdx = REAL_STEPS.length;
              done = i < activeIdx;
              active = i === activeIdx;
            } else {
              done = i < currentStep;
              active = i === currentStep;
            }
            return (
              <div
                key={i}
                className={`cds-step ${done ? "cds-step-done" : active ? "cds-step-active" : "cds-step-waiting"}`}
              >
                <div className="cds-step-icon">
                  {done ? (
                    "✓"
                  ) : active ? (
                    <span className="cds-step-spinner" />
                  ) : (
                    "○"
                  )}
                </div>
                <span className="cds-step-label">
                  {p.icon} {p.label}
                </span>
                {done && <span className="cds-step-done-badge">done</span>}
              </div>
            );
          })}
        </div>

        {isDone && (
          <div
            className="cds-cta-wrap"
            style={{ animation: "cdsCtaPop .5s ease" }}
          >
            <div className="cds-cta-msg">
              ✅ Analysis complete — loading your dashboard
            </div>
            <div className="cds-loading-bar">
              <div className="cds-loading-fill" />
            </div>
          </div>
        )}

        {/* Cancel button */}
        {!isDone && onCancel && (
          <button
            className="cds-cancel-btn"
            onClick={() => setShowCancelConfirm(true)}
          >
            ✕ Cancel scan
          </button>
        )}
      </div>

      {/* Cancel confirm dialog */}
      {showCancelConfirm && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 8,
                color: "#fff",
              }}
            >
              Cancel scan?
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,.55)",
                marginBottom: 24,
                lineHeight: 1.5,
              }}
            >
              The scan is in progress. If you cancel now, your products won't be
              analyzed and you'll return to the home screen.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                className="btn-secondary"
                style={{ padding: "10px 22px", fontSize: 13 }}
                onClick={() => setShowCancelConfirm(false)}
              >
                Continue Scanning
              </button>
              <button
                className="btn-primary"
                style={{
                  padding: "10px 22px",
                  fontSize: 13,
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                }}
                onClick={() => {
                  setShowCancelConfirm(false);
                  onCancel();
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
// AD PREVIEW PANEL
// ══════════════════════════════════════════════

export { CollectingDataScreen };
