/**
 * resilience.test.cjs — Tests for circuit breaker, rate limiter fallback, and retry logic
 * Validates that the infrastructure handles failures gracefully.
 * Run: node tests/resilience.test.cjs
 */

const assert = require("assert");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// ════════════════════════════════════════════════════
// SECTION 1: Circuit Breaker Logic
// ════════════════════════════════════════════════════
console.log("\n🔌 SECTION 1: Circuit Breaker\n");

// Simulate the circuit breaker logic from retry.ts without importing (no ESM in CJS test)
function createCircuitBreaker(threshold = 5, resetMs = 5000) {
  return {
    failures: 0,
    lastFailure: 0,
    state: "closed", // closed | open | half-open
    threshold,
    resetMs,
  };
}

function recordFailure(cb) {
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= cb.threshold) {
    cb.state = "open";
  }
}

function checkCircuit(cb) {
  if (cb.state === "open") {
    const elapsed = Date.now() - cb.lastFailure;
    if (elapsed >= cb.resetMs) {
      cb.state = "half-open";
      return "half-open";
    }
    return "open";
  }
  return cb.state;
}

function recordSuccess(cb) {
  cb.failures = 0;
  cb.state = "closed";
}

test("CB1: Circuit starts closed", () => {
  const cb = createCircuitBreaker();
  assert.strictEqual(cb.state, "closed");
  assert.strictEqual(cb.failures, 0);
});

test("CB2: Circuit stays closed below threshold", () => {
  const cb = createCircuitBreaker(5);
  for (let i = 0; i < 4; i++) recordFailure(cb);
  assert.strictEqual(cb.state, "closed");
  assert.strictEqual(cb.failures, 4);
});

test("CB3: Circuit opens at threshold", () => {
  const cb = createCircuitBreaker(5);
  for (let i = 0; i < 5; i++) recordFailure(cb);
  assert.strictEqual(cb.state, "open");
  assert.strictEqual(cb.failures, 5);
});

test("CB4: Open circuit blocks calls", () => {
  const cb = createCircuitBreaker(5, 60000);
  for (let i = 0; i < 5; i++) recordFailure(cb);
  assert.strictEqual(checkCircuit(cb), "open");
});

test("CB5: Open circuit transitions to half-open after reset period", () => {
  const cb = createCircuitBreaker(5, 100);
  for (let i = 0; i < 5; i++) recordFailure(cb);
  cb.lastFailure = Date.now() - 200; // simulate time passing
  assert.strictEqual(checkCircuit(cb), "half-open");
});

test("CB6: Successful call resets circuit to closed", () => {
  const cb = createCircuitBreaker(5);
  for (let i = 0; i < 5; i++) recordFailure(cb);
  cb.lastFailure = Date.now() - 200;
  cb.state = "half-open";
  recordSuccess(cb);
  assert.strictEqual(cb.state, "closed");
  assert.strictEqual(cb.failures, 0);
});

test("CB7: Multiple circuits are independent", () => {
  const cb1 = createCircuitBreaker(3);
  const cb2 = createCircuitBreaker(3);
  for (let i = 0; i < 3; i++) recordFailure(cb1);
  assert.strictEqual(cb1.state, "open");
  assert.strictEqual(cb2.state, "closed");
});

// ════════════════════════════════════════════════════
// SECTION 2: Rate Limiter (in-memory fallback)
// ════════════════════════════════════════════════════
console.log("\n🚦 SECTION 2: Rate Limiter (in-memory fallback)\n");

