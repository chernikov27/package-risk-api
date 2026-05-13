import { readFile } from "node:fs/promises";

const baseUrl = process.env.DEPSCOUT_BASE_URL ?? "http://127.0.0.1:4021";
const sampleBody = JSON.parse(await readFile("examples/openapi-weather.json", "utf8"));

async function main() {
  const routes = await fetchJson("GET", "/x402/routes");
  if (!routes.routes?.some(route => route.path === "/risk/package")) {
    throw new Error("/x402/routes did not include /risk/package.");
  }
  console.log("ok GET /x402/routes");

  const challenge = await fetch(`${baseUrl}/inspect/openapi`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sampleBody)
  });

  if (challenge.status !== 402) {
    throw new Error(`Expected 402 challenge, received ${challenge.status}. Start the server with DEPSCOUT_PAYMENT_MODE=dev-402.`);
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
      "x-depscout-dev-payment": "paid"
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

  // Check /risk/package 402 challenge
  const riskChallenge = await fetch(`${baseUrl}/risk/package`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ecosystem: "npm", name: "react" })
  });

  if (riskChallenge.status !== 402) {
    throw new Error(`Expected 402 challenge on /risk/package, received ${riskChallenge.status}.`);
  }
  console.log("ok POST /risk/package returns 402 challenge");

  // Check /risk/package accepts dev bypass
  const riskPaid = await fetch(`${baseUrl}/risk/package`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-depscout-dev-payment": "paid"
    },
    body: JSON.stringify({ ecosystem: "npm", name: "react" })
  });

  if (!riskPaid.ok) {
    throw new Error(`Dev paid request to /risk/package failed with ${riskPaid.status}: ${await riskPaid.text()}`);
  }

  const riskPayload = await riskPaid.json();
  if (riskPayload.type !== "package-risk" || !["safe", "caution", "block"].includes(riskPayload.verdict)) {
    throw new Error(`/risk/package returned unexpected payload: ${JSON.stringify(riskPayload).slice(0, 200)}`);
  }
  console.log("ok POST /risk/package accepts dev paid header");

  console.log(`DepScout payment smoke test passed at ${baseUrl}`);
}

async function fetchJson(method, path) {
  const response = await fetch(`${baseUrl}${path}`, { method });
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

main().catch(error => {
  console.error(`DepScout payment smoke test failed: ${error.message}`);
  console.error("Start the server with DEPSCOUT_PAYMENT_MODE=dev-402 in another terminal first, then rerun this command.");
  process.exit(1);
});
