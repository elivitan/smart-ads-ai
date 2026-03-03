-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AiAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "adScore" INTEGER NOT NULL DEFAULT 0,
    "adStrength" TEXT NOT NULL DEFAULT 'AVERAGE',
    "headlines" TEXT NOT NULL DEFAULT '[]',
    "descriptions" TEXT NOT NULL DEFAULT '[]',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "negativeKeywords" TEXT NOT NULL DEFAULT '[]',
    "path1" TEXT NOT NULL DEFAULT 'Shop',
    "path2" TEXT NOT NULL DEFAULT '',
    "recommendedBid" REAL NOT NULL DEFAULT 1.0,
    "targetDemographics" TEXT NOT NULL DEFAULT '',
    "sitelinks" TEXT NOT NULL DEFAULT '[]',
    "competitorIntel" TEXT NOT NULL DEFAULT '{}',
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productHash" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_AiAnalysis" ("adScore", "adStrength", "analyzedAt", "competitorIntel", "descriptions", "headlines", "id", "keywords", "negativeKeywords", "path1", "path2", "productHash", "productId", "recommendedBid", "shop", "sitelinks", "targetDemographics") SELECT "adScore", "adStrength", "analyzedAt", "competitorIntel", "descriptions", "headlines", "id", "keywords", "negativeKeywords", "path1", "path2", "productHash", "productId", "recommendedBid", "shop", "sitelinks", "targetDemographics" FROM "AiAnalysis";
DROP TABLE "AiAnalysis";
ALTER TABLE "new_AiAnalysis" RENAME TO "AiAnalysis";
CREATE UNIQUE INDEX "AiAnalysis_productId_key" ON "AiAnalysis"("productId");
CREATE INDEX "AiAnalysis_shop_idx" ON "AiAnalysis"("shop");
CREATE INDEX "AiAnalysis_productId_idx" ON "AiAnalysis"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
