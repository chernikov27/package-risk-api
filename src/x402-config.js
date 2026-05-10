import { settleCdpPayment, verifyCdpPayment } from "./cdp-facilitator.js";

export const PAYMENT_REQUIRED_HEADER = "PAYMENT-REQUIRED";
export const PAYMENT_RESPONSE_HEADER = "PAYMENT-RESPONSE";
export const PAYMENT_SIGNATURE_HEADER = "PAYMENT-SIGNATURE";

export const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";
export const X402_ORG_TESTNET_FACILITATOR_URL = "https://x402.org/facilitator";

const DEFAULT_NETWORK = "eip155:84532";
const DEFAULT_FACILITATOR_URL = CDP_FACILITATOR_URL;
const DEFAULT_ASSET_SYMBOL = "USDC";
const DEFAULT_ASSET_DECIMALS = 6;
const DEFAULT_X402_VERSION = 2;
const DEFAULT_TIMEOUT_SECONDS = 300;
const USDC_ASSET_BY_NETWORK = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "eip155:84532": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
};
const USDC_EIP712_DOMAIN_BY_NETWORK = {
  "eip155:8453": { name: "USD Coin", version: "2" },
  "eip155:84532": { name: "USDC", version: "2" }
};

export const X402_ROUTES = [
  {
    method: "POST",
    path: "/inspect/openapi",
    price: "0.03",
    currency: "USDC",
    category: "developer-tools",
    description: "Inspect an OpenAPI spec and return agent-readiness score, risks, recommendations, and x402 Bazaar candidates."
  },
  {
    method: "POST",
    path: "/inspect/mcp",
    price: "0.03",
    currency: "USDC",
    category: "developer-tools",
    description: "Inspect MCP tools and return agent-readiness score, risky tools, missing schemas, and marketplace candidates."
  },
  {
    method: "POST",
    path: "/generate/bazaar-metadata",
    price: "0.05",
    currency: "USDC",
    category: "developer-tools",
    description: "Generate x402 Bazaar metadata draft from an AgentSpec report or service description."
  },
  {
    method: "POST",
    path: "/score/agent-readiness",
    price: "0.02",
    currency: "USDC",
    category: "developer-tools",
    description: "Return a compact agent-readiness score for OpenAPI or MCP input."
  }
];

export function findPaidRoute(method, pathname) {
  return X402_ROUTES.find(route => route.method === method.toUpperCase() && route.path === pathname) ?? null;
}

export function paymentMode(env = process.env) {
  const rawMode = String(env.AGENTSPEC_PAYMENT_MODE ?? "off").toLowerCase();
  if (rawMode === "1" || rawMode === "true" || rawMode === "enabled") return "on";
  if (rawMode === "0" || rawMode === "false" || rawMode === "disabled") return "off";
  if (["off", "dev-402", "on", "x402"].includes(rawMode)) return rawMode;
  return "off";
}

export function paymentEnabled(env = process.env) {
  return paymentMode(env) !== "off";
}

export function paymentConfig(env = process.env) {
  const mode = paymentMode(env);
  const facilitatorUrl = env.AGENTSPEC_X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL;
  const facilitatorProvider = env.AGENTSPEC_X402_FACILITATOR_PROVIDER ?? inferFacilitatorProvider(facilitatorUrl);
  const cdpApiKeyIdConfigured = Boolean(env.CDP_API_KEY_ID);
  const cdpApiKeySecretConfigured = Boolean(env.CDP_API_KEY_SECRET);
  const cdpBearerTokenConfigured = Boolean(env.CDP_BEARER_TOKEN);
  const network = env.AGENTSPEC_X402_NETWORK ?? DEFAULT_NETWORK;

  return {
    mode,
    enabled: mode !== "off",
    payTo: env.AGENTSPEC_PAY_TO ?? "",
    network,
    facilitatorUrl,
    facilitatorProvider,
    cdpAuthRequired: facilitatorProvider === "coinbase-cdp",
    cdpApiKeysConfigured: cdpApiKeyIdConfigured && cdpApiKeySecretConfigured,
    cdpBearerTokenConfigured,
    cdpAuthConfigured: cdpBearerTokenConfigured || (cdpApiKeyIdConfigured && cdpApiKeySecretConfigured),
    asset: env.AGENTSPEC_X402_ASSET ?? defaultAssetForNetwork(network),
    assetSymbol: env.AGENTSPEC_X402_ASSET_SYMBOL ?? DEFAULT_ASSET_SYMBOL,
    assetDecimals: Number(env.AGENTSPEC_X402_ASSET_DECIMALS ?? DEFAULT_ASSET_DECIMALS),
    x402Version: Number(env.AGENTSPEC_X402_VERSION ?? DEFAULT_X402_VERSION),
    maxTimeoutSeconds: Number(env.AGENTSPEC_X402_TIMEOUT_SECONDS ?? DEFAULT_TIMEOUT_SECONDS)
  };
}

