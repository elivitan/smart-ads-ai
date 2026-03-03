import { authenticate } from "../shopify.server";
import { analyzeProducts } from "../ai.server.js";

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const productsJson = formData.get("products");
  if (!productsJson) return Response.json({ error: "No products" });
  try {
    const products = JSON.parse(productsJson);
    const result = await analyzeProducts(products);
    return Response.json({ aiData: result });
  } catch (err) {
    return Response.json({ error: err.message });
  }
};