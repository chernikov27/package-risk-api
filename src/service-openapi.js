import { X402_ROUTES } from "./x402-config.js";

export function serviceOpenApi(baseUrl = "http://localhost:4020") {
  return {
    openapi: "3.1.0",
    info: {
      title: "AgentSpec API",
      version: "0.2.0",
      description: "Inspect OpenAPI specs, MCP tools, and API docs, then generate agent-ready x402 Bazaar metadata."
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
                  example: { ok: true, service: "AgentSpec" }
                }
              }
            }
          }
        }
      },
      "/x402/routes": {
        get: {
          operationId: "listX402Routes",
          summary: "List AgentSpec paid route metadata.",
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
            "x-agentspec-pricing": {
              amount: route.price,
              currency: route.currency,
              unit: "per call",
              category: route.category
            },
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: true
                  },
                  example: route.path.includes("openapi")
                    ? { spec: { openapi: "3.1.0", info: { title: "Example", version: "1.0.0" }, paths: {} } }
                    : { name: "Example service" }
                }
              }
            },
            responses: {
              "200": {
                description: "Inspection result.",
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      additionalProperties: true
                    },
                    example: { score: 86, grade: "B", recommendations: [] }
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