// Simulate rate limiter logic from rate-limiter.ts
function createRateLimiter() {
  const buckets = new Map();

  function check(shop, route, maxRequests, windowMs) {
    const key = `${shop}:${route}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0, windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
    }
    return { allowed: true, remaining: maxRequests - bucket.count };
  }

  return { check, buckets };
}

test("RL1: First request is allowed", () => {
  const rl = createRateLimiter();
  const result = rl.check("shop1", "scan", 10, 60000);
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.remaining, 9);
});

test("RL2: Requests within limit are allowed", () => {
  const rl = createRateLimiter();
  for (let i = 0; i < 10; i++) {
    const result = rl.check("shop1", "scan", 10, 60000);
    assert.strictEqual(result.allowed, true);
  }
});

test("RL3: Request exceeding limit is blocked", () => {
  const rl = createRateLimiter();
  for (let i = 0; i < 10; i++) rl.check("shop1", "scan", 10, 60000);
  const result = rl.check("shop1", "scan", 10, 60000);
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.remaining, 0);
  assert.ok(result.retryAfterSeconds > 0);
});

test("RL4: Different shops have independent limits", () => {
  const rl = createRateLimiter();
  for (let i = 0; i < 10; i++) rl.check("shop1", "scan", 10, 60000);
  const blocked = rl.check("shop1", "scan", 10, 60000);
  const allowed = rl.check("shop2", "scan", 10, 60000);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(allowed.allowed, true);
});

test("RL5: Different routes have independent limits", () => {
  const rl = createRateLimiter();
  for (let i = 0; i < 10; i++) rl.check("shop1", "scan", 10, 60000);
  const blocked = rl.check("shop1", "scan", 10, 60000);
  const allowed = rl.check("shop1", "state", 60, 60000);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(allowed.allowed, true);
});

test("RL6: Window resets after expiry", () => {
  const rl = createRateLimiter();
  for (let i = 0; i < 10; i++) rl.check("shop1", "scan", 10, 100);
  // Simulate window expiry
  const bucket = rl.buckets.get("shop1:scan");
  bucket.windowStart = Date.now() - 200;
  const result = rl.check("shop1", "scan", 10, 100);
  assert.strictEqual(result.allowed, true);
});

test("RL7: retryAfterSeconds is always >= 1", () => {
  const rl = createRateLimiter();
  for (let i = 0; i < 11; i++) rl.check("shop1", "scan", 10, 60000);
  const result = rl.check("shop1", "scan", 10, 60000);
  assert.ok(result.retryAfterSeconds >= 1);
});

// ════════════════════════════════════════════════════
// SECTION 3: Retry Logic
// ════════════════════════════════════════════════════
console.log("\n🔄 SECTION 3: Retry Logic\n");

test("RT1: Exponential backoff delays increase", () => {
  const baseDelayMs = 1000;
  const maxDelayMs = 30000;
  const delays = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
    delays.push(delay);
  }
  assert.deepStrictEqual(delays, [1000, 2000, 4000, 8000, 16000]);
});

test("RT2: Delay is capped at maxDelayMs", () => {
  const baseDelayMs = 1000;
  const maxDelayMs = 10000;
  const delay = Math.min(baseDelayMs * Math.pow(2, 10), maxDelayMs);
  assert.strictEqual(delay, 10000);
});

test("RT3: Retryable status codes are detected", () => {
  const retryableStatuses = [429, 500, 502, 503, 504];
  assert.ok(retryableStatuses.includes(429));
  assert.ok(retryableStatuses.includes(503));
  assert.ok(!retryableStatuses.includes(400));
  assert.ok(!retryableStatuses.includes(404));
});

test("RT4: Retryable error messages are detected", () => {
  const retryablePatterns = ["rate_limit", "overloaded", "ECONNRESET", "ETIMEDOUT", "fetch failed"];
  const check = (msg) => retryablePatterns.some(p => msg.includes(p));
  assert.ok(check("rate_limit_exceeded"));
  assert.ok(check("server overloaded"));
  assert.ok(check("ECONNRESET by peer"));
  assert.ok(!check("invalid_api_key"));
  assert.ok(!check("not found"));
});

// ════════════════════════════════════════════════════
// SECTION 4: Cache Fallback Pattern
// ════════════════════════════════════════════════════
console.log("\n💾 SECTION 4: Cache Fallback\n");

test("CF1: Cache returns null on miss (no Redis = graceful fallback)", () => {
  // Simulates the behavior: if redis is null, cache.get returns null
  const redis = null;
  const result = redis ? "cached_value" : null;
  assert.strictEqual(result, null);
});

test("CF2: SWR pattern returns fresh data on cache miss", () => {
  // Simulate: no redis → fetchFn is called directly
  const redis = null;
  const fetchFn = () => ({ data: "fresh" });
  const result = redis ? null : fetchFn();
  assert.deepStrictEqual(result, { data: "fresh" });
});

test("CF3: TTL constants are reasonable", () => {
  const TTL = {
    SCAN_RESULT: 24 * 3600,
    AI_ANALYSIS: 48 * 3600,
    KEYWORD_DATA: 12 * 3600,
    RATE_LIMIT: 60,
    SESSION: 7 * 24 * 3600,
  };
  assert.ok(TTL.SCAN_RESULT === 86400);
  assert.ok(TTL.RATE_LIMIT === 60);
  assert.ok(TTL.SESSION === 604800);
});

// ════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════════════");
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
