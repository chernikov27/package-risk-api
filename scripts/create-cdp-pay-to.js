import { loadDotEnv } from "../src/load-env.js";

loadDotEnv();

const required = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required setting(s): ${missing.join(", ")}`);
  console.error("Add them to .env first. Do not paste secrets into chat.");
  process.exit(1);
}

let CdpClient;

try {
  ({ CdpClient } = await import("@coinbase/cdp-sdk"));
} catch {
  console.error("Missing package: @coinbase/cdp-sdk");
  console.error("Install it with: npm install @coinbase/cdp-sdk");
  process.exit(1);
}

const accountName = process.env.CDP_EVM_ACCOUNT_NAME || "agentspec-pay-to";
const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: accountName });

console.log(`Created/found CDP EVM account: ${accountName}`);
console.log(`Address: ${account.address}`);
console.log("");
console.log("Put this in .env:");
console.log(`AGENTSPEC_PAY_TO=${account.address}`);
