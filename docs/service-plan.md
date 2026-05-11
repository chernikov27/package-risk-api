# DepScout Service Plan

## Goal

Build DepScout as a paid x402 package-risk API for coding agents.

## Product Promise

**Install decisions for coding agents.**

DepScout returns a compact install decision that an IDE agent, repo bot, or CI workflow can use before adding a dependency:

- `safe`, `caution`, or `block` verdict
- score and top reasons
- license metadata
- last release or repository activity
- maintainer/owner signals
- deprecation/yanked/vulnerability signals where public metadata exposes them
- install-size and dependency-footprint hints
- typosquat suspicion

## MVP Endpoints

| Endpoint | Price | Purpose |
| --- | ---: | --- |
| `POST /risk/package` | `0.02 USDC` | Check npm, PyPI, or GitHub package risk before install. |
| `GET /x402/routes` | free | Return paid route metadata and current payment configuration. |
| `GET /openapi.json` | free | Return machine-readable API discovery metadata. |

Compatibility routes from the original copy remain available until removed in a later cleanup pass:

| Endpoint | Price | Purpose |
| --- | ---: | --- |
| `POST /inspect/openapi` | `0.03 USDC` | Legacy API readiness inspection. |
| `POST /inspect/mcp` | `0.03 USDC` | Legacy MCP tool inspection. |
| `POST /generate/bazaar-metadata` | `0.05 USDC` | Legacy Bazaar metadata draft generation. |
| `POST /score/agent-readiness` | `0.02 USDC` | Legacy compact readiness score. |

## First Customer

The first buyer is a developer or team using coding agents that can install dependencies. They pay because DepScout turns an uncertain install into a cheap, machine-readable decision.

## Non-Goals

- Legal compliance advice
- Guaranteed malware detection
- Full enterprise SCA replacement
- KYC, sanctions, or regulated-finance validation
- Replacing x402 facilitator/payment infrastructure

## Payment Modes

`AGENTSPEC_PAYMENT_MODE=off`

No payment gate. Used for local development and tests.

`AGENTSPEC_PAYMENT_MODE=dev-402`

Returns a local `402` challenge unless the request includes:

```http
x-agentspec-dev-payment: paid
```

This does not settle real x402 payments.

`AGENTSPEC_PAYMENT_MODE=x402`

Production-like mode. Next.js App Router routes verify and settle through the configured x402 facilitator.
