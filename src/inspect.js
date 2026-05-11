const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

const RISKY_TERMS = [
  "delete",
  "remove",
  "transfer",
  "withdraw",
  "send",
  "charge",
  "payment",
  "execute",
  "run",
  "shell",
  "admin",
  "write",
  "update",
  "create",
  "mutate"
];

const SAFE_METHODS = new Set(["get", "head", "options"]);

export function inspectOpenApi(input = {}) {
  const spec = input.spec ?? input.openapi ?? input;
  const warnings = [];
  const recommendations = [];

  if (!isPlainObject(spec)) {
    return failureReport("openapi", "Input must include an OpenAPI object in `spec`.");
  }

  const version = typeof spec.openapi === "string" ? spec.openapi : typeof spec.swagger === "string" ? spec.swagger : null;
  if (!version) {
    warnings.push("Missing `openapi` or `swagger` version.");
    recommendations.push("Add an explicit OpenAPI version so agents can choose the right parser.");
  }

  const title = spec.info?.title ?? "Untitled API";
  const description = spec.info?.description ?? "";
  const endpoints = extractOpenApiEndpoints(spec);

  if (!spec.info?.title) {
    recommendations.push("Add `info.title` to make the service easier to identify in agent catalogs.");
  }
  if (!description) {
    recommendations.push("Add `info.description` with the API's value proposition and safe-use constraints.");
  }
  if (!Array.isArray(spec.servers) || spec.servers.length === 0) {
    recommendations.push("Add at least one `servers` entry so agents know where to call the API.");
  }
  if (endpoints.length === 0) {
    warnings.push("No callable OpenAPI paths were found.");
    recommendations.push("Define at least one path operation before publishing this service.");
  }

  const endpointFindings = endpoints.flatMap(endpoint => endpoint.findings);
  const risks = endpoints.flatMap(endpoint => endpoint.risks.map(risk => ({
    endpoint: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
    ...risk
  })));

  const score = scoreOpenApi(spec, endpoints, endpointFindings, warnings);
  const summary = summarizeOpenApi(title, endpoints, score, risks, endpointFindings);

  return {
    type: "openapi",
    name: title,
    version,
    score,
    grade: gradeFromScore(score),
    summary,
    endpointCount: endpoints.length,
    endpoints: endpoints.map(stripInternalFindings),
    risks,
    warnings,
    recommendations: unique([
      ...recommendations,
      ...endpointFindings.map(finding => finding.recommendation).filter(Boolean)
    ]),
    bazaarCandidates: endpoints
      .filter(isLaunchCandidate)
      .slice(0, 8)
      .map(endpoint => buildBazaarCandidate(title, endpoint))
  };
}

export function inspectMcp(input = {}) {
  const tools = normalizeMcpTools(input);
  const recommendations = [];
  const warnings = [];

  if (!Array.isArray(tools) || tools.length === 0) {
    return failureReport("mcp", "Input must include a non-empty MCP `tools` array.");
  }

  const inspectedTools = tools.map(tool => inspectMcpTool(tool));
  const risks = inspectedTools.flatMap(tool => tool.risks.map(risk => ({
    tool: tool.name,
    ...risk
  })));

  const missingDescriptions = inspectedTools.filter(tool => !tool.description).length;
  const missingSchemas = inspectedTools.filter(tool => !tool.inputSchema || Object.keys(tool.inputSchema).length === 0).length;

  if (missingDescriptions > 0) {
    recommendations.push(`Add clear descriptions for ${missingDescriptions} MCP tool(s).`);
  }
  if (missingSchemas > 0) {
    recommendations.push(`Add JSON input schemas for ${missingSchemas} MCP tool(s).`);
  }
  if (risks.length > 0) {
    recommendations.push("Mark destructive or external-effect tools with explicit safety notes and confirmation requirements.");
  }

  const score = scoreMcp(inspectedTools, warnings);

  return {
    type: "mcp",
    name: input.name ?? input.server?.name ?? "MCP Server",
    score,
    grade: gradeFromScore(score),
    summary: summarizeMcp(inspectedTools, score, risks),
    toolCount: inspectedTools.length,
    tools: inspectedTools,
    risks,
    warnings,
    recommendations: unique(recommendations),
    bazaarCandidates: inspectedTools
      .filter(isLaunchCandidate)
      .slice(0, 8)
      .map(tool => buildToolBazaarCandidate(input.name ?? "MCP Server", tool))
  };
}

