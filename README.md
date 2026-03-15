# Smart Ads AI — AI Ad Agency OS for Shopify + Google Ads

> The first **autonomous AI ad agency** that replaces 90%+ of traditional ad agency work.
> AI manages end-to-end: products, creative, bidding, profit optimization, and zero-click campaign orchestration.

## What Makes This Unique

- **Deep Shopify data** (COGS, inventory, reviews, supply chain) + Google Ads API integration
- **18 AI engines** working in concert as a multi-agent system
- **Profit-first bidding** — optimizes for net profit, not vanity ROAS
- **Self-evolving AI** — learns from every decision and improves autonomously
- **Cross-store intelligence** — anonymous benchmarks across the network

## Architecture

```
Shopify Store Data                    Google Ads API
(Products, Inventory,          (Campaigns, Keywords,
 Orders, Reviews, COGS)         Bids, Search Terms)
         |                              |
         v                              v
    +------------------------------------+
    |        Smart Ads AI Brain          |
    |   (Claude AI + Custom Algorithms)  |
    +------------------------------------+
         |              |              |
    +--------+    +---------+    +--------+
    |Learning|    |Execution|    |Analysis|
    | Layer  |    |  Layer  |    | Layer  |
    +--------+    +---------+    +--------+
    |            |              |
    v            v              v
 Self-Evolving  Campaign     Performance
 Rules Engine   Optimizer    Insurance
```

## 18 AI Engines

### Core Intelligence (Engines 1-10)
| # | Engine | What It Does |
|---|--------|-------------|
| 1 | Self-Evolving AI | Learns from past decisions, generates rules |
| 2 | Ad Creative DNA | Extracts winning ad patterns, generates mutations |
| 3 | Profit Intelligence | Net profit per click, Monte Carlo simulation |
| 4 | Inventory-Aware Ads | Stock-based campaign throttling/boosting |
| 5 | Competitor Spend Estimator | Estimates competitor ad budgets |
| 6 | Buyer Psychology | Emotional triggers and psychology-optimized copy |
| 7 | Predictive Engine | Sales forecasting, what-if scenarios |
| 8 | Cross-Store Intelligence | Anonymous industry benchmarks |
| 9 | Landing Page Optimizer | Ad-to-page alignment scoring |
| 10 | Full Funnel Orchestrator | Zero-click campaign setup |

### Advanced Intelligence (Engines 11-18)
| # | Engine | What It Does |
|---|--------|-------------|
| 11 | Digital Twin Simulator | 1,000 Monte Carlo scenarios before spending |
| 12 | Multi-Agent Bidding | 3 AI agents debate budget, CEO decides |
| 13 | Weather & Event Arbitrage | Real-time weather/holiday campaign triggers |
| 14 | Review-to-Creative | Customer voice injected into ad copy |
| 15 | Flash Sale Engine | Synchronized price drops + bid spikes |
| 16 | Silent Profit Sentinel | Hourly search term waste detection |
| 17 | Performance Insurance | Auto-pause losing campaigns |
| 18 | Supply Chain Ads | Shipment-aware campaign orchestration |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Shopify Polaris |
| Backend | Node.js + React Router v7 (TypeScript) |
| Database | PostgreSQL (Supabase) + Prisma ORM |
| AI | Anthropic Claude (Sonnet + Haiku) |
| Ads | Google Ads API (GAQL) |
| Scheduler | node-cron (20+ automated jobs) |
| Platform | Shopify Embedded App |

## Automated Scheduler (20 Jobs)

| Schedule | Job |
|----------|-----|
| Every 6h | Campaign optimization for all shops |
| Every 2h | Search term sentinel scan |
| Every 4h | Performance guard check |
| Every 6h | Weather arbitrage check |
| Every 1h | Flash sale expiry check |
| Daily 01:00 | Funnel budget rebalance |
| Daily 03:00 | Recommendation outcome check |
| Daily 05:00 | Inventory scan + throttle/boost |
| Twice daily | Supply chain status check |
| Weekly Sun 02:00 | Deep competitor scan |
| Weekly Sun 04:00 | AI self-reflection |
| Weekly Sun 05:00 | Ad DNA analysis |
| Weekly Sun 08:00 | Weekly report generation |
| Weekly Mon 09:00 | Forecast accuracy check |
| Weekly Mon 10:00 | Agent bidding session |
| Weekly Wed 06:00 | Review-to-creative extraction |
| Weekly Sat 23:00 | Cross-store aggregation |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in: DATABASE_URL, SHOPIFY_API_KEY, ANTHROPIC_API_KEY, GOOGLE_ADS_*

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

## Project Structure

```
app/
  ai-brain.server.ts          # Core AI brain (Engines 1, 2, 7, 9)
  profit-intel.server.ts       # Engine 3: Profit Intelligence
  inventory-ads.server.ts      # Engine 4: Inventory-Aware Ads
  competitor-intel.server.ts   # Engine 5: Competitor Spend
  buyer-psychology.server.ts   # Engine 6: Buyer Psychology
  cross-store.server.ts        # Engine 8: Cross-Store Intelligence
  funnel-orchestrator.server.ts # Engine 10: Full Funnel
  digital-twin.server.ts       # Engine 11: Digital Twin
  agent-bidding.server.ts      # Engine 12: Multi-Agent Bidding
  weather-arbitrage.server.ts  # Engine 13: Weather Arbitrage
  review-creative.server.ts    # Engine 14: Review-to-Creative
  flash-sale.server.ts         # Engine 15: Flash Sales
  search-sentinel.server.ts    # Engine 16: Search Sentinel
  performance-guard.server.ts  # Engine 17: Performance Guard
  supply-chain.server.ts       # Engine 18: Supply Chain
  google-ads.server.ts         # Google Ads API integration
  shopify.server.ts            # Shopify authentication
  routes/                      # 30+ API endpoints
  components/
    DashboardView.tsx           # Main dashboard (14 widget blocks)
    dashboard/
      EngineWidgets.tsx         # Widgets for Engines 1-10
      AdvancedEngineWidgets.tsx # Widgets for Engines 11-18
      ProactiveAlerts.tsx       # 25+ alert types
  utils/
    optimizer.server.ts         # Campaign optimization loop
    optimizer-scheduler.server.ts # 20 automated cron jobs
prisma/
  schema.prisma                # 36 database models
```

## Database Models (36)

Core: Session, Product, AiAnalysis, SyncLog, ShopSubscription, CampaignJob, AiPromptLog, OptimizationLog, UserState, StoreProfile

Intelligence: CompetitorSnapshot, CompetitorProfile, CompetitorChange, OptimizerLearning, OptimizationRecommendation, KeywordGapAnalysis, ABTest, WeeklyReport

AI Engines (10): AiReflection, AdCreativeDNA, ProfitAnalysis, InventoryAlert, CompetitorSpendEstimate, BuyerPsychology, SalesForecast, CrossStoreInsight, LandingPageAudit, FunnelOrchestration

Advanced Engines (8): DigitalTwinSimulation, AgentBiddingSession, WeatherEventTrigger, ReviewCreativeInsight, FlashSaleEvent, SearchTermSentinel, PerformanceGuard, SupplyChainSignal

## Status (March 2026)

- 18 AI engines fully implemented
- 36 Prisma database models
- 30+ API endpoints
- 14 dashboard widgets with real-time data
- 25+ proactive alert types
- 20 automated scheduler jobs
- Shopify Embedded App ready for App Store

## License

Proprietary - All rights reserved.
