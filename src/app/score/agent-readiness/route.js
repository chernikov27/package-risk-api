import { paidJsonRoute, optionsResponse } from "../../../lib/x402-middleware";
import { inspectMcp, inspectOpenApi } from "../../../inspect.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function POST(request) {
  return paidJsonRoute(request, "/score/agent-readiness", body => {
    const report = body.type === "mcp" || Array.isArray(body.tools) ? inspectMcp(body) : inspectOpenApi(body);
    return {
      type: report.type,
      score: report.score,
      grade: report.grade,
      summary: report.summary,
      riskCount: report.risks.length,
      recommendationCount: report.recommendations.length
    };
  });
}

export function OPTIONS() {
  return optionsResponse();
}