export function maybeRequirePayment(request, route, env = process.env) {
  const config = paymentConfig(env);

  if (!route || !config.enabled) {
    return { ok: true };
  }

  const requirements = buildPaymentRequirements(request, route, config);
  const challengeHeader = encodeBase64Json(requirements);

  if (config.mode === "dev-402" && headerValue(request.headers["x-agentspec-dev-payment"]) === "paid") {
    return {
      ok: true,
      headers: {
        [PAYMENT_RESPONSE_HEADER]: encodeBase64Json({
          x402Version: config.x402Version,
          success: true,
          mode: "dev-402",
          route: `${route.method} ${route.path}`,
          message: "Local development payment bypass accepted. No real settlement occurred."
        })
      }
    };
  }

  const signature = headerValue(request.headers["payment-signature"]) || headerValue(request.headers["x-payment"]);
  if (!signature) {
    return {
      ok: false,
      status: 402,
      headers: {
        [PAYMENT_REQUIRED_HEADER]: challengeHeader,
        "cache-control": "no-store"
      },
      body: buildPaymentRequiredBody(route, config, requirements)
    };
  }

  try {
    return {
      ok: true,
      config,
      challengeHeader,
      paymentPayload: decodeBase64Json(signature),
      paymentRequirements: toFacilitatorPaymentRequirements(requirements)
    };
  } catch {
    return {
      ok: false,
      status: 402,
      headers: {
        [PAYMENT_REQUIRED_HEADER]: challengeHeader,
        "cache-control": "no-store"
      },
      body: {
        error: "invalid_payment_payload",
        message: "PAYMENT-SIGNATURE/X-PAYMENT must be base64-encoded JSON.",
        route: publicRoute(route),
        payment: publicPaymentConfig(config)
      }
    }
  }
}

export async function authorizePayment(request, route, env = process.env) {
  const initial = maybeRequirePayment(request, route, env);
  if (!initial.ok || !route || !paymentEnabled(env)) {
    return initial;
  }

  if (!initial.paymentPayload) {
    return initial;
  }

  const { paymentPayload, paymentRequirements, config, challengeHeader } = initial;

  if (config.facilitatorProvider !== "coinbase-cdp") {
    return {
      ok: false,
      status: 501,
      headers: {
        [PAYMENT_REQUIRED_HEADER]: challengeHeader,
        "cache-control": "no-store"
      },
      body: {
        error: "facilitator_not_supported",
        message: "Direct facilitator settlement is currently implemented for Coinbase CDP Facilitator only.",
        route: publicRoute(route),
        payment: publicPaymentConfig(config)
      }
    };
  }

  try {
    const verification = await verifyCdpPayment({
      config,
      env,
      paymentPayload,
      paymentRequirements
    });

    if (!verification.isValid) {
      return {
        ok: false,
        status: 402,
        headers: {
          [PAYMENT_REQUIRED_HEADER]: challengeHeader,
          "cache-control": "no-store"
        },
        body: {
          error: "payment_invalid",
          message: verification.invalidMessage || verification.invalidReason || "Coinbase CDP Facilitator rejected the payment.",
          verification,
          route: publicRoute(route),
          payment: publicPaymentConfig(config)
        }
      };
    }

    return {
      ok: true,
      paymentPayload,
      paymentRequirements,
      verification,
      settle: () => settleWithCdp({ config, env, paymentPayload, paymentRequirements, route, challengeHeader })
    };
  } catch (error) {
    return facilitatorErrorResult(error, route, config, challengeHeader, "payment_verification_failed");
  }
}

export async function settleAuthorizedPayment(payment) {
  if (!payment?.settle) {
    return { ok: true, headers: payment?.headers ?? {} };
  }

  return payment.settle();
}

