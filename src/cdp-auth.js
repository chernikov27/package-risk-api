import { randomBytes, createPrivateKey, sign as cryptoSign } from "node:crypto";

const DEFAULT_EXPIRES_IN_SECONDS = 120;

export function generateCdpJwt({
  apiKeyId,
  apiKeySecret,
  requestMethod,
  requestHost,
  requestPath,
  expiresIn = DEFAULT_EXPIRES_IN_SECONDS
}) {
  if (!apiKeyId) throw new Error("CDP_API_KEY_ID is required.");
  if (!apiKeySecret) throw new Error("CDP_API_KEY_SECRET is required.");
  if (!requestMethod) throw new Error("requestMethod is required.");
  if (!requestHost) throw new Error("requestHost is required.");
  if (!requestPath) throw new Error("requestPath is required.");

  const privateKey = createCdpPrivateKey(apiKeySecret);
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: algorithmForKey(privateKey),
    typ: "JWT",
    kid: apiKeyId,
    nonce: randomBytes(16).toString("hex")
  };
  const payload = {
    iss: "cdp",
    sub: apiKeyId,
    aud: ["cdp_service"],
    nbf: now,
    exp: now + expiresIn,
    uri: `${requestMethod.toUpperCase()} ${requestHost}${requestPath}`
  };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signature = signJwt(privateKey, header.alg, signingInput);

  return `${signingInput}.${base64url(signature)}`;
}

export function describeCdpApiKeySecretFormat(apiKeySecret) {
  if (!apiKeySecret) {
    return { supported: false, format: "missing", decodedBytes: 0 };
  }

  const normalized = apiKeySecret.replace(/\\n/g, "\n").trim();
  if (normalized.includes("BEGIN")) {
    try {
      const privateKey = createPrivateKey(normalized);
      return {
        supported: privateKey.asymmetricKeyType === "ed25519" || privateKey.asymmetricKeyType === "ec",
        format: `pem-${privateKey.asymmetricKeyType ?? "unknown"}`,
        decodedBytes: null
      };
    } catch {
      return { supported: false, format: "invalid-pem", decodedBytes: null };
    }
  }

  const decoded = Buffer.from(normalized, "base64");
  return {
    supported: decoded.length === 64,
    format: decoded.length === 64 ? "ed25519-base64" : "unsupported",
    decodedBytes: decoded.length
  };
}

function createCdpPrivateKey(value) {
  const normalized = value.replace(/\\n/g, "\n").trim();
  if (normalized.includes("BEGIN")) {
    return createPrivateKey(normalized);
  }

  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length !== 64) {
    throw new Error(`CDP Ed25519 API key secret must decode to 64 bytes; decoded ${decoded.length} bytes.`);
  }

  return createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: base64url(decoded.subarray(0, 32)),
      x: base64url(decoded.subarray(32, 64))
    },
    format: "jwk"
  });
}

function algorithmForKey(privateKey) {
  if (privateKey.asymmetricKeyType === "ed25519") return "EdDSA";
  if (privateKey.asymmetricKeyType === "ec") return "ES256";
  throw new Error(`Unsupported CDP API key type: ${privateKey.asymmetricKeyType ?? "unknown"}.`);
}

function signJwt(privateKey, alg, signingInput) {
  if (alg === "EdDSA") {
    return cryptoSign(null, Buffer.from(signingInput), privateKey);
  }

  return cryptoSign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363"
  });
}

function base64urlJson(value) {
  return base64url(Buffer.from(JSON.stringify(value), "utf8"));
}

function base64url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}
