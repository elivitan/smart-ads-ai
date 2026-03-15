// app/routes/app.api.competitor-strike.ts
// Engine 19: Predatory Competitor Strike API
import { authenticate } from "../shopify.server";
import { logger } from "../utils/logger";
import prisma from "../db.server.js";

interface RouteHandlerArgs {
  request: Request;
}

export async function action({ request }: RouteHandlerArgs) {
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
    const actionType = (formData.get("action") as string) || "";

    switch (actionType) {
      case "weaknesses": {
        const { analyzeCompetitorWeaknesses } = await import(
          "../competitor-strike.server.js"
        );
        const weaknesses = await analyzeCompetitorWeaknesses(shop);
        return Response.json({ success: true, weaknesses });
      }

      case "plan": {
        const competitorDomain = formData.get("competitorDomain") as string;
        const strikeType = formData.get("strikeType") as string;

        if (!competitorDomain || !strikeType) {
          return Response.json(
            {
              success: false,
              error:
                "Missing required fields: competitorDomain and strikeType are required",
            },
            { status: 400 },
          );
        }

        const { planStrike } = await import("../competitor-strike.server.js");
        const strike = await planStrike(shop, competitorDomain, strikeType);
        return Response.json({ success: true, strike });
      }

      case "execute": {
        const strikeId = formData.get("strikeId") as string;

        if (!strikeId) {
          return Response.json(
            { success: false, error: "Missing required field: strikeId" },
            { status: 400 },
          );
        }

        const { executeStrike } = await import("../competitor-strike.server.js");
        const result = await executeStrike(shop, strikeId);
        return Response.json({ success: true, result });
      }

      case "measure": {
        const strikeId = formData.get("strikeId") as string;

        if (!strikeId) {
          return Response.json(
            { success: false, error: "Missing required field: strikeId" },
            { status: 400 },
          );
        }

        const { measureStrikeResults } = await import(
          "../competitor-strike.server.js"
        );
        const result = await measureStrikeResults(shop, strikeId);
        return Response.json({ success: true, result });
      }

      case "list": {
        const strikes = await prisma.competitorStrike.findMany({
          where: { shop },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        return Response.json({ success: true, strikes });
      }

      default:
        return Response.json(
          { success: false, error: "Unknown action" },
          { status: 400 },
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("competitor-strike", "API error", {
      extra: { shop, error: message },
    });
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