export function generateBazaarMetadata(input = {}) {
  const sourceReport = input.report ?? null;
  const service = input.service ?? {};
  const name = service.name ?? sourceReport?.name ?? input.name ?? "DepScout Service";
  const route = service.route ?? input.route ?? firstCandidate(sourceReport);
  const description = service.description
    ?? route?.description
    ?? sourceReport?.summary
    ?? "Agent-ready API service inspected by DepScout.";

  const inputSchema = service.inputSchema ?? route?.inputSchema ?? {
    type: "object",
    properties: {},
    additionalProperties: true
  };

  const outputExample = service.outputExample ?? route?.outputExample ?? {
    ok: true,
    result: "Example response"
  };

  const price = service.price ?? suggestPrice(route, sourceReport);

  return {
    name,
    description: compactText(description, 320),
    category: service.category ?? inferCategory(description),
    tags: unique([
      "agent-ready",
      "x402",
      "api",
      ...(service.tags ?? []),
      ...(route?.tags ?? [])
    ]).slice(0, 8),
    method: route?.method ?? service.method ?? "POST",
    path: route?.path ?? service.path ?? "/",
    priceSuggestion: price,
    bazaarDraft: {
      resource: route?.path ?? service.path ?? "/",
      method: route?.method ?? service.method ?? "POST",
      description: compactText(description, 240),
      inputSchema,
      outputExample,
      discoverable: true
    },
    readinessNotes: [
      "Keep description action-oriented and specific.",
      "Include one minimal input example and one realistic output example.",
      "Publish only endpoints that are safe for autonomous agents to call."
    ]
  };
}

function extractOpenApiEndpoints(spec) {
  if (!isPlainObject(spec.paths)) {
    return [];
  }

  const endpoints = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!isPlainObject(pathItem)) continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase()) || !isPlainObject(operation)) continue;

      const mergedParameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : [])
      ];
      const parameters = mergedParameters.map(parameter => normalizeParameter(parameter, spec));
      const requestBody = normalizeRequestBody(operation.requestBody, spec);
      const responses = normalizeResponses(operation.responses, spec);
      const risks = detectOperationRisks(method, path, operation);
      const findings = endpointFindings(operation, parameters, requestBody, responses, risks);
      const agentScore = scoreEndpoint(operation, parameters, requestBody, responses, risks, findings);

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId ?? null,
        summary: operation.summary ?? "",
        description: operation.description ?? "",
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        auth: operation.security ?? spec.security ?? [],
        parameters,
        requestBody,
        responses,
        riskLevel: riskLevel(risks),
        risks,
        agentScore,
        findings
      });
    }
  }

  return endpoints.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}

function normalizeParameter(parameter, spec) {
  const resolved = resolveRef(parameter, spec);
  return {
    name: resolved.name ?? "unnamed",
    in: resolved.in ?? "query",
    required: Boolean(resolved.required),
    description: resolved.description ?? "",
    schemaSummary: summarizeSchema(resolveRef(resolved.schema, spec))
  };
}

function normalizeRequestBody(requestBody, spec) {
  const resolved = resolveRef(requestBody, spec);
  if (!resolved || Object.keys(resolved).length === 0) {
    return null;
  }

  const content = isPlainObject(resolved.content) ? resolved.content : {};
  const contentTypes = Object.keys(content);
  const firstSchema = contentTypes.length > 0 ? resolveRef(content[contentTypes[0]]?.schema, spec) : null;

  return {
    required: Boolean(resolved.required),
    description: resolved.description ?? "",
    contentTypes,
    schemaSummary: summarizeSchema(firstSchema),
    schema: firstSchema ?? null,
    hasExample: contentTypes.some(type => Boolean(content[type]?.example || content[type]?.examples))
  };
}

function normalizeResponses(responses, spec) {
  if (!isPlainObject(responses)) return [];

  return Object.entries(responses).map(([status, response]) => {
    const resolved = resolveRef(response, spec);
    const content = isPlainObject(resolved.content) ? resolved.content : {};
    const contentTypes = Object.keys(content);
    const firstSchema = contentTypes.length > 0 ? resolveRef(content[contentTypes[0]]?.schema, spec) : null;

    return {
      status,
      description: resolved.description ?? "",
      contentTypes,
      schemaSummary: summarizeSchema(firstSchema),
      hasExample: contentTypes.some(type => Boolean(content[type]?.example || content[type]?.examples))
    };
  });
}

