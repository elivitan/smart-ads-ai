import React, { useState, useEffect, useRef } from "react";

const STEPS = [
  { label: "Preparing your store data", icon: "📦", phase: "prep" },
  { label: "Searching Google for competitors", icon: "🔍", phase: "competitors" },
  { label: "Analyzing competitor strategies", icon: "🕵️", phase: "analyzing" },
  { label: "Generating AI-optimized ad copy", icon: "🤖", phase: "adcopy" },
  { label: "Building your competitive strategy", icon: "📊", phase: "strategy" },
];

function getPhaseIdx(analyzed, total) {
  if (total === 0) return 0;
  const pct = analyzed / total;
  if (pct < 0.2) return 1;
  if (pct < 0.5) return 2;
  if (pct < 0.8) return 3;
  return 4;
}

/**
 * CollectingDataScreen
 *
 * autoStart={true}  — scans first batch (10-15 products, max 45s), then goes to dashboard
 * autoStart={false} — legacy mode for doScan()
 */
function CollectingDataScreen({ totalProducts, onScan, realProgress, scanMsg, onCancel, autoStart, onComplete }) {
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [targetProgress, setTargetProgress] = useState(0);
  const [scanStarted, setScanStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [analyzed, setAnalyzed] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [dots, setDots] = useState("");
  const cancelledRef = useRef(false);
  const pausedRef = useRef(false);
  const smoothRef = useRef(0);
  const startTimeRef = useRef(null);

  // Animated dots
  useEffect(() => {
    const iv = setInterval(() => setDots(function(d) { return d.length >= 3 ? "" : d + "."; }), 500);
    return function() { clearInterval(iv); };
  }, []);

  // Smooth progress animation — NEVER goes backwards
  useEffect(() => {
    var raf;
    function animate() {
      var current = smoothRef.current;
      var target = targetProgress;
      // Never go backwards
      if (target < current) target = current;
      if (Math.abs(current - target) < 0.3) {
        smoothRef.current = target;
        setSmoothProgress(Math.round(target));
      } else {
        var speed = Math.max(0.15, Math.abs(target - current) * 0.06);
        smoothRef.current = current + speed;
        setSmoothProgress(Math.round(smoothRef.current));
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return function() { cancelAnimationFrame(raf); };
  }, [targetProgress]);

  // AUTO-START MODE
  useEffect(() => {
    if (!autoStart) return;
    cancelledRef.current = false;
    pausedRef.current = false;
    startTimeRef.current = Date.now();

    async function runScan() {
      setPhaseIdx(0);
      setStatusMsg("Preparing your store data...");
      setTargetProgress(5);
      setScanStarted(true);
      await sleep(600);
      if (cancelledRef.current) return;

      // Determine batch strategy based on store size
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
      var MAX_TIME_MS = 45000; // 45 second hard limit

      setTargetProgress(10);
      setStatusMsg("Starting AI analysis...");

      while (remaining > 0) {
        if (cancelledRef.current) return;

        // Pause support
        while (pausedRef.current) {
          await sleep(500);
          if (cancelledRef.current) return;
        }

        // Time limit check
        var elapsed = Date.now() - startTimeRef.current;
        if (elapsed > MAX_TIME_MS) {
          setStatusMsg("Moving to dashboard — analysis continues in background");
          await sleep(1000);
          break;
        }

        // First scan limit check
        if (totalAnalyzed >= maxFirstScanProducts && totalProducts > 30) {
          setStatusMsg("First batch ready — loading your dashboard");
          await sleep(1000);
          break;
        }

        // Creep animation: advance progress slowly while batch runs
        var creepInterval = setInterval(function() {
          setTargetProgress(function(prev) { return Math.min(prev + 0.4, 94); });
        }, 300);

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
          clearInterval(creepInterval);

          var data = await res.json();

          if (!data.success) {
            if (data.message === "All products up to date") { remaining = 0; break; }
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
          totalAnalyzed += data.analyzed || 0;
          remaining = data.remaining || 0;
          total = data.total || total;
          var done = total - remaining;
          setAnalyzed(done);

          // Calculate progress — never go backwards
          var scanTarget = Math.min(maxFirstScanProducts, total);
          var pct = scanTarget > 0 ? (Math.min(done, scanTarget) / scanTarget) * 85 : 85;
          var newTarget = Math.min(10 + pct, 95);
          setTargetProgress(function(prev) { return Math.max(prev, newTarget); });

          var idx = getPhaseIdx(done, scanTarget);
          setPhaseIdx(idx);
          setStatusMsg(STEPS[idx].label + " (" + done + "/" + total + " products)");

        } catch (e) {
          clearInterval(creepInterval);
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

      setTargetProgress(100);
      setPhaseIdx(5);
      setStatusMsg("Your store is ready! 🎉");
      await sleep(1500);
      if (onComplete) onComplete();
    }

    runScan();
    return function() { cancelledRef.current = true; };
  }, [autoStart]);

  // LEGACY MODE
  useEffect(() => {
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

  var title = isDone ? "Your store is ready! 🎉"
    : isPaused ? "Scan Paused ⏸"
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
          {isDone && <div className="cds-done-check">✓</div>}
          {isPaused && <div className="cds-done-check" style={{color:"#f59e0b",fontSize:36}}>⏸</div>}
          {totalProducts > 0 && (
            <div className="cds-radar-counter">
              <span className="cds-radar-num">{autoStart ? analyzed : totalProducts}</span>
              <span className="cds-radar-denom">{autoStart ? " / " + totalProducts : " products"}</span>
            </div>
          )}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">{isDone ? (analyzed || totalProducts) + " products analyzed — your dashboard is ready" : displayMsg}</div>

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
                <div className="cds-step-icon">{done ? "✓" : active ? <span className="cds-step-spinner"/> : "○"}</div>
                <span className="cds-step-label">{step.icon} {step.label}</span>
                {done && <span className="cds-step-done-badge">done</span>}
              </div>
            );
          })}
        </div>

        {isDone && (
          <div className="cds-cta-wrap" style={{animation:"cdsCtaPop .5s ease"}}>
            <div className="cds-cta-msg">✅ Analysis complete — loading your dashboard</div>
            <div className="cds-loading-bar"><div className="cds-loading-fill"/></div>
          </div>
        )}

        {!isDone && (
          <div style={{display:"flex",gap:12,marginTop:20,justifyContent:"center",flexWrap:"wrap"}}>
            {isPaused ? (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handleResume}>▶ Resume</button>
            ) : (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={function(){setShowPauseConfirm(true);}}>⏸ Pause</button>
            )}
            <button style={{padding:"10px 28px",fontSize:13,fontWeight:600,background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.7)",border:"1px solid rgba(239,68,68,.15)",borderRadius:10,cursor:"pointer"}} onClick={function(){setShowCancelConfirm(true);}}>✕ Cancel</button>
          </div>
        )}
      </div>

      {showPauseConfirm && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>⏸</div>
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
            <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
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
