import { readFile } from "node:fs/promises";

const baseUrl = process.env.AGENTSPEC_BASE_URL ?? "http://127.0.0.1:4020";
const sampleBody = JSON.parse(await readFile("examples/openapi-weather.json", "utf8"));

async function main() {
  const routes = await fetchJson("GET", "/x402/routes");
  if (!routes.routes?.some(route => route.path === "/inspect/openapi")) {
    throw new Error("/x402/routes did not include /inspect/openapi.");
  }
  console.log("ok GET /x402/routes");

  const challenge = await fetch(`${baseUrl}/inspect/openapi`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sampleBody)
  });

  if (challenge.status !== 402) {
    throw new Error(`Expected 402 challenge, received ${challenge.status}. Start the server with AGENTSPEC_PAYMENT_MODE=dev-402.`);
  }

  const paymentRequired = challenge.headers.get("payment-required");
  if (!paymentRequired) {
    throw new Error("402 response did not include PAYMENT-REQUIRED header.");
  }

  const decoded = JSON.parse(Buffer.from(paymentRequired, "base64").toString("utf8"));
  if (decoded.x402Version !== 2 || !decoded.accepts?.[0]?.resource) {
    throw new Error("PAYMENT-REQUIRED header did not contain valid x402 requirements.");
  }
  console.log("ok POST /inspect/openapi returns 402 challenge");

  const paidResponse = await fetch(`${baseUrl}/inspect/openapi`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agentspec-dev-payment": "paid"
    },
    body: JSON.stringify(sampleBody)
  });

  if (!paidResponse.ok) {
    throw new Error(`Dev paid request failed with ${paidResponse.status}: ${await paidResponse.text()}`);
  }
  if (!paidResponse.headers.get("payment-response")) {
    throw new Error("Dev paid request did not include PAYMENT-RESPONSE header.");
  }

  const payload = await paidResponse.json();
  if (payload.type !== "openapi") {
    throw new Error("Dev paid request returned unexpected payload.");
  }
  console.log("ok POST /inspect/openapi accepts dev paid header");
  console.log(`AgentSpec payment smoke test passed at ${baseUrl}`);
}

async function fetchJson(method, path) {
  const response = await fetch(`${baseUrl}${path}`, { method });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

main().catch(error => {
  console.error(`AgentSpec payment smoke test failed: ${error.message}`);
  console.error("Start the server with AGENTSPEC_PAYMENT_MODE=dev-402 in another terminal first, then rerun this command.");
  process.exit(1);
});
