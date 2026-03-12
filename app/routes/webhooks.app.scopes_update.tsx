import { authenticate } from "../shopify.server";
import db from "../db.server";

interface WebhookActionArgs {
  request: Request;
}


export const action = async ({ request }: WebhookActionArgs): Promise<Response> => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;

  if (session) {
    await db.session.update({
      where: {
        id: session.id,
      },
      data: {
        scope: current.toString(),
      },
    });
  }

  return new Response();
};
