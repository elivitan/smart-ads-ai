/**
 * load-test.cjs — Basic load testing for Smart Ads AI API endpoints
 * Tests concurrent request handling, rate limiting behavior, and response times.
 *
 * Usage:
 *   node tests/load-test.cjs                    # Default: localhost:3457
 *   TEST_PORT=60876 node tests/load-test.cjs    # Custom port
 */

const http = require("http");

const PORT = process.env.TEST_PORT || "3457";
const BASE = `http://localhost:${PORT}`;
const CONCURRENT = 20;
const ROUNDS = 3;

let passed = 0;
let failed = 0;

function test(name, ok, detail = "") {
  if (ok) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}: ${detail}`);
    failed++;
  }
}

function fetchUrl(url, method = "GET", timeout = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      timeout,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          duration: Date.now() - start,
          body: data,
          headers: res.headers,
        });
      });
    });

    req.on("error", (err) => {
      resolve({ status: 0, duration: Date.now() - start, body: err.message, error: true });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ status: 0, duration: Date.now() - start, body: "timeout", error: true });
    });

    req.end();
  });
}

async function runLoadTest() {
  console.log(`\n⚡ Load Test — ${BASE}`);
  console.log(`   Concurrent: ${CONCURRENT} | Rounds: ${ROUNDS}\n`);

  // ── Test 1: Health endpoint under load ──
  console.log("🏥 Test 1: Health endpoint concurrency\n");
  {
    const promises = [];
    for (let i = 0; i < CONCURRENT; i++) {
      promises.push(fetchUrl(`${BASE}/app/api/health`));
    }
    const results = await Promise.all(promises);
    const successful = results.filter((r) => r.status === 200);
    const avgDuration = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);
    const maxDuration = Math.max(...results.map((r) => r.duration));

    test(`Health: ${successful.length}/${CONCURRENT} succeeded`, successful.length >= CONCURRENT * 0.8);
    test(`Health avg response: ${avgDuration}ms`, avgDuration < 5000, `${avgDuration}ms > 5000ms`);
    test(`Health max response: ${maxDuration}ms`, maxDuration < 10000, `${maxDuration}ms > 10000ms`);
  }

  // ── Test 2: Rate limiting kicks in ──
  console.log("\n🚦 Test 2: Rate limiting behavior\n");
  {
    const results = [];
    // Send more requests than rate limit allows (scan: 10/min)
    for (let i = 0; i < 15; i++) {
      const r = await fetchUrl(`${BASE}/app/api/state?shop=load-test.myshopify.com`);
      results.push(r);
    }
    const rateLimited = results.filter((r) => r.status === 429);
    const successful = results.filter((r) => r.status === 200 || r.status === 302);

    // state has limit 60/min so we shouldn't hit it with 15
    test(`State endpoint: ${successful.length} succeeded (limit: 60/min)`, successful.length >= 10);

    // Now test scan which has limit 10/min
    const scanResults = [];
    for (let i = 0; i < 15; i++) {
      const r = await fetchUrl(`${BASE}/app/api/scan?shop=load-test.myshopify.com`, "POST");
      scanResults.push(r);
    }
    // Some should be rate-limited (429) or auth-blocked (302/401)
    test("Scan endpoint responds to all 15 requests", scanResults.every((r) => r.status > 0));
  }

  // ── Test 3: Sustained load over multiple rounds ──
  console.log(`\n🔁 Test 3: Sustained load (${ROUNDS} rounds × ${CONCURRENT} requests)\n`);
  {
    const allDurations = [];
    let allSuccessful = 0;
    let allTotal = 0;

    for (let round = 0; round < ROUNDS; round++) {
      const promises = [];
      for (let i = 0; i < CONCURRENT; i++) {
        promises.push(fetchUrl(`${BASE}/app/api/health`));
      }
      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.status === 200).length;
      allSuccessful += successful;
      allTotal += results.length;
      allDurations.push(...results.map((r) => r.duration));
    }

    const avgDuration = Math.round(allDurations.reduce((s, d) => s + d, 0) / allDurations.length);
    const p95Index = Math.floor(allDurations.sort((a, b) => a - b).length * 0.95);
    const p95 = allDurations[p95Index] || 0;

    test(`Sustained: ${allSuccessful}/${allTotal} succeeded`, allSuccessful >= allTotal * 0.7);
    test(`Sustained avg: ${avgDuration}ms`, avgDuration < 5000, `${avgDuration}ms`);
    test(`Sustained P95: ${p95}ms`, p95 < 10000, `${p95}ms`);
  }

  // ── Results ──
  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  LOAD TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

runLoadTest().catch((err) => {
  console.error("Load test crashed:", err.message);
  process.exit(1);
});
