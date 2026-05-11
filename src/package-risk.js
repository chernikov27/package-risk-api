const POPULAR_PACKAGES = [
  "react",
  "next",
  "express",
  "lodash",
  "axios",
  "typescript",
  "vite",
  "requests",
  "numpy",
  "pandas",
  "django",
  "flask"
];

const INSTALL_SCRIPT_NAMES = new Set(["preinstall", "install", "postinstall", "prepare"]);

export async function assessPackageRisk(input, options = {}) {
  const target = normalizeTarget(input);
  if (!target.ok) {
    return {
      ok: false,
      error: "invalid_target",
      message: target.message
    };
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    return buildReport({
      ecosystem: target.ecosystem,
      name: target.name,
      source: "input",
      signals: [{
        severity: "caution",
        code: "metadata_unavailable",
        message: "No fetch implementation is available, so DepScout could not collect public package metadata."
      }]
    });
  }

  try {
    if (target.ecosystem === "npm") return assessNpmPackage(target, fetcher);
    if (target.ecosystem === "pypi") return assessPypiPackage(target, fetcher);
    return assessGithubRepo(target, fetcher);
  } catch (error) {
    return buildReport({
      ecosystem: target.ecosystem,
      name: target.name,
      source: target.source,
      signals: [{
        severity: "block",
        code: "lookup_failed",
        message: error instanceof Error ? error.message : "Package metadata lookup failed."
      }]
    });
  }
}

async function assessNpmPackage(target, fetcher) {
  const metadata = await fetchJson(fetcher, `https://registry.npmjs.org/${encodeURIComponent(target.name)}`);
  const latestVersion = target.version || metadata["dist-tags"]?.latest;
  const version = metadata.versions?.[latestVersion] ?? {};
  const releaseTime = metadata.time?.[latestVersion] ?? metadata.time?.modified ?? null;
  const installScripts = Object.keys(version.scripts ?? {}).filter(script => INSTALL_SCRIPT_NAMES.has(script));
  const dependencyCount = Object.keys(version.dependencies ?? {}).length;

  return buildReport({
    ecosystem: "npm",
    name: metadata.name ?? target.name,
    version: latestVersion,
    source: `https://www.npmjs.com/package/${metadata.name ?? target.name}`,
    license: version.license ?? metadata.license ?? null,
    lastRelease: releaseTime,
    maintainers: (metadata.maintainers ?? []).map(maintainer => maintainer.name).filter(Boolean),
    installSizeBytes: version.dist?.unpackedSize ?? version.dist?.size ?? null,
    dependencyCount,
    signals: [
      ...commonNameSignals(metadata.name ?? target.name),
      ...releaseSignals(releaseTime),
      ...licenseSignals(version.license ?? metadata.license),
      ...(version.deprecated ? [{
        severity: "block",
        code: "deprecated",
        message: `The latest npm version is deprecated: ${version.deprecated}`
      }] : []),
      ...(installScripts.length ? [{
        severity: "caution",
        code: "install_scripts",
        message: `Package declares install-time scripts: ${installScripts.join(", ")}.`
      }] : []),
      ...(dependencyCount > 80 ? [{
        severity: "info",
        code: "large_dependency_surface",
        message: `Package declares ${dependencyCount} direct dependencies.`
      }] : []),
      ...maintainerSignals(metadata.maintainers ?? [])
    ]
  });
}

