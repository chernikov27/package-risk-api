# x402 Production Integration

DepScout now targets a Vercel-only MVP:

- Next.js App Router route handlers for the landing page and paid API.
- `src/lib/x402-middleware.ts` for x402 challenge, Coinbase Facilitator verify, handler execution, and settlement.
- Coinbase CDP Facilitator on Base mainnet.
- Vercel function `maxDuration` set to 60 seconds in `vercel.json`.

## Environment

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

`AGENTSPEC_PAY_TO` is the public receiving address. It is not a private key.

Base mainnet USDC uses EIP-3009 with this EIP-712 domain:

```json
{
  "name": "USD Coin",
  "version": "2"
}
```

The middleware includes that domain in the x402 payment requirements so AgentCash and other x402 clients can sign the authorization.

## Paid Routes

See `src/x402-config.js`.

- `POST /inspect/openapi`: `0.03 USDC`
- `POST /inspect/mcp`: `0.03 USDC`
- `POST /generate/bazaar-metadata`: `0.05 USDC`
- `POST /score/agent-readiness`: `0.02 USDC`
- `POST /risk/package`: `0.02 USDC`

## Verified Mainnet Smoke

The local implementation has been tested end to end on Base mainnet:

- payer: `REDACTED_PAYER_ADDRESS`
- payTo: `REDACTED_PAYTO_ADDRESS`
- route: `POST /inspect/openapi`
- amount: `0.03 USDC`
- transaction: `REDACTED_TX_HASH`

## Vercel Notes

Deploy as a standard Next.js project. Keep landing and API together for MVP.

If a route exceeds 60 seconds, requires persistent WebSockets, or needs stateful server memory, revisit the architecture. Current inspection endpoints respond well under the limit.
