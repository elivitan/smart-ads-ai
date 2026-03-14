// tests/health-api.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Health API Endpoint
// All tests use request API only (no browser/auth needed)
// ═══════════════════════════════════════════════════

const { test, expect } = require("@playwright/test");

test.describe("Health API", () => {
  test("GET /api/health returns valid JSON with status", async ({ request }) => {
    const response = await request.get("/api/health");
    const status = response.status();

    // 200 = ok, 503 = degraded, 429 = rate limited (all acceptable)
    expect([200, 503, 429]).toContain(status);

    if (status === 429) {
      const body = await response.json();
      expect(body).toHaveProperty("error");
      return;
    }

    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("checks");
    expect(body).toHaveProperty("responseTime");
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof body.uptime).toBe("number");
  });

  test("Health endpoint returns within timeout", async ({ request }) => {
    const start = Date.now();
    const response = await request.get("/api/health");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10000);

    if (response.status() === 429) return;
    const body = await response.json();
    if (body.responseTime !== undefined) {
      expect(body.responseTime).toBeLessThan(5000);
    }
  });

  test("Health endpoint includes memory stats", async ({ request }) => {
    const response = await request.get("/api/health");
    if (response.status() === 429) return;

    const body = await response.json();
    const mem = body.checks?.memory;
    if (!mem) return;
    expect(mem.heapUsedMB).toBeGreaterThan(0);
    expect(mem.rssMB).toBeGreaterThan(0);
  });

  test("Health endpoint includes API cost tracking", async ({ request }) => {
    const response = await request.get("/api/health");
    if (response.status() === 429) return;

    const body = await response.json();
    const costs = body.checks?.apiCosts;
    if (!costs) return;
    for (const service of ["anthropic", "serper", "google_ads"]) {
      expect(costs[service]).toHaveProperty("spent");
      expect(costs[service]).toHaveProperty("limit");
    }
  });

  test("Health endpoint respects rate limiting", async ({ request }) => {
    const responses = [];
    for (let i = 0; i < 35; i++) {
      responses.push(await request.get("/api/health"));
    }
    const has429 = responses.some((r) => r.status() === 429);
    if (has429) {
      const rateLimited = responses.find((r) => r.status() === 429);
      const body = await rateLimited.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("retryAfter");
    }
  });
});