async function assessPypiPackage(target, fetcher) {
  const metadata = await fetchJson(fetcher, `https://pypi.org/pypi/${encodeURIComponent(target.name)}/json`);
  const info = metadata.info ?? {};
  const latestVersion = target.version || info.version;
  const releaseFiles = metadata.releases?.[latestVersion] ?? metadata.urls ?? [];
  const lastRelease = latestUploadTime(releaseFiles);
  const vulnerabilities = metadata.vulnerabilities ?? [];
  const ownership = metadata.ownership?.roles ?? [];
  const yankedFiles = releaseFiles.filter(file => file.yanked);

  return buildReport({
    ecosystem: "pypi",
    name: info.name ?? target.name,
    version: latestVersion,
    source: info.project_url ?? `https://pypi.org/project/${info.name ?? target.name}/`,
    license: info.license_expression || info.license || licenseFromClassifiers(info.classifiers),
    lastRelease,
    maintainers: ownership.map(role => role.user).filter(Boolean),
    installSizeBytes: releaseFiles.reduce((sum, file) => sum + Number(file.size ?? 0), 0) || null,
    dependencyCount: Array.isArray(info.requires_dist) ? info.requires_dist.length : null,
    signals: [
      ...commonNameSignals(info.name ?? target.name),
      ...releaseSignals(lastRelease),
      ...licenseSignals(info.license_expression || info.license || licenseFromClassifiers(info.classifiers)),
      ...(vulnerabilities.length ? [{
        severity: "block",
        code: "known_vulnerabilities",
        message: `PyPI reports ${vulnerabilities.length} known vulnerability record(s) for this package/version.`
      }] : []),
      ...(yankedFiles.length ? [{
        severity: "block",
        code: "yanked_release",
        message: "One or more files for the selected PyPI release are yanked."
      }] : []),
      ...maintainerSignals(ownership)
    ]
  });
}

async function assessGithubRepo(target, fetcher) {
  const metadata = await fetchJson(fetcher, `https://api.github.com/repos/${target.owner}/${target.repo}`);
  const lastRelease = metadata.pushed_at ?? metadata.updated_at ?? null;

  return buildReport({
    ecosystem: "github",
    name: metadata.full_name ?? `${target.owner}/${target.repo}`,
    version: metadata.default_branch ?? null,
    source: metadata.html_url ?? `https://github.com/${target.owner}/${target.repo}`,
    license: metadata.license?.spdx_id && metadata.license.spdx_id !== "NOASSERTION" ? metadata.license.spdx_id : null,
    lastRelease,
    maintainers: metadata.owner?.login ? [metadata.owner.login] : [],
    installSizeBytes: null,
    dependencyCount: null,
    signals: [
      ...releaseSignals(lastRelease),
      ...licenseSignals(metadata.license?.spdx_id && metadata.license.spdx_id !== "NOASSERTION" ? metadata.license.spdx_id : null),
      ...(metadata.archived ? [{
        severity: "block",
        code: "archived_repo",
        message: "GitHub repository is archived."
      }] : []),
      ...(metadata.disabled ? [{
        severity: "block",
        code: "disabled_repo",
        message: "GitHub repository is disabled."
      }] : []),
      ...(Number(metadata.stargazers_count ?? 0) < 5 ? [{
        severity: "info",
        code: "low_public_adoption",
        message: "Repository has fewer than 5 GitHub stars."
      }] : [])
    ]
  });
}

function buildReport(input) {
  const signals = input.signals.filter(Boolean);
  const score = clamp(100 - signals.reduce((total, signal) => total + severityPenalty(signal.severity), 0), 0, 100);
  const verdict = score < 50 || signals.some(signal => signal.severity === "block") ? "block" : score < 78 ? "caution" : "safe";

  return {
    ok: true,
    type: "package-risk",
    service: "DepScout",
    ecosystem: input.ecosystem,
    name: input.name,
    version: input.version ?? null,
    source: input.source,
    verdict,
    score,
    recommendation: recommendationFor(verdict),
    topReasons: signals.slice(0, 4).map(signal => signal.message),
    license: input.license ?? null,
    lastRelease: input.lastRelease ?? null,
    maintainerActivity: {
      maintainers: input.maintainers ?? [],
      maintainerCount: input.maintainers?.length ?? 0
    },
    installSizeBytes: input.installSizeBytes ?? null,
    dependencyCount: input.dependencyCount ?? null,
    signals
  };
}

