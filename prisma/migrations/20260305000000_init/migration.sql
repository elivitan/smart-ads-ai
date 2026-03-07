-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "handle" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "price" TEXT NOT NULL DEFAULT '0',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "inventoryTotal" INTEGER NOT NULL DEFAULT 0,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "productType" TEXT NOT NULL DEFAULT '',
    "vendor" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "shopifyUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "adScore" INTEGER NOT NULL DEFAULT 0,
    "adStrength" TEXT NOT NULL DEFAULT 'AVERAGE',
    "headlines" TEXT NOT NULL DEFAULT '[]',
    "longHeadlines" TEXT DEFAULT '[]',
    "descriptions" TEXT NOT NULL DEFAULT '[]',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "negativeKeywords" TEXT NOT NULL DEFAULT '[]',
    "path1" TEXT NOT NULL DEFAULT 'Shop',
    "path2" TEXT NOT NULL DEFAULT '',
    "recommendedBid" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "targetDemographics" TEXT NOT NULL DEFAULT '',
    "sitelinks" TEXT NOT NULL DEFAULT '[]',
    "competitorIntel" TEXT NOT NULL DEFAULT '{}',
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productHash" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "productsAffected" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSubscription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "scanCredits" INTEGER NOT NULL DEFAULT 0,
    "aiCredits" INTEGER NOT NULL DEFAULT 0,
    "maxProducts" INTEGER NOT NULL DEFAULT 3,
    "maxCampaigns" INTEGER NOT NULL DEFAULT 0,
    "scanCountToday" INTEGER NOT NULL DEFAULT 0,
    "lastScanAt" TIMESTAMP(3),
    "apiCallsToday" INTEGER NOT NULL DEFAULT 0,
    "rateLimitReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialEndsAt" TIMESTAMP(3),
    "billingStartedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignJob" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL DEFAULT '',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "stepsJson" TEXT NOT NULL DEFAULT '[]',
    "googleCampaignId" TEXT,
    "lastError" TEXT,
    "lastStepAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_shop_idx" ON "Session"("shop");

-- CreateIndex
CREATE INDEX "Product_shop_idx" ON "Product"("shop");

-- CreateIndex
CREATE INDEX "Product_shop_inStock_idx" ON "Product"("shop", "inStock");

-- CreateIndex
CREATE INDEX "Product_shop_status_idx" ON "Product"("shop", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnalysis_productId_key" ON "AiAnalysis"("productId");

-- CreateIndex
CREATE INDEX "AiAnalysis_shop_idx" ON "AiAnalysis"("shop");

-- CreateIndex
CREATE INDEX "AiAnalysis_productId_idx" ON "AiAnalysis"("productId");

-- CreateIndex
CREATE INDEX "AiAnalysis_shop_adScore_idx" ON "AiAnalysis"("shop", "adScore");

-- CreateIndex
CREATE INDEX "SyncLog_shop_idx" ON "SyncLog"("shop");

-- CreateIndex
CREATE INDEX "SyncLog_shop_type_idx" ON "SyncLog"("shop", "type");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSubscription_shop_key" ON "ShopSubscription"("shop");

-- CreateIndex
CREATE INDEX "ShopSubscription_shop_idx" ON "ShopSubscription"("shop");

-- CreateIndex
CREATE INDEX "ShopSubscription_plan_idx" ON "ShopSubscription"("plan");

-- CreateIndex
CREATE INDEX "CampaignJob_shop_idx" ON "CampaignJob"("shop");

-- CreateIndex
CREATE INDEX "CampaignJob_shop_state_idx" ON "CampaignJob"("shop", "state");

-- CreateIndex
CREATE INDEX "CampaignJob_idempotencyKey_idx" ON "CampaignJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CampaignJob_state_createdAt_idx" ON "CampaignJob"("state", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

