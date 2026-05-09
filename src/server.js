import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { generateBazaarMetadata, inspectMcp, inspectOpenApi } from "./inspect.js";
import { loadDotEnv } from "./load-env.js";
import { authorizePayment, findPaidRoute, paymentConfig, settleAuthorizedPayment, X402_ROUTES } from "./x402-config.js";
import { serviceOpenApi } from "./service-openapi.js";

const DEFAULT_PORT = 4020;
const MAX_BODY_BYTES = 1_000_000;
const PUBLIC_DIR = join(process.cwd(), "public");

export function createServer(env = process.env) {
  return http.createServer(async (request, response) => {
    try {
      await routeRequest(request, response, env);
    } catch (error) {
      sendJson(response, 500, {
        error: "internal_error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

async function routeRequest(request, response, env) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";

  if (method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "AgentSpec",
      payment: paymentConfig(env)
    });
    return;
  }

  if (method === "GET" && url.pathname === "/x402/routes") {
    sendJson(response, 200, {
      routes: X402_ROUTES,
      payment: paymentConfig(env)
    });
    return;
  }

  if (method === "GET" && url.pathname === "/openapi.json") {
    sendJson(response, 200, serviceOpenApi(baseUrlFromRequest(request)));
    return;
  }

  if (method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/assets/") || url.pathname === "/styles.css" || url.pathname === "/app.js")) {
    const served = await tryServeStatic(url.pathname, response);
    if (served) return;

    if (url.pathname === "/") {
      sendJson(response, 200, {
        name: "AgentSpec",
        slogan: "Turn any API into an agent-ready x402 service.",
        endpoints: ["/inspect/openapi", "/inspect/mcp", "/generate/bazaar-metadata", "/score/agent-readiness"],
        docs: "/openapi.json"
      });
      return;
    }
  }

  if (method === "GET" && url.pathname === "/api") {
    sendJson(response, 200, {
      name: "AgentSpec",
      slogan: "Turn any API into an agent-ready x402 service.",
      endpoints: ["/inspect/openapi", "/inspect/mcp", "/generate/bazaar-metadata", "/score/agent-readiness"],
      docs: "/openapi.json"
    });
    return;
  }

  const paidRoute = findPaidRoute(method, url.pathname);
  const payment = await authorizePayment(request, paidRoute, env);
  if (!payment.ok) {
    sendJson(response, payment.status, payment.body, payment.headers);
    return;
  }

  if (method === "POST" && url.pathname === "/inspect/openapi") {
    const body = await readJsonBody(request);
    await sendPaidJson(response, 200, inspectOpenApi(body), payment);
    return;
  }

  if (method === "POST" && url.pathname === "/inspect/mcp") {
    const body = await readJsonBody(request);
    await sendPaidJson(response, 200, inspectMcp(body), payment);
    return;
  }

  if (method === "POST" && url.pathname === "/generate/bazaar-metadata") {
    const body = await readJsonBody(request);
    await sendPaidJson(response, 200, generateBazaarMetadata(body), payment);
    return;
  }

  if (method === "POST" && url.pathname === "/score/agent-readiness") {
    const body = await readJsonBody(request);
    const report = body.type === "mcp" || Array.isArray(body.tools) ? inspectMcp(body) : inspectOpenApi(body);
    await sendPaidJson(response, 200, {
      type: report.type,
      score: report.score,
      grade: report.grade,
      summary: report.summary,
      riskCount: report.risks.length,
      recommendationCount: report.recommendations.length
    }, payment);
    return;
  }

  sendJson(response, 404, {
    error: "not_found",
    message: `No route for ${method} ${url.pathname}.`
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = "";

    request.setEncoding("utf8");
    request.on("data", chunk => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body exceeds 1MB limit."));
        request.destroy();
        return;
      }
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body, headers = {}) {
  const payload = status === 204 ? "" : JSON.stringify(body, null, 2);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-agentspec-dev-payment,payment-signature,x-payment",
    "access-control-expose-headers": "payment-required,payment-response",
    ...headers
  });
  response.end(payload);
}

async function sendPaidJson(response, status, body, payment) {
  const settlement = await settleAuthorizedPayment(payment);
  if (!settlement.ok) {
    sendJson(response, settlement.status, settlement.body, settlement.headers);
    return;
  }

  sendJson(response, status, body, {
    ...(payment.headers ?? {}),
    ...(settlement.headers ?? {})
  });
}

async function tryServeStatic(pathname, response) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = normalize(join(PUBLIC_DIR, relativePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return false;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentType(filePath),
      "cache-control": "no-store"
    });
    response.end(data);
    return true;
  } catch {
    return false;
  }
}

function contentType(filePath) {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function baseUrlFromRequest(request) {
  const proto = request.headers["x-forwarded-proto"] ?? "http";
  const host = request.headers["x-forwarded-host"] ?? request.headers.host ?? `localhost:${DEFAULT_PORT}`;
  return `${proto}://${host}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  loadDotEnv();

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = createServer();

  server.on("error", error => {
    if (error.code === "EADDRINUSE") {
      console.error(`AgentSpec API could not start because ${host}:${port} is already in use.`);
      console.error("Use the already-running server, stop it with Ctrl+C, or start this one with a different PORT.");
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`AgentSpec API listening on http://${host}:${port}`);
  });
}