function inspectMcpTool(tool = {}) {
  const name = String(tool.name ?? "unnamed_tool");
  const description = typeof tool.description === "string" ? tool.description.trim() : "";
  const inputSchema = isPlainObject(tool.inputSchema) ? tool.inputSchema : isPlainObject(tool.input_schema) ? tool.input_schema : {};
  const risks = detectToolRisks(name, description, inputSchema);
  const findings = [];

  if (!description) {
    findings.push({
      code: "missing_description",
      message: "Tool is missing a description.",
      recommendation: `Add a concise description for tool \`${name}\`.`
    });
  }
  if (Object.keys(inputSchema).length === 0) {
    findings.push({
      code: "missing_input_schema",
      message: "Tool is missing an input schema.",
      recommendation: `Add a JSON schema for tool \`${name}\`.`
    });
  }

  const properties = isPlainObject(inputSchema.properties) ? Object.keys(inputSchema.properties) : [];
  const required = Array.isArray(inputSchema.required) ? inputSchema.required : [];
  const riskPenalty = risks.reduce((sum, risk) => sum + (risk.severity === "high" ? 28 : 14), 0);
  const agentScore = clamp(100 - findings.length * 18 - riskPenalty - propertiesWithoutDescriptions(inputSchema) * 4, 0, 100);

  return {
    name,
    description,
    inputSchema,
    required,
    propertyCount: properties.length,
    riskLevel: riskLevel(risks),
    risks,
    findings,
    agentScore
  };
}

function endpointFindings(operation, parameters, requestBody, responses, risks) {
  const findings = [];

  if (!operation.operationId) {
    findings.push({
      code: "missing_operation_id",
      message: "Operation is missing `operationId`.",
      recommendation: "Add stable `operationId` values so agents can reference tools consistently."
    });
  }
  if (!operation.summary && !operation.description) {
    findings.push({
      code: "missing_description",
      message: "Operation lacks summary and description.",
      recommendation: "Add concise operation summaries that state the value and safe usage boundaries."
    });
  }
  if (parameters.some(parameter => !parameter.description)) {
    findings.push({
      code: "undocumented_parameters",
      message: "One or more parameters are missing descriptions.",
      recommendation: "Describe every parameter, especially identifiers, filters, and limits."
    });
  }
  if (requestBody && !requestBody.schemaSummary) {
    findings.push({
      code: "missing_request_schema",
      message: "Request body is missing a machine-readable schema.",
      recommendation: "Add a JSON schema for request bodies so agents can construct valid calls."
    });
  }
  if (responses.length === 0 || !responses.some(response => /^2\d\d$/.test(response.status))) {
    findings.push({
      code: "missing_success_response",
      message: "Operation does not define a clear 2xx response.",
      recommendation: "Add a documented 2xx response with a schema and example."
    });
  }
  if (responses.some(response => /^2\d\d$/.test(response.status) && !response.schemaSummary)) {
    findings.push({
      code: "missing_response_schema",
      message: "Successful response is missing a schema.",
      recommendation: "Add response schemas and examples so agents can reason about outputs."
    });
  }
  if (risks.length > 0 && !hasSafetyLanguage(operation)) {
    findings.push({
      code: "risky_without_safety_note",
      message: "Operation appears to have side effects but lacks safety language.",
      recommendation: "Add explicit safety notes for destructive, financial, or external-effect operations."
    });
  }

  return findings;
}

function detectOperationRisks(method, path, operation) {
  const text = `${method} ${path} ${operation.operationId ?? ""} ${operation.summary ?? ""} ${operation.description ?? ""}`.toLowerCase();
  const risks = [];

  if (!SAFE_METHODS.has(method.toLowerCase())) {
    risks.push({
      code: "side_effect_method",
      severity: method.toLowerCase() === "delete" ? "high" : "medium",
      message: `${method.toUpperCase()} may mutate external state.`
    });
  }

  const matchedTerms = RISKY_TERMS.filter(term => text.includes(term));
  if (matchedTerms.length > 0) {
    risks.push({
      code: "risky_terms",
      severity: matchedTerms.some(term => ["delete", "withdraw", "transfer", "charge", "shell"].includes(term)) ? "high" : "medium",
      message: `Risk-sensitive language detected: ${matchedTerms.slice(0, 4).join(", ")}.`
    });
  }

  return risks;
}

