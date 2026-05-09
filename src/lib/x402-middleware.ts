import {
  authorizePayment,
  findPaidRoute,
  settleAuthorizedPayment
} from "../x402-config.js";

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

type PaidRouteHandler = (body: Record<string, unknown>) => Promise<JsonBody> | JsonBody;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-agentspec-dev-payment,payment-signature,x-payment",
  "access-control-expose-headers": "payment-required,payment-response"
};

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

export function jsonResponse(body: JsonBody, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init.headers ?? {})
    }
  });
}

export async function paidJsonRoute(request: Request, routePath: string, handler: PaidRouteHandler) {
  const route = findPaidRoute(request.method, routePath);
  const payment = await authorizePayment(toNodeLikeRequest(request), route);

  if (!payment.ok) {
    return jsonResponse(payment.body, {
      status: payment.status,
      headers: payment.headers
    });
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return jsonResponse({
      error: "invalid_json",
      message: error instanceof Error ? error.message : "Request body must be valid JSON."
    }, {
      status: 400
    });
  }

  const responseBody = await handler(body);
  const settlement = await settleAuthorizedPayment(payment);

  if (!settlement.ok) {
    return jsonResponse(settlement.body, {
      status: settlement.status,
      headers: settlement.headers
    });
  }

  return jsonResponse(responseBody, {
    status: 200,
    headers: {
      ...(payment.headers ?? {}),
      ...(settlement.headers ?? {})
    }
  });
}

export function baseUrlFromRequest(request: Request) {
  const headers = request.headers;
  const forwardedProto = headers.get("x-forwarded-proto");
  const forwardedHost = headers.get("x-forwarded-host");
  const url = new URL(request.url);
  const proto = forwardedProto || url.protocol.replace(/:$/u, "") || "https";
  const host = forwardedHost || headers.get("host") || url.host;
  return `${proto}://${host}`;
}

async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function toNodeLikeRequest(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const url = new URL(request.url);
  headers.host ??= url.host;

  return {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers
  };
}
