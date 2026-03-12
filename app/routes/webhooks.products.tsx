/**
 * Webhook: products/create and products/update
 * 
 * Shopify sends this when a product is created or updated.
 * We update the local DB to stay in sync.
 */
import { authenticate } from "../shopify.server.js";
import { handleProductWebhook } from "../sync.server.js";

interface WebhookActionArgs {
  request: Request;
}


export const action = async ({ request }: WebhookActionArgs): Promise<Response> => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Webhook received: ${topic} for shop ${shop}`);

  if (!payload || !payload.id) {
    return new Response("No payload", { status: 200 });
  }

  const eventType = topic.includes("create") ? "create" : "update";

  try {
    const result = await handleProductWebhook(shop, payload, eventType);
    console.log(`Webhook ${eventType}: product ${result.productId}, needsAi: ${result.needsAi}`);
  } catch (err: unknown) {
    console.error(`Webhook ${eventType} error:`, (err instanceof Error ? err.message : String(err)));
  }

  // Always return 200 to Shopify (otherwise they retry)
  return new Response("OK", { status: 200 });
};
