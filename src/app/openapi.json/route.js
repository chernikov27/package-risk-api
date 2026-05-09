import { baseUrlFromRequest, jsonResponse, optionsResponse } from "../../lib/x402-middleware";
import { serviceOpenApi } from "../../service-openapi.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request) {
  return jsonResponse(serviceOpenApi(baseUrlFromRequest(request)));
}

export function OPTIONS() {
  return optionsResponse();
}
