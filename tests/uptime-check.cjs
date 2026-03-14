/**
 * uptime-check.cjs — Lightweight uptime monitor
 * Checks health endpoint at intervals and reports status.
 *
 * Usage:
 *   node tests/uptime-check.cjs                          # One-time check
 *   UPTIME_INTERVAL=30 node tests/uptime-check.cjs       # Check every 30 seconds
 *   TEST_PORT=60876 node tests/uptime-check.cjs           # Custom port
 */

const http = require("http");

const PORT = process.env.TEST_PORT || "3457";
const BASE = `http://localhost:${PORT}`;
const INTERVAL = parseInt(process.env.UPTIME_INTERVAL || "0", 10);
const HEALTH_URL = `${BASE}/app/api/health`;

function checkHealth() {
  return new Promise((resolve) => {
    const start = Date.now();
    const urlObj = new URL(HEALTH_URL);

    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: "GET",
        timeout: 10000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const duration = Date.now() - start;
          const status = res.statusCode;
          const ok = status === 200;
          const ts = new Date().toISOString();

          if (ok) {
            try {
              const body = JSON.parse(data);
              console.log(
                `[${ts}] ✅ UP | ${duration}ms | status: ${body.status || "ok"} | uptime: ${Math.round(body.uptime || 0)}s`
              );
            } catch {
              console.log(`[${ts}] ✅ UP | ${duration}ms | HTTP ${status}`);
            }
          } else {
            console.log(`[${ts}] ⚠️  DEGRADED | ${duration}ms | HTTP ${status}`);
          }
          resolve({ ok, duration, status });
        });
      }
    );

    req.on("error", (err) => {
      const duration = Date.now() - start;
      const ts = new Date().toISOString();
      console.log(`[${ts}] ❌ DOWN | ${duration}ms | ${err.message}`);
      resolve({ ok: false, duration, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      const ts = new Date().toISOString();
      console.log(`[${ts}] ❌ TIMEOUT | 10000ms`);
      resolve({ ok: false, duration: 10000, error: "timeout" });
    });

    req.end();
  });
}

async function main() {
  console.log(`\n🔍 Uptime Check — ${HEALTH_URL}`);

  if (INTERVAL > 0) {
    console.log(`   Checking every ${INTERVAL} seconds (Ctrl+C to stop)\n`);
    await checkHealth();
    setInterval(checkHealth, INTERVAL * 1000);
  } else {
    console.log("");
    const result = await checkHealth();
    process.exit(result.ok ? 0 : 1);
  }
}

main();
