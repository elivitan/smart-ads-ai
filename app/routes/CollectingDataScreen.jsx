import React, { useState, useEffect, useRef } from "react";

var STEPS = [
  { label: "Connecting to your store", icon: "\uD83D\uDCE6", phase: "prep" },
  { label: "Searching Google for competitors", icon: "\uD83D\uDD0D", phase: "competitors" },
  { label: "Analyzing competitor strategies", icon: "\uD83D\uDD75\uFE0F", phase: "analyzing" },
  { label: "Generating AI-optimized ad copy", icon: "\uD83E\uDD16", phase: "adcopy" },
  { label: "Building your competitive strategy", icon: "\uD83D\uDCCA", phase: "strategy" },
];

// Minimum duration per phase (ms) — total minimum ~10-12 seconds
var PHASE_MIN_MS = [1800, 2200, 2400, 2200, 1800];

function CollectingDataScreen(props) {
  var totalProducts = props.totalProducts;
  var onScan = props.onScan;
  var realProgress = props.realProgress;
  var scanMsg = props.scanMsg;
  var onCancel = props.onCancel;
  var autoStart = props.autoStart;
  var onComplete = props.onComplete;

  var _s1 = useState(0), smoothProgress = _s1[0], setSmoothProgress = _s1[1];
  var _s2 = useState(0), targetProgress = _s2[0], setTargetProgress = _s2[1];
  var _s3 = useState(false), scanStarted = _s3[0], setScanStarted = _s3[1];
  var _s4 = useState(false), isPaused = _s4[0], setIsPaused = _s4[1];
  var _s5 = useState(""), statusMsg = _s5[0], setStatusMsg = _s5[1];
  var _s6 = useState(0), analyzed = _s6[0], setAnalyzed = _s6[1];
  var _s7 = useState(0), phaseIdx = _s7[0], setPhaseIdx = _s7[1];
  var _s8 = useState(false), showCancelConfirm = _s8[0], setShowCancelConfirm = _s8[1];
  var _s9 = useState(false), showPauseConfirm = _s9[0], setShowPauseConfirm = _s9[1];
  var _s10 = useState(""), dots = _s10[0], setDots = _s10[1];
  var cancelledRef = useRef(false);
  var pausedRef = useRef(false);
  var smoothRef = useRef(0);

  // Animated dots
  useEffect(function() {
    var iv = setInterval(function() { setDots(function(d) { return d.length >= 3 ? "" : d + "."; }); }, 500);
    return function() { clearInterval(iv); };
  }, []);

  // Smooth progress animation — NEVER goes backwards
  useEffect(function() {
    var raf;
    function animate() {
      var current = smoothRef.current;
      var target = targetProgress;
      if (target < current) target = current;
      if (Math.abs(current - target) < 0.2) {
        smoothRef.current = target;
        setSmoothProgress(Math.round(target));
      } else {
        // Very slow: max 0.05 per frame = ~3 per second at 60fps
        var speed = Math.max(0.02, Math.abs(target - current) * 0.008);
        smoothRef.current = current + speed;
        setSmoothProgress(Math.round(smoothRef.current));
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return function() { cancelAnimationFrame(raf); };
  }, [targetProgress]);

  // AUTO-START MODE
  useEffect(function() {
    if (!autoStart) return;
    cancelledRef.current = false;
    pausedRef.current = false;

    async function runScan() {
      setPhaseIdx(0);
      setStatusMsg("Connecting to your store...");
      setTargetProgress(2);
      setScanStarted(true);

      // Batch strategy
      var batchSize, maxFirstScanProducts, useParallel;
      if (totalProducts <= 30) {
        batchSize = 3; maxFirstScanProducts = totalProducts; useParallel = false;
      } else if (totalProducts <= 200) {
        batchSize = 5; maxFirstScanProducts = 20; useParallel = false;
      } else {
        batchSize = 5; maxFirstScanProducts = 15; useParallel = true;
      }

      var totalAnalyzed = 0;
      var remaining = 999;
      var total = totalProducts || 1;
      var consecutiveErrors = 0;
      var MAX_TIME_MS = 45000;
      var scanStartTime = Date.now();

      // Phase progress boundaries (% ranges)
      var PB = [
        [0, 18],    // 0: Connecting
        [18, 40],   // 1: Searching competitors
        [40, 62],   // 2: Analyzing strategies
        [62, 82],   // 3: Generating ad copy
        [82, 96],   // 4: Building strategy
      ];

      // Gradually animate through a single phase over its minimum duration
      // This is the ONLY place targetProgress gets updated during fill phases
      async function animatePhase(pi) {
        var bounds = PB[pi];
        var minMs = PHASE_MIN_MS[pi] || 1500;
        var steps = Math.ceil(minMs / 150);
        var startPct = bounds[0];
        var endPct = bounds[1] - 1;
        for (var s = 0; s <= steps; s++) {
          if (cancelledRef.current) return;
          while (pausedRef.current) { await sleep(300); if (cancelledRef.current) return; }
          var pct = startPct + ((endPct - startPct) * s / steps);
          setTargetProgress(function(prev) { return Math.max(prev, Math.round(pct)); });
          await sleep(150);
        }
      }

      // ── Phase 0: Connecting ──
      await animatePhase(0);
      if (cancelledRef.current) return;

      // ── Phase 1: Start API scan ──
      setPhaseIdx(1);
      setStatusMsg("Searching Google for competitor data...");

      // Fire off the API call — but DON'T let it control progress directly
      var apiDone = false;
      var apiPhase = 1; // tracks how far the API got

      // Run API in background
      var scanPromise = (async function() {
        var scanTarget = Math.min(maxFirstScanProducts, total);

        while (remaining > 0) {
          if (cancelledRef.current) return;

          var elapsed = Date.now() - scanStartTime;
          if (elapsed > MAX_TIME_MS) break;
          if (totalAnalyzed >= maxFirstScanProducts && totalProducts > 30) break;

          try {
            var form = new FormData();
            if (useParallel) {
              form.append("step", "analyze_parallel");
              form.append("batchSize", String(batchSize));
              form.append("parallel", "3");
            } else {
              form.append("step", "analyze_batch");
              form.append("batchSize", String(batchSize));
            }

            var controller = new AbortController();
            var timeout = setTimeout(function() { controller.abort(); }, 60000);
            var res = await fetch("/app/api/sync", { method: "POST", body: form, signal: controller.signal });
            clearTimeout(timeout);
            var data = await res.json();

            if (!data.success) {
              if (data.message === "All products up to date") { remaining = 0; break; }
              consecutiveErrors++;
              if (consecutiveErrors >= 3) break;
              await sleep(2000);
              continue;
            }

            consecutiveErrors = 0;
            totalAnalyzed += data.analyzed || 0;
            remaining = data.remaining || 0;
            total = data.total || total;

            // Track which phase the real data suggests
            var realPct = scanTarget > 0 ? Math.min(total - remaining, scanTarget) / scanTarget : 1;
            if (realPct >= 0.85) apiPhase = 4;
            else if (realPct >= 0.55) apiPhase = 3;
            else if (realPct >= 0.25) apiPhase = 2;
            else apiPhase = 1;

          } catch (e) {
            consecutiveErrors++;
            if (consecutiveErrors >= 3) break;
            await sleep(2000);
          }
        }
        apiDone = true;
      })();

      // Animate phases 1-4 with minimum durations
      // The animation runs independently from the API
      for (var p = 1; p < 5; p++) {
        if (cancelledRef.current) return;
        setPhaseIdx(p);
        setStatusMsg(STEPS[p].label + "...");
        await animatePhase(p);
      }

      // Wait for API to finish (it's probably done already)
      await scanPromise;
      if (cancelledRef.current) return;

      // ── Done ──
      setTargetProgress(100);
      setPhaseIdx(5);
      setAnalyzed(total);
      setStatusMsg("Your store is ready! \uD83C\uDF89");
      await sleep(1500);
      if (onComplete) onComplete();
    }

    runScan();
    return function() { cancelledRef.current = true; };
  }, [autoStart]);

  // LEGACY MODE
  useEffect(function() {
    if (autoStart) return;
    var cancelled = false;
    async function run() {
      var labels = ["Connecting to your Shopify store", "Reading your product catalog", "Starting AI engine"];
      for (var i = 0; i < 3; i++) {
        if (cancelled) return;
        setStatusMsg(labels[i]);
        setTargetProgress(Math.round(((i + 1) / 3) * 15));
        await sleep(1000);
      }
      if (!scanStarted) { setScanStarted(true); if (onScan) onScan(); }
    }
    run();
    return function() { cancelled = true; };
  }, []);

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  var displayProgress = autoStart
    ? smoothProgress
    : (scanStarted && realProgress != null ? Math.max(15, realProgress) : smoothProgress);

  var isDone = displayProgress >= 100;

  // Visual counter: derived from smoothProgress so it increments gradually
  var displayAnalyzed = autoStart
    ? (isDone ? (analyzed || totalProducts) : Math.min(Math.round((smoothProgress / 100) * totalProducts), totalProducts))
    : totalProducts;

  var title = isDone ? "Your store is ready! \uD83C\uDF89"
    : isPaused ? "Scan Paused \u23F8"
    : (STEPS[Math.min(phaseIdx, STEPS.length - 1)].label + dots);

  var displayMsg = autoStart ? statusMsg
    : ((scanStarted && scanMsg) ? scanMsg : "Setting up AI campaign intelligence for " + totalProducts + " products");

  function handleCancel() { cancelledRef.current = true; setShowCancelConfirm(false); if (onCancel) onCancel(); }
  function handlePause() { pausedRef.current = true; setIsPaused(true); setShowPauseConfirm(false); }
  function handleResume() { pausedRef.current = false; setIsPaused(false); }

  var words = ["impressions","clicks","CTR","ROAS","keywords","budget","CPC","conversions","reach","bids","ads","score"];

  return (
    <div className="cds-wrap">
      <div className="cds-particles">
        {words.map(function(w, i) {
          return (
            <div key={i} className="cds-particle" style={{
              left: (8 + (i * 8) % 84) + "%",
              top: (15 + (i * 11) % 70) + "%",
              animationDelay: (i * 0.3) + "s",
              animationDuration: (3.5 + (i % 3) * 0.8) + "s",
            }}>{w}</div>
          );
        })}
      </div>

      <div className="cds-center">
        <div className="cds-radar">
          <div className="cds-ring cds-ring-1"/>
          <div className="cds-ring cds-ring-2"/>
          <div className="cds-ring cds-ring-3"/>
          <div className="cds-radar-dot" style={
            isDone ? {background:"#22c55e",boxShadow:"0 0 24px #22c55e"}
            : isPaused ? {background:"#f59e0b",boxShadow:"0 0 24px #f59e0b"}
            : {}
          }/>
          {!isDone && !isPaused && <div className="cds-radar-sweep"/>}
          {isDone && <div className="cds-done-check">{"\u2713"}</div>}
          {isPaused && <div className="cds-done-check" style={{color:"#f59e0b",fontSize:36}}>{"\u23F8"}</div>}
          {totalProducts > 0 && (
            <div className="cds-radar-counter">
              <span className="cds-radar-num">{Math.round(displayProgress)}%</span>
            </div>
          )}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">{isDone ? "100% analyzed \u2014 your dashboard is ready" : displayMsg}</div>

        <div className="cds-progress-wrap">
          <div className="cds-progress-bar">
            <div className="cds-progress-fill" style={{ width: displayProgress + "%", transition: "width 0.3s ease" }}/>
            <div className="cds-progress-glow" style={{ left: Math.min(displayProgress, 98) + "%" }}/>
          </div>
          <div className="cds-progress-pct">{displayProgress}%</div>
        </div>

        <div className="cds-steps">
          {STEPS.map(function(step, i) {
            var done = isDone || i < phaseIdx;
            var active = !isDone && i === phaseIdx;
            return (
              <div key={i} className={"cds-step " + (done ? "cds-step-done" : active ? "cds-step-active" : "cds-step-waiting")}>
                <div className="cds-step-icon">{done ? "\u2713" : active ? <span className="cds-step-spinner"/> : "\u25CB"}</div>
                <span className="cds-step-label">{step.icon} {step.label}</span>
                {done && <span className="cds-step-done-badge">done</span>}
              </div>
            );
          })}
        </div>

        {isDone && (
          <div className="cds-cta-wrap" style={{animation:"cdsCtaPop .5s ease"}}>
            <div className="cds-cta-msg">{"\u2705"} Analysis complete \u2014 loading your dashboard</div>
            <div className="cds-loading-bar"><div className="cds-loading-fill"/></div>
          </div>
        )}

        {!isDone && (
          <div style={{display:"flex",gap:12,marginTop:20,justifyContent:"center",flexWrap:"wrap"}}>
            {isPaused ? (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handleResume}>{"\u25B6"} Resume</button>
            ) : (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={function(){setShowPauseConfirm(true);}}>Pause</button>
            )}
            <button style={{padding:"10px 28px",fontSize:13,fontWeight:600,background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.7)",border:"1px solid rgba(239,68,68,.15)",borderRadius:10,cursor:"pointer"}} onClick={function(){setShowCancelConfirm(true);}}>Cancel</button>
          </div>
        )}
      </div>

      {showPauseConfirm && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>{"\u23F8"}</div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8,color:"#fff"}}>Pause scan?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:24,lineHeight:1.5}}>The scan will pause after the current batch. You can resume at any time.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={function(){setShowPauseConfirm(false);}}>Continue</button>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handlePause}>Yes, Pause</button>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>{"\u26A0\uFE0F"}</div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8,color:"#fff"}}>Cancel scan?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:24,lineHeight:1.5}}>{autoStart ? "Products already analyzed will be saved. You can re-scan later." : "If you cancel now, your products won't be analyzed."}</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={function(){setShowCancelConfirm(false);}}>Continue</button>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handleCancel}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CollectingDataScreen };
