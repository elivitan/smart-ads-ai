// app/routes/app.api.job-status.js
// ══════════════════════════════════════════════
// Job Status Endpoint — check background job progress
// GET ?queue=scan&jobId=123
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { getJobStatus, QUEUES } from "../utils/queue";
import { checkRateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { logger } from "../utils/logger";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

const _loader = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    return Response.json({ success: false, error: "Auth failed" }, { status: 401 });
  }
  const shop = session.shop;

  const rl = await checkRateLimit(shop, "job-status", 120, 60000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

  const url = new URL(request.url);
  const queue = url.searchParams.get("queue");
  const jobId = url.searchParams.get("jobId");

  if (!queue || !jobId) {
    return Response.json({ success: false, error: "Missing queue or jobId parameter" }, { status: 400 });
  }

  const validQueues = [QUEUES.SCAN, QUEUES.CAMPAIGN];
  if (!validQueues.includes(queue as any)) {
    return Response.json({ success: false, error: "Invalid queue name" }, { status: 400 });
  }

  const status = await getJobStatus(queue, jobId);
  if (!status) {
    return Response.json({ success: false, error: "Job not found" }, { status: 404 });
  }

  return Response.json({ success: true, ...status });
};


// ── Middleware wrappers (Session 56) ──
export const loader = withSentryMonitoring("api.job-status", withRequestLogging("api.job-status", _loader));