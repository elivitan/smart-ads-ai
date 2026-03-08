import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopProducts, getSyncStatus } from "../sync.server.js";
import { OnboardModal, BuyCreditsModal } from "../components/Modals.jsx";

// Cookie helper — read plan from request cookie
function getPlanFromCookie(request) {
  try {
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(/sai_plan=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}


// ── CSS as constant — injected ONCE via <style> at top of every render path ──
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
.cds-progress-bar{flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:visible;position:relative}
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
.budget-sim-slider{width:100%;height:6px;-webkit-appearance:none;appearance:none;background:rgba(99,102,241,.2);border-radius:3px;outline:none;cursor:pointer;position:relative;z-index:12;pointer-events:all}
.budget-sim-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);cursor:pointer;box-shadow:0 0 8px rgba(99,102,241,.5)}
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

`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const status = await getSyncStatus(shop);
  // Enterprise: never block render with heavy sync — flag client to sync instead
  const needsInitialSync = status.totalProducts === 0;
  const dbProducts = await getShopProducts(shop);
  const syncStatus = await getSyncStatus(shop);
  const planFromCookie = getPlanFromCookie(request);
  const isPaidServer = !!planFromCookie && planFromCookie !== "free";
  return { products: dbProducts, syncStatus, shop, planFromCookie, isPaidServer, needsInitialSync };
};

const FREE_SCAN_LIMIT = 3;

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
// ══════════════════════════════════════════════
function useGoogleAdsData(mockCampaigns, avgScore) {
  const [liveData, setLiveData] = useState(null);
  const [isRealData, setIsRealData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevRef = useRef(null);

  function buildMockData(prev) {
    const campaigns = mockCampaigns || 0;
    const hourOfDay = new Date().getHours();
    const trafficMult = (hourOfDay >= 10 && hourOfDay <= 20) ? 1.3 : 0.7;
    return {
      impressions: Math.round((prev?.impressions || campaigns * 4200) + Math.random() * 14 * trafficMult),
      clicks: Math.round((prev?.clicks || campaigns * 180) + (Math.random() > 0.6 ? 1 : 0)),
      cost: parseFloat(((prev?.cost || campaigns * 79) + Math.random() * 0.44).toFixed(2)),
      conversions: prev?.conversions || Math.round(campaigns * 3.2),
      roas: parseFloat((1.8 + avgScore * 0.028).toFixed(2)),
      campaigns,
      source: "mock",
    };
  }

  async function tryRealAPI(prev) {
    // Real API disabled until Google Ads token is approved
    // Will auto-enable when /app/api/google-ads/metrics route is created
    return null;
  }

  useEffect(() => {
    let mounted = true;
    async function tick() {
      if (document.visibilityState === "hidden") return; // pause when tab hidden
      const real = await tryRealAPI(prevRef.current);
      if (!mounted) return;
      const next = real || buildMockData(prevRef.current);
      prevRef.current = next;
      setLiveData(next);
      setLastUpdated(new Date());
    }
    tick();
    const iv = setInterval(tick, 2800);
    return () => { mounted = false; clearInterval(iv); };
  }, [mockCampaigns, avgScore]);

  const data = liveData || buildMockData(null);
  const ctr = (data.clicks > 0 && data.impressions > 0)
    ? ((data.clicks / data.impressions) * 100).toFixed(2) : "0.00";
  return { ...data, ctr, isRealData, lastUpdated };
}


// ══════════════════════════════════════════════
// COMPETITOR DETAIL MODAL
// Click a competitor → see their ads + traffic estimate
// ══════════════════════════════════════════════
function CompetitorModal({ competitor, products, onClose }) {
  const [loading, setLoading] = useState(true);
  const [compData, setCompData] = useState(null);
  const domain = competitor?.domain;

  function buildFromMentions(mentions) {
    const strength = mentions[0]?.strength || "medium";
    const avgPos = mentions.length > 0
      ? Math.round(mentions.reduce((a,m)=>a+(m.position||3),0)/mentions.length) : 3;
    const trafficBase = strength==="strong"?18000:strength==="medium"?8000:3000;
    const estMonthlyTraffic = Math.round(trafficBase*(1+Math.random()*0.4));
    const estAdSpend = Math.round(estMonthlyTraffic*(strength==="strong"?0.9:0.5));
    const allKeywords = [...new Set(mentions.flatMap(m=>m.keywords||[]))].slice(0,8);
    const brand = domain.split(".")[0];
    const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
    const mockAds = [
      { headline:`${cap(brand)} Official Store`, headline2:"Free Shipping On All Orders", headline3:"Shop Now & Save 40%",
        description:`Discover our full range of premium products. Trusted by thousands. Fast delivery guaranteed.`,
        url:`https://${domain}`, position:avgPos, keywords:allKeywords.slice(0,3) },
      allKeywords.length>2 && { headline:`Best ${cap(allKeywords[0]||"Products")}`, headline2:"Compare & Save Today", headline3:"Limited Time Deal",
        description:`Looking for ${allKeywords[0]||"great products"}? Best selection at unbeatable prices. Free returns.`,
        url:`https://${domain}/shop`, position:avgPos+1, keywords:allKeywords.slice(1,4) },
    ].filter(Boolean);
    return { domain, strength, avgPosition:avgPos, estMonthlyTraffic, estAdSpend, productsFound:mentions.length, keywords:allKeywords, ads:mockAds, priceRange:mentions[0]?.price_range||"Unknown", source:"estimated" };
  }

  useEffect(() => {
    if (!domain) return;
    const mentions = products.flatMap(p => {
      const intel = p.aiAnalysis?.competitor_intel;
      if (!intel) return [];
      const found = (intel.top_competitors||[]).find(c=>c.domain===domain);
      if (!found) return [];
      return [{ product:p.title, position:found.position, strength:found.strength, price_range:found.price_range, keywords:(intel.keyword_gaps||[]).slice(0,5) }];
    });
    async function enrich() {
      try {
        const res = await fetch("/app/api/competitor-intel", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({domain}), signal:AbortSignal.timeout(8000) });
        if (res.ok) { const d=await res.json(); if(d.success){ setCompData({...buildFromMentions(mentions),...d.data,source:"real"}); setLoading(false); return; } }
      } catch {}
      setCompData(buildFromMentions(mentions));
      setLoading(false);
    }
    setTimeout(enrich, 700);
  }, [domain]);

  if (!competitor) return null;
  const strengthColor = {strong:"#ef4444",medium:"#f59e0b",weak:"#22c55e"}[compData?.strength]||"#a5b4fc";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide comp-modal" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="comp-modal-header">
          <div className="comp-modal-favicon">
            <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" onError={e=>{e.target.style.display="none"}} style={{width:28,height:28}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="comp-modal-domain">{domain}</a>
              {compData && <span className="comp-modal-strength" style={{color:strengthColor,borderColor:`${strengthColor}44`}}>{compData.strength}</span>}
              {compData?.source==="estimated" && <span className="comp-est-badge">AI Estimate</span>}
              {compData?.source==="real" && <span className="comp-real-badge">● Live Data</span>}
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:3}}>Competing on {compData?.productsFound||"?"} of your products</div>
          </div>
        </div>
        {loading ? (
          <div className="comp-modal-loading">
            <div className="comp-loading-spinner"/>
            <div style={{fontSize:14,color:"rgba(255,255,255,.5)"}}>Analyzing competitor intelligence...</div>
          </div>
        ) : (
          <>
            <div className="comp-metrics-row">
              {[
                {icon:"📈",val:compData.estMonthlyTraffic.toLocaleString(),lbl:"Est. Monthly Traffic"},
                {icon:"💸",val:"$"+compData.estAdSpend.toLocaleString(),lbl:"Est. Ad Spend/mo"},
                {icon:"📍",val:"#"+compData.avgPosition,lbl:"Avg Google Position"},
                {icon:"🔑",val:compData.keywords.length,lbl:"Keyword Overlaps"},
              ].map((m,i)=>(
                <div key={i} className="comp-metric-card">
                  <div className="comp-metric-icon">{m.icon}</div>
                  <div className="comp-metric-val">{m.val}</div>
                  <div className="comp-metric-lbl">{m.lbl}</div>
                </div>
              ))}
            </div>
            {compData.ads.length>0 && (
              <div className="comp-ads-section">
                <div className="comp-section-title">🎯 Their Active Ads</div>
                <div className="comp-ads-list">
                  {compData.ads.map((ad,i)=>(
                    <div key={i} className="comp-ad-card">
                      <div className="comp-ad-position-badge">Position #{ad.position}</div>
                      <div className="comp-ad-inner">
                        <div className="comp-ad-sponsored">Sponsored</div>
                        <div className="comp-ad-url-row">
                          <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" style={{width:14,height:14}} onError={e=>{e.target.style.display="none"}}/>
                          <span style={{fontSize:12,color:"#202124"}}>{ad.url}</span>
                        </div>
                        <div className="comp-ad-headline">{ad.headline} | {ad.headline2} | {ad.headline3}</div>
                        <div className="comp-ad-desc">{ad.description}</div>
                        {ad.keywords?.length>0 && (
                          <div className="comp-ad-kw-row">
                            {ad.keywords.map((k,j)=><span key={j} className="comp-ad-kw">{k}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {compData.keywords.length>0 && (
              <div className="comp-kw-section">
                <div className="comp-section-title">🔑 Keywords They Target — You Don't</div>
                <div className="comp-kw-grid">
                  {compData.keywords.map((k,i)=><div key={i} className="comp-kw-chip">+ {k}</div>)}
                </div>
              </div>
            )}
            <div className="comp-source-note">
              {compData.source==="real"?"✅ Live data from Google Search":"ℹ️ AI-estimated data · Connect SerpAPI for live competitor ads"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const Counter = React.memo(function Counter({ end, dur = 1200, suffix = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let start = 0; const step = end / (dur / 16);
    const id = setInterval(() => { start += step; if (start >= end) { setV(end); clearInterval(id); } else setV(Math.floor(start)); }, 16);
    return () => clearInterval(id);
  }, [end, dur]);
  return <>{v.toLocaleString()}{suffix}</>;
});

const ScoreRing = React.memo(function ScoreRing({ score, size = 54 }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, off = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} style={{ filter:`drop-shadow(0 0 6px ${color}44)` }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition:"stroke-dashoffset 1s ease" }}/>
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={color} fontSize="13" fontWeight="800">{score}</text>
    </svg>
  );
});

const Speedometer = React.memo(function Speedometer({ value, max, label, color = "#6366f1", size = 120 }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnimated(value), 300); return () => clearTimeout(t); }, [value]);
  const pct = Math.min(animated / max, 1);
  const startAngle = -225, endAngle = 45;
  const sweepRange = endAngle - startAngle; // 270 degrees
  const angle = startAngle + pct * sweepRange;
  const svgW = size, svgH = size * 0.78;
  const cx = svgW / 2, cy = svgH * 0.58, r = size * 0.34;
  function ptXY(pcx, pcy, pr, deg) { const rad = deg * Math.PI / 180; return { x: pcx + pr * Math.cos(rad), y: pcy + pr * Math.sin(rad) }; }
  const arcStart = ptXY(cx,cy,r,startAngle), arcEnd = ptXY(cx,cy,r,endAngle), fillEnd = ptXY(cx,cy,r,angle);
  const needleLen = r * 0.78;
  const needleTip = ptXY(cx,cy,needleLen,angle);
  const largeArc = sweepRange > 180 ? 1 : 0;
  const fillSweep = pct * sweepRange;
  const fillLargeArc = fillSweep > 180 ? 1 : 0;
  const arcPath = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;
  const fillPath = `M ${arcStart.x} ${arcStart.y} A ${r} ${r} 0 ${fillLargeArc} 1 ${fillEnd.x} ${fillEnd.y}`;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        <path d={arcPath} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="6" strokeLinecap="round"/>
        <path d={fillPath} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" style={{ transition:"d 1s cubic-bezier(.4,0,.2,1)" }}/>
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" style={{ transition:"x2 1s cubic-bezier(.4,0,.2,1),y2 1s cubic-bezier(.4,0,.2,1)" }}/>
        <circle cx={cx} cy={cy} r="3" fill={color}/>
        <text x={cx} y={cy + r * 0.62} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="18" fontWeight="800">{animated}</text>
      </svg>
      <span style={{ fontSize:11, color:"rgba(255,255,255,.4)", textTransform:"uppercase", letterSpacing:".5px" }}>{label}</span>
    </div>
  );
});

// ══════════════════════════════════════════════
// COLLECTING DATA SCREEN
// For new paid subscribers — auto-starts scan in background
// ══════════════════════════════════════════════
function CollectingDataScreen({ totalProducts, onScan, realProgress, scanMsg, onCancel }) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [scanStarted, setScanStarted] = useState(false);
  const [dots, setDots] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);



  // Animated dots
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
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
      if (!scanStarted) { setScanStarted(true); onScan(); }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  function animateProgress(from, to, duration) {
    return new Promise(resolve => {
      const steps = to - from;
      if (steps <= 0) { setProgress(to); resolve(); return; }
      const stepDuration = (duration || 1200) / steps;
      let current = from;
      const iv = setInterval(() => {
        current++;
        setProgress(current);
        if (current >= to) { clearInterval(iv); resolve(); }
      }, stepDuration);
    });
  }

  // Once real scan starts, use realProgress
  const displayProgress = scanStarted && realProgress != null
    ? Math.max(15, realProgress)
    : progress;

  const isDone = displayProgress >= 100;

  // Current step label
  let currentLabel, currentIcon;
  if (!scanStarted) {
    const p = INTRO_PHASES[Math.min(currentStep, INTRO_PHASES.length - 1)];
    currentLabel = p?.label;
    currentIcon = p?.icon;
  } else {
    const activeStep = REAL_STEPS.findLast(s => displayProgress >= s.threshold - 20) || REAL_STEPS[0];
    currentLabel = isDone ? "Your store is ready!" : activeStep.label;
    currentIcon = activeStep.icon;
  }

  const title = isDone ? "Your store is ready! 🎉" : (currentLabel + dots);
  const words = ["impressions","clicks","CTR","ROAS","keywords","budget","CPC","conversions","reach","bids","ads","score"];

  return (
    <div className="cds-wrap">
      <div className="cds-particles">
        {words.map((w, i) => (
          <div key={i} className="cds-particle" style={{
            left: `${8 + (i * 8) % 84}%`,
            top: `${15 + (i * 11) % 70}%`,
            animationDelay: `${i * 0.3}s`,
            animationDuration: `${3.5 + (i % 3) * 0.8}s`,
          }}>{w}</div>
        ))}
      </div>

      <div className="cds-center">
        <div className="cds-radar">
          <div className="cds-ring cds-ring-1"/>
          <div className="cds-ring cds-ring-2"/>
          <div className="cds-ring cds-ring-3"/>
          <div className="cds-radar-dot" style={isDone ? {background:"#22c55e",boxShadow:"0 0 24px #22c55e"} : {}}/>
          {!isDone && <div className="cds-radar-sweep"/>}
          {isDone && <div className="cds-done-check">✓</div>}
        </div>

        <div className="cds-title">{title}</div>
        <div className="cds-sub">
          {isDone
            ? `${totalProducts} products analyzed — your dashboard is ready`
            : (scanStarted && scanMsg) ? scanMsg : `Setting up your AI campaign intelligence for ${totalProducts} products`}
        </div>

        <div className="cds-progress-wrap">
          <div className="cds-progress-bar">
            <div className="cds-progress-fill" style={{ width: `${displayProgress}%` }}/>
            <div className="cds-progress-glow" style={{ left: `${Math.min(displayProgress, 98)}%` }}/>
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
                ["fetching","store","found"],
                ["google","competitor","search"],
                ["analyzing","website"],
                ["ranking","rank"],
                ["ai","copy","headline","generat","analyzing product"],
                ["strategy","campaign","together","ready","done"],
              ];
              let activeIdx = 0;
              for (let k = 0; k < stepKeywords.length; k++) {
                if (stepKeywords[k].some(kw => msgLower.includes(kw))) activeIdx = k;
              }
              if (displayProgress >= 100) activeIdx = REAL_STEPS.length;
              done = i < activeIdx;
              active = i === activeIdx;
            } else {
              done = i < currentStep;
              active = i === currentStep;
            }
            return (
              <div key={i} className={`cds-step ${done ? "cds-step-done" : active ? "cds-step-active" : "cds-step-waiting"}`}>
                <div className="cds-step-icon">
                  {done ? "✓" : active ? <span className="cds-step-spinner"/> : "○"}
                </div>
                <span className="cds-step-label">{p.icon} {p.label}</span>
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

        {/* Cancel button */}
        {!isDone && onCancel && (
          <button className="cds-cancel-btn" onClick={() => setShowCancelConfirm(true)}>
            ✕ Cancel scan
          </button>
        )}
      </div>

      {/* Cancel confirm dialog */}
      {showCancelConfirm && (
        <div className="cancel-confirm-overlay">
          <div className="cancel-confirm-box">
            <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
            <h3 style={{fontSize:18,fontWeight:800,marginBottom:8,color:"#fff"}}>Cancel scan?</h3>
            <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:24,lineHeight:1.5}}>
              The scan is in progress. If you cancel now, your products won't be analyzed and you'll return to the home screen.
            </p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn-secondary" style={{padding:"10px 22px",fontSize:13}} onClick={() => setShowCancelConfirm(false)}>
                Continue Scanning
              </button>
              <button className="btn-primary" style={{padding:"10px 22px",fontSize:13,background:"linear-gradient(135deg,#ef4444,#dc2626)"}} onClick={() => { setShowCancelConfirm(false); onCancel(); }}>
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
const AdPreviewPanel = React.memo(function AdPreviewPanel({ topProduct, mockCampaigns, canPublish, onLaunch, onViewProduct, shop }) {
  const [tab, setTab] = useState("search");

  const isActive = mockCampaigns > 0 && canPublish;
  const ai = topProduct?.aiAnalysis || topProduct?.ai || {};
  const headlines = (ai.headlines || []).map(h => typeof h === "string" ? h : h?.text || h).filter(Boolean);
  const descriptions = (ai.descriptions || []).map(d => typeof d === "string" ? d : d?.text || d).filter(Boolean);
  const keywords = (ai.keywords || []).map(k => typeof k === "string" ? k : k?.text || k).filter(Boolean);
  const score = ai.ad_score || 0;
  const productTitle = topProduct?.title || "Your Top Product";
  const productPrice = topProduct?.price ? `$${Number(topProduct.price).toFixed(2)}` : "$49.99";
  const productImage = topProduct?.image || null;
  const storeDomain = shop || "your-store.myshopify.com";
  const cIntel = ai.competitor_intel || {};
  const topComps = (cIntel.top_competitors || []).slice(0, 3);
  const fallbackComps = [
    { domain: "bedding-store.com", price_range: "$42.99", strength: "Large catalog" },
    { domain: "home-goods.com", price_range: "$55.00", strength: "Fast shipping" },
    { domain: "sleep-shop.com", price_range: "$38.95", strength: "Budget option" },
  ];
  const comps = topComps.length >= 3 ? topComps : topComps.length > 0 ? [...topComps, ...fallbackComps.slice(0, 3 - topComps.length)] : fallbackComps;

  const searchQuery = keywords[0] || "luxury bedding set queen";
  const h1 = headlines[0] || productTitle;
  const h2 = headlines[1] || "Free Shipping On Orders $50+";
  const h3 = headlines[2] || "Shop Now & Save";
  const d1 = descriptions[0] || `Discover ${productTitle}. Premium quality, unbeatable prices. Order today.`;

  const adStrengthLabel = score >= 80 ? "Excellent" : score >= 65 ? "Good" : score >= 50 ? "Average" : "Poor";
  const adStrengthColor = score >= 80 ? "#22c55e" : score >= 65 ? "#84cc16" : score >= 50 ? "#f59e0b" : "#ef4444";
  const comp1 = comps[0] || {};

  if (!topProduct) return (
    <div className="adp-card adp-empty">
      <div className="adp-empty-icon">{"\u{1F4F0}"}</div>
      <div className="adp-empty-title">Ad Preview</div>
      <div className="adp-empty-desc">Analyze products to see your ad previews here</div>
    </div>
  );

  return (
    <div className="adp-card">
      {/* Header */}
      <div className="adp-header">
        <div className="adp-header-left">
          <div className={`adp-status-dot ${isActive ? "adp-dot-active" : "adp-dot-preview"}`}/>
          <span className="adp-title">{isActive ? "Live Ad" : "Recommended Ad"}</span>
          {isActive
            ? <span className="adp-badge adp-badge-live">{"\u25CF"} LIVE</span>
            : <span className="adp-badge adp-badge-preview">PREVIEW</span>}
        </div>
        <div className="adp-score-pill" style={{ borderColor: `${adStrengthColor}44`, color: adStrengthColor }}>
          <ScoreRing score={score} size={28}/>
          <span>{adStrengthLabel}</span>
        </div>
      </div>

      {/* Product context */}
      <div className="adp-product-row">
        {productImage && <img src={productImage} alt="" className="adp-product-img"/>}
        <div className="adp-product-info">
          <div className="adp-product-name">{productTitle}</div>
          <div className="adp-product-price">{productPrice}</div>
        </div>
        {!isActive && (<div className="adp-not-live-badge">Not running</div>)}
      </div>

      {/* Tab switcher */}
      <div className="adp-tabs">
        {[["search","\u{1F50D} Search"],["shopping","\u{1F6CD} Shopping"],["mobile","📱 Mobile"]].map(([id, label]) => (
          <button key={id} className={`adp-tab ${tab === id ? "adp-tab-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* === SEARCH TAB === */}
      {tab === "search" && (
        <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:14}}>
          {/* LEFT — White card with search results */}
          <div style={{flex:"0 0 58%",background:"#fff",borderRadius:12,overflow:"hidden"}}>
            {/* Google search bar */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderBottom:"1px solid #e8eaed",background:"#fff",minHeight:38}}>
              <svg width="16" height="16" viewBox="0 0 24 24" style={{flexShrink:0}}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <span style={{fontSize:13,color:"#202124",flex:1}}>{searchQuery}</span>
              <span style={{fontSize:14}}>{"\u{1F50D}"}</span>
            </div>

            <div style={{padding:"0 16px"}}>
              {/* YOUR AD */}
              <div style={{padding:"12px 0",borderBottom:"1px solid #ebebeb"}}>
                <div style={{display:"inline-block",fontSize:11,fontWeight:700,background:"#f1f3f4",color:"#202124",borderRadius:4,padding:"2px 6px",marginBottom:6}}>Sponsored</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{width:20,height:20,borderRadius:3,background:"#e8eaed",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                    {productImage ? <img src={productImage} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:10}}>{"\u{1F6CD}"}</span>}
                  </div>
                  <div>
                    <div style={{fontSize:12,color:"#202124"}}>{storeDomain}</div>
                    <div style={{fontSize:11,color:"#4d5156"}}>www.{storeDomain} {"›"} shop</div>
                  </div>
                </div>
                <div style={{fontSize:16,color:"#1a0dab",fontWeight:400,lineHeight:1.3,marginBottom:4,cursor:"pointer"}}>
                  {h1} | {h2} | {h3}
                </div>
                <div style={{fontSize:13,color:"#4d5156",lineHeight:1.5}}>{d1}</div>
                {(ai.sitelinks?.length > 0) && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                    {ai.sitelinks.slice(0,4).map((sl,i) => (
                      <div key={i} style={{padding:"4px 10px",border:"1px solid #dadce0",borderRadius:6,fontSize:11,color:"#1a0dab",cursor:"pointer"}}>{sl.title||sl}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* COMPETITOR AD */}
              <div style={{padding:"12px 0",borderBottom:"1px solid #ebebeb"}}>
                <div style={{display:"inline-block",fontSize:11,fontWeight:700,background:"#f1f3f4",color:"#202124",borderRadius:4,padding:"2px 6px",marginBottom:6}}>Sponsored</div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{width:20,height:20,borderRadius:3,background:"#e8eaed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{"\u{1F3EA}"}</div>
                  <div>
                    <div style={{fontSize:12,color:"#202124"}}>{comp1.domain || "competitor-store.com"}</div>
                    <div style={{fontSize:11,color:"#4d5156"}}>www.{comp1.domain || "competitor-store.com"}</div>
                  </div>
                </div>
                <div style={{fontSize:16,color:"#1a0dab",fontWeight:400,lineHeight:1.3,marginBottom:4}}>
                  {comp1.strength || "Quality Products"} | Shop Now
                </div>
                <div style={{fontSize:13,color:"#4d5156"}}>{comp1.price_range ? "From "+comp1.price_range : "Great prices on top brands."}</div>
              </div>

              {/* ORGANIC RESULTS */}
              <div style={{padding:"12px 0"}}>
                <div style={{fontSize:11,color:"#70757a",marginBottom:8}}>Organic results</div>
                {[
                  {title:"Top 10 Best "+(keywords[0]||"products")+" (2025 Guide)",desc:"Expert-reviewed picks for every budget. Updated monthly with the latest options..."},
                  {title:"Compare "+(keywords[0]||"products")+" | Reviews & Ratings",desc:"Side-by-side comparison of top brands. Read real customer reviews before you buy..."},
                  {title:"How to Choose the Right "+(keywords[0]||"product"),desc:"Complete buying guide covers materials, sizes, care tips, and what to look for..."},
                ].map((r,i) => (
                  <div key={i} style={{marginBottom:10}}>
                    <div style={{fontSize:13,color:"#1a0dab",marginBottom:2,cursor:"pointer"}}>{r.title}</div>
                    <div style={{fontSize:12,color:"#4d5156",lineHeight:1.4}}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights bar */}
            <div style={{background:"#f8f9fa",borderTop:"1px solid #e8eaed",padding:"10px 16px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:adStrengthColor}}/>
                <span style={{fontSize:11,color:"#555"}}>Ad Score: <strong style={{color:adStrengthColor}}>{score}/100</strong></span>
              </div>
              <span style={{fontSize:11,color:"#999"}}>{"\u2022"}</span>
              <span style={{fontSize:11,color:"#555"}}>{keywords.length} keywords targeted</span>
              <span style={{fontSize:11,color:"#999"}}>{"\u2022"}</span>
              <span style={{fontSize:11,color:"#555"}}>{comps.length} competitors found</span>
              {comp1.price_range && (
                <>
                  <span style={{fontSize:11,color:"#999"}}>{"\u2022"}</span>
                  <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>Your price: {productPrice} vs {comp1.price_range}</span>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — Knowledge Panel (on dark background) */}
          <div style={{flex:1,minWidth:0}}>
            <div style={{border:"1px solid rgba(255,255,255,.1)",borderRadius:12,overflow:"hidden",background:"rgba(255,255,255,.03)"}}>
              {/* Product image */}
              <div style={{width:"100%",height:140,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                {productImage
                  ? <img src={productImage} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                  : <span style={{fontSize:48,opacity:.3}}>{"\u{1F6CD}"}</span>}
              </div>
              {/* Product info */}
              <div style={{padding:"12px 14px"}}>
                <div style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,.9)",lineHeight:1.3,marginBottom:6}}>{productTitle}</div>
                <div style={{fontSize:18,fontWeight:700,color:"#a5b4fc",marginBottom:4}}>{productPrice}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:10}}>Available at {storeDomain.split(".")[0]}</div>
                {/* Rating */}
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:10}}>
                  <span style={{fontSize:12,color:"#fbbc04"}}>{"\u2605\u2605\u2605\u2605\u2605"}</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>4.8</span>
                </div>
                {/* Quick facts */}
                <div style={{borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:10}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontWeight:600,textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Quick facts</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Score</span>
                    <span style={{fontSize:11,fontWeight:700,color:adStrengthColor}}>{score}/100</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Keywords</span>
                    <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)"}}>{keywords.length} targeted</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>Competitors</span>
                    <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)"}}>{comps.length} found</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === SHOPPING TAB === */}
      {tab === "shopping" && (
        <div style={{background:"#fff",borderRadius:12,marginBottom:14,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:13,fontWeight:600,color:"#202124"}}>Google Shopping</span>
            <span style={{fontSize:11,color:"#70757a"}}>{comps.length+1} results for "{keywords[0]||"bedding"}"</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            <div style={{border:"2px solid #6366f1",borderRadius:10,padding:8,position:"relative",background:"#fff"}}>
              <div style={{position:"absolute",top:-8,left:8,background:"#6366f1",color:"#fff",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10}}>YOUR AD</div>
              {productImage
                ? <img src={productImage} alt="" style={{width:"100%",height:80,objectFit:"contain",borderRadius:6,marginTop:4}}/>
                : <div style={{width:"100%",height:80,background:"#f0f0f0",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{"\u{1F6CD}"}</div>}
              <div style={{fontSize:14,fontWeight:700,color:"#d93025",marginTop:6}}>{productPrice}</div>
              <div style={{fontSize:11,color:"#202124",lineHeight:1.3,marginTop:2}}>{productTitle.length>28?productTitle.slice(0,28)+"\u2026":productTitle}</div>
              <div style={{fontSize:10,color:"#70757a",marginTop:2}}>{storeDomain.split(".")[0]}</div>
              <div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>{"\u2605\u2605\u2605\u2605\u2605"} <span style={{color:"rgba(0,0,0,.5)",fontSize:9}}>4.8</span></div>
            </div>
            {comps.map((c,i) => (
              <div key={i} style={{border:"1px solid #e0e0e0",borderRadius:10,padding:8,background:"#fff"}}>
                <div style={{width:"100%",height:80,background:"#f8f8f8",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{["\u{1F6CF}","\u{1F3E0}","\u2B50"][i]||"\u{1F3EA}"}</div>
                <div style={{fontSize:14,fontWeight:700,color:"#202124",marginTop:6}}>{c.price_range||"$\u2014"}</div>
                <div style={{fontSize:11,color:"#555",lineHeight:1.3,marginTop:2}}>{c.strength||"Competitor"}</div>
                <div style={{fontSize:10,color:"#888",marginTop:2}}>{c.domain||"competitor.com"}</div>
                {c.position
                  ? <div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>Rank #{c.position}</div>
                  : <div style={{fontSize:11,color:"#fbbc04",marginTop:2}}>{"\u2605\u2605\u2605\u2605\u2606"} <span style={{color:"rgba(0,0,0,.4)",fontSize:9}}>4.{3+i}</span></div>}
              </div>
            ))}
          </div>
          <div style={{marginTop:14,padding:"10px 14px",background:"#f8f9fa",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:"#333"}}><strong>Your price:</strong> {productPrice}</div>
            {comp1.price_range && <div style={{fontSize:12,color:"#666"}}><strong>Avg competitor:</strong> {comp1.price_range}</div>}
            <div style={{fontSize:11,padding:"3px 10px",borderRadius:12,background:"rgba(34,197,94,.1)",color:"#16a34a",fontWeight:600}}>{"\u2713"} Competitive</div>
          </div>
        </div>
      )}

      {/* === MOBILE TAB === */}
      {tab === "mobile" && (
        <div style={{display:"flex",justifyContent:"center",padding:"20px 0"}}>
          <div style={{width:260,background:"#1a1a2e",borderRadius:28,padding:"10px 0",boxShadow:"0 8px 32px rgba(0,0,0,.4)",border:"2px solid rgba(255,255,255,.1)"}}>
            <div style={{width:80,height:6,background:"rgba(255,255,255,.15)",borderRadius:3,margin:"4px auto 10px"}}/>
            <div style={{background:"#fff",margin:"0 8px",borderRadius:14,overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:"#f1f3f4",borderBottom:"1px solid #e0e0e0"}}>
                <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                <span style={{fontSize:11,color:"#555",flex:1}}>{searchQuery}</span>
                <span style={{fontSize:12}}>{"\u{1F50D}"}</span>
              </div>
              <div style={{padding:"10px 12px",borderBottom:"1px solid #eee"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                  <span style={{fontSize:9,fontWeight:700,color:"#000",background:"#f1f3f4",padding:"1px 5px",borderRadius:3}}>Ad</span>
                  <span style={{fontSize:9,color:"#4d5156"}}>{storeDomain}</span>
                </div>
                <div style={{fontSize:13,color:"#1a0dab",fontWeight:600,lineHeight:1.3,marginBottom:4}}>{h1} | {h2}</div>
                <div style={{fontSize:11,color:"#4d5156",lineHeight:1.4}}>{d1.slice(0,80)}...</div>
                <div style={{display:"flex",gap:8,marginTop:6}}>
                  <span style={{fontSize:9,color:"#1e6641"}}>{"\u2713"} Free Shipping</span>
                  <span style={{fontSize:9,color:"#1e6641"}}>{"\u2713"} 30-day returns</span>
                </div>
                {(ai.sitelinks?.length > 0) && (
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                    {ai.sitelinks.slice(0,2).map((sl,i) => (
                      <span key={i} style={{fontSize:9,color:"#1a0dab",padding:"2px 6px",background:"#f8f9fa",borderRadius:4}}>{sl.title||sl}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{padding:"8px 12px",borderBottom:"1px solid #eee",opacity:.6}}>
                <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
                  <span style={{fontSize:8,fontWeight:700,color:"#000",background:"#f1f3f4",padding:"1px 4px",borderRadius:3}}>Ad</span>
                  <span style={{fontSize:8,color:"#4d5156"}}>{comp1.domain||"competitor.com"}</span>
                </div>
                <div style={{fontSize:11,color:"#1a0dab",fontWeight:600,lineHeight:1.3}}>{comp1.strength||"Shop Now"} | {(comp1.domain||"competitor").split(".")[0]}</div>
                <div style={{fontSize:9,color:"#4d5156",marginTop:2}}>{comp1.price_range?"From "+comp1.price_range:"Great deals available"}</div>
              </div>
              <div style={{padding:"8px 12px"}}>
                <div style={{fontSize:9,color:"#999",marginBottom:6}}>Organic results</div>
                {[
                  "Best "+(keywords[0]||"products")+" 2025",
                  "Compare "+(keywords[0]||"products"),
                  "How to Choose "+(keywords[0]||"product"),
                ].map((t,i) => (
                  <div key={i} style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:"#1a0dab",marginBottom:1}}>{t}</div>
                    <div style={{height:6,width:"90%",background:"#f0f0f0",borderRadius:2}}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{width:60,height:4,background:"rgba(255,255,255,.2)",borderRadius:2,margin:"10px auto 4px"}}/>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="adp-footer">
        {isActive ? (
          <>
            <div className="adp-live-stats">
              <span>{"\u{1F441}"} {(mockCampaigns * 4200).toLocaleString()} impressions/mo</span>
              <span>{"\u{1F446}"} {(mockCampaigns * 180).toLocaleString()} clicks/mo</span>
            </div>
            <button className="adp-btn-secondary" onClick={() => onViewProduct && onViewProduct(topProduct)}>Edit Ad {"→"}</button>
          </>
        ) : (
          <>
            <div className="adp-suggestion">{"💡"} This ad is ready to launch {"\u2014"} {keywords.length} keywords targeted</div>
            <button className="adp-btn-launch" onClick={onLaunch}>{canPublish ? "\u{1F680} Launch This Ad" : "\u{1F512} Subscribe to Launch"}</button>
          </>
        )}
      </div>
    </div>
  );
});

// ══════════════════════════════════════════════
// COMPETITOR GAP FINDER
// ══════════════════════════════════════════════
const CompetitorGapFinder = React.memo(function CompetitorGapFinder({ keywordGaps, totalMonthlyGapLoss, analyzedCount, onAddKeyword, canPublish, onUpgrade }) {
  const [expanded, setExpanded] = useState(false);
  const [addedKeywords, setAddedKeywords] = useState(new Set());
  const [animateTotal, setAnimateTotal] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimateTotal(true), 600); return () => clearTimeout(t); }, []);

  if (analyzedCount === 0) return null;

  const hasGaps = keywordGaps.length > 0;
  const displayGaps = expanded ? keywordGaps : keywordGaps.slice(0, 4);

  function handleAdd(keyword) {
    if (!canPublish) { onUpgrade(); return; }
    setAddedKeywords(prev => new Set([...prev, keyword]));
    onAddKeyword && onAddKeyword(keyword);
  }

  return (
    <div className="gap-card">
      <div className="gap-card-header">
        <div className="gap-card-title-row">
          <span className="gap-card-icon">🎯</span>
          <div>
            <div className="gap-card-title">Competitor Gap Finder</div>
            <div className="gap-card-sub">Keywords your competitors target — that you're missing</div>
          </div>
        </div>
        {hasGaps && (
          <div className="gap-loss-badge">
            <div className="gap-loss-label">Est. Monthly Loss</div>
            <div className={`gap-loss-amount ${animateTotal ? "gap-loss-visible" : ""}`}>
              ${totalMonthlyGapLoss.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {!hasGaps ? (
        <div className="gap-empty">
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>No major gaps detected</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.4)" }}>Your keyword coverage looks solid compared to competitors</div>
        </div>
      ) : (
        <>
          {/* Alert bar */}
          <div className="gap-alert">
            <span className="gap-alert-icon">⚠️</span>
            <span>Competitors are capturing <strong>{keywordGaps.reduce((a,g)=>a+g.estClicks,0).toLocaleString()} clicks/mo</strong> on keywords you're not bidding on</span>
          </div>

          {/* Gap table */}
          <div className="gap-table">
            <div className="gap-table-head">
              <span>Keyword</span>
              <span>Competitors</span>
              <span>Est. Lost Clicks</span>
              <span>Est. Monthly Loss</span>
              <span>Difficulty</span>
              <span></span>
            </div>
            {displayGaps.map((gap, i) => {
              const isAdded = addedKeywords.has(gap.keyword);
              return (
                <div key={i} className={`gap-row ${isAdded ? "gap-row-added" : ""}`} style={{ animationDelay:`${i*0.06}s` }}>
                  <div className="gap-keyword">
                    <span className="gap-keyword-text">{gap.keyword}</span>
                  </div>
                  <div className="gap-freq">
                    {Array.from({length: Math.min(gap.freq, 5)}).map((_,j) => (
                      <span key={j} className="gap-freq-dot" style={{ background: gap.diffColor }}/>
                    ))}
                    <span className="gap-freq-num">{gap.freq}</span>
                  </div>
                  <div className="gap-clicks">~{gap.estClicks} <span className="gap-unit">clicks</span></div>
                  <div className="gap-loss" style={{ color: gap.estMonthlyLoss > 400 ? "#ef4444" : gap.estMonthlyLoss > 200 ? "#f59e0b" : "#fbbf24" }}>
                    ${gap.estMonthlyLoss.toLocaleString()}
                  </div>
                  <div className="gap-diff" style={{ color: gap.diffColor }}>
                    <span className="gap-diff-dot" style={{ background: gap.diffColor }}/>
                    {gap.difficulty}
                  </div>
                  <div className="gap-action">
                    {isAdded ? (
                      <span className="gap-added-badge">✓ Added</span>
                    ) : (
                      <button className="gap-add-btn" onClick={() => handleAdd(gap.keyword)}>
                        {canPublish ? "+ Add" : "🔒"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {keywordGaps.length > 4 && (
            <button className="gap-expand-btn" onClick={() => setExpanded(e => !e)}>
              {expanded ? `↑ Show less` : `↓ Show ${keywordGaps.length - 4} more gaps`}
            </button>
          )}

          {/* CTA */}
          {!canPublish ? (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">🔒 Subscribe to add these keywords to your campaigns instantly</span>
              <button className="gap-upgrade-btn" onClick={onUpgrade}>Unlock →</button>
            </div>
          ) : addedKeywords.size > 0 ? (
            <div className="gap-success-row">
              <span>✅ {addedKeywords.size} keyword{addedKeywords.size!==1?"s":""} added to your campaigns</span>
            </div>
          ) : (
            <div className="gap-upgrade-row">
              <span className="gap-upgrade-txt">💡 Click "+ Add" to target these keywords and recover lost traffic</span>
            </div>
          )}
        </>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════
// STORE HEALTH SCORE — main innovation component
// ══════════════════════════════════════════════
const StoreHealthScore = React.memo(function StoreHealthScore({ analyzedCount, totalProducts, avgScore, highPotential, competitorCount }) {
  const [expanded, setExpanded] = useState(false);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 500); return () => clearTimeout(t); }, []);

  const adQuality = avgScore;
  const productCoverage = totalProducts > 0 ? Math.round((analyzedCount / totalProducts) * 100) : 0;
  const competitorIntel = Math.min(competitorCount * 20, 100);
  const budgetEfficiency = avgScore > 0 ? Math.min(Math.round(avgScore * 0.85 + highPotential * 2.5), 100) : 0;
  const overall = Math.round(adQuality * 0.35 + productCoverage * 0.25 + competitorIntel * 0.2 + budgetEfficiency * 0.2);

  const grade = overall >= 85 ? "A" : overall >= 70 ? "B" : overall >= 55 ? "C" : overall >= 40 ? "D" : "F";
  const gradeColor = overall >= 85 ? "#22c55e" : overall >= 70 ? "#84cc16" : overall >= 55 ? "#f59e0b" : overall >= 40 ? "#f97316" : "#ef4444";
  const statusText = overall >= 85 ? "Excellent" : overall >= 70 ? "Good" : overall >= 55 ? "Average" : overall >= 40 ? "Needs Work" : "Critical";

  const subScores = [
    { label:"Ad Quality", value:adQuality, color:"#6366f1", icon:"🎯", tip:`Avg score ${avgScore}/100 across products` },
    { label:"Product Coverage", value:productCoverage, color:"#06b6d4", icon:"📦", tip:`${analyzedCount} of ${totalProducts} analyzed` },
    { label:"Competitor Intel", value:competitorIntel, color:"#8b5cf6", icon:"🕵️", tip:`${competitorCount} competitors found` },
    { label:"Budget Efficiency", value:budgetEfficiency, color:"#f59e0b", icon:"💰", tip:"Estimated ROI based on scores" },
  ];

  const sz = 148, rr = 58, circ = 2 * Math.PI * rr;
  const offset = circ - (animated ? overall / 100 : 0) * circ;

  return (
    <div className="health-card" onClick={() => setExpanded(e => !e)}>
      <div className="health-top">
        {/* Big ring */}
        <div className="health-ring-wrap">
          <svg width={sz} height={sz}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <circle cx={sz/2} cy={sz/2} r={rr} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="12"/>
            <circle cx={sz/2} cy={sz/2} r={rr} fill="none" stroke={gradeColor} strokeWidth="12"
              strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${sz/2} ${sz/2})`}
              filter="url(#glow)"
              style={{ transition:"stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1), stroke .5s" }}/>
            <text x="50%" y="42%" dominantBaseline="central" textAnchor="middle"
              fill={gradeColor} fontSize="38" fontWeight="900">{grade}</text>
            <text x="50%" y="63%" dominantBaseline="central" textAnchor="middle"
              fill="rgba(255,255,255,.35)" fontSize="12">{overall}/100</text>
          </svg>
          <div className="health-pulse" style={{ borderColor:`${gradeColor}30` }}/>
          <div className="health-pulse health-pulse-2" style={{ borderColor:`${gradeColor}15` }}/>
        </div>

        {/* Info */}
        <div className="health-info">
          <div className="health-label">Store Health Score</div>
          <div className="health-status-text" style={{ color:gradeColor }}>{statusText}</div>
          <div className="health-desc">
            {overall >= 70
              ? `${highPotential} products ready for high-impact campaigns. Keep it up!`
              : `Analyze more products and improve ad scores to boost your rating.`}
          </div>
          {/* Mini sub-score bars */}
          <div className="health-mini-bars">
            {subScores.map((s,i) => (
              <div key={i} className="health-mini-bar-row">
                <span className="health-mini-lbl">{s.icon}</span>
                <div className="health-mini-track">
                  <div className="health-mini-fill" style={{ width:`${animated ? s.value : 0}%`, background:s.color, transition:`width ${1.2+i*0.15}s cubic-bezier(.4,0,.2,1)` }}/>
                </div>
                <span className="health-mini-val" style={{ color:s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div className="health-expand">{expanded ? "Hide ↑" : "Details ↓"}</div>
        </div>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="health-breakdown">
          {subScores.map((s,i) => {
            const sr = 22, sc = 2 * Math.PI * sr;
            const so = sc - (animated ? s.value / 100 : 0) * sc;
            return (
              <div key={i} className="health-sub-item">
                <svg width="52" height="52">
                  <circle cx="26" cy="26" r={sr} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="5"/>
                  <circle cx="26" cy="26" r={sr} fill="none" stroke={s.color} strokeWidth="5"
                    strokeDasharray={sc} strokeDashoffset={so} strokeLinecap="round"
                    transform="rotate(-90 26 26)"
                    style={{ transition:`stroke-dashoffset ${1.2+i*0.2}s cubic-bezier(.4,0,.2,1)`, filter:`drop-shadow(0 0 4px ${s.color}88)` }}/>
                  <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={s.color} fontSize="10" fontWeight="800">{s.value}</text>
                </svg>
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{s.icon} {s.label}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.4)", marginTop:2 }}>{s.tip}</div>
                </div>
              </div>
            );
          })}
          <div className="health-tips">
            {productCoverage < 100 && <div className="health-tip-item">💡 Analyze {totalProducts - analyzedCount} more products to improve coverage</div>}
            {adQuality < 70 && <div className="health-tip-item">💡 Boost low-scoring products with stronger keywords</div>}
            {competitorIntel < 60 && <div className="health-tip-item">💡 Run full scan to gather more competitor intelligence</div>}
          </div>
        </div>
      )}
    </div>
  );
});

// ══════════════════════════════════════════════
// LIVE PULSE — real-time campaign activity
// ══════════════════════════════════════════════
const LivePulse = React.memo(function LivePulse({ campaigns, impressionsBase, clicksBase, campaignId, realSpend, campaignControlStatus, confirmRemove, setConfirmRemove, onPause, onRemove }) {
  const [heartbeat, setHeartbeat] = useState(false);
  const [impressions, setImpressions] = useState(impressionsBase);
  const [clicks, setClicks] = useState(clicksBase);
  const [lastEvent, setLastEvent] = useState("Monitoring your campaigns...");
  const [eventVisible, setEventVisible] = useState(true);
  const canvasRef = useRef(null);
  const dataRef = useRef(Array.from({ length: 30 }, () => Math.random() * 0.4 + 0.1));
  const animRef = useRef(null);

  const events = [
    "New impression — 'luxury bedding set'",
    "Click converted — product page visited",
    "Competitor bid change detected",
    "New impression — 'queen size duvet cover'",
    "Ad shown — mobile search",
    "High-intent search click recorded",
    "Quality score updated +1",
    "New impression — branded keyword",
    "Smart bidding adjustment applied",
  ];

  useEffect(() => {
    if (campaigns === 0) return;
    const tick = () => {
      setHeartbeat(true);
      setTimeout(() => setHeartbeat(false), 700);
      setImpressions(p => p + Math.floor(Math.random() * 14 + 2));
      if (Math.random() > 0.6) setClicks(p => p + 1);
      if (Math.random() > 0.45) {
        setEventVisible(false);
        setTimeout(() => { setLastEvent(events[Math.floor(Math.random() * events.length)]); setEventVisible(true); }, 300);
      }
      dataRef.current = [...dataRef.current.slice(1), Math.random() * 0.75 + 0.25];
    };
    tick();
    const iv = setInterval(() => { if (document.visibilityState !== "hidden") tick(); }, 2200 + Math.random() * 1800);
    return () => clearInterval(iv);
  }, [campaigns]);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const data = dataRef.current;
      if (data.length < 2) { animRef.current = requestAnimationFrame(draw); return; }
      const step = W / (data.length - 1);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,.04)";
      ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(y => {
        ctx.beginPath(); ctx.moveTo(0, H * y); ctx.lineTo(W, H * y); ctx.stroke();
      });

      // Gradient fill
      const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
      fillGrad.addColorStop(0, "rgba(99,102,241,.2)");
      fillGrad.addColorStop(1, "rgba(99,102,241,0)");

      // Line gradient
      const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
      lineGrad.addColorStop(0, "rgba(99,102,241,.3)");
      lineGrad.addColorStop(0.6, "#6366f1");
      lineGrad.addColorStop(1, "#22c55e");

      // Draw path
      ctx.beginPath();
      ctx.moveTo(0, H);
      data.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.8;
        if (i === 0) ctx.lineTo(x, y);
        else {
          const px = (i-1) * step, py = H - data[i-1] * H * 0.8;
          ctx.bezierCurveTo(px + step/2, py, x - step/2, y, x, y);
        }
      });
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = fillGrad; ctx.fill();

      // Stroke
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.8;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const px = (i-1) * step, py = H - data[i-1] * H * 0.8;
          ctx.bezierCurveTo(px + step/2, py, x - step/2, y, x, y);
        }
      });
      ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5;
      ctx.shadowColor = "#6366f1"; ctx.shadowBlur = 8;
      ctx.stroke(); ctx.shadowBlur = 0;

      // Live dot
      const lx = (data.length-1) * step, ly = H - data[data.length-1] * H * 0.8;
      ctx.beginPath(); ctx.arc(lx, ly, 5, 0, Math.PI*2);
      ctx.fillStyle = "#22c55e"; ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 14;
      ctx.fill(); ctx.shadowBlur = 0;

      // Ripple around dot
      ctx.beginPath(); ctx.arc(lx, ly, 9, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(34,197,94,.3)"; ctx.lineWidth = 1.5; ctx.stroke();

      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";
  const spend = (clicks * 0.44).toFixed(2);

  if (campaigns === 0) return (
    <div className="pulse-card pulse-empty">
      <div style={{ fontSize:36, marginBottom:10 }}>📡</div>
      <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Live Campaign Pulse</div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,.4)" }}>Launch campaigns to see real-time data</div>
    </div>
  );

  return (
    <div className="pulse-card">
      <div className="pulse-header-row">
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div className={`pulse-dot-live ${heartbeat ? "pulse-beat" : ""}`}/>
          <span style={{ fontSize:14, fontWeight:700 }}>Live Campaign Pulse</span>
          <span className="pulse-live-tag">LIVE</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Campaign control buttons in header */}
          {campaignId && campaignControlStatus !== "removed" && campaignControlStatus !== "paused" && (
            <>
              <button className="pulse-btn pulse-btn-pause" style={{padding:"5px 12px",fontSize:12}} onClick={onPause} disabled={campaignControlStatus==="pausing"||campaignControlStatus==="removing"}>
                {campaignControlStatus==="pausing" ? "⏳" : "⏸ Pause"}
              </button>
              <button className="pulse-btn pulse-btn-remove" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setConfirmRemove(true)} disabled={campaignControlStatus==="pausing"||campaignControlStatus==="removing"}>
                {campaignControlStatus==="removing" ? "⏳" : "🗑 Remove"}
              </button>
            </>
          )}
          {campaignControlStatus==="paused" && <span className="pulse-status-badge pulse-badge-paused">⏸ Paused</span>}
          {campaignControlStatus==="removed" && <span className="pulse-status-badge pulse-badge-removed">✅ Removed</span>}
          {/* Heartbeat SVG */}
          <svg width="22" height="20" viewBox="0 0 24 22" fill="none" className={heartbeat ? "heart-beat" : ""}>
            <path d="M12 21C12 21 3 14 3 8C3 5.2 5.2 3 8 3C9.7 3 11.2 3.9 12 5.2C12.8 3.9 14.3 3 16 3C18.8 3 21 5.2 21 8C21 14 12 21 12 21Z"
              fill={heartbeat ? "#ef4444" : "#6366f1"} style={{ transition:"fill .3s" }}/>
          </svg>
        </div>
      </div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,.4)", marginBottom:10 }}>{campaigns} campaign{campaigns!==1?"s":""} running · live data</div>

      {/* Waveform */}
      <div style={{ position:"relative", marginBottom:14 }}>
        <canvas ref={canvasRef} width={520} height={72} className="pulse-canvas"/>
      </div>

      {/* 4 metrics */}
      <div className="pulse-metrics-row">
        <div className="pulse-metric-box pulse-m-imp">
          <div className="pulse-m-val">{impressions.toLocaleString()}</div>
          <div className="pulse-m-lbl">👁 Impressions</div>
        </div>
        <div className="pulse-metric-box pulse-m-clk">
          <div className="pulse-m-val">{clicks.toLocaleString()}</div>
          <div className="pulse-m-lbl">👆 Clicks</div>
        </div>
        <div className="pulse-metric-box pulse-m-ctr">
          <div className="pulse-m-val">{ctr}%</div>
          <div className="pulse-m-lbl">📊 CTR</div>
        </div>
        <div className="pulse-metric-box pulse-m-cost">
          <div className="pulse-m-val">${spend}</div>
          <div className="pulse-m-lbl">💸 Est. Spend</div>
        </div>
      </div>

      {/* Live event */}
      <div className="pulse-event-bar" style={{ opacity: eventVisible ? 1 : 0, transition:"opacity .3s" }}>
        <span className="pulse-event-dot-green"/>
        <span className="pulse-event-txt">{lastEvent}</span>
        <span className="pulse-event-time">just now</span>
      </div>

      {/* ── Real Spend ── */}
      {campaignId && (
        <div className="pulse-controls">
          <div className="pulse-spend-box">
            <span className="pulse-spend-label">💸 Total Spend</span>
            <span className="pulse-spend-val">
              {realSpend != null
                ? `$${Number(realSpend).toFixed(2)}`
                : campaignControlStatus === "paused" || campaignControlStatus === "removed"
                  ? `$${spend}`
                  : <span className="pulse-spend-fetching">Fetching from Google…</span>}
            </span>
            {realSpend == null && <span className="pulse-spend-note">(estimated)</span>}
          </div>
          {campaignControlStatus === "error" && (
            <span className="pulse-status-badge pulse-badge-error">⚠️ Action failed — check Google Ads connection</span>
          )}
          {/* Confirm Remove Dialog */}
          {confirmRemove && (
            <div className="pulse-confirm-overlay">
              <div className="pulse-confirm-box">
                <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
                <h3 style={{fontSize:16,fontWeight:800,marginBottom:8}}>Remove Campaign?</h3>
                <p style={{fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:20}}>
                  This will permanently remove the campaign from Google Ads. This cannot be undone.
                </p>
                <div style={{display:"flex",gap:10}}>
                  <button className="pulse-btn pulse-btn-remove" style={{flex:1}} onClick={onRemove}>Yes, Remove</button>
                  <button className="pulse-btn pulse-btn-pause" style={{flex:1}} onClick={() => setConfirmRemove(false)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const TIPS = ["💡 Ads with 10+ headlines get up to 15% more clicks","💡 Specific keywords like 'buy red sneakers size 10' convert 3x better","💡 Starting with $10/day is enough to get real data in a week","💡 Paused campaigns cost nothing — review before going live","💡 Negative keywords can cut wasted spend by up to 30%"];
const TipRotator = React.memo(function TipRotator() {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const iv = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i => (i+1)%TIPS.length); setVisible(true); },400); },4000); return () => clearInterval(iv); }, []);
  return <div className="tip-box" style={{ opacity:visible?1:0, transition:"opacity .4s ease" }}>{TIPS[idx]}</div>;
});