export function buildPaymentRequirements(request, route, config = paymentConfig()) {
  const amount = amountToAtomicUnits(route.price, config.assetDecimals);
  const resourceUrl = resourceUrlFromRequest(request, route);
  const bazaarExtension = buildBazaarExtension(route);

  return {
    x402Version: config.x402Version,
    resource: {
      url: resourceUrl,
      description: route.description,
      mimeType: "application/json"
    },
    accepts: [
      {
        scheme: "exact",
        network: config.network,
        maxAmountRequired: amount,
        amount,
        asset: config.asset,
        payTo: config.payTo || "set AGENTSPEC_PAY_TO",
        resource: resourceUrl,
        description: route.description,
        mimeType: "application/json",
        maxTimeoutSeconds: config.maxTimeoutSeconds,
        extra: {
          ...defaultAssetEip712Domain(config.network),
          service: "AgentSpec",
          route: `${route.method} ${route.path}`,
          category: route.category,
          currency: route.currency,
          assetSymbol: config.assetSymbol
        }
      }
    ],
    extensions: {
      bazaar: bazaarExtension
    }
  };
}

function buildPaymentRequiredBody(route, config, requirements) {
  const devNote = config.mode === "dev-402"
    ? "Local development payment gate. Retry with header `x-agentspec-dev-payment: paid` to bypass. This is not a real x402 settlement."
    : "Payment required. Retry with a valid x402 `PAYMENT-SIGNATURE` header after paying the quoted requirement.";

  return {
    error: "payment_required",
    mode: config.mode,
    message: devNote,
    route: publicRoute(route),
    payment: publicPaymentConfig(config),
    ...requirements
  };
}

function publicRoute(route) {
  return {
    method: route.method,
    path: route.path,
    price: route.price,
    currency: route.currency,
    category: route.category,
    description: route.description
  };
}

function publicPaymentConfig(config) {
  return {
    mode: config.mode,
    enabled: config.enabled,
    payTo: config.payTo,
    network: config.network,
    facilitatorUrl: config.facilitatorUrl,
    facilitatorProvider: config.facilitatorProvider,
    cdpAuthRequired: config.cdpAuthRequired,
    cdpApiKeysConfigured: config.cdpApiKeysConfigured,
    cdpBearerTokenConfigured: config.cdpBearerTokenConfigured,
    cdpAuthConfigured: config.cdpAuthConfigured,
    asset: config.asset,
    assetSymbol: config.assetSymbol,
    assetDecimals: config.assetDecimals,
    x402Version: config.x402Version
  };
}

async function settleWithCdp({ config, env, paymentPayload, paymentRequirements, route, challengeHeader }) {
  try {
    const settlement = await settleCdpPayment({
      config,
      env,
      paymentPayload,
      paymentRequirements
    });

    if (!settlement.success) {
      return {
        ok: false,
        status: 402,
        headers: {
          [PAYMENT_REQUIRED_HEADER]: challengeHeader,
          [PAYMENT_RESPONSE_HEADER]: encodeBase64Json(settlement),
          "cache-control": "no-store"
        },
        body: {
          error: "payment_settlement_failed",
          message: settlement.errorMessage || settlement.errorReason || "Coinbase CDP Facilitator could not settle the payment.",
          settlement,
          route: publicRoute(route),
          payment: publicPaymentConfig(config)
        }
      };
    }

    return {
      ok: true,
      headers: {
        [PAYMENT_RESPONSE_HEADER]: encodeBase64Json(settlement)
      },
      settlement
    };
  } catch (error) {
    return facilitatorErrorResult(error, route, config, challengeHeader, "payment_settlement_failed");
  }
}

function facilitatorErrorResult(error, route, config, challengeHeader, code) {
  return {
    ok: false,
    status: error.status === 401 || error.status === 403 ? 502 : 402,
    headers: {
      [PAYMENT_REQUIRED_HEADER]: challengeHeader,
      "cache-control": "no-store"
    },
    body: {
      error: code,
      message: error.message,
      facilitatorStatus: error.status,
      facilitatorPayload: sanitizeFacilitatorPayload(error.payload),
      route: publicRoute(route),
      payment: publicPaymentConfig(config)
    }
  };
}

function sanitizeFacilitatorPayload(payload) {
  if (!payload || typeof payload !== "object") return payload ?? null;
  const { token, jwt, authorization, ...safePayload } = payload;
  return safePayload;
}

function toFacilitatorPaymentRequirements(requirements) {
  const accepted = requirements.accepts[0];
  return {
    scheme: accepted.scheme,
    network: accepted.network,
    asset: accepted.asset,
    amount: accepted.amount ?? accepted.maxAmountRequired,
    payTo: accepted.payTo,
    maxTimeoutSeconds: accepted.maxTimeoutSeconds,
    extra: accepted.extra,
    extensions: requirements.extensions
  };
}

