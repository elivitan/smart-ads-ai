-- CreateTable
CREATE TABLE "ShopSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "scanCredits" INTEGER NOT NULL DEFAULT 0,
    "aiCredits" INTEGER NOT NULL DEFAULT 0,
    "maxProducts" INTEGER NOT NULL DEFAULT 3,
    "maxCampaigns" INTEGER NOT NULL DEFAULT 0,
    "scanCountToday" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" DATETIME,
    "apiCallsToday" INTEGER NOT NULL DEFAULT 0,
    "rateLimitReset" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" DATETIME,
    "billingStartedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSubscription_shop_key" ON "ShopSubscription"("shop");

-- CreateIndex
CREATE INDEX "ShopSubscription_shop_idx" ON "ShopSubscription"("shop");

-- CreateIndex
CREATE INDEX "ShopSubscription_plan_idx" ON "ShopSubscription"("plan");
