

import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook may fire multiple times
  if (session) {
    await db.session.deleteMany({
      where: { shop },
    });
  }

  return json({ success: true });
};
