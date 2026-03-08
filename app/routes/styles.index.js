// app/routes/styles.index.js
// All CSS for the Smart Ads AI dashboard
// Extracted to reduce app._index.jsx size

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{-webkit-overflow-scrolling:touch}
.sr{font-family:'Plus Jakarta Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;scroll-behavior:smooth}
.dk{background:#0a0a1a;color:#fff;min-height:100vh;position:relative;overflow-x:hidden;width:100%;display:flex;flex-direction:column}
.bg-m{position:absolute;top:0;left:0;right:0;min-height:100%;background:radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.15),transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(6,182,212,.1),transparent 50%),radial-gradient(ellipse at 50% 80%,rgba(139,92,246,.1),transparent 50%);pointer-events:none;z-index:0}

/* TOP BAR */
.top-bar{position:relative;z-index:100}
.top-bar-inner{background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#f59e0b,#8b5cf6,#6366f1);background-size:300% 100%;animation:topBarFlow 4s linear infinite;padding:12px 24px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;box-shadow:0 2px 20px rgba(99,102,241,.4)}
@keyframes topBarFlow{0%{background-position:0% 50%}100%{background-position:300% 50%}}
.top-bar-fire{font-size:16px;animation:topBarPulse 1s ease infinite}
@keyframes topBarPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.3)}}
.top-bar-txt{font-size:13px;color:rgba(255,255,255,.95);text-align:center}
.top-bar-txt strong{color:#fff;font-weight:800}
.top-bar-highlight{background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px;font-weight:700;color:#fff}
.top-bar-btn{background:#fff;color:#4f46e5;font-family:inherit;font-size:13px;font-weight:800;padding:8px 22px;border:none;border-radius:100px;cursor:pointer;transition:all .25s;white-space:nowrap;box-shadow:0 0 16px rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.5px}
.top-bar-btn:hover{transform:scale(1.08);box-shadow:0 0 24px rgba(255,255,255,.5)}

/* STATUS BAR — two rows */
.status-bar{position:relative;z-index:100;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(10,10,26,.96);backdrop-filter:blur(16px)}
.status-bar-inner{padding:8px 24px;max-width:1600px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:6px;box-sizing:border-box}
.sb-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.sb-row-data{gap:6px}
.sb-row-actions{gap:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,.05)}
.sb-chips-left{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1}
.sb-chips-right{display:flex;align-items:center;gap:6px;flex-shrink:0}
.sb-chip2{display:flex;align-items:center;gap:6px;padding:5px 12px;height:32px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);white-space:nowrap;transition:all .2s}
.sb-chip2:hover{background:rgba(255,255,255,.07)}
.sb-chip-plan{border-color:rgba(99,102,241,.3)!important;background:rgba(99,102,241,.1)!important}
.sb-chip-credits{border-color:rgba(6,182,212,.3)!important;background:rgba(6,182,212,.07)!important}
.sb-chip-warn{border-color:rgba(245,158,11,.3)!important;background:rgba(245,158,11,.07)!important}
.sb-chip-top2{max-width:260px;overflow:hidden}
.sb-chip-publish-active{border-color:rgba(34,197,94,.3)!important;background:rgba(34,197,94,.07)!important}
.sb-chip-live{border-color:rgba(34,197,94,.25)!important;background:rgba(34,197,94,.05)!important}
.sb-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.sb-dot-green{background:#22c55e;box-shadow:0 0 6px #22c55e}
.sb-dot-cyan{background:#06b6d4;box-shadow:0 0 6px #06b6d4}
.sb-dot-orange{background:#f59e0b;box-shadow:0 0 6px #f59e0b}
.sb-label{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);letter-spacing:.6px;text-transform:uppercase}
.sb-value{font-size:12px;font-weight:700;color:rgba(255,255,255,.85);font-family:monospace}
.sb-val-green{color:#22c55e}.sb-val-cyan{color:#22d3ee}.sb-val-gold{color:#fbbf24}
.sb-btn2{background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);padding:5px 14px;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s;height:30px}
.sb-btn2:hover{background:rgba(99,102,241,.3);color:#fff}
.sb-btn2-upgrade{background:rgba(245,158,11,.12);color:#fbbf24;border-color:rgba(245,158,11,.3)}
.sb-btn2-upgrade:hover{background:rgba(245,158,11,.25);color:#fff}
.sb-last-updated{font-size:10px;color:rgba(255,255,255,.25);margin-left:auto;white-space:nowrap}

/* COMPETITOR MODAL */
.comp-modal{max-width:700px}
.comp-modal-header{display:flex;align-items:center;gap:14px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08)}
.comp-modal-favicon{width:44px;height:44px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.comp-modal-domain{font-size:20px;font-weight:800;color:#a5b4fc;text-decoration:none;transition:color .2s}
.comp-modal-domain:hover{color:#fff;text-decoration:underline}
.comp-modal-strength{font-size:11px;font-weight:700;border:1px solid;padding:3px 10px;border-radius:20px;text-transform:capitalize}
.comp-est-badge{font-size:10px;font-weight:600;color:rgba(255,255,255,.35);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:2px 8px;border-radius:4px}
.comp-real-badge{font-size:10px;font-weight:700;color:#22c55e;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);padding:2px 8px;border-radius:4px}
.comp-modal-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:40px 0;color:rgba(255,255,255,.5)}
.comp-loading-spinner{width:36px;height:36px;border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.comp-metrics-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.comp-metric-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;text-align:center}
.comp-metric-icon{font-size:20px;margin-bottom:6px}
.comp-metric-val{font-size:18px;font-weight:800;margin-bottom:3px}
.comp-metric-lbl{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.4px}
.comp-ads-section{margin-bottom:18px}
.comp-section-title{font-size:13px;font-weight:700;color:rgba(255,255,255,.6);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
.comp-ads-list{display:flex;flex-direction:column;gap:10px}
.comp-ad-card{border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;position:relative}
.comp-ad-position-badge{position:absolute;top:8px;right:8px;font-size:9px;font-weight:700;color:rgba(255,255,255,.4);background:rgba(0,0,0,.3);padding:2px 7px;border-radius:4px}
.comp-ad-inner{background:#fff;padding:12px 14px}
.comp-ad-sponsored{font-size:10px;font-weight:700;color:#000;border:1px solid rgba(0,0,0,.2);display:inline-block;padding:1px 5px;border-radius:2px;margin-bottom:5px}
.comp-ad-url-row{display:flex;align-items:center;gap:6px;margin-bottom:4px}
.comp-ad-headline{font-size:17px;color:#1a0dab;line-height:1.3;margin-bottom:4px;font-family:Arial,sans-serif;font-weight:400}
.comp-ad-desc{font-size:13px;color:#4d5156;line-height:1.5;font-family:Arial,sans-serif}
.comp-ad-kw-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid #e8eaed}
.comp-ad-kw{font-size:11px;color:#1a73e8;background:#e8f0fe;padding:2px 8px;border-radius:3px;border:1px solid #d2e3fc}
.comp-kw-section{margin-bottom:14px}
.comp-kw-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.comp-kw-chip{font-size:12px;font-weight:600;color:#4ade80;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);padding:4px 10px;border-radius:6px}
.comp-source-note{font-size:11px;color:rgba(255,255,255,.3);padding-top:12px;border-top:1px solid rgba(255,255,255,.06)}
.competitor-item-clickable{cursor:pointer;transition:all .2s}
.competitor-item-clickable:hover{background:rgba(99,102,241,.08)!important;border-color:rgba(99,102,241,.3)!important}
.competitor-click-hint{font-size:11px;color:rgba(99,102,241,.6);margin-left:auto;white-space:nowrap;font-weight:600}
.competitor-item-clickable:hover .competitor-click-hint{color:#a5b4fc}
.competitor-favicon{display:flex;align-items:center;flex-shrink:0}
.competitor-keywords{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.competitor-kw-tag{padding:2px 7px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.25);border-radius:20px;font-size:10px;color:#a5b4fc;white-space:nowrap}



/* COLLECTING DATA SCREEN */
.cds-wrap{min-height:80vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.cds-particles{position:absolute;inset:0;pointer-events:none}
.cds-particle{position:absolute;font-size:11px;font-weight:700;color:rgba(99,102,241,.15);animation:cdsFloat 4s ease-in-out infinite;font-family:monospace;letter-spacing:.5px}
@keyframes cdsFloat{0%,100%{transform:translateY(0) scale(1);opacity:.15}50%{transform:translateY(-18px) scale(1.1);opacity:.35}}
.cds-center{display:flex;flex-direction:column;align-items:center;gap:24px;max-width:520px;width:100%;text-align:center;position:relative;z-index:1;padding:40px 20px}
.cds-radar{position:relative;width:160px;height:160px;margin-bottom:8px}
.cds-radar-counter{position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);display:flex;align-items:baseline;gap:2px;white-space:nowrap}
.cds-radar-num{font-size:22px;font-weight:800;color:#a78bfa;line-height:1}
.cds-radar-denom{font-size:14px;font-weight:600;color:rgba(255,255,255,.5)}
.cds-cancel-btn{margin-top:24px;background:transparent;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.4);font-family:inherit;font-size:12px;padding:8px 20px;border-radius:100px;cursor:pointer;transition:all .2s}
.cds-cancel-btn:hover{border-color:rgba(239,68,68,.5);color:rgba(239,68,68,.8)}
.cds-ring{position:absolute;border-radius:50%;border:1px solid rgba(99,102,241,.2);top:50%;left:50%;transform:translate(-50%,-50%)}
.cds-ring-1{width:160px;height:160px;animation:cdsRingPulse 2s ease-out infinite}
.cds-ring-2{width:110px;height:110px;animation:cdsRingPulse 2s ease-out infinite .5s}
.cds-ring-3{width:60px;height:60px;animation:cdsRingPulse 2s ease-out infinite 1s;border-color:rgba(99,102,241,.4)}
@keyframes cdsRingPulse{0%{opacity:.8;transform:translate(-50%,-50%) scale(.95)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}
.cds-radar-dot{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:radial-gradient(circle,#6366f1,#8b5cf6);box-shadow:0 0 20px rgba(99,102,241,.8);z-index:2}
.cds-radar-sweep{position:absolute;top:50%;left:50%;width:80px;height:2px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(99,102,241,.8),transparent);animation:cdsSweep 2s linear infinite;border-radius:2px}
@keyframes cdsSweep{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.cds-title{font-size:22px;font-weight:800;letter-spacing:-.3px}
.cds-sub{font-size:14px;color:rgba(255,255,255,.45);line-height:1.5;max-width:380px}
.cds-progress-wrap{display:flex;align-items:center;gap:12px;width:100%}
.cds-progress-bar{flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;position:relative}
.cds-progress-fill{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);border-radius:3px;transition:width .3s ease}
.cds-progress-glow{position:absolute;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#8b5cf6;box-shadow:0 0 12px rgba(139,92,246,.9);transition:left .3s ease}
.cds-progress-pct{font-size:12px;font-weight:700;color:rgba(255,255,255,.4);width:36px;text-align:right;flex-shrink:0}
.cds-steps{display:flex;flex-direction:column;gap:8px;width:100%;text-align:left}
.cds-step{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;transition:all .3s;border:1px solid transparent}
.cds-step-done{color:rgba(255,255,255,.4)}
.cds-step-active{color:#fff;background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.2)}
.cds-step-waiting{color:rgba(255,255,255,.2)}
.cds-step-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;color:#22c55e}
.cds-step-active .cds-step-icon{color:#a5b4fc}
.cds-step-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(99,102,241,.3);border-top-color:#6366f1;border-radius:50%;animation:spin .7s linear infinite}
.cds-step-label{font-size:13px;font-weight:500}
.cds-cta-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:8px;width:100%}
.cds-cta-msg{font-size:13px;color:#86efac;font-weight:600}
.cds-cta-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:14px 36px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;transition:all .3s;box-shadow:0 8px 32px rgba(99,102,241,.4);animation:cdsCtaPop .4s cubic-bezier(.4,0,.2,1)}
@keyframes cdsCtaPop{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
.cds-step-done-badge{margin-left:auto;font-size:9px;font-weight:700;color:#22c55e;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);padding:1px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px}
.cds-done-check{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:32px;color:#22c55e;font-weight:900;z-index:3;animation:cdsCtaPop .4s ease}
.cds-loading-bar{width:100%;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:8px}
.cds-loading-fill{height:100%;background:linear-gradient(90deg,#6366f1,#22c55e);border-radius:2px;animation:cdsLoadingFill 1.8s ease forwards}
@keyframes cdsLoadingFill{from{width:0%}to{width:100%}}

/* COMPETITOR GAP FINDER */
.gap-card{background:linear-gradient(135deg,rgba(239,68,68,.06),rgba(245,158,11,.04));border:1px solid rgba(239,68,68,.2);border-radius:20px;padding:22px 24px;margin-bottom:24px;position:relative;overflow:hidden}
.gap-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(239,68,68,.5),rgba(245,158,11,.4),transparent)}
.gap-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.gap-card-title-row{display:flex;align-items:center;gap:12px}
.gap-card-icon{font-size:24px;flex-shrink:0}
.gap-card-title{font-size:16px;font-weight:800;margin-bottom:2px}
.gap-card-sub{font-size:12px;color:rgba(255,255,255,.4)}
.gap-loss-badge{text-align:right;flex-shrink:0}
.gap-loss-label{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
.gap-loss-amount{font-size:28px;font-weight:900;color:#ef4444;opacity:0;transform:scale(.8);transition:all .6s cubic-bezier(.4,0,.2,1);letter-spacing:-1px}
.gap-loss-visible{opacity:1;transform:scale(1);text-shadow:0 0 20px rgba(239,68,68,.4)}
.gap-alert{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);border-radius:10px;padding:10px 14px;font-size:13px;color:rgba(255,255,255,.7);margin-bottom:16px}
.gap-alert-icon{font-size:16px;flex-shrink:0}
.gap-alert strong{color:#fca5a5}
.gap-table{display:flex;flex-direction:column;border:1px solid rgba(255,255,255,.07);border-radius:12px;overflow:hidden;margin-bottom:12px}
.gap-table-head{display:grid;grid-template-columns:2fr 1fr 1fr 1.2fr 1fr .8fr;gap:8px;padding:9px 16px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.07);font-size:10px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.5px}
.gap-row{display:grid;grid-template-columns:2fr 1fr 1fr 1.2fr 1fr .8fr;gap:8px;padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.05);align-items:center;transition:background .2s;animation:gapRowIn .3s ease both}
@keyframes gapRowIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
.gap-row:last-child{border-bottom:none}
.gap-row:hover{background:rgba(255,255,255,.03)}
.gap-row-added{background:rgba(34,197,94,.04)!important}
.gap-keyword-text{font-size:13px;font-weight:600;color:#fff}
.gap-freq{display:flex;align-items:center;gap:3px}
.gap-freq-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.gap-freq-num{font-size:11px;color:rgba(255,255,255,.4);margin-left:3px}
.gap-clicks{font-size:13px;color:rgba(255,255,255,.6)}
.gap-unit{font-size:10px;color:rgba(255,255,255,.3)}
.gap-loss{font-size:14px;font-weight:800}
.gap-diff{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700}
.gap-diff-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.gap-action{display:flex;justify-content:flex-end}
.gap-add-btn{background:rgba(99,102,241,.15);color:#a5b4fc;border:1px solid rgba(99,102,241,.3);padding:5px 12px;border-radius:7px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.gap-add-btn:hover{background:rgba(99,102,241,.3);color:#fff;transform:scale(1.05)}
.gap-added-badge{font-size:11px;font-weight:700;color:#22c55e;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);padding:4px 10px;border-radius:6px}
.gap-expand-btn{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:rgba(255,255,255,.5);font-family:inherit;font-size:12px;font-weight:600;padding:8px;cursor:pointer;transition:all .2s;margin-bottom:12px}
.gap-expand-btn:hover{background:rgba(255,255,255,.08);color:#fff}
.gap-upgrade-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:10px;padding:10px 16px;flex-wrap:wrap}
.gap-upgrade-txt{font-size:12px;color:rgba(255,255,255,.5);flex:1}
.gap-upgrade-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:7px 18px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s}
.gap-upgrade-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(99,102,241,.4)}
.gap-success-row{background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.2);border-radius:10px;padding:10px 16px;font-size:13px;color:#86efac;font-weight:600}
.gap-empty{text-align:center;padding:24px 0}

/* AD PREVIEW PANEL */
.adp-card{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(99,102,241,.04));border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:20px;margin-bottom:24px;position:relative;overflow:hidden}
.adp-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.4),rgba(6,182,212,.4),transparent)}
.adp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:160px;gap:8px}
.adp-empty-icon{font-size:36px;opacity:.4}
.adp-empty-title{font-size:15px;font-weight:700;color:rgba(255,255,255,.4)}
.adp-empty-desc{font-size:13px;color:rgba(255,255,255,.25)}
.adp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.adp-header-left{display:flex;align-items:center;gap:8px}
.adp-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.adp-dot-active{background:#22c55e;box-shadow:0 0 8px #22c55e;animation:ldPulse 1.5s ease infinite}
.adp-dot-preview{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,.5)}
.adp-title{font-size:14px;font-weight:700}
.adp-badge{font-size:9px;font-weight:800;padding:2px 8px;border-radius:4px;letter-spacing:.8px}
.adp-badge-live{background:rgba(34,197,94,.15);color:#22c55e;border:1px solid rgba(34,197,94,.3);animation:liveTagBlink 2s ease infinite}
.adp-badge-preview{background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.25)}
.adp-score-pill{display:flex;align-items:center;gap:6px;border:1px solid;border-radius:100px;padding:3px 10px 3px 4px;font-size:12px;font-weight:700}
.adp-product-row{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 14px;margin-bottom:14px}
.adp-product-img{width:42px;height:42px;border-radius:8px;object-fit:cover;flex-shrink:0}
.adp-product-info{flex:1;min-width:0}
.adp-product-name{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adp-product-price{font-size:12px;color:#a5b4fc;font-weight:600;margin-top:2px}
.adp-not-live-badge{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:3px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.adp-tabs{display:flex;gap:4px;background:rgba(255,255,255,.04);border-radius:10px;padding:3px;margin-bottom:14px}
.adp-tab{flex:1;padding:6px;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:rgba(255,255,255,.4)}
.adp-tab.adp-tab-active{background:rgba(99,102,241,.25);color:#c4b5fd}
.adp-tab:hover:not(.adp-tab-active){color:rgba(255,255,255,.7)}
.adp-preview-wrap{background:#fff;border-radius:12px;overflow:hidden;margin-bottom:14px}
.adp-google-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #e8eaed;background:#fff;font-size:13px;color:#202124;min-height:38px}
.adp-typed-text{flex:1;color:#202124;font-size:13px}
.adp-cursor{animation:cursorBlink .7s ease infinite;color:#4285F4}
@keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}
.adp-search-icon{font-size:16px;margin-left:auto}
.adp-dropdown{background:#fff;border:1px solid #ddd;border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.adp-dropdown-item{padding:6px 12px;font-size:12px;color:#202124;display:flex;align-items:center;gap:8px}
.adp-dropdown-item:hover{background:#f5f5f5}
.adp-google-result{padding:12px 14px;background:#fff}
.adp-sponsored-tag{font-size:11px;font-weight:700;color:#000;margin-bottom:6px;display:inline-block;border:1px solid rgba(0,0,0,.2);padding:1px 5px;border-radius:2px}
.adp-result-url{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.adp-favicon{width:20px;height:20px;border-radius:3px;background:#e8eaed;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.adp-result-headline{font-size:18px;color:#1a0dab;line-height:1.3;margin-bottom:4px;font-family:Arial,sans-serif;font-weight:400}
.adp-hl-part{cursor:pointer}
.adp-hl-part:hover{text-decoration:underline}
.adp-hl-sep{color:#1a0dab;font-weight:300}
.adp-result-desc{font-size:13px;color:#4d5156;line-height:1.5;font-family:Arial,sans-serif}
.adp-sitelinks-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #e8eaed}
.adp-sitelink-chip{font-size:13px;color:#1a0dab;padding:4px 10px;border:1px solid #dadce0;border-radius:4px;cursor:pointer}
.adp-sitelink-chip:hover{background:#f8f9fa}
.adp-shopping-bar{padding:6px 12px;font-size:11px;color:#555;border-bottom:1px solid #e8eaed;background:#f8f9fa}
.adp-shopping-cards{display:flex;gap:8px;padding:10px;overflow-x:auto}
.adp-shopping-card{background:#fff;border:1px solid #e8eaed;border-radius:8px;padding:10px;min-width:100px;flex-shrink:0;position:relative}
.adp-shopping-ours{border-color:#1a73e8;box-shadow:0 1px 8px rgba(26,115,232,.2)}
.adp-shopping-comp{opacity:.85}
.adp-shopping-our-badge{position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:#1a73e8;color:#fff;font-size:8px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap}
.adp-shopping-img{width:80px;height:80px;object-fit:cover;border-radius:4px;display:block;margin-bottom:6px}
.adp-shopping-noimg{width:80px;height:80px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:6px}
.adp-shopping-price{font-size:14px;font-weight:700;color:#1a73e8;margin-bottom:2px}
.adp-shopping-name{font-size:11px;color:#202124;line-height:1.3;margin-bottom:2px}
.adp-shopping-store{font-size:10px;color:#70757a;margin-bottom:3px}
.adp-shopping-stars{font-size:11px;color:#fbbc04}
.adp-mobile-wrap{background:transparent!important;display:flex;justify-content:center;padding:10px 0}
.adp-phone-frame{width:180px;height:280px;background:#1a1a1a;border-radius:24px;padding:6px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.adp-phone-notch{width:50px;height:8px;background:#0a0a0a;border-radius:4px;margin:0 auto 4px}
.adp-phone-screen{background:#fff;border-radius:18px;height:100%;overflow:hidden;display:flex;flex-direction:column}
.adp-phone-searchbar{background:#f1f3f4;margin:6px;border-radius:10px;padding:5px 8px;font-size:9px;color:#202124}
.adp-phone-ad{background:#fff;border:1px solid #e8eaed;margin:4px 6px;border-radius:6px;padding:6px}
.adp-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px}
.adp-live-stats{display:flex;gap:14px;font-size:12px;color:rgba(255,255,255,.5)}
.adp-live-stats span{display:flex;align-items:center;gap:4px}
.adp-suggestion{font-size:12px;color:rgba(255,255,255,.45);flex:1}
.adp-btn-secondary{background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);padding:7px 16px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap}
.adp-btn-secondary:hover{background:rgba(99,102,241,.25);color:#fff}
.adp-btn-launch{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:8px 20px;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;white-space:nowrap;flex-shrink:0}
.adp-btn-launch:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,.4)}

/* HEALTH + PULSE ROW */
.health-pulse-row{display:grid;grid-template-columns:380px 1fr;gap:16px;margin-bottom:24px;align-items:start}

/* STORE HEALTH CARD */
.health-card{background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.05));border:1px solid rgba(99,102,241,.2);border-radius:20px;padding:22px;cursor:pointer;transition:all .3s;position:relative;overflow:hidden}
.health-card:hover{border-color:rgba(99,102,241,.4);box-shadow:0 8px 32px rgba(99,102,241,.15)}
.health-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.6),transparent)}
.health-top{display:flex;align-items:center;gap:18px}
.health-ring-wrap{position:relative;flex-shrink:0}
.health-pulse{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:168px;height:168px;border-radius:50%;border:1.5px solid;animation:healthPulse 2.5s ease-out infinite;pointer-events:none}
.health-pulse-2{animation-delay:1.2s;width:190px;height:190px}
@keyframes healthPulse{0%{opacity:.8;transform:translate(-50%,-50%) scale(.85)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15)}}
.health-info{flex:1;min-width:0}
.health-label{font-size:11px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px}
.health-status-text{font-size:22px;font-weight:900;margin-bottom:6px;letter-spacing:-.5px}
.health-desc{font-size:12px;color:rgba(255,255,255,.5);line-height:1.5;margin-bottom:12px}
.health-mini-bars{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.health-mini-bar-row{display:flex;align-items:center;gap:6px}
.health-mini-lbl{font-size:13px;flex-shrink:0;width:18px}
.health-mini-track{flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:2px;overflow:hidden}
.health-mini-fill{height:100%;border-radius:2px}
.health-mini-val{font-size:10px;font-weight:700;min-width:24px;text-align:right}
.health-expand{font-size:11px;color:rgba(99,102,241,.7);cursor:pointer;font-weight:600}
.health-expand:hover{color:#a5b4fc}
.health-breakdown{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:1fr 1fr;gap:12px}
.health-sub-item{display:flex;align-items:center;gap:10px}
.health-tips{grid-column:1/-1;margin-top:4px}
.health-tip-item{font-size:12px;color:rgba(255,255,255,.45);padding:5px 0;border-top:1px solid rgba(255,255,255,.05)}

/* LIVE PULSE CARD */
.pulse-card{background:linear-gradient(135deg,rgba(6,182,212,.06),rgba(99,102,241,.06));border:1px solid rgba(6,182,212,.2);border-radius:20px;padding:20px;position:relative;overflow:hidden}
.pulse-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(6,182,212,.5),transparent)}
.pulse-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:220px}
.pulse-header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.pulse-dot-live{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;transition:all .3s;flex-shrink:0}
.pulse-beat{box-shadow:0 0 20px #22c55e,0 0 40px rgba(34,197,94,.4);transform:scale(1.4)}
.pulse-live-tag{font-size:9px;font-weight:800;color:#22c55e;border:1px solid rgba(34,197,94,.35);padding:2px 7px;border-radius:4px;letter-spacing:1px;animation:liveTagBlink 2s ease infinite}
@keyframes liveTagBlink{0%,100%{opacity:1}50%{opacity:.6}}
.heart-beat{animation:heartBeat .6s ease}
@keyframes heartBeat{0%,100%{transform:scale(1)}30%{transform:scale(1.3)}60%{transform:scale(.9)}}
.pulse-canvas{width:100%;height:72px;display:block;border-radius:8px}
.pulse-metrics-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
.pulse-metric-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px;text-align:center}
.pulse-m-val{font-size:16px;font-weight:800;margin-bottom:3px}
.pulse-m-lbl{font-size:10px;color:rgba(255,255,255,.4)}
.pulse-m-imp .pulse-m-val{color:#6366f1}
.pulse-m-clk .pulse-m-val{color:#22c55e}
.pulse-m-ctr .pulse-m-val{color:#06b6d4}
.pulse-m-cost .pulse-m-val{color:#f59e0b}
.pulse-event-bar{display:flex;align-items:center;gap:8px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:8px;padding:8px 12px;font-size:12px;transition:opacity .3s}
.pulse-event-dot-green{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e;flex-shrink:0;animation:ldPulse 1s ease infinite}
.pulse-event-txt{flex:1;color:rgba(255,255,255,.7)}
.pulse-event-time{color:rgba(255,255,255,.3);font-size:10px;white-space:nowrap}
.pulse-controls{margin-top:14px;border-top:1px solid rgba(255,255,255,.08);padding-top:14px;display:flex;flex-direction:column;gap:10px}
.pulse-spend-box{display:flex;align-items:center;gap:10px}
.pulse-spend-label{font-size:12px;color:rgba(255,255,255,.5)}
.pulse-spend-val{font-size:20px;font-weight:800;color:#22c55e}
.pulse-spend-fetching{font-size:13px;color:rgba(255,255,255,.4);font-weight:400}
.pulse-spend-note{font-size:11px;color:rgba(255,255,255,.3)}
.pulse-btn-row{display:flex;gap:8px;flex-wrap:wrap}
.pulse-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all .2s}
.pulse-btn:disabled{opacity:.5;cursor:not-allowed}
.pulse-btn-pause{background:rgba(99,102,241,.2);color:#a5b4fc;border:1px solid rgba(99,102,241,.3)}
.pulse-btn-pause:hover:not(:disabled){background:rgba(99,102,241,.35)}
.pulse-btn-remove{background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.3)}
.pulse-btn-remove:hover:not(:disabled){background:rgba(239,68,68,.3)}
.pulse-status-badge{font-size:12px;padding:6px 12px;border-radius:20px;font-weight:700}
.pulse-badge-paused{background:rgba(99,102,241,.15);color:#a5b4fc}
.pulse-badge-removed{background:rgba(34,197,94,.1);color:#22c55e}
.pulse-badge-error{background:rgba(239,68,68,.1);color:#fca5a5}
.pulse-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;display:flex;align-items:center;justify-content:center}
.pulse-confirm-box{background:#1a1a2e;border:1px solid rgba(239,68,68,.3);border-radius:16px;padding:32px;max-width:380px;width:90%;text-align:center}
.campaign-control-bar{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 16px;margin-top:8px;gap:12px;flex-wrap:wrap}
.campaign-control-label{font-size:13px;font-weight:700;color:rgba(255,255,255,.8)}
.campaign-control-btns{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cc-btn{padding:7px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all .2s}
.cc-btn:disabled{opacity:.5;cursor:not-allowed}
.cc-btn-pause{background:rgba(99,102,241,.2);color:#a5b4fc;border:1px solid rgba(99,102,241,.3)}
.cc-btn-pause:hover:not(:disabled){background:rgba(99,102,241,.35)}
.cc-btn-remove{background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.3)}
.cc-btn-remove:hover:not(:disabled){background:rgba(239,68,68,.3)}
.cc-error{font-size:11px;color:#fca5a5}
.budget-sim-card{background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(6,182,212,.05));border:1px solid rgba(99,102,241,.2);border-radius:20px;padding:28px;margin-bottom:24px;position:relative;z-index:10}
.budget-sim-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:12px}
.budget-sim-title{font-size:18px;font-weight:800;margin:0 0 4px}
.budget-sim-sub{font-size:13px;color:rgba(255,255,255,.5);margin:0}
.budget-sim-upgrade{padding:8px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.budget-sim-inputs{display:flex;flex-direction:column;gap:18px;margin-bottom:24px;position:relative;z-index:11}
.budget-sim-input-row{display:flex;flex-direction:column;gap:6px}
.budget-sim-input-label{display:flex;justify-content:space-between;font-size:13px;color:rgba(255,255,255,.7)}
.budget-sim-input-val{font-weight:800;color:#a5b4fc}
.budget-sim-slider{width:100%;height:8px;-webkit-appearance:none;appearance:none;background:rgba(99,102,241,.2);border-radius:4px;outline:none;cursor:pointer;position:relative;z-index:9999;pointer-events:all;margin:8px 0;touch-action:none;-webkit-user-select:none;user-select:none}.budget-sim-slider:active{cursor:grabbing}.budget-sim-input-row{position:relative;z-index:9999;touch-action:none}
.budget-sim-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);cursor:pointer;box-shadow:0 0 8px rgba(99,102,241,.5);margin-top:-7px}.budget-sim-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);cursor:pointer;box-shadow:0 0 8px rgba(99,102,241,.5);border:none}.budget-sim-slider::-moz-range-track{height:8px;background:rgba(99,102,241,.2);border-radius:4px}
.budget-sim-range-labels{display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.3)}
.budget-sim-results{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.budget-sim-result-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;text-align:center;transition:border-color .3s}
.budget-sim-result-val{font-size:22px;font-weight:900;color:#e2e8f0;margin-bottom:4px}
.budget-sim-result-lbl{font-size:11px;color:rgba(255,255,255,.4)}
.budget-sim-monthly{background:rgba(0,0,0,.2);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px}
.budget-sim-monthly-row{display:flex;justify-content:space-between;font-size:13px;color:rgba(255,255,255,.7)}
.budget-sim-breakeven{margin-top:8px;padding:8px 12px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;font-size:12px;font-weight:700;color:#a5b4fc;text-align:center}
.budget-sim-note{margin-top:12px;font-size:11px;color:rgba(255,255,255,.25);text-align:center}
@media(max-width:768px){.budget-sim-results{grid-template-columns:repeat(2,1fr)}}

/* ── TOP MISSED OPPORTUNITY ── */
.tmo-card{position:relative;background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(34,197,94,.08));border:1px solid rgba(99,102,241,.3);border-radius:20px;padding:24px;margin-bottom:20px;overflow:hidden}
.tmo-teaser{display:flex;align-items:center;gap:20px;cursor:pointer}
.tmo-teaser-icon{font-size:48px;flex-shrink:0}
.tmo-teaser-content{flex:1}
.tmo-teaser-title{font-size:20px;font-weight:800;margin:0 0 6px;color:#e2e8f0}
.tmo-teaser-sub{font-size:13px;color:rgba(255,255,255,.55);margin:0 0 14px;line-height:1.5}
.tmo-teaser-btn{padding:10px 22px;background:linear-gradient(135deg,#6366f1,#22c55e);border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:transform .2s}
.tmo-teaser-btn:hover{transform:scale(1.04)}
.tmo-teaser-bg{position:absolute;right:24px;top:50%;transform:translateY(-50%);font-size:80px;opacity:.06;pointer-events:none}
.tmo-badge{display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:16px;letter-spacing:.5px}
.tmo-content{display:flex;gap:24px;align-items:flex-start}
.tmo-left{display:flex;gap:12px;align-items:flex-start;min-width:200px}
.tmo-img{width:70px;height:70px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,.1)}
.tmo-product-info{flex:1}
.tmo-product-title{font-size:14px;font-weight:700;color:#e2e8f0;margin-bottom:4px;line-height:1.3}
.tmo-product-price{font-size:13px;color:rgba(255,255,255,.5);margin-bottom:8px}
.tmo-score-row{display:flex;align-items:center;gap:8px}
.tmo-score-bar{flex:1;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden}
.tmo-score-fill{height:100%;border-radius:3px;transition:width .6s}
.tmo-score-val{font-size:11px;font-weight:700;color:rgba(255,255,255,.6);white-space:nowrap}
.tmo-right{flex:1;display:flex;flex-direction:column;gap:14px}
.tmo-money-lost{text-align:center;padding:16px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:14px}
.tmo-money-val{font-size:36px;font-weight:900;color:#22c55e;line-height:1}
.tmo-money-lbl{font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;line-height:1.4}
.tmo-insights{display:flex;flex-direction:column;gap:6px}
.tmo-insight{font-size:12px;color:rgba(255,255,255,.6);padding:6px 10px;background:rgba(255,255,255,.04);border-radius:8px;line-height:1.4}
.tmo-cta{padding:11px 20px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:all .2s;align-self:flex-start}
.tmo-cta:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(99,102,241,.4)}

/* ── COMPETITOR LIVE FEED ── */
.clf-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;margin-bottom:20px}
.clf-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.clf-live-dot{width:8px;height:8px;background:#ef4444;border-radius:50%;box-shadow:0 0 6px #ef4444;animation:pulse-dot 1.5s infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
.clf-title{font-size:15px;font-weight:700;margin:0}
.clf-live-badge{background:rgba(239,68,68,.15);color:#fca5a5;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid rgba(239,68,68,.3)}
.clf-sub{font-size:12px;color:rgba(255,255,255,.35)}
.clf-feed{display:flex;flex-direction:column;gap:8px}
.clf-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;transition:all .3s}
.clf-item-new{border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.05)}
.clf-item-icon{font-size:16px;flex-shrink:0}
.clf-item-content{flex:1;font-size:12px;line-height:1.4}
.clf-item-domain{font-weight:700;color:#a5b4fc}
.clf-item-action{color:rgba(255,255,255,.6)}
.clf-item-time{font-size:10px;color:rgba(255,255,255,.3);white-space:nowrap}
@media(max-width:768px){.tmo-content{flex-direction:column}.tmo-left{min-width:unset}}

/* DASHBOARD */
.da{position:relative;z-index:1;padding:28px 32px;max-width:1600px;margin:0 auto;width:100%;flex:1;box-sizing:border-box}
.da-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.da-title{font-size:26px;font-weight:800;background:linear-gradient(135deg,#fff,#c7d2fe);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.da-sub{font-size:14px;color:rgba(255,255,255,.5);margin-top:4px}
.da-potential-banner{margin-top:10px;padding:8px 14px;background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(99,102,241,.1));border:1px solid rgba(34,197,94,.25);border-radius:10px;font-size:13px;color:rgba(255,255,255,.75)}
.da-potential-banner strong{color:#22c55e}
.da-potential-link{color:#a5b4fc;cursor:pointer;text-decoration:underline;font-weight:600}

/* ── LANDING BUDGET TEASER ── */
.lp-budget-section .sec-sub,.lp-missing-section .sec-sub{font-size:15px;color:rgba(255,255,255,.5);margin:-12px 0 24px;text-align:center}
.lp-budget-card{max-width:640px;margin:0 auto;background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(6,182,212,.06));border:1px solid rgba(99,102,241,.25);border-radius:20px;padding:32px}
.lp-budget-slider-wrap{margin-bottom:28px}
.lp-budget-slider-label{display:flex;justify-content:space-between;font-size:15px;font-weight:600;margin-bottom:10px;color:rgba(255,255,255,.8)}
.lp-budget-val{color:#a5b4fc;font-weight:800;font-size:18px}
.lp-budget-results{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.lp-budget-result{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;text-align:center;transition:border-color .3s}
.lp-budget-result-val{font-size:24px;font-weight:900;color:#e2e8f0;margin-bottom:4px}
.lp-budget-result-lbl{font-size:11px;color:rgba(255,255,255,.4)}
.lp-budget-footer{text-align:center;font-size:11px;color:rgba(255,255,255,.25);margin-top:8px}

/* ── LANDING MISSING BLOCK ── */
.lp-missing-card{max-width:760px;margin:0 auto;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden}
.lp-missing-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
.lp-missing-stat{padding:32px 24px;text-align:center;border-right:1px solid rgba(255,255,255,.06)}
.lp-missing-stat:last-child{border-right:none}
.lp-missing-icon{font-size:28px;margin-bottom:10px}
.lp-missing-val{font-size:36px;font-weight:900;margin-bottom:8px;transition:all .4s}
.lp-missing-lbl{font-size:12px;color:rgba(255,255,255,.45);line-height:1.4}
.lp-missing-cta{padding:20px 28px;background:rgba(99,102,241,.08);border-top:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.lp-missing-cta-text{font-size:14px;color:rgba(255,255,255,.6)}
.lp-missing-cta-text strong{color:#e2e8f0}
.lp-missing-btn{padding:12px 24px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .2s}
.lp-missing-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,.4)}
@media(max-width:768px){.lp-budget-results{grid-template-columns:repeat(2,1fr)}.lp-missing-stats{grid-template-columns:1fr}.lp-missing-stat{border-right:none;border-bottom:1px solid rgba(255,255,255,.06)}.lp-missing-stat:last-child{border-bottom:none}}
.speedo-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.speedo-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.speedo-card:hover{background:rgba(255,255,255,.07);border-color:rgba(99,102,241,.3)}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
.stat-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px;text-align:center;transition:all .2s}
.stat-card:hover{background:rgba(255,255,255,.07);border-color:rgba(99,102,241,.3)}
.stat-icon{font-size:22px;margin-bottom:6px}
.stat-val{font-size:22px;font-weight:800}
.stat-lbl{font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;text-transform:uppercase;letter-spacing:.5px}
.status-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:24px}
.status-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;display:flex;align-items:center;gap:12px;transition:all .2s}
.status-card:hover{background:rgba(255,255,255,.06)}
.status-card-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.status-card-label{font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.status-card-val{font-size:15px;font-weight:700}
.status-card-trend{font-size:11px;color:rgba(255,255,255,.35);margin-left:auto;white-space:nowrap;flex-shrink:0}
.status-card-trend.up{color:#22c55e}
.competitor-panel{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px 20px;margin-bottom:24px}
.competitor-panel-header{display:flex;align-items:baseline;gap:10px;margin-bottom:14px}
.competitor-panel-title{font-size:14px;font-weight:700}
.competitor-panel-sub{font-size:12px;color:rgba(255,255,255,.35)}
.competitor-list{display:flex;flex-direction:column;gap:6px}
.competitor-item{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px 14px}
.competitor-rank{font-size:12px;font-weight:800;color:rgba(255,255,255,.3);min-width:24px}
.competitor-domain{flex:1;font-size:13px;font-weight:600;font-family:monospace}
.competitor-count{font-size:11px;color:rgba(255,255,255,.35);white-space:nowrap}
.competitor-strength{font-size:11px;font-weight:700;text-transform:capitalize;white-space:nowrap}
.ai-summary-card{background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08));border:1px solid rgba(99,102,241,.25);border-radius:14px;padding:16px 20px;font-size:14px;color:rgba(255,255,255,.8);margin-bottom:24px;line-height:1.6;display:flex;align-items:flex-start;gap:10px}
.ai-summary-free{background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(239,68,68,.06));border-color:rgba(245,158,11,.25)}
.ai-summary-icon{font-size:22px;flex-shrink:0}
.celebrate-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#22c55e22,#16a34a11);border:1px solid rgba(34,197,94,.3);color:#86efac;font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px;margin-bottom:12px}
.free-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#fbbf24;font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px;margin-bottom:12px}
.auto-campaign-card{background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.1));border:1px solid rgba(99,102,241,.3);border-radius:16px;padding:20px 24px;display:flex;align-items:center;gap:20px;margin-bottom:28px;flex-wrap:wrap}
.auto-campaign-left{display:flex;align-items:center;gap:16px;flex:1}
.auto-campaign-icon{font-size:36px;flex-shrink:0;animation:autoPulse 2s ease infinite}
@keyframes autoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1);filter:drop-shadow(0 0 16px rgba(99,102,241,.6))}}
.auto-campaign-title{font-size:17px;font-weight:800;margin-bottom:4px}
.auto-campaign-desc{font-size:13px;color:rgba(255,255,255,.55);line-height:1.4}
.btn-auto-launch{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:14px 28px;border-radius:12px;font-family:inherit;cursor:pointer;transition:all .25s;flex-shrink:0;text-align:center;min-width:180px}
.btn-auto-launch:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(99,102,241,.5)}
.btn-auto-launch span{display:block;font-size:14px;font-weight:700}
.upgrade-publish-card{background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(239,68,68,.06));border:1px solid rgba(245,158,11,.25);border-radius:16px;padding:20px 24px;display:flex;align-items:center;gap:20px;margin-bottom:28px;flex-wrap:wrap}
.upc-left{display:flex;align-items:center;gap:14px;flex:1}
.upc-title{font-size:16px;font-weight:800;margin-bottom:4px}
.upc-desc{font-size:13px;color:rgba(255,255,255,.55);line-height:1.4}

/* PRODUCTS GRID */
.p-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;contain:layout}
.p-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;position:relative;will-change:transform;backface-visibility:hidden}
.p-card:hover{transform:translate3d(0,-3px,0);border-color:rgba(99,102,241,.4);box-shadow:0 8px 30px rgba(99,102,241,.12)}
.p-card-recommended{border-color:rgba(245,158,11,.35);box-shadow:0 0 20px rgba(245,158,11,.1)}
.p-card-rec-badge{position:absolute;top:0;left:0;right:0;background:linear-gradient(90deg,rgba(245,158,11,.9),rgba(251,191,36,.8));color:#000;font-size:11px;font-weight:700;padding:5px 12px;z-index:2;text-align:center}
.p-card-pending{opacity:.75}
.p-card-locked{opacity:.7;cursor:default}
.p-card-locked-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.5)}
.p-card-img-wrap{position:relative;height:180px;background:#111;overflow:hidden}
.p-card-img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.p-card:hover .p-card-img{transform:scale(1.05)}
.p-card-noimg{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background:rgba(255,255,255,.03)}
.p-card-score{position:absolute;top:10px;right:10px}
.p-card-pending-badge{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.6);padding:4px 10px;border-radius:6px;font-size:11px;color:rgba(255,255,255,.7)}
.p-card-oos{position:absolute;bottom:10px;left:10px;background:rgba(239,68,68,.85);padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700}
.p-card-body{padding:16px}
.p-card-title{font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-card-price{font-size:13px;color:#a5b4fc;font-weight:600;margin-bottom:10px}
.p-card-metrics{display:flex;gap:8px;margin-bottom:10px}
.p-metric{display:flex;align-items:center;gap:3px;background:rgba(255,255,255,.05);padding:4px 8px;border-radius:6px;font-size:11px}
.p-metric-ic{font-size:10px}
.p-metric-val{color:#fff;font-weight:700}
.p-metric-lbl{color:rgba(255,255,255,.4)}
.p-card-hl{font-size:12px;color:rgba(255,255,255,.5);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p-card-blur{filter:blur(4px);user-select:none}
.p-card-cta{font-size:12px;font-weight:600;color:#a5b4fc}
.p-card:hover .p-card-cta{color:#c4b5fd}
.free-upgrade-cta{display:flex;align-items:center;gap:18px;margin-top:24px;padding:20px 28px;background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(239,68,68,.06));border:2px dashed rgba(245,158,11,.3);border-radius:16px;cursor:pointer;transition:all .3s}
.free-upgrade-cta:hover{border-color:rgba(245,158,11,.5)}
.free-upgrade-icon{font-size:32px;flex-shrink:0}
.free-upgrade-title{font-size:16px;font-weight:700;margin-bottom:4px}
.free-upgrade-desc{font-size:13px;color:rgba(255,255,255,.5);line-height:1.4}
.free-upgrade-arrow{font-size:24px;color:#f59e0b;font-weight:700;margin-left:auto;flex-shrink:0}
.free-campaign-lock{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:24px;text-align:center}
.picker-card{background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.1);border-radius:12px;padding:12px;cursor:pointer;transition:all .2s;position:relative}
.picker-card:hover{border-color:rgba(99,102,241,.4);background:rgba(99,102,241,.06)}
.picker-selected{border-color:#6366f1;background:rgba(99,102,241,.1)}
.picker-rec{font-size:10px;font-weight:700;color:#fbbf24;margin-bottom:6px}
.btn-saved{background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.12);padding:8px 18px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-saved:hover{background:rgba(255,255,255,.1);color:#fff}
.btn-rescan{background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25);padding:8px 18px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}
.btn-rescan:hover{background:rgba(99,102,241,.25)}
.btn-back-home{background:none;border:none;color:rgba(255,255,255,.5);font-family:inherit;font-size:13px;cursor:pointer;padding:0;margin-bottom:8px;transition:color .2s}
.btn-back-home:hover{color:#fff}

/* MODALS */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);backdrop-filter:blur(20px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#1a1a2e;border:1px solid rgba(255,255,255,.1);border-radius:20px;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;padding:28px;position:relative}
.modal-wide{max-width:720px}
.modal-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,.1);border:none;color:#fff;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;transition:background .2s;z-index:10}
.modal-close:hover{background:rgba(255,255,255,.2)}
.modal-header{display:flex;gap:16px;align-items:center;margin-bottom:16px}
.modal-img{width:72px;height:72px;border-radius:12px;object-fit:cover}
.modal-title{font-size:20px;font-weight:700}
.modal-price{font-size:15px;color:#a5b4fc;font-weight:600;margin-top:4px}
.modal-body{display:flex;flex-direction:column;gap:18px}
.rsa-score-box{display:flex;flex-direction:column;align-items:center;gap:2px}
.rsa-score-lbl{font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase}
.rsa-strength{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.rsa-strength-bar{flex:1;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
.rsa-strength-fill{height:100%;border-radius:3px;transition:width .5s}
.rsa-strength-txt{font-size:13px;font-weight:800}
.rsa-strength-info{font-size:11px;color:rgba(255,255,255,.35)}
.rsa-preview{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;margin-bottom:14px}
.rsa-preview-label{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:10px;font-weight:600}
.rsa-preview-ad{background:#fff;border-radius:10px;padding:16px;color:#202124;font-family:Arial,sans-serif}
.rsa-preview-sponsor{font-size:11px;font-weight:700;margin-bottom:2px}
.rsa-preview-url{font-size:12px;margin-bottom:4px}
.rsa-preview-h{font-size:18px;color:#1a0dab;font-weight:400;line-height:1.3;margin-bottom:4px}
.rsa-preview-d{font-size:13px;color:#4d5156;line-height:1.4}
.rsa-section{margin-bottom:16px}
.rsa-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.rsa-section h3{font-size:14px;font-weight:700;color:rgba(255,255,255,.85);margin-bottom:10px}
.rsa-hint{font-size:11px;color:rgba(255,255,255,.35)}
.rsa-items{display:flex;flex-direction:column;gap:6px}
.rsa-item{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:8px 12px}
.rsa-item-desc{min-height:44px}
.rsa-item-num{font-size:11px;font-weight:800;color:rgba(99,102,241,.7);min-width:18px}
.rsa-item-input{flex:1;font-size:13px;color:rgba(255,255,255,.9);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:6px 10px;font-family:inherit;outline:none;transition:border-color .2s}
.rsa-item-input:focus{border-color:#6366f1;background:rgba(99,102,241,.08)}
.rsa-item-textarea{resize:none;min-height:44px}
.rsa-item-len{font-size:10px;color:rgba(255,255,255,.3);white-space:nowrap}
.rsa-over{color:#ef4444!important;font-weight:700}
.rsa-pin{font-size:10px;background:rgba(99,102,241,.15);color:#a5b4fc;padding:2px 6px;border-radius:4px;white-space:nowrap}
.btn-ai-improve{background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);color:#fbbf24;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.btn-ai-improve:hover{background:rgba(251,191,36,.2);transform:scale(1.1)}
.btn-ai-improve:disabled{opacity:.4;cursor:not-allowed;transform:none}
.btn-ai-improve.improving{animation:aiSpin 1s linear infinite}
@keyframes aiSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
.credits-bar{display:flex;align-items:center;justify-content:space-between;background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.15);border-radius:10px;padding:8px 14px;margin-bottom:14px}
.credits-count{font-size:13px;color:#fbbf24;font-weight:600}
.btn-buy-credits{background:rgba(251,191,36,.15);color:#fbbf24;border:1px solid rgba(251,191,36,.3);padding:4px 12px;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}
.credits-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.92);backdrop-filter:blur(20px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.credits-modal{background:#1a1a2e;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px;text-align:center;max-width:440px;width:100%;position:relative}
.credits-packages{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.credit-pkg{background:rgba(255,255,255,.04);border:2px solid rgba(255,255,255,.1);border-radius:14px;padding:20px 12px;cursor:pointer;transition:all .2s;position:relative}
.credit-pkg:hover{border-color:rgba(99,102,241,.5);transform:translateY(-2px)}
.credit-pkg-popular{border-color:#6366f1;background:rgba(99,102,241,.08)}
.credit-pkg-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap}
.credit-pkg-amount{font-size:28px;font-weight:800;color:#fff}
.credit-pkg-label{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:8px}
.credit-pkg-price{font-size:16px;font-weight:700;color:#a5b4fc}
.rsa-kw-grid{display:flex;flex-wrap:wrap;gap:6px}
.rsa-kw{padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
.kw-broad{background:rgba(99,102,241,.1);color:#a5b4fc;border:1px solid rgba(99,102,241,.2)}
.kw-phrase{background:rgba(245,158,11,.1);color:#fbbf24;border:1px solid rgba(245,158,11,.2)}
.kw-exact{background:rgba(34,197,94,.1);color:#86efac;border:1px solid rgba(34,197,94,.2)}
.kw-neg{background:rgba(239,68,68,.08);color:#fca5a5;border:1px solid rgba(239,68,68,.15)}
.kw-gap{background:rgba(34,197,94,.12)!important;border-color:rgba(34,197,94,.3)!important;color:#4ade80!important}
.rsa-kw-type{font-size:9px;opacity:.5;text-transform:uppercase}
.rsa-neg-kw{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
.rsa-neg-kw strong{font-size:12px;color:rgba(255,255,255,.5)}
.rsa-sitelinks{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rsa-sitelink{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.rsa-sitelink strong{font-size:13px;color:#a5b4fc}
.rsa-sitelink span{font-size:11px;color:rgba(255,255,255,.4)}
.ci-section{background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.15);border-radius:14px;padding:18px}
.ci-section h3{margin-bottom:14px}
.ci-ranking{display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.2);border-radius:10px;padding:12px 14px;margin-bottom:12px}
.ci-ranking-icon{font-size:22px}
.ci-ranking-info{flex:1;display:flex;flex-direction:column;gap:2px}
.ci-ranking-info strong{font-size:13px;color:#fff}
.ci-ranking-info span{font-size:12px;color:rgba(255,255,255,.5)}
.ci-strategy-badge{font-size:10px;font-weight:800;padding:4px 10px;border-radius:20px;letter-spacing:.5px}
.ci-strat-aggressive{background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3)}
.ci-strat-defensive{background:rgba(245,158,11,.15);color:#fbbf24;border:1px solid rgba(245,158,11,.3)}
.ci-strat-dominant{background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.3)}
.ci-reason{font-size:12px;color:rgba(255,255,255,.5);margin:8px 0 14px;line-height:1.5}
.ci-competitors{margin-bottom:14px}
.ci-competitors strong{font-size:13px;display:block;margin-bottom:8px}
.ci-comp-list{display:flex;flex-direction:column;gap:6px}
.ci-comp-card{display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.15);border-radius:8px;padding:8px 12px}
.ci-comp-rank{font-size:12px;font-weight:800;color:rgba(255,255,255,.4);min-width:24px}
.ci-comp-info{flex:1;display:flex;flex-direction:column;gap:1px}
.ci-comp-domain{font-size:13px;font-weight:600}
.ci-comp-link{color:#a5b4fc;text-decoration:none;transition:color .2s}
.ci-comp-link:hover{color:#fff;text-decoration:underline}
.competitor-domain-link{color:#a5b4fc;text-decoration:none;font-family:monospace;transition:color .2s}
.competitor-domain-link:hover{color:#fff;text-decoration:underline}
.ci-comp-strength{font-size:11px;color:rgba(255,255,255,.4);text-transform:capitalize}
.ci-comp-price{font-size:11px;color:rgba(255,255,255,.4)}
.ci-gaps,.ci-advantages,.ci-threats{margin-bottom:12px}
.ci-gaps strong,.ci-advantages strong,.ci-threats strong{font-size:13px;display:block;margin-bottom:6px}
.ci-adv-list,.ci-threat-list{margin:4px 0 0 16px;font-size:12px;color:rgba(255,255,255,.6);line-height:1.8}
.ci-opp{display:flex;align-items:center;gap:10px}
.ci-opp strong{font-size:13px;white-space:nowrap}
.ci-opp-bar{flex:1;height:8px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden}
.ci-opp-fill{height:100%;background:linear-gradient(90deg,#6366f1,#06b6d4);border-radius:4px;transition:width .5s ease}
.ci-opp-val{font-size:13px;font-weight:700;color:#a5b4fc}
.btn-campaign{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s}
.btn-campaign:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,.4)}
.btn-campaign:disabled{opacity:.6;cursor:not-allowed;transform:none}
.campaign-msg{font-size:13px;padding:10px 14px;border-radius:8px;margin-top:8px}
.campaign-msg.success{background:rgba(34,197,94,.1);color:#86efac;border:1px solid rgba(34,197,94,.2)}
.campaign-msg.error{background:rgba(239,68,68,.1);color:#fca5a5;border:1px solid rgba(239,68,68,.2)}
.onboard-modal{max-width:820px}
.onboard-tabs{display:flex;gap:4px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:4px;margin-bottom:24px}
.onboard-tab{flex:1;padding:10px;border:none;border-radius:9px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:transparent;color:rgba(255,255,255,.4)}
.onboard-tab.active{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 2px 12px rgba(99,102,241,.3)}
.onboard-tab:hover:not(.active){background:rgba(255,255,255,.06);color:rgba(255,255,255,.7)}
.onboard-content{text-align:center}
.onboard-progress{display:flex;align-items:center;justify-content:center;margin-bottom:20px}
.onboard-step-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;background:rgba(255,255,255,.08);color:rgba(255,255,255,.3);transition:all .3s}
.onboard-step-dot.active{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
.onboard-line{width:60px;height:2px;background:rgba(255,255,255,.1);transition:background .3s}
.onboard-line.active{background:linear-gradient(90deg,#6366f1,#8b5cf6)}
.onboard-title{font-size:22px;font-weight:800;margin-bottom:6px}
.onboard-sub{font-size:14px;color:rgba(255,255,255,.5);margin-bottom:24px}
.scan-credit-packages{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.scan-credit-pkg{background:rgba(255,255,255,.04);border:2px solid rgba(255,255,255,.1);border-radius:16px;padding:22px 14px;cursor:pointer;transition:all .2s;text-align:center;position:relative}
.scan-credit-pkg:hover{border-color:rgba(6,182,212,.5);transform:translateY(-2px);background:rgba(6,182,212,.06)}
.scp-popular{border-color:#06b6d4;background:rgba(6,182,212,.08)}
.scp-badge{position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#06b6d4,#6366f1);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap}
.scp-amount{font-size:32px;font-weight:800}
.scp-label{font-size:11px;color:rgba(255,255,255,.4);margin-bottom:8px}
.scp-price{font-size:18px;font-weight:700;color:#22d3ee}
.scp-per{font-size:10px;color:rgba(255,255,255,.3);margin-top:4px}
.onboard-credits-info{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;margin-bottom:14px;text-align:left}
.oci-row{font-size:13px;color:rgba(255,255,255,.6);padding:4px 0}
.onboard-credits-tip{font-size:12px;color:rgba(255,255,255,.4);padding:10px 14px;background:rgba(99,102,241,.06);border-radius:10px;text-align:center}
.onboard-credits-tip span{color:#a5b4fc;cursor:pointer;font-weight:600}
.plan-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px}
.plan-cards-3{grid-template-columns:repeat(3,1fr)}
.plan-card{background:rgba(255,255,255,.04);border:2px solid rgba(255,255,255,.1);border-radius:16px;padding:24px 18px;cursor:pointer;transition:all .2s;text-align:left;position:relative}
.plan-card:hover{border-color:rgba(99,102,241,.4)}
.plan-selected{border-color:#6366f1;background:rgba(99,102,241,.08)}
.plan-badge{position:absolute;top:-10px;right:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px}
.plan-badge-gold{background:linear-gradient(135deg,#f59e0b,#d97706)}
.plan-name{font-size:18px;font-weight:700;margin-bottom:4px}
.plan-price{font-size:32px;font-weight:800;margin-bottom:14px}
.plan-price span{font-size:14px;font-weight:500;color:rgba(255,255,255,.4)}
.plan-features{list-style:none;padding:0}
.plan-features li{font-size:13px;color:rgba(255,255,255,.6);padding:4px 0}
.btn-onboard{width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s}
.btn-onboard:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,.4)}
.btn-onboard:disabled{opacity:.4;cursor:not-allowed;transform:none}
.google-connect-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px;display:flex;flex-direction:column;align-items:center;gap:16px;margin-bottom:20px}
.google-logo{width:64px;height:64px;background:#fff;border-radius:16px;display:flex;align-items:center;justify-content:center}
.btn-google{background:#fff;color:#333;font-family:inherit;font-size:14px;font-weight:600;padding:12px 28px;border:none;border-radius:10px;cursor:pointer;transition:all .2s}
.btn-google:hover{box-shadow:0 4px 16px rgba(0,0,0,.15)}
.google-connected{color:#22c55e;font-weight:700;font-size:16px;display:flex;align-items:center;gap:8px}
.google-check{background:#22c55e;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px}
.google-trust{display:flex;gap:16px;font-size:12px;color:rgba(255,255,255,.4)}

/* LOADING */
.ld-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 60px);padding:32px 20px;position:relative;z-index:1;gap:6px}
.ld-pct-ring{position:relative;width:110px;height:110px;margin-bottom:14px}
.ld-pct-text{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800}
.ld-title{font-size:22px;font-weight:700;margin-bottom:4px;text-align:center}
.ld-sub{font-size:14px;color:rgba(255,255,255,.55);margin-bottom:16px;text-align:center;max-width:380px;line-height:1.5}
.ld-bar-bg{width:300px;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;margin-bottom:18px}
.ld-bar-fill{height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);border-radius:3px}
@keyframes barPulse{0%,100%{opacity:.6}50%{opacity:1}}
.ld-steps{display:flex;flex-direction:column;gap:6px;margin:8px 0;min-width:260px}
.ld-step{font-size:13px;color:rgba(255,255,255,.3);display:flex;align-items:center;gap:8px;transition:all .3s}
.ld-step-done{color:rgba(99,102,241,.7)}
.ld-step-active{color:#fff;font-weight:600}
.ld-dot{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
.ld-step-done .ld-dot{background:rgba(99,102,241,.5);color:#fff}
.ld-step-active .ld-dot{background:#6366f1;animation:ldPulse 1s ease infinite}
@keyframes ldPulse{0%,100%{opacity:.5}50%{opacity:1}}
.free-scan-note{font-size:13px;color:rgba(245,158,11,.7);background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:10px 18px;margin-top:8px}
.cancel-confirm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.cancel-confirm-box{background:#1a1a2e;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px;text-align:center;max-width:380px;width:100%}
.btn-back{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.1);padding:8px 20px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;transition:all .2s}
.btn-back:hover{background:rgba(255,255,255,.1);color:#fff}
.tip-box{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:12px;padding:12px 18px;font-size:13px;color:rgba(255,255,255,.65);max-width:360px;text-align:center;line-height:1.5;margin-top:8px}

/* LANDING */
.la{position:relative;z-index:1;padding:0 24px 60px;max-width:1200px;margin:0 auto;width:100%;opacity:0;transform:translateY(20px);transition:all .6s ease}
.la-v{opacity:1;transform:translateY(0)}
.hero{text-align:center;padding:56px 0 40px}
.hero-badge{display:inline-block;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#a5b4fc;font-size:12px;font-weight:600;padding:6px 16px;border-radius:100px;margin-bottom:20px}
.hero-h{font-size:44px;font-weight:800;line-height:1.1;margin-bottom:16px}
.hero-grad{background:linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-size:200% auto;animation:heroGrad 3s linear infinite}
@keyframes heroGrad{0%{background-position:0% center}100%{background-position:200% center}}
.hero-p{font-size:17px;color:rgba(255,255,255,.55);max-width:520px;margin:0 auto 28px;line-height:1.6}
.hero-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
.btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;transition:all .25s;box-shadow:0 4px 20px rgba(99,102,241,.3)}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(99,102,241,.45)}
.btn-primary:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-lg{padding:16px 40px;font-size:16px}
.btn-secondary{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.12);padding:14px 32px;border-radius:12px;font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s}
.btn-secondary:hover{background:rgba(255,255,255,.1);color:#fff}
.btn-secondary:disabled{opacity:.5;cursor:not-allowed}
.hero-metrics{display:flex;justify-content:center;gap:32px;flex-wrap:wrap;margin-top:20px}
.hm{text-align:center}
.hm-val{display:block;font-size:22px;font-weight:800}
.hm-lbl{font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px}
.hero-nudge{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 18px;background:rgba(255,255,255,.04);border:1px dashed rgba(139,92,246,.35);border-radius:100px;font-size:12px;color:rgba(255,255,255,.5);cursor:pointer;transition:all .3s}
.hero-nudge:hover{background:rgba(139,92,246,.1);border-color:rgba(139,92,246,.6);color:rgba(255,255,255,.8)}
.hero-nudge strong{color:#c4b5fd;font-weight:700}
.nudge-lock{font-size:11px}
.nudge-arrow{color:#8b5cf6;font-weight:700}
.section{padding:48px 0}
.sec-h{font-size:28px;font-weight:800;text-align:center;margin-bottom:32px}
.pain-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.pain-card{background:rgba(255,255,255,.03);border:1px solid rgba(239,68,68,.15);border-radius:14px;padding:22px;transition:all .3s}
.pain-ic{font-size:24px;display:block;margin-bottom:10px}
.pain-t{font-size:15px;font-weight:700;margin-bottom:6px}
.pain-d{font-size:13px;color:rgba(255,255,255,.5);line-height:1.5}
.sol-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.sol-card{background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.15);border-radius:14px;padding:28px 18px;text-align:center}
.sol-n{font-size:36px;font-weight:800;background:linear-gradient(135deg,#6366f1,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sol-s{font-size:12px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.sol-d{font-size:13px;color:rgba(255,255,255,.55)}
.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.step-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:28px 20px;text-align:center}
.step-n{width:40px;height:40px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;margin:0 auto 14px}
.step-t{font-size:16px;font-weight:700;margin-bottom:6px}
.step-d{font-size:13px;color:rgba(255,255,255,.5)}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.feat-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:22px;transition:all .3s}
.feat-card:hover{border-color:rgba(99,102,241,.3);background:rgba(255,255,255,.05)}
.feat-ic{font-size:24px;display:block;margin-bottom:10px}
.feat-t{font-size:14px;font-weight:700;margin-bottom:4px}
.feat-d{font-size:13px;color:rgba(255,255,255,.5)}
.test-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.test-card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:22px}
.test-q{font-size:13px;color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:14px;font-style:italic}
.test-author{display:flex;flex-direction:column;gap:2px}
.test-author strong{font-size:13px}
.test-author span{font-size:11px;color:rgba(255,255,255,.4)}
.cta-section{text-align:center;padding:56px 0}
.cta-h{font-size:32px;font-weight:800;margin-bottom:12px}
.cta-p{font-size:15px;color:rgba(255,255,255,.5);margin-bottom:24px}
.ticker-wrap{display:flex;align-items:center;gap:10px;margin-top:24px;padding:10px 20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:100px;font-size:13px;max-width:600px;margin-left:auto;margin-right:auto}
.ticker-emoji{font-size:16px;flex-shrink:0}
.ticker-text{color:rgba(255,255,255,.7)}
.ticker-text strong{color:#fff;font-weight:700}
.ticker-time{color:rgba(255,255,255,.3);font-size:11px;margin-left:auto;white-space:nowrap}
.launch-choice-btn{display:flex;align-items:center;gap:16px;width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px 24px;cursor:pointer;transition:all .25s;text-align:left;color:#fff;font-family:inherit}
.launch-choice-btn:hover{border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.08);transform:translateY(-2px)}
.launch-auto{border-color:rgba(99,102,241,.25);background:rgba(99,102,241,.06)}
.launch-choice-icon{font-size:32px;flex-shrink:0}
.launch-choice-title{font-size:17px;font-weight:700;margin-bottom:4px}
.launch-choice-desc{font-size:13px;color:rgba(255,255,255,.5);line-height:1.4}

@keyframes confettiFall{0%{opacity:1;transform:translateY(0) rotate(0deg)}15%{opacity:1}100%{opacity:0;transform:translateY(100vh) rotate(720deg)}}

/* RESPONSIVE */
@media(max-width:1024px){.health-pulse-row{grid-template-columns:1fr}.speedo-row{grid-template-columns:repeat(2,1fr)}.status-row{grid-template-columns:repeat(3,1fr)}.status-bar-inner{height:auto;padding:8px 16px;flex-wrap:wrap;gap:6px}}
@media(max-width:768px){.stats-row,.speedo-row{grid-template-columns:repeat(2,1fr)}.status-row{grid-template-columns:1fr 1fr}.pain-grid,.sol-grid,.steps-grid,.feat-grid,.test-grid{grid-template-columns:1fr}.hero-h{font-size:30px}.plan-cards,.plan-cards-3{grid-template-columns:1fr}.da{padding:20px 16px}.auto-campaign-card,.upgrade-publish-card{flex-direction:column;text-align:center}.scan-credit-packages{grid-template-columns:1fr}.pulse-metrics-row{grid-template-columns:repeat(2,1fr)}.health-top{flex-direction:column;text-align:center}}

/* ═══ RESPONSIVE FIXES (added) ═══ */
@media(max-width:480px){
  .gap-table-head,.gap-row{grid-template-columns:2fr 1fr 1fr}
  .gap-diff,.gap-freq,.gap-action{display:none}
  .comp-metrics-row{grid-template-columns:repeat(2,1fr)}
  .hero-h{font-size:24px}
  .hero-p{font-size:14px}
  .da-header{flex-direction:column;gap:12px}
  .tmo-content{flex-direction:column}
  .adp-search-result{padding:12px}
}
/* Fix .da needs position:relative so bg-m stays behind it */
.da{position:relative;z-index:1}
/* RESPONSIVE FIX: narrow mobile */
@media(max-width:480px){
  .gap-table-head,.gap-row{grid-template-columns:2fr 1fr 1fr}
  .gap-diff,.gap-freq,.gap-action{display:none}
  .comp-metrics-row{grid-template-columns:repeat(2,1fr)}
  .hero-h{font-size:24px}
  .hero-p{font-size:14px}
  .da-header{flex-direction:column;gap:12px}
  .tmo-content{flex-direction:column}
}
/* FIX: .da needs position:relative for gradient bg */
.da{position:relative;z-index:1}




/* ─── Campaign Counter Hero Card ─── */
.campaign-hero-card{position:relative;border-radius:16px;padding:28px 32px;margin-bottom:24px;overflow:hidden;border:1px solid rgba(99,102,241,.25)}
.campaign-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,rgba(99,102,241,.18) 0%,rgba(168,85,247,.12) 50%,rgba(34,197,94,.08) 100%);z-index:0}
.campaign-hero-bg::after{content:'';position:absolute;top:-50%;right:-20%;width:300px;height:300px;background:radial-gradient(circle,rgba(99,102,241,.15),transparent 70%);border-radius:50%}
.campaign-hero-content{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:24px}
.campaign-hero-left{display:flex;flex-direction:column;gap:4px}
.campaign-hero-number{font-size:56px;font-weight:900;line-height:1;background:linear-gradient(135deg,#a5b4fc,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.campaign-hero-label{font-size:16px;font-weight:700;color:rgba(255,255,255,.9);letter-spacing:.5px}
.campaign-hero-sub{font-size:13px;color:rgba(255,255,255,.45);margin-top:2px}
.campaign-hero-right{display:flex;flex-direction:column;align-items:flex-end;gap:12px}
.campaign-hero-dots{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.campaign-dot{width:14px;height:14px;border-radius:50%;transition:all .3s}
.dot-active{background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.5);animation:dot-pulse 2s ease-in-out infinite}
.dot-paused{background:#f59e0b;box-shadow:0 0 6px rgba(245,158,11,.3)}
.dot-other{background:rgba(255,255,255,.15)}
.dot-empty{background:rgba(255,255,255,.08);border:2px dashed rgba(255,255,255,.15)}
@keyframes dot-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.15)}}
.campaign-hero-link{color:#a5b4fc;font-size:13px;font-weight:600;text-decoration:none;padding:6px 14px;border:1px solid rgba(99,102,241,.3);border-radius:8px;transition:all .2s}
.campaign-hero-link:hover{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.5)}

`;

export { CSS };
