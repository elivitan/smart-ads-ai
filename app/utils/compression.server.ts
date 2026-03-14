// compression.server.ts — API response compression
// Compresses JSON API responses with gzip when client supports it.

import { createGzip } from "zlib";
import { Readable } from "stream";

/**
 * Check if the client accepts gzip encoding.
 */
export function acceptsGzip(request: Request): boolean {
  const accept = request.headers.get("accept-encoding") || "";
  return accept.includes("gzip");
}

/**
 * Compress a JSON response body with gzip.
 * Returns a new Response with compressed body and appropriate headers.
 * Only compresses if body is larger than threshold (1KB default).
 */
export function compressJsonResponse(
  body: string,
  status: number = 200,
  extraHeaders: Record<string, string> = {},
  minSize: number = 1024
): Response {
  // Don't compress small responses
  if (body.length < minSize) {
    return new Response(body, {
      status,
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
      },
    });
  }

  // Create gzip stream
  const gzip = createGzip({ level: 6 });
  const readable = new Readable();
  readable.push(body);
  readable.push(null);

  const compressed = readable.pipe(gzip);

  // Convert Node stream to Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      compressed.on("data", (chunk: Buffer) => controller.enqueue(chunk));
      compressed.on("end", () => controller.close());
      compressed.on("error", (err: Error) => controller.error(err));
    },
  });

  return new Response(webStream, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Content-Encoding": "gzip",
      "Vary": "Accept-Encoding",
      ...extraHeaders,
    },
  });
}
