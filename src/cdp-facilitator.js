import { generateCdpJwt } from "./cdp-auth.js";

const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
const DEFAULT_REQUEST_HOST = "api.cdp.coinbase.com";
const DEFAULT_PLATFORM_PREFIX = "/platform";

export async function getCdpSupportedPaymentKinds(config, env = process.env, fetchImpl = fetch) {
  return cdpRequest({
    config,
    env,
    fetchImpl,
    method: "GET",
    path: "/v2/x402/supported"
  });
}

export async function verifyCdpPayment({ config, env = process.env, paymentPayload, paymentRequirements, fetchImpl = fetch }) {
  return cdpRequest({
    config,
    env,
    fetchImpl,
    method: "POST",
    path: "/v2/x402/verify",
    body: {
      x402Version: config.x402Version,
      paymentPayload,
      paymentRequirements
    }
  });
}

export async function settleCdpPayment({ config, env = process.env, paymentPayload, paymentRequirements, fetchImpl = fetch }) {
  return cdpRequest({
    config,
    env,
    fetchImpl,
    method: "POST",
    path: "/v2/x402/settle",
    body: {
      x402Version: config.x402Version,
      paymentPayload,
      paymentRequirements
    }
  });
}

async function cdpRequest({ config, env, fetchImpl, method, path, body }) {
  const facilitatorUrl = new URL(config.facilitatorUrl || CDP_FACILITATOR_URL);
  const requestHost = facilitatorUrl.host || DEFAULT_REQUEST_HOST;
  const requestPath = `${DEFAULT_PLATFORM_PREFIX}${path}`;
  const url = new URL(requestPath, `${facilitatorUrl.protocol}//${requestHost}`);
  const token = env.CDP_BEARER_TOKEN || generateCdpJwt({
    apiKeyId: env.CDP_API_KEY_ID,
    apiKeySecret: env.CDP_API_KEY_SECRET,
    requestMethod: method,
    requestHost,
    requestPath
  });

  const response = await fetchImpl(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    const message = payload?.message || payload?.error || `CDP Facilitator request failed with HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload ?? {};
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
