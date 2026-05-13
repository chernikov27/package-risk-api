# DepScout

**Install decisions for coding agents.**

DepScout is a paid x402 API that checks npm packages, PyPI packages, and GitHub repositories before a coding agent installs a dependency. It returns a compact `safe`, `caution`, or `block` verdict based on public developer-hygiene signals.

Payment environment variables use the `DEPSCOUT_*` prefix.

## Run Locally

```bash
npm install
npm run dev
```

The Next.js app starts on:

```text
http://localhost:4021
```

The main agent-facing route is:

```text
POST /risk/package
```

Compatibility routes from the previous copy remain available:

```text
/inspect/openapi
/inspect/mcp
/generate/bazaar-metadata
/score/agent-readiness
```

## Test

```bash
npm test
```

Using Node directly:

```bash
node --test
```

## Example Calls

Check an npm package:

```bash
curl -s http://localhost:4021/risk/package \
  -H 'content-type: application/json' \
  --data '{"ecosystem":"npm","name":"react"}'
```

Check a PyPI package:

```bash
curl -s http://localhost:4021/risk/package \
  -H 'content-type: application/json' \
  --data '{"ecosystem":"pypi","name":"requests"}'
```

Check a GitHub repo:

```bash
curl -s http://localhost:4021/risk/package \
  -H 'content-type: application/json' \
  --data '{"ecosystem":"github","repo":"vercel/next.js"}'
```

## Payment Modes

DepScout has three runtime modes:

- `DEPSCOUT_PAYMENT_MODE=off`: default local demo mode, no paid-route gate.
- `DEPSCOUT_PAYMENT_MODE=dev-402`: local x402-shaped simulation. Paid routes return `402 Payment Required` unless you pass the dev bypass header.
- `DEPSCOUT_PAYMENT_MODE=on` or `DEPSCOUT_PAYMENT_MODE=x402`: paid routes return a real x402 `402` challenge when no `PAYMENT-SIGNATURE` is supplied, then verify and settle through Coinbase CDP Facilitator.

Base mainnet defaults:

```bash
DEPSCOUT_X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
DEPSCOUT_X402_NETWORK=eip155:8453
DEPSCOUT_X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
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

`DEPSCOUT_PAY_TO` must be a public EVM address you control. `CDP_API_KEY_SECRET` is the CDP Secret API Key value, usually an Ed25519 base64 string; it is not a wallet private key.

`CDP_WALLET_SECRET` is only required if you run `npm run create:cdp-pay-to` to create a new CDP-managed wallet as your receiving address. If you already have an EVM address for `DEPSCOUT_PAY_TO`, leave `CDP_WALLET_SECRET` unset.

Local 402 simulation in Next:

```bash
npm run dev:402
```

Then paid endpoints return `402` unless you pass:

```http
x-depscout-dev-payment: paid
```

Production settlement is implemented in `src/lib/x402-middleware.ts` for Next.js App Router routes and uses the Coinbase CDP Facilitator calls in `src/cdp-facilitator.js`.

## Vercel Deployment

Deploy this repo as a Next.js project on Vercel. The paid API routes and landing page live in the same app.

Required production environment variables:

```bash
DEPSCOUT_PAYMENT_MODE=on
DEPSCOUT_PAY_TO=0xYourReceivingWallet
DEPSCOUT_X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
DEPSCOUT_X402_NETWORK=eip155:8453
DEPSCOUT_X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
DEPSCOUT_X402_ASSET_SYMBOL=USDC
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

## Troubleshooting

If the legacy Node server startup says:

```text
address already in use 127.0.0.1:4021
```

another DepScout server is already running. Use that server, stop it with `Ctrl+C`, or start a temporary server on another port:

```bash
PORT=4022 node src/server.js
```

Then test that port:

```bash
DEPSCOUT_BASE_URL=http://127.0.0.1:4022 node scripts/smoke.js
```
