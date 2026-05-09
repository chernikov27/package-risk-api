import { loadDotEnv } from "../src/load-env.js";
import { describeCdpApiKeySecretFormat } from "../src/cdp-auth.js";
import { paymentConfig, X402_ROUTES } from "../src/x402-config.js";

loadDotEnv();

const config = paymentConfig();
const missing = [];
const productionLike = config.mode === "on" || config.mode === "x402";

if (productionLike && !config.payTo) {
  missing.push("AGENTSPEC_PAY_TO");
}

if (productionLike && config.cdpAuthRequired && !config.cdpAuthConfigured && !process.env.CDP_API_KEY_ID) {
  missing.push("CDP_API_KEY_ID");
}

if (productionLike && config.cdpAuthRequired && !config.cdpAuthConfigured && !process.env.CDP_API_KEY_SECRET) {
  missing.push("CDP_API_KEY_SECRET");
}

const invalid = [];
if (productionLike && config.payTo && !/^0x[a-fA-F0-9]{40}$/u.test(config.payTo)) {
  invalid.push("AGENTSPEC_PAY_TO must be a 42-character EVM address like 0x...");
}

const secretFormat = describeCdpApiKeySecretFormat(process.env.CDP_API_KEY_SECRET);
if (productionLike && config.cdpAuthRequired && !config.cdpBearerTokenConfigured && !secretFormat.supported) {
  invalid.push(`CDP_API_KEY_SECRET format is unsupported (${secretFormat.format}, decodedBytes=${secretFormat.decodedBytes ?? "n/a"})`);
}

console.log("AgentSpec x402 environment");
console.log(`mode: ${config.mode}`);
console.log(`enabled: ${config.enabled}`);
console.log(`facilitatorProvider: ${config.facilitatorProvider}`);
console.log(`facilitatorUrl: ${config.facilitatorUrl}`);
console.log(`network: ${config.network}`);
console.log(`assetSymbol: ${config.assetSymbol}`);
console.log(`asset: ${config.asset}`);
console.log(`payToConfigured: ${Boolean(config.payTo)}`);
console.log(`cdpApiKeysConfigured: ${config.cdpApiKeysConfigured}`);
console.log(`cdpBearerTokenConfigured: ${config.cdpBearerTokenConfigured}`);
console.log(`cdpAuthConfigured: ${config.cdpAuthConfigured}`);
console.log(`cdpApiKeySecretFormat: ${secretFormat.format}`);
console.log(`paidRoutes: ${X402_ROUTES.map(route => `${route.method} ${route.path} ${route.price} ${route.currency}`).join(", ")}`);

if (missing.length) {
  console.error(`Missing required production setting(s): ${missing.join(", ")}`);
  process.exit(1);
}

if (invalid.length) {
  console.error(`Invalid production setting(s): ${invalid.join("; ")}`);
  process.exit(1);
}

console.log("x402 environment looks ready for local production-like challenge testing.");
