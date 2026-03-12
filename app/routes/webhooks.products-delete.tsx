/**
 * Webhook: products/delete
 * 
 * Shopify sends this when a product is deleted.
 * We remove it from the local DB.
 */
import { authenticate } from "../shopify.server.js";
import { handleProductDelete } from "../sync.server.js";

interface WebhookActionArgs {
  request: Request;
}


export const action = async ({ request }: WebhookActionArgs): Promise<Response> => {
  const { shop, payload } = await authenticate.webhook(request);

  console.log(`Webhook: products/delete for shop ${shop}`);

  if (!payload || !payload.id) {
    return new Response("No payload", { status: 200 });
  }

  try {
    const result = await handleProductDelete(shop, payload.id);
    console.log(`Deleted product: ${result.deleted}`);
  } catch (err: unknown) {
    console.error("Webhook delete error:", (err instanceof Error ? err.message : String(err)));
  }

  return new Response("OK", { status: 200 });
};