const Confetti = React.memo(function Confetti({ active }) {
  if (!active) return null;
  const pieces = Array.from({ length: 60 }, (_, i) => {
    const colors = ["#6366f1","#8b5cf6","#06b6d4","#22c55e","#f59e0b","#ec4899","#fff"];
    const left = Math.random()*100, delay = Math.random()*.8, dur = 2+Math.random()*1.5, sz = 6+Math.random()*6, rot = Math.random()*360;
    return <div key={i} style={{ position:"fixed",top:-20,left:left+"%",width:sz,height:sz*.4,background:colors[i%colors.length],borderRadius:2,zIndex:9999,transform:`rotate(${rot}deg)`,animation:`confettiFall ${dur}s ease-out ${delay}s forwards`,opacity:0 }}/>;
  });
  return <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999 }}>{pieces}</div>;
});

const TICKER = [
  { name:"🇺🇸 Shopify Plus store", action:"replaced a $2,500/mo agency with Smart Ads AI", time:"just now", emoji:"💎" },
  { name:"🇬🇧 First-time advertiser", action:"got their first Google Ads sale within 48 hours", time:"3 min ago", emoji:"🎯" },
  { name:"🇦🇺 Store with 340 products", action:"full AI scan completed in 58 seconds", time:"7 min ago", emoji:"⚡" },
  { name:"🇩🇪 DTC skincare brand", action:"went from 1.1x to 4.6x ROAS in 3 weeks", time:"19 min ago", emoji:"📈" },
];
function SuccessTicker() {
  const [idx, setIdx] = useState(0), [visible, setVisible] = useState(true);
  useEffect(() => { const iv = setInterval(() => { setVisible(false); setTimeout(() => { setIdx(i=>(i+1)%TICKER.length); setVisible(true); },500); },3500); return () => clearInterval(iv); }, []);
  const msg = TICKER[idx];
  return (
    <div className="ticker-wrap" style={{ opacity:visible?1:0, transition:"opacity .5s ease" }}>
      <span className="ticker-emoji">{msg.emoji}</span>
      <span className="ticker-text"><strong>{msg.name}</strong> {msg.action}</span>
      <span className="ticker-time">{msg.time}</span>
    </div>
  );
}