function detectToolRisks(name, description, inputSchema) {
  const text = `${name} ${description} ${JSON.stringify(inputSchema)}`.toLowerCase();
  const matchedTerms = RISKY_TERMS.filter(term => text.includes(term));

  if (matchedTerms.length === 0) return [];

  return [{
    code: "risky_tool_terms",
    severity: matchedTerms.some(term => ["delete", "withdraw", "transfer", "charge", "shell", "execute"].includes(term)) ? "high" : "medium",
    message: `Risk-sensitive language detected: ${matchedTerms.slice(0, 4).join(", ")}.`
  }];
}

function scoreOpenApi(spec, endpoints, endpointFindings, warnings) {
  let score = 100;

  if (!spec.openapi && !spec.swagger) score -= 15;
  if (!spec.info?.title) score -= 6;
  if (!spec.info?.description) score -= 8;
  if (!Array.isArray(spec.servers) || spec.servers.length === 0) score -= 5;
  if (endpoints.length === 0) score -= 45;

  score -= Math.min(endpointFindings.length * 4, 35);
  score -= Math.min(warnings.length * 5, 15);

  const averageEndpointScore = endpoints.length
    ? endpoints.reduce((sum, endpoint) => sum + endpoint.agentScore, 0) / endpoints.length
    : 0;

  if (endpoints.length > 0) {
    score = Math.round(score * 0.55 + averageEndpointScore * 0.45);
  }

  return clamp(Math.round(score), 0, 100);
}

function scoreEndpoint(operation, parameters, requestBody, responses, risks, findings) {
  let score = 100;
  if (!operation.operationId) score -= 10;
  if (!operation.summary && !operation.description) score -= 15;
  if (parameters.some(parameter => !parameter.description)) score -= 8;
  if (requestBody && !requestBody.schemaSummary) score -= 10;
  if (!responses.some(response => /^2\d\d$/.test(response.status))) score -= 20;
  if (responses.some(response => /^2\d\d$/.test(response.status) && !response.schemaSummary)) score -= 10;
  if (!responses.some(response => response.hasExample)) score -= 5;
  score -= Math.min(risks.reduce((sum, risk) => sum + (risk.severity === "high" ? 22 : 10), 0), 35);
  score -= Math.min(findings.length * 3, 15);
  return clamp(score, 0, 100);
}

function scoreMcp(tools, warnings) {
  const average = tools.reduce((sum, tool) => sum + tool.agentScore, 0) / Math.max(tools.length, 1);
  return clamp(Math.round(average - warnings.length * 5), 0, 100);
}

function summarizeOpenApi(title, endpoints, score, risks, findings) {
  const highRiskCount = risks.filter(risk => risk.severity === "high").length;
  const weakEndpointCount = endpoints.filter(endpoint => endpoint.agentScore < 65).length;
  return `${title} has ${endpoints.length} inspected endpoint(s), a DepScout score of ${score}, ${weakEndpointCount} endpoint(s) below launch-ready quality, and ${highRiskCount} high-risk signal(s). ${findings.length === 0 ? "It is ready for an x402 Bazaar metadata draft." : "Improve the findings before publishing to agent marketplaces."}`;
}

function summarizeMcp(tools, score, risks) {
  const weakToolCount = tools.filter(tool => tool.agentScore < 65).length;
  const highRiskCount = risks.filter(risk => risk.severity === "high").length;
  return `MCP inspection found ${tools.length} tool(s), a DepScout score of ${score}, ${weakToolCount} tool(s) below launch-ready quality, and ${highRiskCount} high-risk signal(s).`;
}

function buildBazaarCandidate(apiName, endpoint) {
  return {
    name: endpoint.operationId ?? `${endpoint.method.toLowerCase()}_${endpoint.path.replace(/[^a-z0-9]+/gi, "_")}`,
    apiName,
    method: endpoint.method,
    path: endpoint.path,
    description: endpoint.summary || endpoint.description || `${endpoint.method} ${endpoint.path}`,
    inputSchema: endpoint.requestBody?.schema ?? parametersToSchema(endpoint.parameters),
    outputExample: exampleForEndpoint(endpoint),
    tags: endpoint.tags,
    agentScore: endpoint.agentScore,
    priceSuggestion: suggestPrice(endpoint, null)
  };
}

function buildToolBazaarCandidate(serverName, tool) {
  return {
    name: tool.name,
    apiName: serverName,
    method: "POST",
    path: `/mcp/tools/${tool.name}`,
    description: tool.description || `Call MCP tool ${tool.name}.`,
    inputSchema: tool.inputSchema,
    outputExample: { ok: true, tool: tool.name, result: {} },
    tags: ["mcp", "tool"],
    agentScore: tool.agentScore,
    priceSuggestion: suggestPrice(tool, null)
  };
}

