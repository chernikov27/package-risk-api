# AgentSpec

**Turn any API into an agent-ready x402 service.**

AgentSpec inspects OpenAPI specs, MCP tools, and API docs, then generates readiness scores, risk notes, recommendations, and x402 Bazaar metadata drafts.

## Run Locally

```bash
npm install
npm run dev
```

The Next.js app starts on:

```text
http://localhost:3000
```

The Vercel/App Router API routes are available at the same public paths used by agents:

```text
/inspect/openapi
/inspect/mcp
/generate/bazaar-metadata
/score/agent-readiness
```

The previous plain Node server is still available for local fallback checks:

```bash
npm run start:node
```

## Test

```bash
npm test
```

Using portable Node directly:

```bash
"/Users/sergejcernikov/Desktop/тест клод/.codex-runtime/node-v24.15.0-darwin-arm64/bin/node" --test
```

## Example Calls

Inspect OpenAPI:

```bash
curl -s http://localhost:3000/inspect/openapi \
  -H 'content-type: application/json' \
  --data @examples/openapi-weather.json
```

Inspect MCP tools:

```bash
curl -s http://localhost:3000/inspect/mcp \
  -H 'content-type: application/json' \
  --data @examples/mcp-tools.json
```

Generate Bazaar metadata from an existing report:

```bash
curl -s http://localhost:3000/generate/bazaar-metadata \
  -H 'content-type: application/json' \
  --data '{"service":{"name":"Weather Utility","path":"/forecast","method":"GET","description":"Read-only forecast lookup for agents."}}'
```

## Payment Modes

AgentSpec has three runtime modes:

- `AGENTSPEC_PAYMENT_MODE=off`: default local demo mode, no paid-route gate.
- `AGENTSPEC_PAYMENT_MODE=dev-402`: local x402-shaped simulation. Paid routes return `402 Payment Required` unless you pass the dev bypass header.
- `AGENTSPEC_PAYMENT_MODE=on` or `AGENTSPEC_PAYMENT_MODE=x402`: paid routes return a real x402 `402` challenge when no `PAYMENT-SIGNATURE` is supplied, then verify and settle through Coinbase CDP Facilitator.

Base mainnet defaults:

```bash
AGENTSPEC_X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
AGENTSPEC_X402_NETWORK=eip155:8453
AGENTSPEC_X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

For Coinbase CDP Facilitator, also configure:

```bash
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

Use `.env.example` as the template. Real values belong in `.env`, which is ignored by git:

```bash
cp .env.example .env
npm run check:x402-env
npm run check:cdp-facilitator
```

`AGENTSPEC_PAY_TO` must be a public EVM address you control, for example `0x...` with 40 hex characters after `0x`. `CDP_API_KEY_SECRET` is the CDP Secret API Key value, usually an Ed25519 base64 string; it is not a wallet private key.

For a quick facilitator connectivity check, you can also set a temporary `CDP_BEARER_TOKEN` instead of generating JWTs from `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`. Bearer tokens expire quickly, so this is useful only for local testing.

Local 402 simulation in Next:

```bash
npm run dev:402
```

Then paid endpoints return `402` unless you pass:

```http
x-agentspec-dev-payment: paid
```

The `402` response includes:

- HTTP status `402 Payment Required`
- `PAYMENT-REQUIRED` response header with base64-encoded x402 requirements JSON
- JSON body with `accepts`, price, route, network, and facilitator settings

Run the legacy payment smoke test against the plain Node server with `dev:402:node`:

```bash
npm run dev:402:node
npm run smoke:402
```

Production settlement is implemented in `src/lib/x402-middleware.ts` for Next.js App Router routes and uses the Coinbase CDP Facilitator calls in `src/cdp-facilitator.js`.

## Vercel Deployment

Deploy this repo as a Next.js project on Vercel. The paid API routes and landing page live in the same app. Function duration is configured in `vercel.json`:

```json
{
  "functions": {
    "src/app/**/route.js": {
      "maxDuration": 60
    }
  }
}
```

Required production environment variables:

```bash
AGENTSPEC_PAYMENT_MODE=on
AGENTSPEC_PAY_TO=0xYourReceivingWallet
AGENTSPEC_X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
AGENTSPEC_X402_NETWORK=eip155:8453
AGENTSPEC_X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
AGENTSPEC_X402_ASSET_SYMBOL=USDC
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

## Troubleshooting

If the legacy Node server startup says:

```text
address already in use 127.0.0.1:4020
```

another AgentSpec server is already running. Use that server, stop the old server with `Ctrl+C`, or start a new one on another port:

```bash
PORT=4021 "/Users/sergejcernikov/Desktop/тест клод/.codex-runtime/node-v24.15.0-darwin-arm64/bin/node" src/server.js
```

Then test that port:

```bash
AGENTSPEC_BASE_URL=http://127.0.0.1:4021 "/Users/sergejcernikov/Desktop/тест клод/.codex-runtime/node-v24.15.0-darwin-arm64/bin/node" scripts/smoke.js
```

## Project Docs

- `docs/service-plan.md`
- `docs/x402-integration.md`
- `Brand/brand-brief.md`