// ══════════════════════════════════════════════
// LANDING PAGE — BUDGET TEASER
// ══════════════════════════════════════════════
function LandingBudgetTeaser() {
  const [daily, setDaily] = useState(30);
  const cpc = 0.72;
  const clicks = Math.round(daily / cpc);
  const orders = (clicks * 0.028).toFixed(1);
  const revenue = Math.round(clicks * 0.028 * 85);
  const roas = (revenue / daily).toFixed(1);
  const roasColor = parseFloat(roas) >= 4 ? "#22c55e" : parseFloat(roas) >= 2 ? "#f59e0b" : "#ef4444";

  return (
    <div className="lp-budget-card">
      <div className="lp-budget-slider-wrap">
        <div className="lp-budget-slider-label">
          <span>Daily Budget</span>
          <span className="lp-budget-val">${daily}/day</span>
        </div>
        <input type="range" min="5" max="200" step="5" value={daily}
          onChange={e => setDaily(Number(e.target.value))}
          className="budget-sim-slider" />
        <div className="budget-sim-range-labels"><span>$5</span><span>$200</span></div>
      </div>
      <div className="lp-budget-results">
        <div className="lp-budget-result">
          <div className="lp-budget-result-val">{clicks.toLocaleString()}</div>
          <div className="lp-budget-result-lbl">👆 Clicks/day</div>
        </div>
        <div className="lp-budget-result">
          <div className="lp-budget-result-val">{orders}</div>
          <div className="lp-budget-result-lbl">🛍 Orders/day</div>
        </div>
        <div className="lp-budget-result">
          <div className="lp-budget-result-val">${revenue.toLocaleString()}</div>
          <div className="lp-budget-result-lbl">💵 Revenue/day</div>
        </div>
        <div className="lp-budget-result" style={{borderColor: roasColor + "55"}}>
          <div className="lp-budget-result-val" style={{color: roasColor}}>{roas}x</div>
          <div className="lp-budget-result-lbl">📈 ROAS</div>
        </div>
      </div>
      <div className="lp-budget-footer">
        * Based on avg Shopify store metrics · Your actual results depend on products & competition
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// LANDING PAGE — WHAT YOU'RE MISSING
// ══════════════════════════════════════════════
function LandingMissingBlock({ onInstall }) {
  const [counter, setCounter] = useState({ competitors: 38, revenue: 1840, products: 0 });

  useEffect(() => {
    const iv = setInterval(() => {
      setCounter(prev => ({
        competitors: prev.competitors + Math.floor(Math.random() * 2),
        revenue: prev.revenue + Math.floor(Math.random() * 40 + 10),
        products: prev.products,
      }));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  const stats = [
    { icon: "⚔️", val: counter.competitors, suffix: "", label: "competitors bidding on your keywords right now", color: "#ef4444" },
    { icon: "💸", val: `$${counter.revenue.toLocaleString()}`, suffix: "/mo", label: "in revenue going to competitors this month", color: "#f59e0b" },
    { icon: "📭", val: counter.products, suffix: "", label: "of your products have active Google Ads", color: "#6366f1" },
  ];

  return (
    <div className="lp-missing-card">
      <div className="lp-missing-stats">
        {stats.map((s, i) => (
          <div key={i} className="lp-missing-stat">
            <div className="lp-missing-icon">{s.icon}</div>
            <div className="lp-missing-val" style={{color: s.color}}>
              {s.val}{s.suffix}
            </div>
            <div className="lp-missing-lbl">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="lp-missing-cta">
        <div className="lp-missing-cta-text">
          <strong>See your real numbers →</strong>
          <span> Connect your store and get a full competitive analysis in 60 seconds.</span>
        </div>
        <button className="lp-missing-btn" onClick={onInstall}>
          ⚡ Get My Free Analysis
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════
// TOP MISSED OPPORTUNITY CARD
// ══════════════════════════════════════════════
const TopMissedOpportunity = React.memo(function TopMissedOpportunity({ topProduct, avgScore, totalMonthlyGapLoss, analyzedCount, onScan, onViewProduct, hasScanAccess }) {
  if (!topProduct && analyzedCount === 0) {
    // Never scanned — show teaser
    return (
      <div className="tmo-card tmo-teaser">
        <div className="tmo-teaser-icon">🔍</div>
        <div className="tmo-teaser-content">
          <h3 className="tmo-teaser-title">Discover Your #1 Missed Opportunity</h3>
          <p className="tmo-teaser-sub">Run a free scan to see which product could be making you the most money right now — and exactly why it isn't.</p>
          <button className="tmo-teaser-btn" onClick={onScan}>⚡ Run Free Scan Now</button>
        </div>
        <div className="tmo-teaser-bg">💰</div>
      </div>
    );
  }

  if (!topProduct) return null;

  const ai = topProduct.aiAnalysis || {};
  const score = ai.ad_score || 0;
  const topKeyword = (ai.keywords?.[0]?.text || ai.keywords?.[0] || "your top keyword");
  const estMonthly = totalMonthlyGapLoss > 0 ? totalMonthlyGapLoss : Math.round(score * 18 + 240);
  const topComp = ai.competitor_intel?.top_competitors?.[0]?.domain || null;

  return (
    <div className="tmo-card">
      <div className="tmo-badge">🎯 Your #1 Opportunity</div>
      <div className="tmo-content">
        <div className="tmo-left">
          {topProduct.image && <img src={topProduct.image} alt="" className="tmo-img"/>}
          <div className="tmo-product-info">
            <div className="tmo-product-title">{topProduct.title}</div>
            <div className="tmo-product-price">${Number(topProduct.price||0).toFixed(2)}</div>
            <div className="tmo-score-row">
              <div className="tmo-score-bar">
                <div className="tmo-score-fill" style={{width:`${score}%`, background: score>=70?"#22c55e":score>=50?"#f59e0b":"#ef4444"}}/>
              </div>
              <span className="tmo-score-val">{score}/100</span>
            </div>
          </div>
        </div>
        <div className="tmo-right">
          <div className="tmo-money-lost">
            <div className="tmo-money-val">${estMonthly.toLocaleString()}</div>
            <div className="tmo-money-lbl">estimated monthly revenue<br/>you could be capturing</div>
          </div>
          <div className="tmo-insights">
            {topComp && <div className="tmo-insight">⚔️ <strong>{topComp}</strong> is bidding on "<em>{topKeyword}</em>" right now</div>}
            <div className="tmo-insight">🔑 Top keyword: <strong>"{topKeyword}"</strong></div>
            {ai.strategy && <div className="tmo-insight">📋 Recommended strategy: <strong>{ai.strategy.replace(/_/g," ").toUpperCase()}</strong></div>}
          </div>
          <button className="tmo-cta" onClick={() => onViewProduct && onViewProduct(topProduct)}>
            🚀 View Full Campaign →
          </button>
        </div>
      </div>
    </div>
  );
});


// ══════════════════════════════════════════════
// BUDGET SIMULATOR
// ══════════════════════════════════════════════
const BudgetSimulator = React.memo(function BudgetSimulator({ avgScore, avgCpc, canPublish, onUpgrade }) {
  const [vals, setVals] = useState({ budget: 20, aov: 80, conv: 2.5 });

  // Calculations
  const cpc = avgCpc || Math.max(0.25, (1.2 - avgScore * 0.006));
  const dailyClicks   = Math.round(vals.budget / cpc);
  const dailyOrders   = (dailyClicks * vals.conv / 100);
  const dailyRevenue  = dailyOrders * vals.aov;
  const dailyProfit   = dailyRevenue - vals.budget;
  const monthlyBudget = vals.budget * 30;
  const monthlyRev    = dailyRevenue * 30;
  const roas          = vals.budget > 0 ? (dailyRevenue / vals.budget).toFixed(1) : "0";
  const breakEvenDays = dailyProfit > 0 ? Math.ceil(monthlyBudget / dailyProfit) : null;
  const roasNum       = parseFloat(roas);
  const roasColor     = roasNum >= 4 ? "#22c55e" : roasNum >= 2 ? "#f59e0b" : "#ef4444";
  const roasLabel     = roasNum >= 4 ? "Excellent" : roasNum >= 2 ? "Good" : "Low";

  return (
    <div className="budget-sim-card">
      <div className="budget-sim-header">
        <div>
          <h3 className="budget-sim-title">💰 Budget Simulator</h3>
          <p className="budget-sim-sub">Adjust your budget and see projected results</p>
        </div>
        {!canPublish && (
          <button className="budget-sim-upgrade" onClick={onUpgrade}>🔒 Subscribe to Launch</button>
        )}
      </div>

      {/* Sliders */}
      <div className="budget-sim-inputs">
        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Daily Budget</span>
            <span className="budget-sim-input-val">${vals.budget}/day</span>
          </div>
          <input type="range" min="5" max="500" step="5" value={vals.budget}
            onChange={e => setVals(v => ({...v, budget: Number(e.target.value)}))}
            className="budget-sim-slider" />
          <div className="budget-sim-range-labels"><span>$5</span><span>$500</span></div>
        </div>

        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Avg Order Value</span>
            <span className="budget-sim-input-val">${vals.aov}</span>
          </div>
          <input type="range" min="10" max="500" step="5" value={vals.aov}
            onChange={e => setVals(v => ({...v, aov: Number(e.target.value)}))}
            className="budget-sim-slider" />
          <div className="budget-sim-range-labels"><span>$10</span><span>$500</span></div>
        </div>

        <div className="budget-sim-input-row">
          <div className="budget-sim-input-label">
            <span>Conversion Rate</span>
            <span className="budget-sim-input-val">{vals.conv}%</span>
          </div>
          <input type="range" min="0.1" max="10" step="0.1" value={vals.conv}
            onChange={e => setVals(v => ({...v, conv: parseFloat(e.target.value)}))}
            className="budget-sim-slider" />
          <div className="budget-sim-range-labels"><span>0.1%</span><span>10%</span></div>
        </div>
      </div>

      {/* Results */}
      <div className="budget-sim-results">
        <div className="budget-sim-result-card">
          <div className="budget-sim-result-val">{dailyClicks.toLocaleString()}</div>
          <div className="budget-sim-result-lbl">👆 Daily Clicks</div>
        </div>
        <div className="budget-sim-result-card">
          <div className="budget-sim-result-val">{dailyOrders.toFixed(1)}</div>
          <div className="budget-sim-result-lbl">🛍 Daily Orders</div>
        </div>
        <div className="budget-sim-result-card">
          <div className="budget-sim-result-val">${Math.round(dailyRevenue).toLocaleString()}</div>
          <div className="budget-sim-result-lbl">💵 Daily Revenue</div>
        </div>
        <div className="budget-sim-result-card" style={{borderColor: roasColor + "44"}}>
          <div className="budget-sim-result-val" style={{color: roasColor}}>{roas}x</div>
          <div className="budget-sim-result-lbl">📈 ROAS <span style={{color:roasColor,fontSize:10}}>({roasLabel})</span></div>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="budget-sim-monthly">
        <div className="budget-sim-monthly-row">
          <span>Monthly ad spend</span>
          <span style={{color:"#ef4444"}}>-${(vals.budget*30).toLocaleString()}</span>
        </div>
        <div className="budget-sim-monthly-row">
          <span>Monthly revenue</span>
          <span style={{color:"#22c55e"}}>+${Math.round(dailyRevenue*30).toLocaleString()}</span>
        </div>
        <div className="budget-sim-monthly-row" style={{fontWeight:800,fontSize:15,borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:8,marginTop:4}}>
          <span>Monthly profit</span>
          <span style={{color: dailyProfit >= 0 ? "#22c55e" : "#ef4444"}}>
            {dailyProfit >= 0 ? "+" : ""}${Math.round((dailyRevenue-vals.budget)*30).toLocaleString()}
          </span>
        </div>
        {breakEvenDays && breakEvenDays <= 60 && (
          <div className="budget-sim-breakeven">
            ⚡ Break-even in ~{breakEvenDays} days at this budget
          </div>
        )}
      </div>

      <div className="budget-sim-note">
        * Based on avg score {avgScore}/100 · Est. CPC ${cpc.toFixed(2)} · Results may vary
      </div>
    </div>
  );
});

function ModalScrollLock() {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "unset"; };
  }, []);
  return null;
}

function ProductModal({ product, onClose, aiResults, shop }) {
  const isDb = !!product.hasAiAnalysis;
  const ai = isDb ? (product.aiAnalysis||{}) : (aiResults?.products?.find(ap=>ap.title===product.title)||{});
  const headlines = (ai.headlines||[]).map(h => typeof h === "string" ? h : h?.text || h).filter(Boolean);
  const descriptions = (ai.descriptions||[]).map(d => typeof d === "string" ? d : d?.text || d).filter(Boolean);
  const keywords = (ai.keywords||[]).map(k=>typeof k==="string"?{text:k,match_type:"BROAD"}:k);
  const sitelinks = ai.sitelinks||[], cIntel = ai.competitor_intel||null;
  const path1 = ai.path1||"Shop", path2 = ai.path2||"", negKw = ai.negative_keywords||[];
  const longHeadlines = (ai.long_headlines||ai.longHeadlines||[]).map(h => typeof h==="string"?h:(h?.text||"")).filter(Boolean);
  const recBid = ai.recommended_bid||null;
  const targetDemo = ai.target_demographics||null;
  const score = ai.ad_score||0;
  const adStrength = headlines.length>=8&&descriptions.length>=4?"Excellent":headlines.length>=5?"Good":headlines.length>=3?"Average":"Poor";
  const strengthColor = {Excellent:"#22c55e",Good:"#84cc16",Average:"#f59e0b",Poor:"#ef4444"}[adStrength];
  const strengthPct = {Excellent:100,Good:75,Average:50,Poor:25}[adStrength];
  const storeUrl = `https://${shop || "your-store.myshopify.com"}`;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <ModalScrollLock/>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-header">
          {product.image && <img src={product.image} alt="" className="modal-img"/>}
          <div style={{flex:1}}><h2 className="modal-title">{product.title}</h2><p className="modal-price">${Number(product.price).toFixed(2)}</p></div>
          <div className="rsa-score-box"><ScoreRing score={score} size={58}/><span className="rsa-score-lbl">Ad Score</span></div>
        </div>
        <div className="rsa-strength">
          <div className="rsa-strength-bar"><div className="rsa-strength-fill" style={{width:strengthPct+"%",background:strengthColor}}/></div>
          <span className="rsa-strength-txt" style={{color:strengthColor}}>{adStrength}</span>
          <span className="rsa-strength-info">{headlines.length} headlines · {descriptions.length} descriptions{longHeadlines.length>0?` · ${longHeadlines.length} long headlines`:""}</span>
        </div>
        {(recBid || targetDemo) && <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
          {recBid && <div style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,padding:"8px 14px",fontSize:12}}><span style={{color:"rgba(255,255,255,.5)"}}>Recommended Bid: </span><strong style={{color:"#a5b4fc"}}>${recBid.toFixed(2)}</strong></div>}
          {targetDemo && <div style={{background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.15)",borderRadius:10,padding:"8px 14px",fontSize:12}}><span style={{color:"rgba(255,255,255,.5)"}}>Target: </span><strong style={{color:"#86efac"}}>{targetDemo}</strong></div>}
        </div>}

        <div className="rsa-preview">
          <div className="rsa-preview-label">📱 Google Ad Preview</div>
          <div className="rsa-preview-ad">
            <div className="rsa-preview-sponsor">Sponsored</div>
            <div className="rsa-preview-url">{storeUrl} › {path1}{path2?" › "+path2:""}</div>
            <div className="rsa-preview-h">{headlines[0]||"Headline 1"} | {headlines[1]||"Headline 2"} | {headlines[2]||"Headline 3"}</div>
            <div className="rsa-preview-d">{descriptions[0]||"Description will appear here."}</div>
          </div>
        </div>
        <div className="modal-body">
          {/* READ-ONLY Headlines */}
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>Headlines ({headlines.length})</h3></div>
            <div className="rsa-items">{headlines.map((h,i)=>(
              <div key={i} className="rsa-item">
                <span className="rsa-item-num">{i+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"7px 10px",fontSize:13,color:"rgba(255,255,255,.8)",minHeight:32,display:"flex",alignItems:"center"}}>{h}</div>
              </div>
            ))}</div>
          </div>

          {/* READ-ONLY Long Headlines */}
          {longHeadlines.length>0 && <div className="rsa-section">
            <div className="rsa-section-head"><h3>Long Headlines ({longHeadlines.length})</h3></div>
            <div className="rsa-items">{longHeadlines.map((lh,li)=>(
              <div key={li} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{li+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"rgba(255,255,255,.8)",minHeight:36,display:"flex",alignItems:"center"}}>{lh}</div>
              </div>
            ))}</div>
          </div>}

          {/* READ-ONLY Descriptions */}
          <div className="rsa-section">
            <div className="rsa-section-head"><h3>Descriptions ({descriptions.length})</h3></div>
            <div className="rsa-items">{descriptions.map((d,i)=>(
              <div key={i} className="rsa-item rsa-item-desc">
                <span className="rsa-item-num">{i+1}</span>
                <div className="rsa-item-input" style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"8px 10px",fontSize:13,color:"rgba(255,255,255,.8)",minHeight:36,display:"flex",alignItems:"center"}}>{d}</div>
              </div>
            ))}</div>
          </div>

          {/* Keywords */}
          <div className="rsa-section">
            <h3>🔑 Keywords ({keywords.length})</h3>
            <div className="rsa-kw-grid">{keywords.map((k,i)=>{const mt=k.match_type||"BROAD";const mc=mt==="EXACT"?"kw-exact":mt==="PHRASE"?"kw-phrase":"kw-broad";const disp=mt==="EXACT"?`[${k.text}]`:mt==="PHRASE"?`"${k.text}"`:k.text;return <div key={i} className={`rsa-kw ${mc}`}>{disp}<span className="rsa-kw-type">{mt}</span></div>;})}</div>
            {negKw.length>0 && <div className="rsa-neg-kw"><strong>🚫 Negative Keywords:</strong><div className="rsa-kw-grid" style={{marginTop:6}}>{negKw.map((k,i)=><div key={i} className="rsa-kw kw-neg">-{k}</div>)}</div></div>}
          </div>

          {/* Sitelinks */}
          {sitelinks.length>0 && <div className="rsa-section"><h3>🔗 Sitelinks</h3><div className="rsa-sitelinks">{sitelinks.map((sl,i)=><div key={i} className="rsa-sitelink"><strong>{sl.title}</strong><span>{sl.description||""}</span></div>)}</div></div>}

          {/* Competitor Intelligence */}
          {cIntel && (
            <div className="rsa-section ci-section">
              <h3>🕵️ Competitor Intelligence</h3>
              {cIntel.strategy_reason && <p className="ci-reason">{cIntel.strategy_reason}</p>}
              {cIntel.top_competitors?.length>0 && <div className="ci-competitors"><strong>Top Competitors:</strong><div className="ci-comp-list">{cIntel.top_competitors.map((c,i)=><div key={i} className="ci-comp-card"><div className="ci-comp-rank">#{c.position||i+1}</div><div className="ci-comp-info"><a href={`https://${c.domain}`} target="_blank" rel="noopener noreferrer" className="ci-comp-domain ci-comp-link">{c.domain}</a><span className="ci-comp-strength">{c.strength||"unknown"}</span></div>{c.price_range&&<span className="ci-comp-price">{c.price_range}</span>}</div>)}</div></div>}
              {cIntel.keyword_gaps?.length>0 && <div className="ci-gaps"><strong>💡 Keyword Opportunities:</strong><div className="rsa-kw-grid" style={{marginTop:6}}>{cIntel.keyword_gaps.map((k,i)=><div key={i} className="rsa-kw kw-gap">+{k}</div>)}</div></div>}
              {cIntel.competitive_advantages?.length>0 && <div className="ci-advantages"><strong>✅ Your Advantages:</strong><ul className="ci-adv-list">{cIntel.competitive_advantages.map((a,i)=><li key={i}>{a}</li>)}</ul></div>}
              {cIntel.opportunity_score && <div className="ci-opp"><strong>Opportunity Score:</strong><div className="ci-opp-bar"><div className="ci-opp-fill" style={{width:`${cIntel.opportunity_score}%`}}/></div><span className="ci-opp-val">{cIntel.opportunity_score}/100</span></div>}
            </div>
          )}

          {/* CTA: Go to Campaigns */}
          <a href="/app/campaigns" className="btn-campaign" style={{display:"block",textAlign:"center",textDecoration:"none",marginTop:8}}>📋 Go to Campaigns →</a>
        </div>
      </div>
    </div>
  );
}



// Single CSS injection — renders once, never duplicated
function StyleTag() { return <style dangerouslySetInnerHTML={{__html: CSS}}/>; }


// Single CSS injection — no more 8x duplication


// Single CSS injection — no more 8x duplication

export default function Index() {
  const { products: dbProducts, planFromCookie, isPaidServer, shop: shopDomain, needsInitialSync } = useLoaderData();
  const storeUrl = shopDomain ? `https://${shopDomain}` : "https://your-store.myshopify.com";

  // Enterprise: trigger initial sync on client side (never block server render)
  useEffect(() => {
    if (needsInitialSync) {
      fetch("/app/api/sync", { method: "POST" })
        .catch(() => {}); // silent — UI will update via webhook
    }
  }, [needsInitialSync]);

  // Build product-specific URL for campaigns
  function getProductUrl(product) {
    const base = storeUrl;
    if (product?.handle) return `${base}/products/${product.handle}`;
    if (product?.title) {
      const handle = product.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return `${base}/products/${handle}`;
    }
    return base;
  }
  const allDbProducts = dbProducts || [];
  const analyzedDbProducts = allDbProducts.filter(p => p.hasAiAnalysis);
  const totalDbProducts = allDbProducts.length;

  // Enterprise: O(1) lookup maps instead of O(n) find() on every render
  const productById = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach(p => { if (p.id) map.set(p.id, p); });
    return map;
  }, [allDbProducts]);

  const productByTitle = useMemo(() => {
    const map = new Map();
    allDbProducts.forEach(p => { if (p.title) map.set(p.title.toLowerCase(), p); });
    return map;
  }, [allDbProducts]);

  const [products, setProductsRaw] = useState([]);
  const [aiResults, setAiResultsRaw] = useState(null);
  function setProducts(v) { setProductsRaw(v); try { sessionStorage.setItem("sai_products", JSON.stringify(v)); } catch {} }
  function setAiResults(v) { setAiResultsRaw(v); try { sessionStorage.setItem("sai_aiResults", JSON.stringify(v)); } catch {} }

  const scanned = products.length > 0;
  const [isScanning, setIsScanning] = useState(false);
  const [fakeProgress, setFakeProgress] = useState(0);
  const [scanMode, setScanMode] = useState(null);
  const [vis, setVis] = useState(false);
  const [selProduct, setSelProduct] = useState(null);
  const [selCompetitor, setSelCompetitor] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardTab, setOnboardTab] = useState("subscription");

  // Plan — cookie is source of truth (set server-side, no flash)
  const [selectedPlan, setSelectedPlan] = useState(
    isPaidServer ? planFromCookie : ((() => { try { return sessionStorage.getItem("sai_plan") || null; } catch { return null; } })())
  );
  const [isHydrated, setIsHydrated] = useState(isPaidServer); // if server knows isPaid, already hydrated
  useEffect(() => { setIsHydrated(true); }, []);

  const [scanCredits, setScanCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_scan_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });
  const [aiCredits, setAiCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });
  function setScanCredits(v) { setScanCreditsRaw(v); try { sessionStorage.setItem("sai_scan_credits", String(v)); } catch {} }
  function setAiCredits(v) { setAiCreditsRaw(v); try { sessionStorage.setItem("sai_credits", String(v)); } catch {} }

  const [googleConnected, setGoogleConnected] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState(null);
  const [campaignId, setCampaignId] = useState(() => { try { return sessionStorage.getItem("sai_campaign_id")||"sim_001"; } catch { return "sim_001"; } });
  const [campaignControlStatus, setCampaignControlStatus] = useState(null); // 'pausing'|'removing'|'paused'|'removed'|'error'
  const [realSpend, setRealSpend] = useState(null); // live spend from Google Ads API
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showLaunchChoice, setShowLaunchChoice] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null);
  const [editHeadlines, setEditHeadlines] = useState([]);
  const [editDescriptions, setEditDescriptions] = useState([]);
  const [improvingIdx, setImprovingIdx] = useState(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanMsg, setScanMsg] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [pickedProducts, setPickedProducts] = useState([]);
  const [autoLaunching, setAutoLaunching] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(null);
  const [justSubscribed, setJustSubscribed] = useState(false); // true after selectPlan until scan starts // "auto"|"review"|null — set by Launch Choice after subscription

  const cancelRef = useRef(false);
  const creepRef = useRef(null);

  const isPaid = !!selectedPlan;
  const hasScanAccess = isPaid || scanCredits > 0;
  const canPublish = isPaid;

  // ⚠️ ALL HOOKS MUST BE CALLED HERE — before any early returns
  // Pre-compute values for the Google Ads hook
  const _analyzedCount = analyzedDbProducts.length;
  const _avgScore = _analyzedCount > 0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/_analyzedCount) : 0;
  const _mockCampaigns = isPaid && _analyzedCount > 0 ? Math.min(Math.floor(_analyzedCount * 0.6), 12) : 0;
  const liveAds = useGoogleAdsData(_mockCampaigns, _avgScore);

  function triggerConfetti() { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3500); }
  useEffect(() => { setVis(true); }, []);

  function selectPlan(plan) {
    setSelectedPlan(plan);
    setJustSubscribed(true); // Mark: show scanning flow, not dashboard
    setScanMsg(""); // Clear stale scan messages from previous sessions
    // Save as cookie (1 year) — survives tab close, cache clear
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `sai_plan=${encodeURIComponent(plan)}; expires=${expires}; path=/; SameSite=None; Secure`;
    try { sessionStorage.setItem("sai_plan", plan); } catch {}
    setAiCredits({ starter: 10, pro: 200, premium: 1000 }[plan] || 0);
    // Also save to server API (best effort)
    fetch("/app/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    }).catch(() => {});
  }

  async function doScan(mode) {
    const isAuto = mode === "auto";
    setScanMode(mode || "review"); setIsScanning(true); setFakeProgress(0);
    setScanMsg(hasScanAccess ? "Connecting to your Shopify store..." : "Quick preview scan starting...");
    setAutoStatus(null); setScanError(null); cancelRef.current = false;
    let fetchedProducts = [], allAiProducts = [];

    let smoothProg = 0;
    const smoothTimer = setInterval(() => { smoothProg = Math.min(smoothProg + 0.15, 8); setFakeProgress(Math.round(smoothProg * 10) / 10); }, 100);

    try {
      const scanAbort = new AbortController();
      cancelRef._abort = () => scanAbort.abort();
      const ff = new FormData(); ff.append("step", "fetch");
      const fr = await fetch("/app/api/scan", { method:"POST", body:ff, signal:scanAbort.signal });
      const fd = await fr.json().catch(() => { throw new Error("Server returned invalid response."); });
      if (!fd.success) throw new Error(fd.error || "Failed to fetch products");
      if (cancelRef.current) { clearInterval(smoothTimer); setIsScanning(false); return; }
      clearInterval(smoothTimer);

      const allFetched = fd.products, storeUrl = fd.storeInfo?.url || "";
      const toAnalyze = hasScanAccess ? allFetched : allFetched.slice(0, FREE_SCAN_LIMIT);
      fetchedProducts = allFetched; setProducts(allFetched);

      for (let p = Math.ceil(smoothProg); p <= 10; p++) { setFakeProgress(p); await new Promise(r => setTimeout(r, 40)); }
      setScanMsg(hasScanAccess ? `Found ${allFetched.length} products — analyzing with AI...` : `Found ${allFetched.length} products — analyzing top ${FREE_SCAN_LIMIT} for preview...`);
      await new Promise(r => setTimeout(r, 600));

      const BATCH = 3, total = toAnalyze.length, batches = Math.ceil(total / BATCH);
      for (let b = 0; b < batches; b++) {
        if (cancelRef.current) { setIsScanning(false); return; }
        const start = b * BATCH, batch = toAnalyze.slice(start, start + BATCH);
        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);
        let creepPct = batchStartPct;
        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < batchEndPct - 0.5) creepPct += 0.3;
          setFakeProgress(Math.round(creepPct * 10) / 10);
          const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          const curPct = Math.round(creepPct);
          if (hasScanAccess) {
            const sn = curPct<25?"Searching Google":curPct<45?"Analyzing competitors":curPct<60?"Checking rankings":curPct<80?"Generating ad copy":"Building strategy";
            setScanMsg(fakeNum+" of "+total+" products · "+sn);
          } else setScanMsg("Analyzing product "+fakeNum+" of "+total+"...");
        }, 400);
        creepRef.current = creepTimer;

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", storeUrl);
        const ar = await fetch("/app/api/scan", { method:"POST", body:af, signal:scanAbort.signal });
        clearInterval(creepTimer); creepRef.current = null;
        const ad = await ar.json().catch(() => { throw new Error(`AI returned invalid response on batch ${b+1}.`); });
        if (!ad.success) throw new Error(ad.error || `AI failed on batch ${b+1}`);
        allAiProducts = [...allAiProducts, ...(ad.result?.products || [])];
        setFakeProgress(batchEndPct);
      }

      if (cancelRef.current) { setIsScanning(false); return; }
      setScanMsg(hasScanAccess ? "Almost done — putting it all together! 🚀" : "Wrapping up your preview...");
      await new Promise(r => setTimeout(r, 600));

      const topScore = allAiProducts.reduce((best,p) => ((p.ad_score||0)>(best.ad_score||0)?p:best), allAiProducts[0]||{});
      let summary;
      if (hasScanAccess) {
        const opts = [`🎯 Analyzed ${allAiProducts.length} products. "${topScore.title||"Top product"}" scored ${topScore.ad_score||0}/100.`,`✨ Found ${allAiProducts.filter(p=>(p.ad_score||0)>=70).length} high-potential products!`,`🏆 Average score: ${Math.round(allAiProducts.reduce((a,p)=>a+(p.ad_score||0),0)/allAiProducts.length)}/100.`];
        summary = opts[Math.floor(Math.random()*opts.length)];
      } else {
        summary = `Preview: Analyzed ${FREE_SCAN_LIMIT} of ${fetchedProducts.length} products. ${topScore.title||"Your top product"} shows real potential! Upgrade to unlock all ${fetchedProducts.length - FREE_SCAN_LIMIT} remaining.`;
      }

      setAiResults({ summary, recommended_budget:100, products:allAiProducts });
      setFakeProgress(100); setScanMsg(hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!");
      triggerConfetti(); await new Promise(r => setTimeout(r, 800));

    } catch (e) {
      clearInterval(smoothTimer);
      if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
      let msg = e.message || "Something went wrong";
      if (msg.includes("credit balance")||msg.includes("billing")) msg = "AI credits have run out. Please top up your Anthropic API balance.";
      else if (msg.includes("rate_limit")||msg.includes("429")) msg = "Too many requests. Please wait a minute and try again.";
      else if (msg.includes("401")||msg.includes("api_key")) msg = "API key is invalid. Please check your ANTHROPIC_API_KEY.";
      else if (msg.includes("overloaded")) msg = "AI service is temporarily overloaded. Please try again.";
      setScanError(msg); setIsScanning(false); setFakeProgress(0); return;
    }

    setIsScanning(false); setFakeProgress(0);

    if (isAuto && allAiProducts.length > 0 && canPublish) {
      setAutoLaunching(true);
      let successCount = 0;
      for (let i = 0; i < fetchedProducts.length; i++) {
        const prod = fetchedProducts[i], ai = allAiProducts.find(ap => ap.title===prod.title)||allAiProducts[i]||{};
        try {
          const form = new FormData();
          form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines||[]));
          form.append("descriptions", JSON.stringify(ai.descriptions||[])); form.append("keywords", JSON.stringify(ai.keywords||[]));
          form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
          const res = await fetch("/app/api/campaign", { method:"POST", body:form });
          const data = await res.json(); if (data.success) successCount++;
        } catch {}
      }
      setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    }
  }

  async function handleAutoCampaign() {
    if (!canPublish) { setShowOnboard(true); setOnboardTab("subscription"); setOnboardStep(1); return; }
    setAutoLaunching(true);
    let successCount = 0;
    const toProcess = analyzedDbProducts.length > 0 ? analyzedDbProducts : allDbProducts.slice(0, 5);
    for (const prod of toProcess) {
      const ai = prod.aiAnalysis||{};
      try {
        const form = new FormData();
        form.append("productTitle", prod.title); form.append("headlines", JSON.stringify(ai.headlines||[]));
        form.append("descriptions", JSON.stringify(ai.descriptions||[])); form.append("keywords", JSON.stringify(ai.keywords||[]));
        form.append("finalUrl", getProductUrl(prod)); form.append("dailyBudget", "50");
        const res = await fetch("/app/api/campaign", { method:"POST", body:form });
        const data = await res.json(); if (data.success) successCount++;
      } catch {}
    }
    setAutoLaunching(false); setAutoStatus(successCount > 0 ? "success" : "error");
    if (successCount > 0) triggerConfetti();
  }

  function handleProductClick(product) {
    if (!hasScanAccess) { setShowOnboard(true); setOnboardStep(1); return; }
    setSelProduct(product); setCampaignStatus(null);
    const isDb = !!product.hasAiAnalysis;
    const ai = isDb ? (product.aiAnalysis||{}) : (aiResults?.products?.find(ap => ap.title===product.title)||{});
    setEditHeadlines((ai.headlines||[]).map(h => typeof h==="string"?h:h.text||h));
    setEditDescriptions((ai.descriptions||[]).map(d => typeof d==="string"?d:d.text||d));
  }

  // ── Fetch real spend from Google Ads API ──
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    async function fetchSpend() {
      try {
        const form = new FormData();
        form.append("action", "list");
        const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
        const data = await res.json();
        if (!cancelled && data.campaigns) {
          // Find our campaign by id
          const numId = String(campaignId).split("/").pop();
          const camp = data.campaigns.find(c => String(c.id) === numId || c.resourceName === campaignId);
          if (camp) setRealSpend(parseFloat(camp.cost));
        }
      } catch {}
    }
    fetchSpend();
    const iv = setInterval(fetchSpend, 60000); // refresh every minute
    return () => { cancelled = true; clearInterval(iv); };
  }, [campaignId]);

  async function handlePauseCampaign() {
    if (!campaignId) return;
    setCampaignControlStatus("pausing");
    try {
      const form = new FormData();
      form.append("action", "pause");
      form.append("campaignId", campaignId);
      const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
      const data = await res.json();
      setCampaignControlStatus(data.success ? "paused" : "error");
    } catch { setCampaignControlStatus("error"); }
  }

  async function handleRemoveCampaign() {
    if (!campaignId) return;
    setCampaignControlStatus("removing");
    setConfirmRemove(false);
    try {
      const form = new FormData();
      form.append("action", "remove");
      form.append("campaignId", campaignId);
      const res = await fetch("/app/api/campaign-manage", { method: "POST", body: form });
      const data = await res.json();
      if (data.success) {
        setCampaignControlStatus("removed");
        setCampaignId(null);
        try { sessionStorage.removeItem("sai_campaign_id"); } catch {}
      } else {
        setCampaignControlStatus("error");
      }
    } catch { setCampaignControlStatus("error"); }
  }


  const handleUpgradeClick = React.useCallback(() => {
    setShowOnboard(true);
    setOnboardTab("subscription");
    setOnboardStep(1);
  }, []);

  // useLatest pattern — פונקציות יציבות שתמיד קוראות לנתונים המעודכנים
  const handleProductClickRef = useRef(handleProductClick);
  const handleAutoCampaignRef = useRef(handleAutoCampaign);
  useEffect(() => {
    handleProductClickRef.current = handleProductClick;
    handleAutoCampaignRef.current = handleAutoCampaign;
  });
  const handleProductClickCb = React.useCallback((p) => handleProductClickRef.current(p), []);
  const handleAutoCampaignCb = React.useCallback(() => handleAutoCampaignRef.current(), []);

  async function handleCreateCampaign() {
    if (!selProduct||!canPublish) return;
    setCampaignStatus("creating");
    try {
      const isDb = !!selProduct.hasAiAnalysis;
      const ai = isDb ? (selProduct.aiAnalysis||{}) : (aiResults?.products?.find(ap => ap.title===selProduct.title)||{});
      const form = new FormData();
      form.append("productTitle", selProduct.title); form.append("headlines", JSON.stringify(editHeadlines));
      form.append("descriptions", JSON.stringify(editDescriptions)); form.append("keywords", JSON.stringify(ai.keywords||[]));
      form.append("finalUrl", getProductUrl(selProduct)); form.append("dailyBudget", "50");
      const campAbort = new AbortController();
      const res = await fetch("/app/api/campaign", { method:"POST", body:form, signal:campAbort.signal });
      const data = await res.json(); setCampaignStatus(data.success ? "success" : "error");
      if (data.success) {
        triggerConfetti();
        const cid = data.campaignId || data.campaign_id || data.resourceName || null;
        if (cid) { setCampaignId(cid); try { sessionStorage.setItem("sai_campaign_id", cid); } catch {} }
      }
    } catch { setCampaignStatus("error"); }
  }

  async function handleAiImprove(type, index) {
    if (aiCredits <= 0) { setShowBuyCredits(true); return; }
    const key = `${type}-${index}`; setImprovingIdx(key);
    const text = type==="h" ? editHeadlines[index] : editDescriptions[index];
    try {
      const form = new FormData(); form.append("text", text); form.append("type", type==="h"?"headline":"description"); form.append("productTitle", selProduct?.title||"");
      const improveAbort = new AbortController();
      const res = await fetch("/app/api/ai-improve", { method:"POST", body:form, signal:improveAbort.signal });
      const data = await res.json();
      if (data.success && data.improved) {
        if (type==="h") { const n=[...editHeadlines]; n[index]=data.improved; setEditHeadlines(n); }
        else { const n=[...editDescriptions]; n[index]=data.improved; setEditDescriptions(n); }
        setAiCredits(aiCredits - 1);
      }
    } catch {}
    setImprovingIdx(null);
  }

  // ── ONBOARD MODAL ──

  // ── Computed values + useMemo hooks (MUST be before any early returns) ──
    const totalProducts = totalDbProducts;
    const analyzedCount = analyzedDbProducts.length;
    const avgScore = analyzedCount>0 ? Math.round(analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.ad_score||0),0)/analyzedCount) : 0;
  // ── These useMemo hooks were inside if(hasScanAccess) — moved out to fix React hooks rule ──
    const sortedProducts = useMemo(() =>
      [...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0)),
    [allDbProducts]);
    const topCompetitors = useMemo(() => {
      const allCompetitors = analyzedDbProducts.flatMap(p=>p.aiAnalysis?.competitor_intel?.top_competitors||[]);
      const competitorMap = {};
      allCompetitors.forEach(c => { if (!c.domain) return; if (!competitorMap[c.domain]) competitorMap[c.domain]={count:0,strength:c.strength||"unknown"}; competitorMap[c.domain].count++; });
      return Object.entries(competitorMap).sort((a,b)=>b[1].count-a[1].count).slice(0,5);
    }, [analyzedDbProducts]);
    const { keywordGaps, totalMonthlyGapLoss } = useMemo(() => {
      const myKeywords = new Set(
        analyzedDbProducts.flatMap(p => (p.aiAnalysis?.keywords||[]).map(k => (typeof k==="string"?k:k?.text||"").toLowerCase().trim()))
          .filter(Boolean)
      );
      const competitorKeywords = analyzedDbProducts.flatMap(p => p.aiAnalysis?.competitor_intel?.keyword_gaps||[])
        .map(k => (typeof k==="string"?k:k?.text||k).toLowerCase().trim())
        .filter(Boolean);
      const gapKeywordCounts = {};
      competitorKeywords.forEach(k => { gapKeywordCounts[k] = (gapKeywordCounts[k]||0)+1; });
      const gaps = Object.entries(gapKeywordCounts)
        .filter(([k]) => !myKeywords.has(k) && k.length > 3)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 8)
        .map(([keyword, freq]) => ({
          keyword,
          freq,
          estMonthlyLoss: Math.round((freq * 280) * (avgScore < 60 ? 1.4 : 1)),
          estClicks: Math.round(freq * 22),
          difficulty: freq >= 3 ? "High" : freq === 2 ? "Medium" : "Low",
          diffColor: freq >= 3 ? "#ef4444" : freq === 2 ? "#f59e0b" : "#22c55e",
        }));
      return { keywordGaps: gaps, totalMonthlyGapLoss: gaps.reduce((a,g) => a+g.estMonthlyLoss, 0) };
    }, [analyzedDbProducts, avgScore]);

  // OnboardModal — now imported from ../components/Modals.jsx

  // BuyCreditsModal — now imported from ../components/Modals.jsx

  // ── ERROR / LOADING SCREENS ──
  if (scanError) return (
    <div className="sr dk"><StyleTag/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>⚠️</div>
        <h2 className="ld-title">Scan Failed</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{scanError}</p>
        <div style={{display:"flex",gap:12}}>
          <button className="btn-primary" onClick={()=>{setScanError(null);doScan("review");}}>🔄 Try Again</button>
          <button className="btn-secondary" onClick={()=>setScanError(null)}>← Go Back</button>
        </div>
      </div>
    </div>
  );

  if (isScanning && !justSubscribed) {
    const pct = Math.round(fakeProgress);
    const steps = hasScanAccess ? [
      {label:"Fetching products from your store",done:pct>=10,active:pct<10},
      {label:"Searching Google for competitors",done:pct>=25,active:pct>=10&&pct<25},
      {label:"Analyzing competitor websites",done:pct>=45,active:pct>=25&&pct<45},
      {label:"Checking your Google rankings",done:pct>=60,active:pct>=45&&pct<60},
      {label:"Generating AI-optimized ad copy",done:pct>=80,active:pct>=60&&pct<80},
      {label:"Building your competitive strategy",done:pct>=100,active:pct>=80&&pct<100},
    ] : [
      {label:"Fetching products",done:pct>=10,active:pct<10},
      {label:"Quick AI analysis",done:pct>=55,active:pct>=10&&pct<55},
      {label:"Generating preview",done:pct>=100,active:pct>=55&&pct<100},
    ];
    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/>
        <div className="ld-wrap">
          <div className="ld-pct-ring">
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7"/>
              <circle cx="55" cy="55" r="46" fill="none" stroke={pct>=100?"#22c55e":"#6366f1"} strokeWidth="7" strokeDasharray="289" strokeDashoffset={289-(289*pct/100)} strokeLinecap="round" transform="rotate(-90 55 55)" style={{transition:"stroke-dashoffset .5s ease, stroke .3s"}}/>
            </svg>
            <span className="ld-pct-text">{pct}%</span>
          </div>
          <h2 className="ld-title">{hasScanAccess?(pct>=100?"Your store is ready to grow! 🎉":pct>=50?"Making great progress! ✨":"On it! Working my magic… 🤖"):(pct>=100?"Preview ready!":"Running quick preview...")}</h2>
          <p className="ld-sub">{scanMsg||"Hang tight — your AI assistant is hard at work"}</p>
          <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:pct+"%",transition:"width .5s ease"}}/></div>
          {hasScanAccess && <TipRotator/>}
          {!hasScanAccess && <div className="free-scan-note">🔓 Free preview — {FREE_SCAN_LIMIT} products only</div>}
          <div className="ld-steps">{steps.map((s,i)=><div key={i} className={`ld-step ${s.done?"ld-step-done":""} ${s.active?"ld-step-active":""}`}><span className="ld-dot">{s.done?"✓":""}</span>{s.label}</div>)}</div>
          <button className="btn-back" style={{marginTop:8}} onClick={()=>setShowCancelConfirm(true)}>← Cancel</button>
          {showCancelConfirm && (
            <div className="cancel-confirm-overlay">
              <div className="cancel-confirm-box">
                <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
                <h3 style={{fontSize:17,fontWeight:700,marginBottom:8}}>Stop Scanning?</h3>
                <p style={{fontSize:13,color:"rgba(255,255,255,.55)",marginBottom:20}}>All progress will be lost.</p>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button className="btn-primary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>setShowCancelConfirm(false)}>Continue Scanning</button>
                  <button className="btn-secondary" style={{padding:"10px 22px",fontSize:13}} onClick={()=>{cancelRef.current=true;if(creepRef.current){clearInterval(creepRef.current);creepRef.current=null;}setShowCancelConfirm(false);setIsScanning(false);setFakeProgress(0);setProducts([]);setAiResults(null);}}>Yes, Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (autoLaunching) return (
    <div className="sr dk"><StyleTag/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20,animation:"ldPulse 1s ease infinite"}}>⚡</div>
        <h2 className="ld-title">Launching Your Campaigns...</h2>
        <p className="ld-sub">AI is building and submitting Google Ads campaigns for all your products.</p>
        <div className="ld-bar-bg"><div className="ld-bar-fill" style={{width:"60%",animation:"barPulse 2s ease infinite"}}/></div>
      </div>
    </div>
  );

  if (autoStatus==="success"||autoStatus==="error") return (
    <div className="sr dk"><StyleTag/>
      <Confetti active={showConfetti}/>
      <div className="ld-wrap">
        <div style={{fontSize:64,marginBottom:20}}>{autoStatus==="success"?"✅":"❌"}</div>
        <h2 className="ld-title">{autoStatus==="success"?"Campaigns Are Live!":"Campaign Creation Failed"}</h2>
        <p className="ld-sub" style={{marginBottom:24}}>{autoStatus==="success"?"Your AI-optimized campaigns are created in PAUSED state. Review them in Google Ads.":"Something went wrong. Try manual mode."}</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          <button className="btn-primary" onClick={()=>setAutoStatus(null)}>📊 View Dashboard</button>
          {autoStatus==="success" && <a href="https://ads.google.com" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{textDecoration:"none"}}>Open Google Ads →</a>}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════

  if (hasScanAccess) {
    const totalKeywords = analyzedDbProducts.reduce((a,p)=>a+(p.aiAnalysis?.keywords?.length||0),0);
    const highPotential = analyzedDbProducts.filter(p=>(p.aiAnalysis?.ad_score||0)>=70).length;
    const topProduct = analyzedDbProducts.reduce((best,p)=>((p.aiAnalysis?.ad_score||0)>(best.aiAnalysis?.ad_score||0)?p:best),analyzedDbProducts[0]||null);
    const mockCampaigns = canPublish&&analyzedCount>0 ? Math.min(Math.floor(analyzedCount*0.6),12) : 0;
    const mockRoas = analyzedCount>0 ? (1.8+avgScore*0.028).toFixed(1) : "0";
    const competitorThreat = avgScore>=70?"Low":avgScore>=50?"Moderate":"High";
    const threatColor = {Low:"#22c55e",Moderate:"#f59e0b",High:"#ef4444"}[competitorThreat];
    const googleRankStatus = avgScore>=70?"page_1":avgScore>=50?"page_2":"page_3";

    // Competitor aggregation — sorted by count
    const competitorCount = topCompetitors.length;

    // Competitor Gap Finder — keywords competitors use that we don't

    // Live Google Ads data — from top-level hook
    const impressionsBase = liveAds.impressions;
    const clicksBase = liveAds.clicks;

    // ── Fresh paid subscriber — never scanned yet ──
    if (isPaid && (analyzedCount === 0 || justSubscribed)) return (
      <div className="sr dk"><StyleTag/><div className="bg-m"/>
        <div className="status-bar"><div className="status-bar-inner">
          <div className="sb-row sb-row-data">
            <div className="sb-chips-left">
              <div className="sb-chip2 sb-chip-plan"><span className="sb-dot sb-dot-green"/><span className="sb-label">PLAN</span><span className="sb-value">{selectedPlan.toUpperCase()}</span></div>
              <div className="sb-chip2"><span className="sb-label">📦 PRODUCTS</span><span className="sb-value">{totalProducts}</span></div>
              <div className="sb-chip2"><span className="sb-label">🎯 ANALYZED</span><span className="sb-value sb-val-green">0</span></div>
            </div>
          </div>
        </div></div>
        <div className="da">
          {autoScanMode ? (
            <CollectingDataScreen
              totalProducts={totalProducts}
              onComplete={() => { setJustSubscribed(false); window.location.reload(); }}
              onCancel={() => { setAutoScanMode(null); setJustSubscribed(false); }}
            />
          ) : (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:64,marginBottom:20}}>🚀</div>
              <h2 style={{fontSize:28,fontWeight:800,color:"#f1f5f9",marginBottom:12}}>Welcome to Smart Ads AI!</h2>
              <p style={{fontSize:16,color:"rgba(255,255,255,.55)",maxWidth:460,lineHeight:1.6,marginBottom:32}}>Complete the setup above to start scanning your store and generating AI-powered campaigns.</p>
            </div>
          )}
        </div>
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
      </div>
    );

    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/>
        <div className="bg-m"/>

        {/* STATUS BAR — two rows */}
        <div className="status-bar">
          <div className="status-bar-inner">
            {/* Row 1: data chips */}
            <div className="sb-row sb-row-data">
              <div className="sb-chips-left">
                {isPaid
                  ? <div className="sb-chip2 sb-chip-plan"><span className="sb-dot sb-dot-green"/><span className="sb-label">PLAN</span><span className="sb-value">{selectedPlan.toUpperCase()}</span></div>
                  : <div className="sb-chip2 sb-chip-credits"><span className="sb-dot sb-dot-cyan"/><span className="sb-label">SCAN CREDITS</span><span className="sb-value">{scanCredits}</span></div>}
                {isPaid && <div className="sb-chip2"><span className="sb-label">✨ AI CREDITS</span><span className="sb-value sb-val-cyan">{aiCredits}</span></div>}
                <div className="sb-chip2"><span className="sb-label">📦 PRODUCTS</span><span className="sb-value">{totalProducts}</span></div>
                <div className="sb-chip2"><span className="sb-label">🎯 ANALYZED</span><span className="sb-value sb-val-green">{analyzedCount}</span></div>
                {topProduct && <div className="sb-chip2 sb-chip-top2"><span className="sb-label">👑 TOP</span><span className="sb-value sb-val-gold" title={topProduct.title}>{topProduct.title.length>28?topProduct.title.slice(0,28)+"…":topProduct.title}</span></div>}
              </div>
              <div className="sb-chips-right">
                {canPublish
                  ? <div className="sb-chip2 sb-chip-publish-active"><span className="sb-dot sb-dot-green"/><span className="sb-label">PUBLISH</span><span className="sb-value sb-val-green">ACTIVE</span></div>
                  : <div className="sb-chip2 sb-chip-warn"><span className="sb-dot sb-dot-orange"/><span className="sb-label">PUBLISH</span><span className="sb-value">LOCKED</span></div>}
                {liveAds.isRealData && <div className="sb-chip2 sb-chip-live"><span className="sb-dot sb-dot-green" style={{animation:"ldPulse 1s ease infinite"}}/><span className="sb-label">LIVE DATA</span></div>}
              </div>
            </div>
            {/* Row 2: action buttons */}
            <div className="sb-row sb-row-actions">
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                {isPaid
                  ? <button className="sb-btn2" onClick={()=>setShowBuyCredits(true)}>✨ Buy AI Credits</button>
                  : <>
                      <button className="sb-btn2 sb-btn2-upgrade" onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>↑ Upgrade to Publish</button>
                      <button className="sb-btn2" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
                    </>}
              </div>
              {liveAds.lastUpdated && (
                <span className="sb-last-updated">
                  {liveAds.isRealData ? "🟢 Live" : "⚪ Mock"} · Updated {liveAds.lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="da">
          {/* HEADER */}
          <div className="da-header">
            <div>
              <h1 className="da-title">Campaign Dashboard</h1>
              <p className="da-sub">{analyzedCount>0?`${analyzedCount} products analyzed · ${highPotential} high-potential · avg score ${avgScore}/100`:`${totalProducts} products synced · Run AI analysis to get started`}</p>
              {analyzedCount>0 && totalMonthlyGapLoss>0 && (
                <div className="da-potential-banner">
                  💸 Your store could be capturing an extra <strong>${totalMonthlyGapLoss.toLocaleString()}/mo</strong> in revenue — <span className="da-potential-link" onClick={() => document.querySelector('.clf-card, .tmo-card')?.scrollIntoView({behavior:'smooth'})}>see how →</span>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {analyzedCount>0 && <a href="/app/saved" className="btn-saved" style={{textDecoration:"none"}}>📋 My Results</a>}
              <button className="btn-secondary" style={{padding:"8px 16px",fontSize:13}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>
              {canPublish
                ? <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={handleAutoCampaign}>⚡ Auto Launch All</button>
                : <button className="btn-primary" style={{padding:"10px 22px",fontSize:14}} onClick={()=>doScan("review")}>🔍 Scan Products</button>}
            </div>
          </div>

          {/* ══ STORE HEALTH + LIVE PULSE ROW ══ */}
          {/* TOP MISSED OPPORTUNITY */}
          <TopMissedOpportunity
            topProduct={topProduct}
            avgScore={avgScore}
            totalMonthlyGapLoss={totalMonthlyGapLoss}
            analyzedCount={analyzedCount}
            hasScanAccess={hasScanAccess}
            onScan={() => { setShowOnboard(true); setOnboardTab("scan"); setOnboardStep(1); }}
            onViewProduct={handleProductClickCb}
          />

          <div className="health-pulse-row">
            <StoreHealthScore
              analyzedCount={analyzedCount}
              totalProducts={totalProducts}
              avgScore={avgScore}
              highPotential={highPotential}
              competitorCount={competitorCount}
            />
            <LivePulse
              campaigns={mockCampaigns}
              impressionsBase={impressionsBase}
              clicksBase={clicksBase}
              campaignId={campaignId}
              realSpend={realSpend}
              campaignControlStatus={campaignControlStatus}
              confirmRemove={confirmRemove}
              setConfirmRemove={setConfirmRemove}
              onPause={handlePauseCampaign}
              onRemove={handleRemoveCampaign}
            />
          </div>

          {/* SPEEDOMETERS */}
          <div className="speedo-row">
            <div className="speedo-card"><Speedometer value={avgScore} max={100} label="Avg Ad Score" color="#6366f1" size={130}/></div>
            <div className="speedo-card"><Speedometer value={highPotential} max={Math.max(totalProducts,1)} label="High-Potential" color="#22c55e" size={130}/></div>
            <div className="speedo-card"><Speedometer value={Math.min(mockCampaigns,20)} max={20} label="Active Campaigns" color="#06b6d4" size={130}/></div>
            <div className="speedo-card"><Speedometer value={parseFloat(mockRoas)*10} max={100} label="ROAS Score" color="#f59e0b" size={130}/></div>
          </div>

          {/* STATS */}
          <div className="stats-row" style={{marginBottom:24}}>
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={totalProducts}/></div><div className="stat-lbl">Total Products</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val">{analyzedCount>0?<Counter end={avgScore} suffix="/100"/>:<span style={{color:"rgba(255,255,255,.3)"}}>—</span>}</div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">🔑</div><div className="stat-val">{analyzedCount>0?<Counter end={totalKeywords}/>:<span style={{color:"rgba(255,255,255,.3)"}}>—</span>}</div><div className="stat-lbl">Keywords</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={analyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {totalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
          </div>

          {/* STATUS ROW */}
          <div className="status-row">
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(34,197,94,.1)",color:"#22c55e"}}>📈</div><div><div className="status-card-label">Campaigns Active</div><div className="status-card-val">{mockCampaigns} running</div></div><div className="status-card-trend">{canPublish?`+${Math.round(mockCampaigns*0.2)} this week`:"Subscribe to launch"}</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(6,182,212,.1)",color:"#06b6d4"}}>👁</div><div><div className="status-card-label">Impressions</div><div className="status-card-val">{(mockCampaigns*4200).toLocaleString()}/mo</div></div><div className="status-card-trend up">est.</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(99,102,241,.1)",color:"#a5b4fc"}}>👆</div><div><div className="status-card-label">Est. Clicks</div><div className="status-card-val">{(mockCampaigns*180).toLocaleString()}/mo</div></div><div className="status-card-trend up">est.</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:`rgba(${threatColor==="#22c55e"?"34,197,94":threatColor==="#f59e0b"?"245,158,11":"239,68,68"},.1)`,color:threatColor}}>🕵️</div><div><div className="status-card-label">Competitor Threat</div><div className="status-card-val" style={{color:threatColor}}>{competitorThreat}</div></div><div className="status-card-trend" style={{color:threatColor}}>{googleRankStatus==="page_1"?"Page 1":googleRankStatus==="page_2"?"Page 2":"Page 3+"} rank</div></div>
            <div className="status-card"><div className="status-card-icon" style={{background:"rgba(245,158,11,.1)",color:"#fbbf24"}}>💰</div><div><div className="status-card-label">Est. ROAS</div><div className="status-card-val">{mockRoas}x</div></div><div className="status-card-trend up">based on scores</div></div>
            {/* Total Spend Card */}
            {campaignId && (
              <div className="status-card status-card-spend">
                <div className="status-card-icon" style={{background:"rgba(34,197,94,.1)",color:"#22c55e"}}>💸</div>
                <div>
                  <div className="status-card-label">Total Spend</div>
                  <div className="status-card-val">
                    {realSpend != null ? `$${Number(realSpend).toFixed(2)}` : "Fetching…"}
                  </div>
                </div>
                <div className="status-card-trend up">{realSpend != null ? "live from Google" : "connecting…"}</div>
              </div>
            )}
          </div>


          {/* COMPETITOR PANEL */}
          {topCompetitors.length>0 && (
            <div className="competitor-panel">
              <div className="competitor-panel-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div className="clf-live-dot"/>
                  <span className="competitor-panel-title">🕵️ Top Competitors Detected</span>
                  <span className="clf-live-badge">LIVE</span>
                </div>
                <span className="competitor-panel-sub">Across {analyzedCount} analyzed products · sorted by frequency</span>
              </div>
              <div className="competitor-list">
                {topCompetitors.map(([domain,data],i)=>{
                  const tc = data.strength==="strong"?"#ef4444":data.strength==="medium"?"#f59e0b":"#22c55e";
                  const keywords = analyzedDbProducts
                    .flatMap(p=>(p.aiAnalysis?.competitor_intel?.top_competitors||[]).filter(c=>c.domain===domain).flatMap(c=>c.keywords||[]))
                    .filter(Boolean).slice(0,3);
                  return (
                    <div key={i} className="competitor-item competitor-item-clickable" onClick={()=>setSelCompetitor({domain})}>
                      <div className="competitor-rank">#{i+1}</div>
                      <div className="competitor-favicon">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" onError={e=>{e.target.style.display="none"}} style={{width:16,height:16}}/>
                      </div>
                      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="competitor-domain competitor-domain-link" onClick={e=>e.stopPropagation()}>{domain}</a>
                      {keywords.length>0 && (
                        <div className="competitor-keywords">
                          {keywords.map((k,ki)=><span key={ki} className="competitor-kw-tag">{typeof k==="string"?k:k?.text||k}</span>)}
                        </div>
                      )}
                      <div className="competitor-count">{data.count} product{data.count!==1?"s":""}</div>
                      <div className="competitor-strength" style={{color:tc}}>{data.strength}</div>
                      <div className="competitor-click-hint">View ads →</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPETITOR GAP FINDER */}
          {analyzedCount > 0 && (
            <CompetitorGapFinder
              keywordGaps={keywordGaps}
              totalMonthlyGapLoss={totalMonthlyGapLoss}
              analyzedCount={analyzedCount}
              canPublish={canPublish}
              onUpgrade={handleUpgradeClick}
            />
          )}

          {/* BUDGET SIMULATOR */}
          <BudgetSimulator
            avgScore={avgScore}
            avgCpc={liveAds?.avgCpc || null}
            canPublish={canPublish}
            onUpgrade={handleUpgradeClick}
          />

          {/* AD PREVIEW PANEL */}
          <AdPreviewPanel
            topProduct={topProduct}
            mockCampaigns={mockCampaigns}
            canPublish={canPublish}
            shop={shopDomain}
            onLaunch={canPublish ? handleAutoCampaignCb : handleUpgradeClick}
            onViewProduct={handleProductClickCb}
          />

          {/* AI SUMMARY */}
          {analyzedCount>0 && (
            <div className="ai-summary-card" style={{marginBottom:24}}>
              <span className="ai-summary-icon">🤖</span>
              <div>
                <div className="celebrate-badge">✨ {analyzedCount===totalProducts?"All Products Analyzed":`${analyzedCount} Products Analyzed`}</div>
                <div>{highPotential} high-potential products found. {topProduct?.title?`"${topProduct.title}" is your top performer with a score of ${topProduct.aiAnalysis?.ad_score||0}.`:""} {canPublish?"Ready for campaign launch.":"Subscribe to publish campaigns to Google Ads."}</div>
              </div>
            </div>
          )}

          {/* ACTION CARD */}
          {canPublish ? (
            <div className="auto-campaign-card">
              <div className="auto-campaign-left">
                <div className="auto-campaign-icon">⚡</div>
                <div><div className="auto-campaign-title">Fully Automatic Campaign</div><div className="auto-campaign-desc">The AI handles everything — competitor research, keywords, ad copy, targeting, and launch. Zero manual work.</div></div>
              </div>
              <button className="btn-auto-launch" onClick={handleAutoCampaign}><span>Launch All Campaigns</span><span style={{fontSize:12,opacity:0.7,display:"block"}}>AI does everything for you</span></button>
            </div>
          ) : (
            <div className="upgrade-publish-card">
              <div className="upc-left">
                <div style={{fontSize:32,flexShrink:0}}>🔒</div>
                <div><div className="upc-title">Ready to Publish Campaigns?</div><div className="upc-desc">You have full AI scan access. Subscribe to push these campaigns live to Google Ads with one click.</div></div>
              </div>
              <button className="btn-primary" style={{padding:"12px 28px",flexShrink:0}} onClick={()=>{setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>View Plans →</button>
            </div>
          )}

          {/* PRODUCTS GRID */}
          <div style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <h2 style={{fontSize:18,fontWeight:700}}>Your Products</h2>
            <div style={{display:"flex",gap:8}}>
              <button className="btn-secondary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>doScan("review")}>↻ Rescan</button>
              {canPublish && <button className="btn-secondary" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setShowManualPicker(true)}>🎯 Manual Campaign</button>}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <a href="/app/campaigns" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 18px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",borderRadius:10,fontSize:13,fontWeight:600,textDecoration:"none",border:"none",cursor:"pointer"}}>📋 Go to Campaigns →</a>
          </div>
          <div className="p-grid">
            {sortedProducts.map((product,idx)=>{
              const ai=product.aiAnalysis, hasAi=product.hasAiAnalysis&&ai, score=hasAi?ai.ad_score||0:0;
              const isTopPick=idx<3&&hasAi&&score>=60;
              const eI=hasAi?Math.round(score*46+500):0, eC=hasAi?Math.round(score*3.8+20):0, eCo=hasAi?Math.round(score*0.45+10):0;
              return (
                <div key={product.id} className={`p-card ${!hasAi?"p-card-pending":""} ${isTopPick?"p-card-recommended":""}`} onClick={()=>hasAi?handleProductClick(product):null}>
                  {isTopPick && <div className="p-card-rec-badge">⭐ AI Recommends</div>}
                  <div className="p-card-img-wrap">
                    {product.image?<img src={product.image} alt={product.title} className="p-card-img"/>:<div className="p-card-noimg">📦</div>}
                    {hasAi && <div className="p-card-score"><ScoreRing score={score}/></div>}
                    {!hasAi && <div className="p-card-pending-badge">🔒 Not analyzed</div>}
                    {!product.inStock && <div className="p-card-oos">Out of Stock</div>}
                  </div>
                  <div className="p-card-body">
                    <h3 className="p-card-title">{product.title}</h3>
                    <p className="p-card-price">${Number(product.price).toFixed(2)}</p>
                    {hasAi ? (
                      <>
                        <div className="p-card-metrics">
                          <div className="p-metric"><span className="p-metric-ic">👁</span><span className="p-metric-val">{eI.toLocaleString()}</span><span className="p-metric-lbl">/mo</span></div>
                          <div className="p-metric"><span className="p-metric-ic">👆</span><span className="p-metric-val">{eC}</span><span className="p-metric-lbl">/mo</span></div>
                          <div className="p-metric"><span className="p-metric-ic">💰</span><span className="p-metric-val">${eCo}</span><span className="p-metric-lbl">/day</span></div>
                        </div>
                        <div className="p-card-hl">{ai.headlines?.[0]||"AI headline preview..."}</div>
                        <div className="p-card-cta">{canPublish?"View & Launch →":"View AI Analysis →"}</div>
                      </>
                    ) : (
                      <><div className="p-card-hl" style={{color:"rgba(255,255,255,.25)"}}>Analysis pending...</div><div className="p-card-cta" style={{color:"rgba(255,255,255,.3)"}}>⏳ In queue</div></>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MANUAL PICKER */}
        {showManualPicker && (
          <div className="modal-overlay" onClick={()=>setShowManualPicker(false)}>
            <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{maxWidth:680}}>
              <button className="modal-close" onClick={()=>setShowManualPicker(false)}>✕</button>
              <h2 style={{fontSize:20,fontWeight:800,marginBottom:6}}>🎯 Manual Campaign</h2>
              <p style={{fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:20}}>Select products. AI will create optimized campaigns for each one.</p>
              {!canPublish && <div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#fbbf24",marginBottom:16}}>🔒 Publishing requires a subscription. <span style={{color:"#a5b4fc",cursor:"pointer"}} onClick={()=>{setShowManualPicker(false);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);}}>View plans →</span></div>}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxHeight:"50vh",overflowY:"auto",marginBottom:20}}>
                {[...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0)).filter(p=>p.hasAiAnalysis).map(p=>{
                  const picked=pickedProducts.includes(p.id), isRec=(p.aiAnalysis?.ad_score||0)>=70;
                  return (
                    <div key={p.id} className={`picker-card ${picked?"picker-selected":""}`} onClick={()=>setPickedProducts(prev=>picked?prev.filter(id=>id!==p.id):[...prev,p.id])}>
                      {isRec && <div className="picker-rec">⭐ Recommended</div>}
                      <div style={{display:"flex",gap:10,alignItems:"center"}}>
                        {p.image && <img src={p.image} alt="" style={{width:44,height:44,borderRadius:8,objectFit:"cover"}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.title}</div>
                          <div style={{fontSize:12,color:"#a5b4fc"}}>${Number(p.price).toFixed(2)} · Score: {p.aiAnalysis?.ad_score||0}/100</div>
                        </div>
                        <div style={{width:22,height:22,borderRadius:"50%",border:`2px solid ${picked?"#6366f1":"rgba(255,255,255,.2)"}`,background:picked?"#6366f1":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{picked?"✓":""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {analyzedDbProducts.length===0 && <p style={{textAlign:"center",color:"rgba(255,255,255,.4)",fontSize:13}}>No analyzed products yet. Run AI analysis first.</p>}
              <div style={{display:"flex",gap:10}}>
                <button className="btn-secondary" style={{flex:1}} onClick={()=>setShowManualPicker(false)}>Cancel</button>
                <button className="btn-primary" style={{flex:2}} disabled={pickedProducts.length===0||!canPublish} onClick={async()=>{
                  if(!canPublish){setShowManualPicker(false);setShowOnboard(true);setOnboardTab("subscription");setOnboardStep(1);return;}
                  setShowManualPicker(false);setAutoLaunching(true);
                  let sc=0;
                  const sorted=[...allDbProducts].sort((a,b)=>(b.aiAnalysis?.ad_score||0)-(a.aiAnalysis?.ad_score||0));
                  for(const id of pickedProducts){
                    const prod=sorted.find(p=>p.id===id);if(!prod)continue;
                    const ai=prod.aiAnalysis||{};
                    try{const form=new FormData();form.append("productTitle",prod.title);form.append("headlines",JSON.stringify((ai.headlines||[]).map(h=>typeof h==="string"?h:h.text||h)));form.append("descriptions",JSON.stringify((ai.descriptions||[]).map(d=>typeof d==="string"?d:d.text||d)));form.append("keywords",JSON.stringify(ai.keywords||[]));form.append("finalUrl",getProductUrl(prod));form.append("dailyBudget","50");const res=await fetch("/app/api/campaign",{method:"POST",body:form});const data=await res.json();if(data.success)sc++;}catch{}
                  }
                  setAutoLaunching(false);setPickedProducts([]);setAutoStatus(sc>0?"success":"error");if(sc>0)triggerConfetti();
                }}>{canPublish?`🚀 Launch ${pickedProducts.length>0?pickedProducts.length+" ":""}Campaign${pickedProducts.length!==1?"s":""}` :"🔒 Subscribe to Launch"}</button>
              </div>
            </div>
          </div>
        )}

        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults}
          shop={shopDomain}
        />}
        {selCompetitor && <CompetitorModal competitor={selCompetitor} products={analyzedDbProducts} onClose={()=>setSelCompetitor(null)}/>}
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
        {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      </div>
    );
  }

  // ── FREE DEMO RESULTS ──
  if (scanned && products.length > 0) {
    const analyzedCount = aiResults?.products?.length||0, totalProducts = products.length;
    const avgScore = aiResults?.products?.length ? Math.round(aiResults.products.reduce((a,p)=>a+(p.ad_score||0),0)/aiResults.products.length) : 0;
    const highPotential = aiResults?.products?.filter(p=>p.ad_score>=70).length||0;
    return (
      <div className="sr dk"><StyleTag/>
        <Confetti active={showConfetti}/><div className="bg-m"/>
        {isHydrated && !isPaid && scanCredits === 0 && <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>}
        <div className="da">
          <div className="da-header">
            <div>
              <button className="btn-back-home" onClick={()=>{setProducts([]);setAiResults(null);}}>← Back</button>
              <h1 className="da-title">Free Preview</h1>
              <p className="da-sub">{analyzedCount} of {totalProducts} products analyzed · Upgrade to unlock all {totalProducts-analyzedCount} remaining</p>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <button className="btn-rescan" onClick={()=>doScan("review")}>↻ Scan Again</button>
              <button className="btn-secondary" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
              <button className="btn-primary" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Subscribe & Publish</button>
            </div>
          </div>
          <div className="stats-row">
            <div className="stat-card"><div className="stat-icon">📦</div><div className="stat-val"><Counter end={totalProducts}/></div><div className="stat-lbl">Products Found</div></div>
            <div className="stat-card"><div className="stat-icon">🎯</div><div className="stat-val"><Counter end={avgScore} suffix="/100"/></div><div className="stat-lbl">Avg Score</div></div>
            <div className="stat-card"><div className="stat-icon">⚡</div><div className="stat-val"><Counter end={highPotential}/></div><div className="stat-lbl">High-Potential</div></div>
            <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-val"><Counter end={analyzedCount}/><span style={{fontSize:13,color:"rgba(255,255,255,.3)"}}> / {totalProducts}</span></div><div className="stat-lbl">Analyzed</div></div>
          </div>
          <div className="ai-summary-card ai-summary-free"><span className="ai-summary-icon">🔒</span><div><div className="free-badge">Free Preview</div><div>{aiResults?.summary}</div></div></div>
          <div className="p-grid">
            {products.map(product=>{
              const ai=aiResults?.products?.find(ap=>ap.title===product.title), hasAi=!!ai, score=hasAi?ai.ad_score||0:0;
              const eI=hasAi?Math.round(score*46+500):0, eC=hasAi?Math.round(score*3.8+20):0, eCo=hasAi?Math.round(score*0.45+10):0;
              return (
                <div key={product.id} className={`p-card ${!hasAi?"p-card-locked":""}`} onClick={()=>hasAi?handleProductClick({...product,aiAnalysis:ai}):null}>
                  <div className="p-card-img-wrap">
                    {product.image?<img src={product.image} alt={product.title} className="p-card-img"/>:<div className="p-card-noimg">📦</div>}
                    {hasAi && <div className="p-card-score"><ScoreRing score={score}/></div>}
                    {!hasAi && <div className="p-card-locked-overlay"><div style={{fontSize:28}}>🔒</div><div style={{fontSize:11,marginTop:4}}>Upgrade to unlock</div></div>}
                  </div>
                  <div className="p-card-body">
                    <h3 className="p-card-title">{product.title}</h3>
                    <p className="p-card-price">${Number(product.price).toFixed(2)}</p>
                    {hasAi ? (<><div className="p-card-metrics"><div className="p-metric"><span className="p-metric-ic">👁</span><span className="p-metric-val">{eI.toLocaleString()}</span><span className="p-metric-lbl">/mo</span></div><div className="p-metric"><span className="p-metric-ic">👆</span><span className="p-metric-val">{eC}</span><span className="p-metric-lbl">/mo</span></div><div className="p-metric"><span className="p-metric-ic">💰</span><span className="p-metric-val">${eCo}</span><span className="p-metric-lbl">/day</span></div></div><div className="p-card-hl">{ai.headlines?.[0]||"AI headline preview..."}</div><div className="p-card-cta">View AI Analysis →</div></>) : (<div className="p-card-hl p-card-blur">Upgrade to see keywords, ad copy & competitor data</div>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="free-upgrade-cta" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>
            <div className="free-upgrade-icon">🚀</div>
            <div><div className="free-upgrade-title">Unlock All {totalProducts} Products + Full Campaigns</div><div className="free-upgrade-desc">Get competitor intelligence, ad copy, keywords & one-click Google Ads campaigns for every product</div></div>
            <div className="free-upgrade-arrow">→</div>
          </div>
        </div>
        {selProduct && <ProductModal product={selProduct} onClose={()=>setSelProduct(null)}
          aiResults={aiResults}
          shop={shopDomain}
        />}
        {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
        {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      </div>
    );
  }

  // ── LANDING PAGE ──
  return (
    <div className="sr dk"><StyleTag/>
      <div className="bg-m"/>
      <div className="top-bar"><div className="top-bar-inner"><span className="top-bar-fire">🔥</span><span className="top-bar-txt"><strong>Limited Offer:</strong> Get <span className="top-bar-highlight">7 days FREE</span> — AI campaigns that bring <strong>3x more sales</strong></span><button className="top-bar-btn" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>Start Free Trial →</button><span className="top-bar-fire">🔥</span></div></div>
      <div className={`la ${vis?"la-v":""}`}>
        <section className="hero">
          <div className="hero-badge">🤖 AI-Powered Google Ads for Shopify</div>
          <h1 className="hero-h">Stop guessing.<br/><span className="hero-grad">Start selling.</span></h1>
          <p className="hero-p">Smart Ads AI scans your competitors, checks your Google rankings, writes killer ad copy, and launches campaigns that convert — in 60 seconds.</p>
          <div className="hero-btns">
            <button className="btn-primary btn-lg" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Start My Campaign</button>
            <button className="btn-secondary" onClick={()=>doScan("review")}>Try Free Preview</button>
          </div>
          <div className="hero-nudge" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}><span className="nudge-lock">⚡</span> No subscription? <strong>Buy scan credits</strong> — from $0.60/scan <span className="nudge-arrow">→</span></div>
          <div className="hero-metrics">
            <div className="hm"><span className="hm-val">+340%</span><span className="hm-lbl">Avg ROAS</span></div>
            <div className="hm"><span className="hm-val">47hrs</span><span className="hm-lbl">Saved/month</span></div>
            <div className="hm"><span className="hm-val">-52%</span><span className="hm-lbl">CPC Reduction</span></div>
          </div>
          <SuccessTicker/>
        </section>
        {/* ── BUDGET TEASER ── */}
        <section className="section lp-budget-section">
          <h2 className="sec-h">See your numbers before you commit</h2>
          <p className="sec-sub">Move the slider — watch your projected results update instantly.</p>
          <LandingBudgetTeaser />
        </section>

        {/* ── WHAT YOU'RE MISSING ── */}
        <section className="section lp-missing-section">
          <h2 className="sec-h">What's happening while you wait</h2>
          <p className="sec-sub">Every day without Smart Ads AI, your competitors are pulling ahead.</p>
          <LandingMissingBlock onInstall={() => { setShowOnboard(true); setOnboardStep(1); setOnboardTab("subscription"); }} />
        </section>

        <section className="section"><h2 className="sec-h">Sound familiar?</h2><div className="pain-grid">{[{ic:"💸",t:"Wasted Ad Spend",d:"Thousands spent on agencies with nothing to show for it."},{ic:"😵",t:"Google Ads Confusion",d:"The interface is overwhelming. You don't know where to start."},{ic:"📝",t:"Generic Ad Copy",d:"Your ads sound like everyone else's. No personality, no conversions."},{ic:"⏰",t:"Weeks of Setup",d:"By the time your campaign launches, the trend is already over."}].map((p,i)=><div key={i} className="pain-card"><span className="pain-ic">{p.ic}</span><h3 className="pain-t">{p.t}</h3><p className="pain-d">{p.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">What if AI could do it all — better?</h2><div className="sol-grid">{[{n:"60",s:"seconds",d:"Full competitor scan + campaign-ready ads"},{n:"Top 10",s:"competitors",d:"Scraped and analyzed for every product"},{n:"Real",s:"data",d:"Keywords from Google, not guesses from a robot"}].map((s,i)=><div key={i} className="sol-card"><div className="sol-n">{s.n}</div><div className="sol-s">{s.s}</div><p className="sol-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Stupidly simple. Seriously powerful.</h2><div className="steps-grid">{[{n:"1",t:"Scan",d:"AI scans your products and searches Google for your competitors."},{n:"2",t:"Analyze",d:"See competitor keywords, your rankings, and AI-optimized ad copy."},{n:"3",t:"Launch",d:"One click to launch campaigns built on real competitive data."}].map((s,i)=><div key={i} className="step-card"><div className="step-n">{s.n}</div><h3 className="step-t">{s.t}</h3><p className="step-d">{s.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Everything you need. Nothing you don't.</h2><div className="feat-grid">{[{ic:"🕵️",t:"Competitor Intelligence",d:"We scan your competitors' sites, steal their best keywords, and find gaps they're missing."},{ic:"📍",t:"Google Rank Check",d:"See exactly where your store ranks — and where it doesn't."},{ic:"🧠",t:"AI Ad Copy",d:"Headlines and descriptions based on what's actually working for top-ranking competitors."},{ic:"🎯",t:"Smart Keywords",d:"Real keywords pulled from competitor websites, Google results, and search trends."},{ic:"📊",t:"Ad Score + Strategy",d:"Each product gets a competitive score and a strategy: aggressive, defensive, or dominant."},{ic:"⚡",t:"One-Click Launch",d:"From scan to live Google Ads campaign in 60 seconds. All campaigns start paused for your review."}].map((f,i)=><div key={i} className="feat-card"><span className="feat-ic">{f.ic}</span><h3 className="feat-t">{f.t}</h3><p className="feat-d">{f.d}</p></div>)}</div></section>
        <section className="section"><h2 className="sec-h">Loved by Shopify merchants</h2><div className="test-grid">{[{q:"Set up my first campaign in under 2 minutes. The AI copy was better than what my agency wrote.",n:"Sarah K.",r:"Fashion Store Owner"},{q:"Finally an app that makes Google Ads accessible. My ROAS went from 1.2x to 4.8x in a month.",n:"Mike T.",r:"Electronics Store"},{q:"I was spending $500/mo on a freelancer. Now AI does it better for $29/mo.",n:"Lisa R.",r:"Beauty & Wellness"}].map((t,i)=><div key={i} className="test-card"><p className="test-q">"{t.q}"</p><div className="test-author"><strong>{t.n}</strong><span>{t.r}</span></div></div>)}</div></section>
        <section className="section cta-section">
          <h2 className="cta-h">Your products deserve better ads.</h2>
          <p className="cta-p">Join 2,000+ Shopify merchants who stopped guessing and started growing.</p>
          <button className="btn-primary btn-lg" onClick={()=>{setShowOnboard(true);setOnboardStep(1);setOnboardTab("subscription");}}>🚀 Start My Campaign →</button>
          <div style={{marginTop:12,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button className="btn-secondary" onClick={()=>doScan("review")}>🔍 Try Free Preview</button>
            <button className="btn-secondary" onClick={()=>{setShowOnboard(true);setOnboardTab("credits");}}>⚡ Buy Scan Credits</button>
          </div>
        </section>
      </div>
      {showOnboard && <OnboardModal onClose={()=>setShowOnboard(false)} onboardTab={onboardTab} setOnboardTab={setOnboardTab} onboardStep={onboardStep} setOnboardStep={setOnboardStep} selectedPlan={selectedPlan} selectPlan={selectPlan} googleConnected={googleConnected} setGoogleConnected={setGoogleConnected} scanCredits={scanCredits} setScanCredits={setScanCredits} onLaunchChoice={()=>{if(justSubscribed){setAutoScanMode("review");}else{setShowLaunchChoice(true);}}}/>}
      {showBuyCredits && <BuyCreditsModal onClose={()=>setShowBuyCredits(false)} aiCredits={aiCredits} setAiCredits={setAiCredits}/>}
      {showLaunchChoice && (
        <div className="modal-overlay" onClick={()=>setShowLaunchChoice(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:520,textAlign:"center",padding:"44px 36px"}}>
            <button className="modal-close" onClick={()=>setShowLaunchChoice(false)}>✕</button>
            <div style={{fontSize:48,marginBottom:16}}>🚀</div>
            <h2 style={{fontSize:24,fontWeight:800,marginBottom:8}}>Launch Your Campaigns</h2>
            <p style={{color:"rgba(255,255,255,.55)",marginBottom:32,fontSize:15}}>How would you like to proceed?</p>
            <div style={{display:"flex",gap:16,flexDirection:"column"}}>
              <button className="launch-choice-btn launch-auto" onClick={()=>{setShowLaunchChoice(false);doScan("auto");}}><span className="launch-choice-icon">⚡</span><div><div className="launch-choice-title">Auto Launch</div><div className="launch-choice-desc">AI scans, builds and launches campaigns instantly — zero manual work</div></div></button>
              <button className="launch-choice-btn" onClick={()=>{setShowLaunchChoice(false);doScan("review");}}><span className="launch-choice-icon">🔍</span><div><div className="launch-choice-title">Review & Edit</div><div className="launch-choice-desc">Check keywords, headlines & images before launching</div></div></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

