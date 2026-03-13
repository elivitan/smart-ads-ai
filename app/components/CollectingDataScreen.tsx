import React, { useState, useEffect, useRef } from "react";

interface CollectingDataScreenProps {
  products?: any[];
  totalProducts?: number;
  storeName?: string;
  onComplete: () => void;
  onCancel?: () => void;
}

// ══════════════════════════════════════════════════════════════
// CollectingDataScreen — Welcome experience for new subscribers
//
// ARCHITECTURE:
//   - Products are ALREADY in the DB from Shopify webhook sync
//   - This is a purely theatrical animation — zero API calls
//   - Timing scales with store size (15s → 60s)
//   - Pause/Cancel use refs (instant, no race conditions)
//   - Single mode only — no legacy/autoStart split
//
// PROPS:
//   totalProducts  — number of products in the store
//   onComplete     — called when animation finishes
//   onCancel       — called when user confirms cancel
// ══════════════════════════════════════════════════════════════

var STEPS = [
  { label: "Connecting to your store",           icon: "\uD83D\uDCE6" },
  { label: "Discovering your products",           icon: "\uD83D\uDD0D" },
  { label: "Analyzing your market",               icon: "\uD83D\uDD75\uFE0F" },
  { label: "Building your ad strategy",           icon: "\uD83E\uDD16" },
  { label: "Preparing your dashboard",            icon: "\uD83D\uDCCA" },
];

