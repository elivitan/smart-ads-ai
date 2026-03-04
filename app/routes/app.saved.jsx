
import { useState, useEffect } from "react";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return {};
};

export default function SavedCampaigns() {
  const [products, setProducts] = useState([]);
  const [aiResults, setAiResults] = useState(null);

  useEffect(() => {
    try {
      const p = sessionStorage.getItem("sai_products");
      const a = sessionStorage.getItem("sai_aiResults");

      if (p) setProducts(JSON.parse(p));
      if (a) setAiResults(JSON.parse(a));
    } catch (e) {
      console.error(e);
    }
  }, []);

  if (!products.length) {
    return (
      <div style={{ padding: 40 }}>
        <h2>No Saved Results Yet</h2>
        <p>Scan your store first to generate recommendations.</p>
        <a href="/app">Go to dashboard</a>
      </div>
    );
  }

  const aiProducts = aiResults?.products || [];

  const merged = products.map((p, i) => {
    const ai =
      aiProducts.find((x) => x.title === p.title) || aiProducts[i] || {};
    return { ...p, ...ai, ad_score: ai.ad_score || 0 };
  });

  return (
    <div style={{ padding: 40 }}>
      <h1>Saved Recommendations</h1>

      <div style={{ marginTop: 20 }}>
        {merged.map((p, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #ddd",
              padding: 16,
              marginBottom: 12,
              borderRadius: 8,
            }}
          >
            <h3>{p.title}</h3>
            <p>Price: ${Number(p.price || 0).toFixed(2)}</p>
            <p>Ad Score: {p.ad_score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
