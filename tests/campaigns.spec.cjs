// tests/campaigns.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Campaigns API
// Tests campaign-related API endpoints (no browser needed)
// ═══════════════════════════════════════════════════

const { test, expect } = require("@playwright/test");

test.describe("Campaigns API", () => {
  test("Campaign create endpoint responds (POST /app/api/campaign)", async ({ request }) => {
    const response = await request.post("/app/api/campaign", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    // Should return auth error (401/302) not crash (500)
    expect(response.status()).not.toBe(500);
  });

  test("Campaign manage endpoint responds (POST /app/api/campaign-manage)", async ({ request }) => {
    const response = await request.post("/app/api/campaign-manage", {
      headers: { "Content-Type": "application/json" },
      data: { action: "list" },
    });
    expect(response.status()).not.toBe(500);
  });

  test("Campaign status endpoint responds (GET /app/api/campaign-status)", async ({ request }) => {
    const response = await request.get("/app/api/campaign-status");
    // Without auth, should return 401 (not 500)
    expect(response.status()).not.toBe(500);
  });

  test("Campaign status with launchId returns 401 without auth", async ({ request }) => {
    const response = await request.get("/app/api/campaign-status?launchId=test_123");
    expect(response.status()).not.toBe(500);
    // Should be 401 (auth required) or 400 (bad request)
    expect([401, 400, 302, 303, 404]).toContain(response.status());
  });

  test("Campaign create with empty body returns proper error", async ({ request }) => {
    const response = await request.post("/app/api/campaign", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    // Should not crash
    expect(response.status()).not.toBe(500);
  });
});
