import { paidJsonRoute, optionsResponse } from "../../../lib/x402-middleware";
import { generateBazaarMetadata } from "../../../inspect.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function POST(request) {
  return paidJsonRoute(request, "/generate/bazaar-metadata", generateBazaarMetadata);
}

export function OPTIONS() {
  return optionsResponse();
}
