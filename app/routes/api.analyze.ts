// app/routes/api.analyze.ts
// ══════════════════════════════════════════════
// Analyze products endpoint
// POST → Runs AI analysis on provided products
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { analyzeProducts } from "../ai.server";

interface RouteHandlerArgs {
  request: Request;
}

export const action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const productsJson = formData.get("products");
  if (!productsJson) return Response.json({ error: "No products" });
  try {
    const products = JSON.parse(productsJson as string);
    const result = await analyzeProducts(products);
    return Response.json({ aiData: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message });
  }
};
