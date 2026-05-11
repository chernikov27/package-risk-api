import { readFile } from "node:fs/promises";

const baseUrl = process.env.AGENTSPEC_BASE_URL ?? "http://127.0.0.1:4021";

async function main() {
  const checks = [
    ["GET", "/health"],
    ["GET", "/openapi.json"],
    ["POST", "/inspect/openapi", JSON.parse(await readFile("examples/openapi-weather.json", "utf8"))],
    ["POST", "/inspect/mcp", JSON.parse(await readFile("examples/mcp-tools.json", "utf8"))],
    ["POST", "/generate/bazaar-metadata", {
      service: {
        name: "Weather Utility",
        path: "/forecast",
        method: "GET",
        description: "Read-only forecast lookup for agents."
      }
    }]
  ];

  for (const [method, path, body] of checks) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${path} failed with ${response.status}: ${text}`);
    }

    const payload = await response.json();
    console.log(`ok ${method} ${path}`);

    if (path === "/health" && payload.service !== "DepScout") {
      throw new Error("Health check returned an unexpected service name.");
    }
    if (path === "/inspect/openapi" && payload.type !== "openapi") {
      throw new Error("OpenAPI inspection returned an unexpected payload.");
    }
    if (path === "/inspect/mcp" && payload.type !== "mcp") {
      throw new Error("MCP inspection returned an unexpected payload.");
    }
  }

  console.log(`DepScout smoke test passed at ${baseUrl}`);
}

main().catch(error => {
  console.error(`DepScout smoke test failed: ${error.message}`);
  console.error("Start the server in another terminal first, then rerun this command.");
  process.exit(1);
});
