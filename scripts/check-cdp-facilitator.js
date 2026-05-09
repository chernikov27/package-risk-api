import { getCdpSupportedPaymentKinds } from "../src/cdp-facilitator.js";
import { loadDotEnv } from "../src/load-env.js";
import { paymentConfig } from "../src/x402-config.js";

loadDotEnv();

const config = paymentConfig();

if (!config.cdpApiKeysConfigured) {
  console.error("CDP API keys are not configured. Add CDP_API_KEY_ID and CDP_API_KEY_SECRET to .env.");
  process.exit(1);
}

try {
  const supported = await getCdpSupportedPaymentKinds(config);
  const kinds = supported.kinds ?? [];
  const exactMatches = kinds.filter(kind => kind.scheme === "exact" && kind.network === config.network);

  console.log("Coinbase CDP Facilitator reachable.");
  console.log(`configuredNetwork: ${config.network}`);
  console.log(`matchingExactKinds: ${exactMatches.length}`);
  console.log(`extensions: ${(supported.extensions ?? []).join(", ") || "none reported"}`);

  if (!exactMatches.length) {
    console.error("Configured network was not reported as supported by the facilitator.");
    process.exit(1);
  }
} catch (error) {
  console.error(`Coinbase CDP Facilitator check failed: ${error.message}`);
  if (error.status) console.error(`facilitatorStatus: ${error.status}`);
  process.exit(1);
}
