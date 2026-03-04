
import { authenticate } from "../shopify.server.js";
import { handleProductWebhook } from "../sync.server.js";

export const action = async ({ request }) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Webhook received: ${topic} for shop ${shop}`);

  if (!payload || !payload.id) {
    return json({ ok: true });
  }

  const eventType = topic.includes("create") ? "create" : "update";

  try {
    const result = await handleProductWebhook(shop, payload, eventType);

    console.log(
      `Webhook ${eventType}: product ${result.productId}, needsAi: ${result.needsAi}`,
    );
  } catch (err) {
    console.error(`Webhook ${eventType} error:`, err.message);
  }

  return json({ ok: true });
};