function buildBazaarExtension(route) {
  const inputBody = bazaarInputBodyExample(route);
  const outputExample = bazaarOutputExample(route);

  return {
    info: {
      input: {
        type: "http",
        method: route.method,
        bodyType: "json",
        body: inputBody
      },
      output: {
        type: "json",
        example: outputExample
      }
    },
    schema: {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        input: {
          type: "object",
          properties: {
            type: { type: "string", const: "http" },
            method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
            bodyType: { type: "string", enum: ["json", "form-data", "text"] },
            body: { type: "object" },
            queryParams: {
              type: "object",
              additionalProperties: { type: "string" }
            },
            headers: {
              type: "object",
              additionalProperties: { type: "string" }
            }
          },
          required: ["type", "method", "bodyType", "body"],
          additionalProperties: false
        },
        output: {
          type: "object",
          properties: {
            type: { type: "string" },
            example: {}
          },
          required: ["type"]
        }
      },
      required: ["input"]
    }
  };
}

function bazaarInputBodyExample(route) {
  if (route.path === "/inspect/openapi") {
    return {
      spec: {
        openapi: "3.1.0",
        info: { title: "Weather Utility API", version: "1.0.0" },
        paths: {
          "/forecast": {
            get: {
              operationId: "getForecast",
              summary: "Get a weather forecast by city.",
              responses: {
                "200": {
                  description: "Forecast result.",
                  content: {
                    "application/json": {
                      schema: { type: "object" },
                      example: { city: "Paris", days: [] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  if (route.path === "/inspect/mcp") {
    return {
      name: "Repo Assistant MCP",
      tools: [
        {
          name: "inspect_repository",
          description: "Analyze a public GitHub repository and return detected stack.",
          inputSchema: {
            type: "object",
            properties: {
              repoUrl: { type: "string" }
            },
            required: ["repoUrl"],
            additionalProperties: false
          }
        }
      ]
    };
  }

  if (route.path === "/generate/bazaar-metadata") {
    return {
      report: {
        type: "openapi",
        name: "Weather Utility API",
        score: 100,
        grade: "A",
        bazaarCandidates: [
          {
            name: "getForecast",
            method: "GET",
            path: "/forecast",
            description: "Get a weather forecast by city.",
            inputSchema: {
              type: "object",
              properties: { city: { type: "string" } },
              required: ["city"]
            },
            outputExample: { status: 200, data: { city: "Paris" } }
          }
        ]
      }
    };
  }

  if (route.path === "/score/agent-readiness") {
    return {
      spec: {
        openapi: "3.1.0",
        info: { title: "Mini API", version: "1.0.0" },
        paths: {
          "/ping": {
            get: {
              operationId: "ping",
              summary: "Ping service",
              responses: {
                "200": {
                  description: "pong",
                  content: {
                    "application/json": {
                      schema: { type: "object" },
                      example: { ok: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  return {};
}

function bazaarOutputExample(route) {
  if (route.path === "/generate/bazaar-metadata") {
    return {
      name: "getForecast",
      category: "developer-tools",
      priceSuggestion: { amount: "0.03", currency: "USDC", unit: "per call" },
      bazaarDraft: { discoverable: true }
    };
  }

  if (route.path === "/score/agent-readiness") {
    return {
      type: "openapi",
      score: 93,
      grade: "A",
      riskCount: 0,
      recommendationCount: 2
    };
  }

  return {
    type: route.path.includes("mcp") ? "mcp" : "openapi",
    score: 96,
    grade: "A",
    risks: [],
    recommendations: [],
    bazaarCandidates: []
  };
}

function amountToAtomicUnits(amount, decimals) {
  const [whole, fraction = ""] = String(amount).split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/u, "") || "0";
}

function defaultAssetForNetwork(network) {
  return USDC_ASSET_BY_NETWORK[network] ?? DEFAULT_ASSET_SYMBOL;
}

function defaultAssetEip712Domain(network) {
  return USDC_EIP712_DOMAIN_BY_NETWORK[network] ?? {};
}

function inferFacilitatorProvider(facilitatorUrl) {
  if (facilitatorUrl.startsWith(CDP_FACILITATOR_URL)) return "coinbase-cdp";
  if (facilitatorUrl.startsWith(X402_ORG_TESTNET_FACILITATOR_URL)) return "x402-org-testnet";
  return "custom";
}

function resourceUrlFromRequest(request, route) {
  const proto = headerValue(request.headers["x-forwarded-proto"]) || "http";
  const host = headerValue(request.headers["x-forwarded-host"]) || headerValue(request.headers.host) || "localhost:4020";
  return `${proto}://${host}${route.path}`;
}

function encodeBase64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

function decodeBase64Json(value) {
  return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
}

function headerValue(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
