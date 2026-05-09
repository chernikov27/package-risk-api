import { jsonResponse, optionsResponse } from "../../lib/x402-middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET() {
  return jsonResponse({
    name: "AgentSpec",
    slogan: "Turn any API into an agent-ready x402 service.",
    endpoints: ["/inspect/openapi", "/inspect/mcp", "/generate/bazaar-metadata", "/score/agent-readiness"],
    docs: "/openapi.json"
  });
}

export function OPTIONS() {
  return optionsResponse();
}
