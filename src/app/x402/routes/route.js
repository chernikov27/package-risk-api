import { jsonResponse, optionsResponse } from "../../../lib/x402-middleware";
import { paymentConfig, X402_ROUTES } from "../../../x402-config.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET() {
  return jsonResponse({
    routes: X402_ROUTES,
    payment: paymentConfig()
  });
}

export function OPTIONS() {
  return optionsResponse();
}
