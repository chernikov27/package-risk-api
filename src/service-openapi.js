import { X402_ROUTES } from "./x402-config.js";

export function serviceOpenApi(baseUrl = "http://localhost:4021") {
  return {
    openapi: "3.1.0",
    info: {
      title: "DepScout API",
      version: "0.2.0",
      description: "Check package risk before coding agents install dependencies.",
      "x-guidance": "Use DepScout before a coding agent installs an npm package, PyPI package, or GitHub repository dependency. Call POST /risk/package with an ecosystem and package name to receive a safe, caution, or block install verdict. Compatibility routes include POST /inspect/openapi for API readiness checks."
    },
    servers: [{ url: baseUrl }],
    paths: {
      "/health": {
        get: {
          operationId: "getHealth",
          summary: "Return service health.",
          responses: {
            "200": {
              description: "Service is healthy.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" },
                      service: { type: "string" }
                    },
                    required: ["ok", "service"]
                  },
                  example: { ok: true, service: "DepScout" }
                }
              }
            }
          }
        }
      },
      "/x402/routes": {
        get: {
          operationId: "listX402Routes",
          summary: "List DepScout paid route metadata.",
          responses: {
            "200": {
              description: "Paid route catalog and current payment configuration.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true
                  }
                }
              }
            }
          }
        }
      },
      ...Object.fromEntries(X402_ROUTES.map(route => [
        route.path,
        {
          [route.method.toLowerCase()]: {
            operationId: route.path.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "_"),
            summary: route.description,
            description: `${route.description} Price suggestion: ${route.price} ${route.currency} per call.`,
            "x-depscout-pricing": {
              amount: route.price,
              currency: route.currency,
              unit: "per call",
              category: route.category
            },
            "x-payment-info": {
              price: {
                mode: "fixed",
                currency: "USD",
                amount: fixedUsdAmount(route.price)
              },
              protocols: [{ x402: {} }]
            },
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true
                  },
                  example: requestExample(route.path)
                }
              }
            },
            responses: {
              "200": {
                description: responseDescription(route.path),
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      additionalProperties: true
                    },
                    example: responseExample(route.path)
                  }
                }
              },
              "402": {
                description: "Payment required when x402 payment mode is enabled.",
                headers: {
                  "PAYMENT-REQUIRED": {
                    description: "Base64-encoded x402 payment requirements JSON.",
                    schema: { type: "string" }
                  }
                },
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        error: { type: "string" },
                        x402Version: { type: "integer" },
                        accepts: {
                          type: "array",
                          items: {
                            type: "object",
                            additionalProperties: true
                          }
                        }
                      },
                      required: ["error", "x402Version", "accepts"],
                      additionalProperties: true
                    }
                  }
                }
              },
              "501": {
                description: "Payment signature was supplied, but local no-dependency settlement is not configured."
              }
            }
          }
        }
      ]))
    }
  };
}

function fixedUsdAmount(price) {
  return Number(price).toFixed(6);
}

function requestExample(path) {
  if (path === "/risk/package") {
    return { ecosystem: "npm", name: "react" };
  }

  if (path.includes("openapi")) {
    return { spec: { openapi: "3.1.0", info: { title: "Example", version: "1.0.0" }, paths: {} } };
  }

  return { name: "Example service" };
}

function responseDescription(path) {
  return path === "/risk/package" ? "Package risk install decision." : "Inspection result.";
}

function responseExample(path) {
  if (path === "/risk/package") {
    return {
      type: "package-risk",
      service: "DepScout",
      ecosystem: "npm",
      name: "react",
      verdict: "safe",
      score: 94,
      recommendation: "Install may proceed without extra user confirmation.",
      topReasons: []
    };
  }

  return { score: 86, grade: "B", recommendations: [] };
}
