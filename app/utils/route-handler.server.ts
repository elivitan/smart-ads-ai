// Shared route action handler — reduces boilerplate duplication across API routes
import { authenticate } from "../shopify.server";
import { logger } from "./logger";

type ActionHandler = (shop: string, formData: FormData) => Promise<unknown>;

/**
 * Creates a standard authenticated route action handler.
 * Handles auth, formData parsing, action dispatch, and error handling.
 */
export function createRouteAction(
  tag: string,
  defaultAction: string,
  handlers: Record<string, ActionHandler>,
) {
  return async function action({ request }: { request: Request }) {
    let session;
    try {
      ({ session } = await authenticate.admin(request));
    } catch {
      return Response.json(
        { success: false, error: "Authentication failed" },
        { status: 401 },
      );
    }

    const shop = session.shop;

    try {
      const formData = await request.formData();
      const actionType = (formData.get("action") as string) || defaultAction;

      const handler = handlers[actionType];
      if (!handler) {
        return Response.json({ error: "Unknown action" }, { status: 400 });
      }

      const result = await handler(shop, formData);
      return Response.json({ success: true, result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(tag, "API error", { extra: { error: message } });
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
