# Smart Ads AI — Architecture Rules
# ══════════════════════════════════════════════════
# EVERY SESSION MUST READ THIS FILE BEFORE TOUCHING CODE.
# Last updated: Session 17 (March 2026)
# ══════════════════════════════════════════════════

## IRON RULE #1: Never Inline What's Been Extracted
If a component lives in `components/`, `hooks/`, or `utils/`, it stays there.  
**Never copy it back into `app._index.jsx`.** The monolith regression from S14→S15  
(1,479 → 3,586 lines) must never happen again.

## IRON RULE #2: All Hooks Before Early Returns
Inside `export default function Index()`, every `useState`, `useEffect`, `useRef`,  
`useMemo`, `useCallback`, and custom hook MUST appear before the first `if (...) return`.  
Violating this causes "Rendered more hooks than during the previous render" crash.

## IRON RULE #3: Commit Before Every Change
Run `git add -A && git commit -m "checkpoint before <description>"` before starting  
any modification. If something breaks: `git stash` or `git checkout -- <file>`.

## IRON RULE #4: Terminal Only for File Operations
All file moves, renames, copies, and edits via terminal commands.  
Never ask the user to drag/rename/move files in File Explorer.  
PowerShell pattern for patches:
```
Set-Content -Path "C:\Users\אלי\smart-ads-ai-backup\fix.cjs" -Encoding UTF8 -Value @'
...code...
'@
node fix.cjs
```

## IRON RULE #5: Two Verifications Before Delivery
Every code change must pass TWO checks before being given to the user:
1. Hook safety (all hooks before early returns, no conditional hooks)
2. Syntax balance (braces, parentheses, JSX div tags all balanced)

## IRON RULE #6: Slider CSS Never Changes
```css
.budget-sim-slider { z-index: 9999; touch-action: none; user-select: none; }
.budget-sim-input-row { z-index: 9999; touch-action: none; }
```
Removing or reducing these breaks sliders in Shopify's embedded iframe.

---

## File Architecture (Target State)

```
app/
├── routes/
│   ├── app._index.jsx              (< 1,100 lines — ONLY orchestration logic)
│   ├── app.campaigns.jsx           (campaign management page)
│   ├── styles.index.js             (ALL CSS — never inline CSS in app._index.jsx)
│   ├── MarketAlert.jsx             (market intelligence widget)
│   ├── StoreAnalytics.jsx          (store analytics widget)
│   ├── CollectingDataScreen.jsx    (scanning animation)
│   └── ...api routes...
│
├── components/
│   ├── Modals.jsx                  (OnboardModal + BuyCreditsModal)
│   ├── CompetitorModal.jsx         (competitor detail modal)
│   ├── CompetitorGapFinder.jsx     (keyword gap analysis)
│   ├── AdPreviewPanel.jsx          (ad preview + launch)
│   ├── ProductModal.jsx            (product detail modal)
│   ├── LandingComponents.jsx       (LandingBudgetTeaser + LandingMissingBlock)
│   ├── dashboard/
│   │   ├── StoreHealthScore.jsx
│   │   ├── LivePulse.jsx
│   │   ├── TopMissedOpportunity.jsx
│   │   ├── BudgetSimulator.jsx
│   │   └── index.js                (barrel export)
│   └── ui/
│       └── SmallWidgets.jsx        (Counter, ScoreRing, Speedometer,
│                                    TipRotator, Confetti, SuccessTicker,
│                                    ModalScrollLock)
│
├── hooks/
│   └── useGoogleAdsData.js         (Google Ads data polling)
│
└── utils/
    ├── calculations.js
    ├── config.js
    └── normalizeStrategy.js
```

## Required Imports in app._index.jsx
If ANY of these imports are missing, the app is broken:
```js
import { CSS } from "./styles.index.js";
import { Counter, ScoreRing, Speedometer, TipRotator, Confetti, SuccessTicker, ModalScrollLock } from "../components/ui/SmallWidgets.jsx";
import { CollectingDataScreen } from "./CollectingDataScreen.jsx";
import { AdPreviewPanel } from "../components/AdPreviewPanel.jsx";
import { CompetitorModal } from "../components/CompetitorModal.jsx";
import { CompetitorGapFinder } from "../components/CompetitorGapFinder.jsx";
import { StoreHealthScore, LivePulse, TopMissedOpportunity, BudgetSimulator } from "../components/dashboard/index.js";
import { LandingBudgetTeaser, LandingMissingBlock } from "../components/LandingComponents.jsx";
import { ProductModal } from "../components/ProductModal.jsx";
import { MarketAlert } from "./MarketAlert.jsx";
import { StoreAnalyticsWidget } from "./StoreAnalytics.jsx";
import { OnboardModal, BuyCreditsModal } from "../components/Modals.jsx";
import { useGoogleAdsData } from "../hooks/useGoogleAdsData.js";
```

## Session Checklist (Do This FIRST Every Session)
1. Read this ARCHITECTURE.md
2. Run `wc -l app/routes/app._index.jsx` — if > 1,200 lines, something was inlined
3. Run `grep "^import" app/routes/app._index.jsx` — verify all imports above exist
4. Run `git log --oneline -5` — know what the last session did
5. Commit a checkpoint before starting work

## Known Open Issues
- Bug: "Rendered more hooks" on subscription purchase (selectPlan setState batching)
- Bug: Free user scanning uses old UI (CollectingDataScreen only for justSubscribed)
- Bug: Pause dialog animation continues ~100ms
- Bug: sessionStorage SSR hydration hazard (lines using sessionStorage in useState init)
