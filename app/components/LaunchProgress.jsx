import React from "react";
// getStepInfo — inlined from deleted useCampaignLaunch.js
function getStepInfo(stepKey) {
  const STEPS = {
    createCampaign:   { label: "Creating campaign...",       icon: "🚀" },
    createAdGroup:    { label: "Setting up ad group...",     icon: "📦" },
    createAd:         { label: "Building your ad...",        icon: "✍️" },
    setKeywords:      { label: "Adding keywords...",         icon: "🔑" },
    setBudget:        { label: "Configuring budget...",      icon: "💰" },
    enableCampaign:   { label: "Going live!",                icon: "✅" },
    verifyStatus:     { label: "Verifying status...",        icon: "🔍" },
    done:             { label: "Campaign is live!",          icon: "🎉" },
  };
  return STEPS[stepKey] || { label: stepKey, icon: "⏳" };
}

/**
 * LaunchProgress — Visual progress for campaign creation.
 * Shows each lifecycle step with status, progress bar, and error/retry UI.
 *
 * Usage in CampaignWizard:
 *   {launch.isLoading || launch.isSuccess || launch.isFailed ? (
 *     <LaunchProgress launch={launch} />
 *   ) : ( ... normal review step ... )}
 */
const LaunchProgress = React.memo(function LaunchProgress({ launch }) {
  const {
    state,
    steps,
    error,
    progress,
    stepInfo,
    campaignId,
    isLoading,
    isFailed,
    isPartial,
    isSuccess,
  } = launch;

  const ALL_STEPS = [
    "QUEUED",
    "VALIDATING",
    "CREATING",
    "CAMPAIGN_CREATED",
    "UPLOADING_ASSETS",
    "ASSETS_UPLOADED",
    "LINKING_CONVERSIONS",
    "ENABLED",
  ];

  const completedStates = new Set(steps.map((s) => s.state));

  return (
    <div
      style={{
        background: "rgba(255,255,255,.03)",
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${isSuccess ? "rgba(34,197,94,.3)" : isFailed ? "rgba(239,68,68,.3)" : "rgba(99,102,241,.3)"}`,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>
          {isSuccess ? "🎉" : isFailed ? "😓" : "🚀"}
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            color: isSuccess ? "#22c55e" : isFailed ? "#ef4444" : "#818cf8",
          }}
        >
          {isSuccess
            ? "Campaign is Live!"
            : isFailed
              ? "Launch Failed"
              : "Creating Your Campaign..."}
        </h3>
        {isSuccess && campaignId && (
          <p
            style={{
              color: "rgba(255,255,255,.4)",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Campaign ID: {campaignId}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div
        style={{
          background: "rgba(255,255,255,.06)",
          borderRadius: 8,
          height: 8,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 8,
            width: `${progress}%`,
            background: isSuccess
              ? "#22c55e"
              : isFailed
                ? "#ef4444"
                : "linear-gradient(90deg, #6366f1, #818cf8)",
            transition: "width 0.6s ease-out",
          }}
        />
      </div>

      {/* Step List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ALL_STEPS.map((stepName) => {
          const info = getStepInfo(stepName);
          const isDone = completedStates.has(stepName);
          const isCurrent = stepName === launch.currentStep && isLoading;
          const failedStep = steps.find(
            (s) => s.state === "FAILED" || s.state === "FAILED_PARTIAL",
          );
          const isFailedStep =
            failedStep &&
            !isDone &&
            stepName === ALL_STEPS[ALL_STEPS.indexOf(launch.currentStep) + 1];

          return (
            <div
              key={stepName}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 10px",
                borderRadius: 8,
                background: isCurrent
                  ? "rgba(99,102,241,.1)"
                  : isDone
                    ? "rgba(34,197,94,.05)"
                    : "transparent",
                opacity: isDone || isCurrent ? 1 : 0.3,
                transition: "all 0.3s",
              }}
            >
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>
                {isDone ? (
                  "✅"
                ) : isCurrent ? (
                  <span
                    style={{
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                    }}
                  >
                    ⏳
                  </span>
                ) : isFailedStep ? (
                  "❌"
                ) : (
                  "○"
                )}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: isDone
                    ? "#22c55e"
                    : isCurrent
                      ? "#818cf8"
                      : "rgba(255,255,255,.4)",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {info.label}
              </span>
              {isDone && steps.find((s) => s.state === stepName) && (
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,.2)",
                    marginLeft: "auto",
                  }}
                >
                  {new Date(
                    steps.find((s) => s.state === stepName).ts ||
                      steps.find((s) => s.state === stepName).timestamp,
                  ).toLocaleTimeString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Error + Retry */}
      {isFailed && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: isPartial
              ? "rgba(245,158,11,.1)"
              : "rgba(239,68,68,.1)",
            border: `1px solid ${isPartial ? "rgba(245,158,11,.3)" : "rgba(239,68,68,.3)"}`,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: isPartial ? "#f59e0b" : "#ef4444",
              marginBottom: 8,
            }}
          >
            {isPartial ? "⚠️ Campaign was partially created" : "❌ "}
            {error}
          </div>
          {isPartial && campaignId && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,.4)",
                marginBottom: 8,
              }}
            >
              Campaign {campaignId} was created but some steps failed. You can
              retry or manage it in Google Ads.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={launch.retry}
              style={{
                background: "rgba(99,102,241,.2)",
                border: "1px solid rgba(99,102,241,.4)",
                borderRadius: 8,
                padding: "6px 16px",
                color: "#818cf8",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              🔄 Retry
            </button>
            <button
              onClick={launch.reset}
              style={{
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 8,
                padding: "6px 16px",
                color: "rgba(255,255,255,.4)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Success Actions */}
      {isSuccess && (
        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            padding: 12,
            background: "rgba(34,197,94,.08)",
            borderRadius: 10,
            border: "1px solid rgba(34,197,94,.2)",
          }}
        >
          <div style={{ fontSize: 13, color: "#22c55e", marginBottom: 8 }}>
            Your campaign is now running on Google Ads!
          </div>
          <button
            onClick={launch.reset}
            style={{
              background: "rgba(34,197,94,.2)",
              border: "1px solid rgba(34,197,94,.4)",
              borderRadius: 8,
              padding: "8px 20px",
              color: "#22c55e",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ✨ Create Another Campaign
          </button>
        </div>
      )}

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

export default LaunchProgress;
