
import { boundary } from "@shopify/shopify-app-react-router/server";

interface LoaderArgs {
  request: Request;
}

interface HeadersArgs {
  loaderHeaders: Headers;
  parentHeaders: Headers;
  actionHeaders: Headers;
  errorHeaders: Headers;
}


export const loader = async ({ request }: LoaderArgs): Promise<null> => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return null;
};
export const headers = (headersArgs: HeadersArgs): Headers => {
  return boundary.headers(headersArgs);
};