function CollectingDataScreen(props: CollectingDataScreenProps) {
  var totalProducts = props.totalProducts || 0;
  var onComplete = props.onComplete;
  var onCancel = props.onCancel;

  // ── State ──
  var _p  = useState(0),     progress    = _p[0],  setProgress    = _p[1];
  var _t  = useState(0),     targetProg  = _t[0],  setTargetProg  = _t[1];
  var _ph = useState(0),     phaseIdx    = _ph[0], setPhaseIdx    = _ph[1];
  var _m  = useState(""),    statusMsg   = _m[0],  setStatusMsg   = _m[1];
  var _pa = useState(false), isPaused    = _pa[0], setIsPaused    = _pa[1];
  var _d  = useState(""),    dots        = _d[0],  setDots        = _d[1];
  var _sc = useState(false), showCancel  = _sc[0], setShowCancel  = _sc[1];
  var _sp = useState(false), showPause   = _sp[0], setShowPause   = _sp[1];
  var _dn = useState(false), isDone      = _dn[0], setIsDone      = _dn[1];

  // ── Refs for instant pause/cancel (no race conditions) ──
  var cancelledRef = useRef(false);
  var pausedRef    = useRef(false);
  var progressRef  = useRef(0);

  // ── Animated dots ──
  useEffect(function() {
    var iv = setInterval(function() {
      setDots(function(d) { return d.length >= 3 ? "" : d + "."; });
    }, 500);
    return function() { clearInterval(iv); };
  }, []);

  // ── Smooth progress animation ──
  useEffect(function() {
    var raf: number;
    function animate() {
      // Skip animation frame when paused — prevents CSS from drifting
      if (pausedRef.current) {
        raf = requestAnimationFrame(animate);
        return;
      }
      var current = progressRef.current;
      var target = targetProg;
      if (target < current) target = current; // never go backwards
      if (Math.abs(current - target) < 0.3) {
        progressRef.current = target;
        setProgress(Math.round(target));
      } else {
        var speed = Math.max(0.03, Math.abs(target - current) * 0.01);
        progressRef.current = current + speed;
        setProgress(Math.round(progressRef.current));
      }
      raf = requestAnimationFrame(animate);
    }
    raf = requestAnimationFrame(animate);
    return function() { cancelAnimationFrame(raf); };
  }, [targetProg]);

  // ── Main theatrical animation ──
  useEffect(function() {
    cancelledRef.current = false;
    pausedRef.current = false;

    var total = totalProducts || 1;

    // Scale timing to store size:
    // < 30 products → ~15s | 30-200 → ~28s | 200-1000 → ~42s | 1000+ → ~60s
    var timeScale = total < 30 ? 1 : total < 200 ? 1.8 : total < 1000 ? 2.8 : 4;
    var baseDurations = [2000, 2500, 3000, 2500, 2000];
    var durations = baseDurations.map(function(d) { return Math.round(d * timeScale); });

    // Phase boundaries (% ranges)
    var PB = [[0, 15], [15, 35], [35, 60], [60, 82], [82, 96]];

    function sleep(ms: number) { return new Promise(function(r) { setTimeout(r, ms); }); }

    // Show messages one by one with smooth progress
    async function runPhase(pi: number, msgs: string[]) {
      var bounds = PB[pi];
      var minMs = durations[pi];
      var interval = Math.max(Math.floor(minMs / msgs.length), 800);

      for (var s = 0; s < msgs.length; s++) {
        if (cancelledRef.current) return false;
        // ── PAUSE: freeze here until resumed or cancelled ──
        while (pausedRef.current) {
          await sleep(200);
          if (cancelledRef.current) return false;
        }
        setStatusMsg(msgs[s]);
        var pct = bounds[0] + ((bounds[1] - bounds[0]) * (s + 1) / msgs.length);
        setTargetProg(Math.round(pct));
        // Pause-aware sleep: check every 100ms instead of sleeping the full interval
        var elapsed = 0;
        while (elapsed < interval) {
          if (cancelledRef.current) return false;
          while (pausedRef.current) {
            await sleep(100);
            if (cancelledRef.current) return false;
          }
          await sleep(100);
          elapsed += 100;
        }
      }
      return true;
    }

    async function run() {
      // ── Phase 0: Connecting ──
      setPhaseIdx(0);
      var ok = await runPhase(0, [
        "Connecting to your Shopify store...",
        "Reading your product catalog...",
        total > 50
          ? "Found " + total.toLocaleString() + " products \u2014 impressive catalog!"
          : "Found " + total + " products \u2014 let\u2019s make them shine!",
      ]);
      if (!ok) return;

      // ── Phase 1: Discovering products ──
      setPhaseIdx(1);
      var discoverMsgs;
      if (total <= 30) {
        discoverMsgs = [
          "Analyzing each product in detail...",
          "Understanding your pricing & positioning...",
          "Your products are looking great!",
        ];
      } else if (total <= 200) {
        discoverMsgs = [
          "Scanning " + total + " products for opportunities...",
          Math.round(total * 0.4) + " products analyzed so far...",
          "Understanding your pricing & categories...",
          Math.round(total * 0.8) + " of " + total + " \u2014 almost there...",
          "Your catalog has real potential!",
        ];
      } else {
        discoverMsgs = [
          "Processing " + total.toLocaleString() + " products \u2014 this is a big store!",
          Math.round(total * 0.2).toLocaleString() + " products scanned...",
          "Mapping categories & price ranges...",
          Math.round(total * 0.5).toLocaleString() + " of " + total.toLocaleString() + " analyzed...",
          "Identifying your best-selling categories...",
          Math.round(total * 0.8).toLocaleString() + " products \u2014 nearly done...",
          "Your catalog is packed with opportunities!",
        ];
      }
      ok = await runPhase(1, discoverMsgs);
      if (!ok) return;

      // ── Phase 2: Market analysis ──
      setPhaseIdx(2);
      var competitors = Math.min(Math.round(total * 0.4), 50);
      var marketMsgs;
      if (total <= 50) {
        marketMsgs = [
          "Checking who\u2019s advertising in your niche...",
          "Found " + competitors + " competitors on Google Ads...",
          "Studying their strategies so you can beat them!",
        ];
      } else {
        marketMsgs = [
          "Scanning Google for competitors across " + Math.min(Math.round(total * 0.3), 30) + " categories...",
          "Found " + competitors + " active advertisers in your space...",
          "Analyzing their ad copy & bidding patterns...",
          "Mapping " + Math.round(competitors * 2.5) + " competitor keywords...",
          "Building your competitive advantage...",
        ];
      }
      ok = await runPhase(2, marketMsgs);
      if (!ok) return;

      // ── Phase 3: Building strategy ──
      setPhaseIdx(3);
      var stratMsgs;
      if (total <= 50) {
        stratMsgs = [
          "Crafting your personalized ad strategy...",
          "Selecting the best keywords for your products...",
          "Optimizing your budget allocation...",
        ];
      } else {
        stratMsgs = [
          "AI is designing your campaign structure...",
          "Building " + Math.min(Math.round(total * 0.6), 50) + " targeted ad groups...",
          "Selecting high-intent keywords...",
          "Calculating optimal budget per category...",
          "Fine-tuning for maximum ROI...",
        ];
      }
      ok = await runPhase(3, stratMsgs);
      if (!ok) return;

      // ── Phase 4: Preparing dashboard ──
      setPhaseIdx(4);
      ok = await runPhase(4, [
        "Organizing your insights...",
        "Preparing your personalized dashboard...",
        "Everything is ready for you!",
      ]);
      if (!ok) return;

      // ── Done ──
      setTargetProg(100);
      setPhaseIdx(5);
      setIsDone(true);
      setStatusMsg("Welcome aboard! Your store is ready to grow \uD83C\uDF89");
      await sleep(2000);
      if (!cancelledRef.current && onComplete) onComplete();
    }

    run();

    return function() { cancelledRef.current = true; };
  }, [totalProducts]);

  // ── Handlers ──
  function handlePause() {
    pausedRef.current = true;  // instant — ref, not state
    setIsPaused(true);
    setShowPause(false);
  }

  function handleResume() {
    pausedRef.current = false;
    setIsPaused(false);
  }

  function handleCancel() {
    cancelledRef.current = true; // instant stop — ref, not state
    setShowCancel(false);
    setIsPaused(false);
    pausedRef.current = false;
    if (onCancel) onCancel();
  }

  // When Cancel is clicked, IMMEDIATELY pause via ref (not just state)
  function onCancelClick() {
    pausedRef.current = true;  // freeze animation RIGHT NOW
    setIsPaused(true);
    setShowCancel(true);
  }

  // If user dismisses cancel dialog without cancelling, resume
  function onCancelDismiss() {
    setShowCancel(false);
    pausedRef.current = false;
    setIsPaused(false);
  }

  function onPauseClick() {
    pausedRef.current = true;
    setIsPaused(true);
    setShowPause(true);
  }

  function onPauseDismiss() {
    setShowPause(false);
    pausedRef.current = false;
    setIsPaused(false);
  }

  // ── Derived display values ──
  var displayProgress = progress;
  var title = isDone
    ? "Your store is ready! \uD83C\uDF89"
    : isPaused
    ? "Scan Paused \u23F8"
    : (STEPS[Math.min(phaseIdx, STEPS.length - 1)].label + dots);

  var displayMsg = isDone
    ? "Welcome aboard \u2014 your personalized dashboard is loading"
    : statusMsg;

  var words = ["impressions","clicks","CTR","ROAS","keywords","budget","CPC","conversions","reach","bids","ads","score"];

  // ── Render ──
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
              animationPlayState: isPaused ? "paused" : "running",
            }}>{w}</div>
          );
        })}
      </div>

      <div className="cds-center">
        <div className="cds-radar">
          <div className="cds-ring cds-ring-1" style={isPaused ? {animationPlayState:"paused"} : undefined}/>
          <div className="cds-ring cds-ring-2" style={isPaused ? {animationPlayState:"paused"} : undefined}/>
          <div className="cds-ring cds-ring-3" style={isPaused ? {animationPlayState:"paused"} : undefined}/>
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
              <span className="cds-radar-num">{displayProgress}%</span>
            </div>
          )}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">{displayMsg}</div>

        <div className="cds-progress-wrap">
          <div className="cds-progress-bar">
            <div className="cds-progress-fill" style={{ width: displayProgress + "%", transition: isPaused ? "none" : "width 0.3s ease" }}/>
            <div className="cds-progress-glow" style={{ left: Math.min(displayProgress, 98) + "%", transition: isPaused ? "none" : "left 0.3s ease" }}/>
          </div>
          <div className="cds-progress-pct">{displayProgress}%</div>
        </div>

        <div className="cds-steps">
          {STEPS.map(function(step, i) {
            var done = isDone || i < phaseIdx;
            var active = !isDone && i === phaseIdx;
            return (
              <div key={i} className={"cds-step " + (done ? "cds-step-done" : active ? "cds-step-active" : "cds-step-waiting")}>
                <div className="cds-step-icon">{done ? "\u2713" : active ? <span className="cds-step-spinner" style={isPaused ? {animationPlayState:"paused"} : undefined}/> : "\u25CB"}</div>
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
            {isPaused && !showCancel && !showPause ? (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handleResume}>{"\u25B6"} Resume</button>
            ) : !isPaused ? (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={onPauseClick}>Pause</button>
            ) : null}
            {!showCancel && (
              <button style={{padding:"10px 28px",fontSize:13,fontWeight:600,background:"rgba(239,68,68,.08)",color:"rgba(239,68,68,.7)",border:"1px solid rgba(239,68,68,.15)",borderRadius:10,cursor:"pointer"}} onClick={onCancelClick}>Cancel</button>
            )}
          </div>
        )}
      </div>

      {showPause && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>{"\u23F8"}</div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8,color:"#fff"}}>Pause scan?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:24,lineHeight:1.5}}>The scan will pause. You can resume at any time.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={onPauseDismiss}>Continue Scanning</button>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handlePause}>Yes, Pause</button>
            </div>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>{"\u26A0\uFE0F"}</div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8,color:"#fff"}}>Cancel scan?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:24,lineHeight:1.5}}>Your products are safe. You can always scan again later from your dashboard.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:600,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,cursor:"pointer"}} onClick={onCancelDismiss}>Continue Scanning</button>
              <button style={{padding:"10px 22px",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer"}} onClick={handleCancel}>Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CollectingDataScreen };
export default CollectingDataScreen;
