@echo off
REM Run this from C:\Users\אלי\smart-ads-ai-backup
REM Creates a ZIP with all files needed for Session 12

cd "C:\Users\אלי\smart-ads-ai-backup"

powershell -Command "Compress-Archive -Path @('app\routes\app.campaigns.jsx', 'app\routes\app._index.jsx', 'app\routes\app.api.ai-engine.js', 'app\routes\app.api.market-intel.js', 'app\routes\app.api.campaign-manage.js', 'app\routes\app.api.campaign.js', 'app\routes\app.api.scan.js', 'app\routes\app.api.ai-improve.js', 'app\routes\app.api.keywords.js', 'app\routes\app.api.subscription.js', 'app\routes\MarketAlert.jsx', 'app\ai-brain.server.js', 'app\ai.server.js', 'app\competitor-intel.server.js', 'app\market-intel.server.js', 'app\keyword-research.server.js', 'app\prompts.server.js', 'app\license.server.js', 'app\campaignLifecycle.server.js', 'app\google-ads.server.js', 'app\db.server.js', 'app\retry.server.js', 'app\components\campaigns\shared.jsx', 'app\components\campaigns\GoogleAdsPreview.jsx', 'app\components\campaigns\CampaignWizard.jsx') -DestinationPath 'smart-ads-session12-files.zip' -Force"

echo.
echo ZIP created: smart-ads-session12-files.zip
echo Upload this + SESSION-12-BRIEF.md to the next session
