/**
 * Webhook: products/delete
 * 
 * Shopify sends this when a product is deleted.
 * We remove it from the local DB.
 */
import { authenticate } from "../shopify.server.js";
import { handleProductDelete } from "../sync.server.js";

export const action = async ({ request }) => {
  const { shop, payload } = await authenticate.webhook(request);

  console.log(`Webhook: products/delete for shop ${shop}`);

  if (!payload || !payload.id) {
    return new Response("No payload", { status: 200 });
  }

  try {
    const result = await handleProductDelete(shop, payload.id);
    console.log(`Deleted product: ${result.deleted}`);
  } catch (err) {
    console.error("Webhook delete error:", err.message);
  }

  return new Response("OK", { status: 200 });
};
