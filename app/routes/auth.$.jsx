
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return null;
};
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
