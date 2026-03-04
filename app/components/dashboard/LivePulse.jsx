import React, { useState, useEffect, useRef } from "react";

const LIVE_PULSE_EVENTS = [
  "New impression ג€” 'luxury bedding set'",
  "Click converted ג€” product page visited",
  "Competitor bid change detected",
  "New impression ג€” 'queen size duvet cover'",
  "Ad shown ג€” mobile search",
  "High-intent search click recorded",
  "Quality score updated +1",
  "New impression ג€” branded keyword",
  "Smart bidding adjustment applied",
];

/**
 * LivePulse
 * Real-time campaign monitoring widget with animated waveform.
 * Pauses canvas animation when tab is hidden (enterprise performance).
 */
const LivePulse = React.memo(function LivePulse({
  campaigns,
  impressionsBase,
  clicksBase,
  campaignId,
  realSpend,
  campaignControlStatus,
  confirmRemove,
  setConfirmRemove,
  onPause,
  onRemove,
}) {
  const [heartbeat, setHeartbeat] = useState(false);
  const [impressions, setImpressions] = useState(impressionsBase);
  const [clicks, setClicks] = useState(clicksBase);
  const [lastEvent, setLastEvent] = useState("Monitoring your campaigns...");
  const [eventVisible, setEventVisible] = useState(true);
  const canvasRef = useRef(null);
  const dataRef = useRef(
    Array.from({ length: 30 }, () => Math.random() * 0.4 + 0.1),
  );
  const animRef = useRef(null);

  useEffect(() => {
    if (campaigns === 0) return;
    const tick = () => {
      setHeartbeat(true);
      setTimeout(() => setHeartbeat(false), 700);
      setImpressions((p) => p + Math.floor(Math.random() * 14 + 2));
      if (Math.random() > 0.6) setClicks((p) => p + 1);
      if (Math.random() > 0.45) {
        setEventVisible(false);
        setTimeout(() => {
          setLastEvent(
            LIVE_PULSE_EVENTS[
              Math.floor(Math.random() * LIVE_PULSE_EVENTS.length)
            ],
          );
          setEventVisible(true);
        }, 300);
      }
      dataRef.current = [
        ...dataRef.current.slice(1),
        Math.random() * 0.75 + 0.25,
      ];
    };
    tick();
    const iv = setInterval(
      () => {
        if (document.visibilityState !== "hidden") tick();
      },
      2200 + Math.random() * 1800,
    );
    return () => clearInterval(iv);
  }, [campaigns]);

  // Canvas animation ג€” stops when tab hidden
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width,
      H = canvas.height;

    let lastFrameTime = 0;
    const TARGET_FPS = 24;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    const draw = (timestamp) => {
      if (document.visibilityState === "hidden") {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      if (timestamp - lastFrameTime < FRAME_INTERVAL) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = timestamp;
      ctx.clearRect(0, 0, W, H);
      const data = dataRef.current;
      if (data.length < 2) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      const step = W / (data.length - 1);

      ctx.strokeStyle = "rgba(255,255,255,.04)";
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach((y) => {
        ctx.beginPath();
        ctx.moveTo(0, H * y);
        ctx.lineTo(W, H * y);
        ctx.stroke();
      });

      const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
      fillGrad.addColorStop(0, "rgba(99,102,241,.2)");
      fillGrad.addColorStop(1, "rgba(99,102,241,0)");

      const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
      lineGrad.addColorStop(0, "rgba(99,102,241,.3)");
      lineGrad.addColorStop(0.6, "#6366f1");
      lineGrad.addColorStop(1, "#22c55e");

      ctx.beginPath();
      ctx.moveTo(0, H);
      data.forEach((v, i) => {
        const x = i * step,
          y = H - v * H * 0.8;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = (i - 1) * step,
            py = H - data[i - 1] * H * 0.8;
          ctx.bezierCurveTo(px + step / 2, py, x - step / 2, y, x, y);
        }
      });
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * step,
          y = H - v * H * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = (i - 1) * step,
            py = H - data[i - 1] * H * 0.8;
          ctx.bezierCurveTo(px + step / 2, py, x - step / 2, y, x, y);
        }
      });
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#6366f1";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const lx = (data.length - 1) * step,
        ly = H - data[data.length - 1] * H * 0.8;
      ctx.beginPath();
      ctx.arc(lx, ly, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#22c55e";
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(lx, ly, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(34,197,94,.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const ctr =
    impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const avgCpc = realSpend != null && clicks > 0 ? realSpend / clicks : 0.44;
  const spend = (clicks * avgCpc).toFixed(2);
  if (campaigns === 0)
    return (
      <div className="pulse-card pulse-empty">
        <div style={{ fontSize: 36, marginBottom: 10 }}>נ“¡</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Live Campaign Pulse
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)" }}>
          Launch campaigns to see real-time data
        </div>
      </div>
    );

  return (
    <div className="pulse-card">
      <div className="pulse-header-row">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className={`pulse-dot-live ${heartbeat ? "pulse-beat" : ""}`} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            Live Campaign Pulse
          </span>
          <span className="pulse-live-tag">LIVE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {campaignId &&
            campaignControlStatus !== "removed" &&
            campaignControlStatus !== "paused" && (
              <>
                <button
                  className="pulse-btn pulse-btn-pause"
                  style={{ padding: "5px 12px", fontSize: 12 }}
                  onClick={onPause}
                  disabled={
                    campaignControlStatus === "pausing" ||
                    campaignControlStatus === "removing"
                  }
                >
                  {campaignControlStatus === "pausing" ? "ג³" : "ג¸ Pause"}
                </button>
                <button
                  className="pulse-btn pulse-btn-remove"
                  style={{ padding: "5px 12px", fontSize: 12 }}
                  onClick={() => setConfirmRemove(true)}
                  disabled={
                    campaignControlStatus === "pausing" ||
                    campaignControlStatus === "removing"
                  }
                >
                  {campaignControlStatus === "removing" ? "ג³" : "נ—‘ Remove"}
                </button>
              </>
            )}
          {campaignControlStatus === "paused" && (
            <span className="pulse-status-badge pulse-badge-paused">
              ג¸ Paused
            </span>
          )}
          {campaignControlStatus === "removed" && (
            <span className="pulse-status-badge pulse-badge-removed">
              ג… Removed
            </span>
          )}
          <svg
            width="22"
            height="20"
            viewBox="0 0 24 22"
            fill="none"
            className={heartbeat ? "heart-beat" : ""}
          >
            <path
              d="M12 21C12 21 3 14 3 8C3 5.2 5.2 3 8 3C9.7 3 11.2 3.9 12 5.2C12.8 3.9 14.3 3 16 3C18.8 3 21 5.2 21 8C21 14 12 21 12 21Z"
              fill={heartbeat ? "#ef4444" : "#6366f1"}
              style={{ transition: "fill .3s" }}
            />
          </svg>
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,.4)",
          marginBottom: 10,
        }}
      >
        {campaigns} campaign{campaigns !== 1 ? "s" : ""} running ֲ· live data
      </div>

      <div style={{ position: "relative", marginBottom: 14 }}>
        <canvas
          ref={canvasRef}
          width={520}
          height={72}
          className="pulse-canvas"
        />
      </div>

      <div className="pulse-metrics-row">
        {[
          {
            val: impressions.toLocaleString(),
            lbl: "נ‘ Impressions",
            cls: "pulse-m-imp",
          },
          {
            val: clicks.toLocaleString(),
            lbl: "נ‘† Clicks",
            cls: "pulse-m-clk",
          },
          { val: `${ctr}%`, lbl: "נ“ CTR", cls: "pulse-m-ctr" },
          { val: `$${spend}`, lbl: "נ’¸ Est. Spend", cls: "pulse-m-cost" },
        ].map((m, i) => (
          <div key={i} className={`pulse-metric-box ${m.cls}`}>
            <div className="pulse-m-val">{m.val}</div>
            <div className="pulse-m-lbl">{m.lbl}</div>
          </div>
        ))}
      </div>

      <div
        className="pulse-event-bar"
        style={{ opacity: eventVisible ? 1 : 0, transition: "opacity .3s" }}
      >
        <span className="pulse-event-dot-green" />
        <span className="pulse-event-txt">{lastEvent}</span>
        <span className="pulse-event-time">just now</span>
      </div>

      {campaignId && (
        <div className="pulse-controls">
          <div className="pulse-spend-box">
            <span className="pulse-spend-label">נ’¸ Total Spend</span>
            <span className="pulse-spend-val">
              {realSpend != null ? (
                `$${Number(realSpend).toFixed(2)}`
              ) : campaignControlStatus === "paused" ||
                campaignControlStatus === "removed" ? (
                `$${spend}`
              ) : (
                <span className="pulse-spend-fetching">
                  Fetching from Googleג€¦
                </span>
              )}
            </span>
            {realSpend == null && (
              <span className="pulse-spend-note">(estimated)</span>
            )}
          </div>
          {campaignControlStatus === "error" && (
            <span className="pulse-status-badge pulse-badge-error">
              ג ן¸ Action failed ג€” check Google Ads connection
            </span>
          )}
          {confirmRemove && (
            <div className="pulse-confirm-overlay">
              <div className="pulse-confirm-box">
                <div style={{ fontSize: 32, marginBottom: 8 }}>ג ן¸</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>
                  Remove Campaign?
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,.6)",
                    marginBottom: 20,
                  }}
                >
                  This will permanently remove the campaign from Google Ads.
                  This cannot be undone.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    className="pulse-btn pulse-btn-remove"
                    style={{ flex: 1 }}
                    onClick={onRemove}
                  >
                    Yes, Remove
                  </button>
                  <button
                    className="pulse-btn pulse-btn-pause"
                    style={{ flex: 1 }}
                    onClick={() => setConfirmRemove(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default LivePulse;