function isLaunchCandidate(item) {
  return item.agentScore >= 65 && item.riskLevel !== "high";
}

function parametersToSchema(parameters) {
  const properties = {};
  const required = [];

  for (const parameter of parameters) {
    properties[parameter.name] = {
      type: inferTypeFromSummary(parameter.schemaSummary),
      description: parameter.description || `${parameter.in} parameter`
    };
    if (parameter.required) required.push(parameter.name);
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false
  };
}

function exampleForEndpoint(endpoint) {
  const success = endpoint.responses.find(response => /^2\d\d$/.test(response.status));
  return {
    status: Number(success?.status ?? 200),
    data: success?.schemaSummary ? `Example ${success.schemaSummary}` : {}
  };
}

function suggestPrice(route, report) {
  const complexity = route?.agentScore && route.agentScore < 70 ? "medium" : "low";
  const amount = report?.type === "mcp" || complexity === "medium" ? "0.05" : "0.03";
  return {
    amount,
    currency: "USDC",
    unit: "per call",
    rationale: "Low-friction price for one-shot agent inspection or metadata generation."
  };
}

function inferCategory(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes("mcp")) return "developer-tools";
  if (lower.includes("openapi") || lower.includes("schema")) return "developer-tools";
  if (lower.includes("risk") || lower.includes("safety")) return "security";
  return "api-tools";
}

function firstCandidate(report) {
  return Array.isArray(report?.bazaarCandidates) && report.bazaarCandidates.length > 0
    ? report.bazaarCandidates[0]
    : null;
}

function stripInternalFindings(endpoint) {
  const { findings, ...publicEndpoint } = endpoint;
  return {
    ...publicEndpoint,
    findings: findings.map(({ code, message, recommendation }) => ({ code, message, recommendation }))
  };
}

function normalizeMcpTools(input) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.tools)) return input.tools;
  if (Array.isArray(input.serverManifest?.tools)) return input.serverManifest.tools;
  if (Array.isArray(input.server?.tools)) return input.server.tools;
  return [];
}

function propertiesWithoutDescriptions(schema) {
  if (!isPlainObject(schema.properties)) return 0;
  return Object.values(schema.properties).filter(property => isPlainObject(property) && !property.description).length;
}

function resolveRef(value, spec) {
  if (!isPlainObject(value) || typeof value.$ref !== "string") {
    return value ?? {};
  }

  const parts = value.$ref.replace(/^#\//, "").split("/");
  let current = spec;
  for (const part of parts) {
    current = current?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
  }
  return isPlainObject(current) ? current : value;
}

function summarizeSchema(schema) {
  if (!isPlainObject(schema)) return "";
  if (schema.type) {
    if (schema.type === "object" && isPlainObject(schema.properties)) {
      return `object{${Object.keys(schema.properties).slice(0, 6).join(", ")}}`;
    }
    if (schema.type === "array") {
      return `array<${summarizeSchema(schema.items) || "item"}>`;
    }
    return schema.type;
  }
  if (schema.oneOf) return "oneOf";
  if (schema.anyOf) return "anyOf";
  if (schema.allOf) return "allOf";
  return "";
}

function inferTypeFromSummary(summary) {
  if (summary.includes("array")) return "array";
  if (summary.includes("integer")) return "integer";
  if (summary.includes("number")) return "number";
  if (summary.includes("boolean")) return "boolean";
  if (summary.includes("object")) return "object";
  return "string";
}

function hasSafetyLanguage(operation) {
  const text = `${operation.summary ?? ""} ${operation.description ?? ""}`.toLowerCase();
  return ["confirm", "confirmation", "safe", "safety", "idempotent", "dry run", "read-only"].some(term => text.includes(term));
}

function riskLevel(risks) {
  if (risks.some(risk => risk.severity === "high")) return "high";
  if (risks.some(risk => risk.severity === "medium")) return "medium";
  return "low";
}

function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function failureReport(type, message) {
  return {
    type,
    score: 0,
    grade: "F",
    summary: message,
    risks: [],
    warnings: [message],
    recommendations: ["Provide valid structured input and rerun the inspection."],
    bazaarCandidates: []
  };
}

function compactText(text, maxLength) {
  const compact = String(text).replace(/\s+/g, " ").trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1).trim()}...`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
