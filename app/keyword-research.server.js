import Anthropic from "@anthropic-ai/sdk";
import { isCostLimitReached } from "./utils/api-cost-tracker.js";
import { withRetry } from "./retry.server";


// ── Timeout for Anthropic SDK calls (Session 56) ──
const ANTHROPIC_TIMEOUT_MS = 30000; // 30 seconds
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: ANTHROPIC_TIMEOUT_MS,
});

export async function exploreKeywords(seedKeyword, location = "United States") {
  // Cost guard
  if (isCostLimitReached("anthropic")) {
    throw new Error("Daily AI processing limit reached. Try again tomorrow.");
  }
  const response = await withRetry(
    () =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `You are a keyword research expert for Google Ads. Analyze this seed keyword for the given location.

SEED KEYWORD: "${seedKeyword}"
LOCATION: ${location}

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "seed": {
    "keyword": "${seedKeyword}",
    "monthly_volume": 12000,
    "competition": "Medium",
    "cpc_estimate": "$1.50",
    "trend": "Rising"
  },
  "related_keywords": [
    {
      "keyword": "example keyword",
      "monthly_volume": 8000,
      "competition": "Low",
      "cpc_estimate": "$0.80",
      "relevance": 95,
      "source": "Google"
    }
  ],
  "long_tail": [
    {
      "keyword": "long tail example keyword phrase",
      "monthly_volume": 500,
      "competition": "Low",
      "cpc_estimate": "$0.40"
    }
  ],
  "questions": [
    "how to choose example keyword",
    "what is the best example keyword"
  ],
  "rising_trends": [
    {
      "keyword": "trending variation",
      "growth": "+120%",
      "monthly_volume": 3000
    }
  ],
  "ad_group_suggestions": [
    {
      "name": "Ad Group Name",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "estimated_cpc": "$1.20"
    }
  ]
}

Rules:
- Provide 15-25 related keywords across Google, Bing, YouTube, Amazon
- Provide 8-12 long tail keywords
- Provide 5-8 questions people search
- Provide 3-5 rising trends
- Provide 3-4 ad group suggestions
- Monthly volumes should be realistic estimates for ${location}
- CPC estimates in USD
- Competition: Low, Medium, or High
- Source: Google, Bing, YouTube, or Amazon
- Return ONLY valid JSON`,
          },
        ],
      }),
    { label: "Claude" },
  );

  const text = response.content[0].text.trim();
  let cleaned = text;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

export async function scanWebsite(url) {
  const response = await withRetry(
    () =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `You are an SEO and Google Ads keyword expert. Analyze this website URL and extract keyword opportunities.

WEBSITE URL: ${url}

Based on the URL, domain name, and what a website like this would typically contain, identify keyword opportunities.

Return ONLY valid JSON (no markdown, no backticks) with this exact structure:
{
  "website": "${url}",
  "industry": "Detected industry",
  "primary_keywords": [
    {
      "keyword": "main keyword",
      "monthly_volume": 10000,
      "competition": "High",
      "cpc_estimate": "$2.00",
      "relevance": 95
    }
  ],
  "long_tail_keywords": [
    {
      "keyword": "long tail keyword phrase",
      "monthly_volume": 800,
      "competition": "Low",
      "cpc_estimate": "$0.60"
    }
  ],
  "negative_keywords": [
    "free",
    "diy",
    "cheap"
  ],
  "competitor_gaps": [
    {
      "keyword": "keyword competitor might miss",
      "opportunity": "High",
      "monthly_volume": 2000
    }
  ],
  "content_themes": [
    "Theme 1",
    "Theme 2"
  ]
}

Rules:
- Provide 12-18 primary keywords
- Provide 8-12 long tail keywords
- Provide 5-10 negative keywords (to save budget)
- Provide 5-8 competitor gaps
- Provide 3-5 content themes
- All volumes and CPCs are realistic estimates
- Return ONLY valid JSON`,
          },
        ],
      }),
    { label: "Claude" },
  );

  const text = response.content[0].text.trim();
  let cleaned = text;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}
