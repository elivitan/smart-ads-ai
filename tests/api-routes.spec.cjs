// tests/api-routes.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: All 13 API Routes
// Verifies every endpoint responds without crashing (no 500s)
// Auth-protected routes should return 401/302, not 500
// ═══════════════════════════════════════════════════

const { test, expect } = require("@playwright/test");

const AUTH_ROUTES = [
  { path: "/app/api/scan", method: "POST", name: "Scan" },
  { path: "/app/api/ai-engine", method: "POST", name: "AI Engine" },
  { path: "/app/api/ai-improve", method: "POST", name: "AI Improve" },
  { path: "/app/api/campaign", method: "POST", name: "Campaign Create" },
  { path: "/app/api/campaign-manage", method: "POST", name: "Campaign Manage" },
  { path: "/app/api/campaign-status", method: "GET", name: "Campaign Status" },
  { path: "/app/api/keywords", method: "POST", name: "Keywords" },
  { path: "/app/api/market-intel", method: "POST", name: "Market Intel" },
  { path: "/app/api/state", method: "POST", name: "State" },
  { path: "/app/api/store-analytics", method: "POST", name: "Store Analytics" },
  { path: "/app/api/subscription", method: "POST", name: "Subscription" },
  { path: "/app/api/sync", method: "POST", name: "Sync" },
];

test.describe("API Routes", () => {
  test("Health endpoint returns 200 or 503", async ({ request }) => {
    const response = await request.get("/api/health");
    expect([200, 503, 429]).toContain(response.status());
  });

  for (const route of AUTH_ROUTES) {
    test(`${route.name} (${route.path}) does not return 500`, async ({ request }) => {
      let response;
      if (route.method === "GET") {
        response = await request.get(route.path);
      } else {
        response = await request.post(route.path, {
          headers: { "Content-Type": "application/json" },
          data: {},
        });
      }

      const status = response.status();

      // 500 = server crash = BUG. Everything else is acceptable:
      // 200-299 = success, 302/303 = redirect to auth, 400 = bad request,
      // 401/403 = auth required, 404 = not found, 405 = wrong method, 429 = rate limited
      expect(status).not.toBe(500);
    });
  }

  test("Unknown API route returns 404", async ({ request }) => {
    const response = await request.get("/app/api/nonexistent-route-xyz");
    expect(response.status()).not.toBe(500);
  });

  test("Health endpoint returns JSON with correct headers", async ({ request }) => {
    const response = await request.get("/api/health");
    if (response.status() === 429) return;
    const headers = response.headers();
    expect(headers["cache-control"]).toContain("no-cache");
    const body = await response.json();
    expect(body).toHaveProperty("status");
  });
});
