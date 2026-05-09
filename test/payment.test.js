import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import test from "node:test";
import { generateCdpJwt } from "../src/cdp-auth.js";
import {
  findPaidRoute,
  maybeRequirePayment,
  paymentConfig,
  paymentMode,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER
} from "../src/x402-config.js";

const route = findPaidRoute("POST", "/inspect/openapi");

function request(headers = {}) {
  return {
    headers: {
      host: "127.0.0.1:4020",
      ...headers
    }
  };
}

function decodeHeader(value) {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function encodeHeader(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

test("payment mode aliases normalize to off/on", () => {
  assert.equal(paymentMode({ AGENTSPEC_PAYMENT_MODE: "enabled" }), "on");
  assert.equal(paymentMode({ AGENTSPEC_PAYMENT_MODE: "false" }), "off");
  assert.equal(paymentMode({ AGENTSPEC_PAYMENT_MODE: "x402" }), "x402");
  assert.equal(paymentMode({ AGENTSPEC_PAYMENT_MODE: "unknown" }), "off");
});

test("payment mode off allows paid routes without a challenge", () => {
  const result = maybeRequirePayment(request(), route, { AGENTSPEC_PAYMENT_MODE: "off" });
  assert.equal(result.ok, true);
});

test("payment mode on returns an x402 payment challenge without a signature", () => {
  const result = maybeRequirePayment(request(), route, {
    AGENTSPEC_PAYMENT_MODE: "on",
    AGENTSPEC_PAY_TO: "0xAgentSpecWallet",
    AGENTSPEC_X402_NETWORK: "base-sepolia"
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 402);
  assert.equal(result.body.error, "payment_required");
  assert.equal(result.body.payment.mode, "on");
  assert.ok(result.headers[PAYMENT_REQUIRED_HEADER]);

  const decoded = decodeHeader(result.headers[PAYMENT_REQUIRED_HEADER]);
  assert.equal(decoded.x402Version, 2);
  assert.equal(decoded.accepts[0].scheme, "exact");
  assert.equal(decoded.accepts[0].network, "base-sepolia");
  assert.equal(decoded.accepts[0].asset, "USDC");
  assert.equal(decoded.accepts[0].maxAmountRequired, "30000");
  assert.equal(decoded.accepts[0].amount, "30000");
  assert.equal(decoded.accepts[0].payTo, "0xAgentSpecWallet");
  assert.equal(decoded.accepts[0].resource, "http://127.0.0.1:4020/inspect/openapi");
});

test("payment signature is decoded for facilitator verification", () => {
  const paymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "30000",
      payTo: "0xAgentSpecWallet"
    },
    payload: { signature: "0x1234" }
  };
  const result = maybeRequirePayment(request({ "payment-signature": encodeHeader(paymentPayload) }), route, {
    AGENTSPEC_PAYMENT_MODE: "on",
    AGENTSPEC_PAY_TO: "0xAgentSpecWallet"
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.paymentPayload, paymentPayload);
  assert.equal(result.paymentRequirements.amount, "30000");
  assert.equal(result.paymentRequirements.network, "eip155:84532");
});

test("dev-402 mode supports a local paid-header bypass", () => {
  const result = maybeRequirePayment(request({ "x-agentspec-dev-payment": "paid" }), route, {
    AGENTSPEC_PAYMENT_MODE: "dev-402"
  });

  assert.equal(result.ok, true);
  assert.ok(result.headers[PAYMENT_RESPONSE_HEADER]);

  const decoded = decodeHeader(result.headers[PAYMENT_RESPONSE_HEADER]);
  assert.equal(decoded.success, true);
  assert.equal(decoded.mode, "dev-402");
});

test("payment config exposes enabled route settings", () => {
  const config = paymentConfig({
    AGENTSPEC_PAYMENT_MODE: "on",
    AGENTSPEC_PAY_TO: "0xAgentSpecWallet"
  });

  assert.equal(config.enabled, true);
  assert.equal(config.mode, "on");
  assert.equal(config.payTo, "0xAgentSpecWallet");
  assert.equal(config.facilitatorProvider, "coinbase-cdp");
  assert.equal(config.facilitatorUrl, "https://api.cdp.coinbase.com/platform/v2/x402");
  assert.equal(config.cdpAuthRequired, true);
  assert.equal(config.cdpApiKeysConfigured, false);
  assert.equal(config.network, "eip155:84532");
  assert.equal(config.asset, "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  assert.equal(config.assetSymbol, "USDC");
});

test("generateCdpJwt creates an Ed25519 bearer token shape", () => {
  const { privateKey } = generateKeyPairSync("ed25519");
  const apiKeySecret = privateKey.export({ format: "pem", type: "pkcs8" });
  const token = generateCdpJwt({
    apiKeyId: "organizations/test/apiKeys/test",
    apiKeySecret,
    requestMethod: "GET",
    requestHost: "api.cdp.coinbase.com",
    requestPath: "/platform/v2/x402/supported"
  });

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

  assert.equal(header.alg, "EdDSA");
  assert.equal(header.kid, "organizations/test/apiKeys/test");
  assert.equal(payload.iss, "cdp");
  assert.deepEqual(payload.aud, ["cdp_service"]);
  assert.equal(payload.uri, "GET api.cdp.coinbase.com/platform/v2/x402/supported");
  assert.ok(encodedSignature.length > 40);
});

test("generateCdpJwt supports CDP Ed25519 base64 key secrets", () => {
  const apiKeySecret = Buffer.concat([randomBytes(32), randomBytes(32)]).toString("base64");
  const token = generateCdpJwt({
    apiKeyId: "organizations/test/apiKeys/test",
    apiKeySecret,
    requestMethod: "GET",
    requestHost: "api.cdp.coinbase.com",
    requestPath: "/platform/v2/x402/supported"
  });

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

  assert.equal(header.alg, "EdDSA");
  assert.equal(payload.sub, "organizations/test/apiKeys/test");
  assert.ok(encodedSignature.length > 40);
});
