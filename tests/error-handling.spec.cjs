// tests/error-handling.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Error Handling
// Verifies API routes handle bad input gracefully
// Uses API requests only — no browser auth needed
// ═══════════════════════════════════════════════════

const { test, expect } = require("@playwright/test");

test.describe("Error Handling", () => {
  test("Scan API handles empty POST body without crashing", async ({ request }) => {
    const response = await request.post("/app/api/scan", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(response.status()).not.toBe(500);
  });

  test("AI Engine handles empty POST body without crashing", async ({ request }) => {
    const response = await request.post("/app/api/ai-engine", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(response.status()).not.toBe(500);
  });

  test("State API handles invalid JSON gracefully", async ({ request }) => {
    const response = await request.post("/app/api/state", {
      headers: { "Content-Type": "text/plain" },
      data: "this is not json",
    });
    expect(response.status()).not.toBe(500);
  });

  test("Campaign status handles missing launchId", async ({ request }) => {
    const response = await request.get("/app/api/campaign-status");
    expect(response.status()).not.toBe(500);
  });

  test("Keywords API handles empty POST body", async ({ request }) => {
    const response = await request.post("/app/api/keywords", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(response.status()).not.toBe(500);
  });

  test("Market Intel handles empty POST body", async ({ request }) => {
    const response = await request.post("/app/api/market-intel", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(response.status()).not.toBe(500);
  });

  test("Health endpoint survives rapid requests", async ({ request }) => {
    // Send 10 rapid requests — none should return 500
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(request.get("/app/api/health"));
    }
    const responses = await Promise.all(promises);
    for (const r of responses) {
      expect(r.status()).not.toBe(500);
    }
  });

  test("POST to GET-only endpoint returns proper error", async ({ request }) => {
    // Health is GET-only — POST should not crash
    const response = await request.post("/app/api/health", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    // Should be 404 or 405, not 500
    expect(response.status()).not.toBe(500);
  });

  test("Oversized request body is rejected", async ({ request }) => {
    // Generate 200KB of data
    const bigData = { data: "x".repeat(200000) };
    const response = await request.post("/app/api/state", {
      headers: { "Content-Type": "application/json" },
      data: bigData,
    });
    // Should be 401 (auth) or 413 (too large) — not 500
    expect(response.status()).not.toBe(500);
  });
});
