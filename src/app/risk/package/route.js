import { paidJsonRoute, optionsResponse } from "../../../lib/x402-middleware";
import { assessPackageRisk } from "../../../package-risk.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function POST(request) {
  return paidJsonRoute(request, "/risk/package", assessPackageRisk);
}

export function OPTIONS() {
  return optionsResponse();
}
