import React, { useState, useEffect, useRef } from "react";

const STEPS = [
  { label: "Connecting to your store", icon: "📦", phase: "prep" },
  { label: "Searching Google for competitors", icon: "🔍", phase: "competitors" },
  { label: "Analyzing competitor strategies", icon: "🕵️", phase: "analyzing" },
  { label: "Generating AI-optimized ad copy", icon: "🤖", phase: "adcopy" },
  { label: "Building your competitive strategy", icon: "📊", phase: "strategy" },
];

// Minimum duration per phase (ms) — total minimum ~10-12 seconds
var PHASE_MIN_MS = [1800, 2200, 2400, 2200, 1800]; // = 10.4s minimum

/**
 * CollectingDataScreen
 *
 * autoStart={true}  — scans products via API, minimum 10s animation
 * autoStart={false} — legacy mode for doScan()
 */
function CollectingDataScreen({ totalProducts, onScan, realProgress, scanMsg, onCancel, autoStart, onComplete }) {
  var _useState = useState(0), smoothProgress = _useState[0], setSmoothProgress = _useState[1];
  var _useState2 = useState(0), targetProgress = _useState2[0], setTargetProgress = _useState2[1];
  var _useState3 = useState(false), scanStarted = _useState3[0], setScanStarted = _useState3[1];
  var _useState4 = useState(false), isPaused = _useState4[0], setIsPaused = _useState4[1];
  var _useState5 = useState(""), statusMsg = _useState5[0], setStatusMsg = _useState5[1];
  var _useState6 = useState(0), analyzed = _useState6[0], setAnalyzed = _useState6[1];
  var _useState7 = useState(0), phaseIdx = _useState7[0], setPhaseIdx = _useState7[1];
  var _useState8 = useState(false), showCancelConfirm = _useState8[0], setShowCancelConfirm = _useState8[1];
  var _useState9 = useState(false), showPauseConfirm = _useState9[0], setShowPauseConfirm = _useState9[1];
  var _useState10 = useState(""), dots = _useState10[0], setDots = _useState10[1];
  var cancelledRef = useRef(false);
  var pausedRef = useRef(false);
  var smoothRef = useRef(0);
  var startTimeRef = useRef(null);

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
      if (Math.abs(current - target) < 0.3) {
        smoothRef.current = target;
        setSmoothProgress(Math.round(target));
      } else {
        // Smooth easing — faster when far, slower when close
        var speed = Math.max(0.12, Math.abs(target - current) * 0.04);
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
    startTimeRef.current = Date.now();

    async function runScan() {
      // Phase 0: Preparing (0-18%)
      setPhaseIdx(0);
      setStatusMsg("Connecting to your store...");
      setTargetProgress(3);
      setScanStarted(true);

      // Determine batch strategy
      var batchSize, maxFirstScanProducts, useParallel;
      if (totalProducts <= 30) {
        batchSize = 3;
        maxFirstScanProducts = totalProducts;
        useParallel = false;
      } else if (totalProducts <= 200) {
        batchSize = 5;
        maxFirstScanProducts = 20;
        useParallel = false;
      } else {
        batchSize = 5;
        maxFirstScanProducts = 15;
        useParallel = true;
      }

      var totalAnalyzed = 0;
      var remaining = 999;
      var total = totalProducts || 1;
      var consecutiveErrors = 0;
      var MAX_TIME_MS = 45000;

      // Phase progress boundaries (% ranges for each of 5 phases)
      var phaseBounds = [
        [0, 18],    // Phase 0: Connecting
        [18, 40],   // Phase 1: Searching competitors
        [40, 62],   // Phase 2: Analyzing strategies
        [62, 82],   // Phase 3: Generating ad copy
        [82, 96],   // Phase 4: Building strategy
      ];

      // Track when each phase started for minimum duration
      var phaseStartTime = Date.now();

      // Helper: ensure minimum phase duration before moving to next
      async function ensurePhaseMinDuration(phaseIndex) {
        var elapsed = Date.now() - phaseStartTime;
        var minMs = PHASE_MIN_MS[phaseIndex] || 1500;
        if (elapsed < minMs) {
          // Creep progress during wait
          var remaining_ms = minMs - elapsed;
          var steps = Math.ceil(remaining_ms / 200);
          var currentBounds = phaseBounds[phaseIndex];
          var currentTarget = currentBounds[0] + (currentBounds[1] - currentBounds[0]) * 0.4;
          for (var s = 0; s < steps; s++) {
            if (cancelledRef.current) return;
            while (pausedRef.current) { await sleep(300); if (cancelledRef.current) return; }
            currentTarget = Math.min(currentTarget + (currentBounds[1] - currentBounds[0]) * 0.6 / steps, currentBounds[1] - 1);
            setTargetProgress(Math.round(currentTarget));
            await sleep(200);
          }
        }
      }

      // Phase 0 animation
      await sleep(400);
      if (cancelledRef.current) return;
      setTargetProgress(8);
      setStatusMsg("Reading " + total + " products from your catalog...");
      await sleep(600);
      if (cancelledRef.current) return;
      setTargetProgress(14);
      await ensurePhaseMinDuration(0);
      if (cancelledRef.current) return;

      // Phase 1: Start scanning
      setPhaseIdx(1);
      phaseStartTime = Date.now();
      setTargetProgress(phaseBounds[1][0]);
      setStatusMsg("Searching Google for competitor data...");

      // The actual API scan loop
      var scanComplete = false;
      var batchCount = 0;
      var scanTarget = Math.min(maxFirstScanProducts, total);

      while (remaining > 0 && !scanComplete) {
        if (cancelledRef.current) return;

        while (pausedRef.current) {
          await sleep(500);
          if (cancelledRef.current) return;
        }

        // Time limit
        var elapsed = Date.now() - startTimeRef.current;
        if (elapsed > MAX_TIME_MS) {
          setStatusMsg("Moving to dashboard — analysis continues in background");
          await sleep(1000);
          break;
        }

        // First scan limit
        if (totalAnalyzed >= maxFirstScanProducts && totalProducts > 30) {
          setStatusMsg("First batch ready — loading your dashboard");
          await sleep(1000);
          break;
        }

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
            if (data.message === "All products up to date") { remaining = 0; scanComplete = true; break; }
            consecutiveErrors++;
            if (consecutiveErrors >= 3) {
              setStatusMsg("Finishing with analyzed products...");
              await sleep(1500);
              break;
            }
            setStatusMsg("Retrying... (" + consecutiveErrors + "/3)");
            await sleep(2000);
            continue;
          }

          consecutiveErrors = 0;
          batchCount++;
          totalAnalyzed += data.analyzed || 0;
          remaining = data.remaining || 0;
          total = data.total || total;
          var done = total - remaining;
          setAnalyzed(done);

          // Map real progress to phase 1-3 range (18%-82%)
          var realPct = scanTarget > 0 ? Math.min(done, scanTarget) / scanTarget : 1;
          // Determine which phase we should be in based on real progress
          var targetPhase;
          if (realPct < 0.25) targetPhase = 1;
          else if (realPct < 0.55) targetPhase = 2;
          else if (realPct < 0.85) targetPhase = 3;
          else targetPhase = 4;

          // Update phase with minimum duration enforcement
          if (targetPhase > phaseIdx) {
            await ensurePhaseMinDuration(phaseIdx);
            if (cancelledRef.current) return;
            setPhaseIdx(targetPhase);
            phaseStartTime = Date.now();
            setStatusMsg(STEPS[targetPhase].label + " (" + done + "/" + total + " products)");
          } else {
            setStatusMsg(STEPS[phaseIdx].label + " (" + done + "/" + total + " products)");
          }

          // Calculate progress within current phase bounds
          var curBounds = phaseBounds[Math.min(targetPhase, 4)];
          var phaseProgress = curBounds[0] + (curBounds[1] - curBounds[0]) * realPct;
          setTargetProgress(function(prev) { return Math.max(prev, Math.round(phaseProgress)); });

        } catch (e) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            setStatusMsg("Finishing with analyzed products...");
            await sleep(1500);
            break;
          }
          setStatusMsg("Retrying... (" + consecutiveErrors + "/3)");
          await sleep(2000);
        }
      }

      if (cancelledRef.current) return;

      // Ensure remaining phases have minimum duration before finishing
      for (var p = phaseIdx; p < 5; p++) {
        if (cancelledRef.current) return;
        if (p > phaseIdx) {
          setPhaseIdx(p);
          phaseStartTime = Date.now();
        }
        setStatusMsg(STEPS[Math.min(p, 4)].label + "...");
        setTargetProgress(phaseBounds[Math.min(p, 4)][1] - 2);
        await ensurePhaseMinDuration(p);
      }

      if (cancelledRef.current) return;

      // Done!
      setTargetProgress(100);
      setPhaseIdx(5);
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
              <span className="cds-radar-num">{autoStart ? analyzed : totalProducts}</span>
              <span className="cds-radar-denom">{autoStart ? " / " + totalProducts : " products"}</span>
            </div>
          )}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">{isDone ? (analyzed || totalProducts) + " products analyzed \u2014 your dashboard is ready" : displayMsg}</div>

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
            <div className="cds-cta-msg">{"\u2705"} Analysis complete — loading your dashboard</div>
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
