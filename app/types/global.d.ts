// app/types/global.d.ts — Global type declarations for Smart Ads AI

/** Shopify product from store sync */
export interface ShopifyProduct {
  id: string | number;
  title: string;
  handle?: string;
  description?: string;
  price?: string | number;
  image?: string;
  images?: string[];
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** AI analysis result for a product */
export interface ProductAnalysis {
  productId: string | number;
  score: number;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  strategy: string;
  competitors: CompetitorInfo[];
  suggestions: string[];
  analyzedAt: string;
}

/** Competitor information */
export interface CompetitorInfo {
  name: string;
  domain?: string;
  adCopy?: string;
  position?: number;
  estimatedBudget?: number;
}

/** Campaign configuration */
export interface CampaignConfig {
  type: "search" | "pmax" | "shopping" | "display" | "video";
  name: string;
  budget: number;
  bidStrategy: string;
  targeting: {
    keywords?: string[];
    locations?: string[];
    audiences?: string[];
  };
  products: (string | number)[];
  status?: "draft" | "pending" | "active" | "paused" | "removed";
}

/** User subscription info */
export interface SubscriptionInfo {
  plan: "free" | "starter" | "pro" | "premium";
  status: "active" | "expired" | "trial";
  trialEndsAt?: string;
  scanCredits: number;
  aiCredits: number;
  campaignsPerDay: number;
}

/** API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

/** Store scan result */
export interface ScanResult {
  shop: string;
  totalProducts: number;
  analyzedProducts: number;
  avgScore: number;
  healthScore: number;
  topKeywords: string[];
  competitors: CompetitorInfo[];
  scannedAt: string;
}
