# Smart Ads AI — Architecture Rules
# EVERY SESSION MUST READ THIS FILE BEFORE TOUCHING CODE.
# Last updated: Session 17

## IRON RULE #1: Never Inline What's Been Extracted
If a component lives in components/, hooks/, or utils/, it stays there.
Never copy it back into app._index.jsx.

## IRON RULE #2: All Hooks Before Early Returns
Inside Index(), every hook MUST appear before the first if (...) return.

## IRON RULE #3: Commit Before Every Change
git add -A && git commit -m "checkpoint before <description>"

## IRON RULE #4: Terminal Only for File Operations

## IRON RULE #5: Two Verifications Before Delivery
1. Hook safety  2. Syntax balance (braces, parens, divs)

## IRON RULE #6: Slider CSS Never Changes
.budget-sim-slider: z-index:9999, touch-action:none, user-select:none
.budget-sim-input-row: z-index:9999, touch-action:none

## Required Imports in app._index.jsx
CSS, Counter/ScoreRing/Speedometer, TipRotator/Confetti/SuccessTicker,
CollectingDataScreen, AdPreviewPanel, CompetitorModal, CompetitorGapFinder,
StoreHealthScore/TopMissedOpportunity/BudgetSimulator, LivePulse,
LandingBudgetTeaser/LandingMissingBlock, ProductModal, MarketAlert,
StoreAnalyticsWidget, OnboardModal/BuyCreditsModal, useGoogleAdsData,
getSubscriptionInfo

## Session Checklist
1. Read ARCHITECTURE.md
2. wc -l app/routes/app._index.jsx (if > 1,300 = regression)
3. grep "^import" app/routes/app._index.jsx (verify all imports)
4. git log --oneline -5
5. Commit checkpoint
