import { authenticate } from "../shopify.server";
import { exploreKeywords, scanWebsite } from "../keyword-research.server";

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    if (actionType === "explore") {
      const keyword = formData.get("keyword");
      const location = formData.get("location") || "United States";
      if (!keyword) {
        return Response.json({ success: false, error: "Please enter a keyword" }, { status: 400 });
      }
      const result = await exploreKeywords(keyword, location);
      return Response.json({ success: true, ...result });
    }

    if (actionType === "scan") {
      const url = formData.get("url");
      if (!url) {
        return Response.json({ success: false, error: "Please enter a URL" }, { status: 400 });
      }
      const result = await scanWebsite(url);
      return Response.json({ success: true, ...result });
    }

    return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Keyword research error:", err);
    return Response.json(
      { success: false, error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
};