function normalizeTarget(input = {}) {
  const rawEcosystem = String(input.ecosystem ?? input.type ?? "").toLowerCase();
  const rawName = String(input.name ?? input.package ?? input.repo ?? input.repository ?? "").trim();

  if (!rawName) {
    return { ok: false, message: "Provide `name`, `package`, `repo`, or `repository`." };
  }

  if (rawEcosystem === "github" || rawName.startsWith("github:") || rawName.includes("github.com/")) {
    const parsed = parseGithubRepo(rawName);
    if (!parsed) return { ok: false, message: "GitHub input must be `owner/repo` or a GitHub repository URL." };
    return { ok: true, ecosystem: "github", name: `${parsed.owner}/${parsed.repo}`, owner: parsed.owner, repo: parsed.repo, source: rawName };
  }

  const ecosystem = rawEcosystem || (rawName.includes("/") && !rawName.startsWith("@") ? "github" : "npm");
  if (ecosystem === "github") {
    const parsed = parseGithubRepo(rawName);
    if (!parsed) return { ok: false, message: "GitHub input must be `owner/repo` or a GitHub repository URL." };
    return { ok: true, ecosystem, name: `${parsed.owner}/${parsed.repo}`, owner: parsed.owner, repo: parsed.repo, source: rawName };
  }

  if (!["npm", "pypi"].includes(ecosystem)) {
    return { ok: false, message: "Supported ecosystems are `npm`, `pypi`, and `github`." };
  }

  return {
    ok: true,
    ecosystem,
    name: rawName,
    version: input.version ? String(input.version).trim() : null,
    source: rawName
  };
}

function parseGithubRepo(value) {
  const trimmed = value.replace(/^github:/u, "").replace(/^https?:\/\/github\.com\//u, "").replace(/\.git$/u, "");
  const [owner, repo] = trimmed.split("/").filter(Boolean);
  if (!owner || !repo) return null;
  return { owner, repo };
}

async function fetchJson(fetcher, url) {
  const response = await fetcher(url, {
    headers: {
      accept: "application/json",
      "user-agent": "DepScout package risk API"
    }
  });

  if (!response.ok) {
    throw new Error(`Public metadata lookup failed with HTTP ${response.status}.`);
  }

  return response.json();
}

function commonNameSignals(name) {
  const normalized = String(name).replace(/^@/u, "").split("/").pop().toLowerCase();
  const suspiciousMatch = POPULAR_PACKAGES.find(pkg => pkg !== normalized && levenshtein(pkg, normalized) <= 2);
  return suspiciousMatch ? [{
    severity: "caution",
    code: "typosquat_suspicion",
    message: `Package name is very similar to popular package \`${suspiciousMatch}\`.`
  }] : [];
}

function releaseSignals(dateValue) {
  if (!dateValue) {
    return [{
      severity: "info",
      code: "missing_release_time",
      message: "Could not determine last release or activity time from public metadata."
    }];
  }

  const ageDays = Math.floor((Date.now() - new Date(dateValue).getTime()) / 86_400_000);
  if (ageDays > 730) {
    return [{
      severity: "caution",
      code: "stale_release",
      message: `Last release or repository activity was ${ageDays} days ago.`
    }];
  }

  return [];
}

function licenseSignals(license) {
  if (!license || String(license).trim().toLowerCase() === "unknown") {
    return [{
      severity: "caution",
      code: "missing_license",
      message: "No clear license was found in public metadata."
    }];
  }

  return [];
}

function maintainerSignals(maintainers) {
  return maintainers.length === 0 ? [{
    severity: "info",
    code: "missing_maintainers",
    message: "No maintainer or owner list was available in public metadata."
  }] : [];
}

function latestUploadTime(files) {
  return files
    .map(file => file.upload_time_iso_8601 || file.upload_time)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}

function licenseFromClassifiers(classifiers = []) {
  const licenseClassifier = classifiers.find(value => String(value).startsWith("License ::"));
  return licenseClassifier ? licenseClassifier.split("::").at(-1).trim() : null;
}

function severityPenalty(severity) {
  if (severity === "block") return 45;
  if (severity === "caution") return 18;
  return 6;
}

function recommendationFor(verdict) {
  if (verdict === "safe") return "Install may proceed without extra user confirmation.";
  if (verdict === "caution") return "Ask the user before installing and show the top risk reasons.";
  return "Do not install automatically. Require explicit user approval or choose another package.";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }

  return matrix[a.length][b.length];
}
