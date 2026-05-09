import { paidJsonRoute, optionsResponse } from "../../../lib/x402-middleware";
import { inspectMcp } from "../../../inspect.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function POST(request) {
  return paidJsonRoute(request, "/inspect/mcp", inspectMcp);
}

export function OPTIONS() {
  return optionsResponse();
}
