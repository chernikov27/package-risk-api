const examples = {
  npm: {
    ecosystem: "npm",
    name: "react"
  },
  pypi: {
    ecosystem: "pypi",
    name: "requests"
  },
  github: {
    ecosystem: "github",
    repo: "vercel/next.js"
  }
};

const input = document.querySelector("#specInput");
const output = document.querySelector("#resultOutput");
const loadExample = document.querySelector("#loadExample");
const inspectButton = document.querySelector("#inspectButton");
const metadataButton = document.querySelector("#metadataButton");
const tabs = [...document.querySelectorAll(".tab")];

let mode = "npm";
let latestReport = null;

function setExample() {
  input.value = JSON.stringify(examples[mode], null, 2);
  latestReport = null;
  metadataButton.disabled = true;
  output.innerHTML = `<p class="empty-state">Example loaded. Run DepScout to get an install decision.</p>`;
}

async function inspect() {
  inspectButton.disabled = true;
  inspectButton.textContent = "Checking";
  metadataButton.disabled = true;
  output.innerHTML = `<p class="empty-state">Checking public package metadata...</p>`;

  try {
    const body = JSON.parse(input.value);
    const response = await fetch(apiPath("/risk/package"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
    }

    renderReport(payload);
  } catch (error) {
    output.innerHTML = `<p class="empty-state">Error: ${escapeHtml(error.message)}</p>`;
  } finally {
    inspectButton.disabled = false;
    inspectButton.textContent = "Check";
  }
}

function renderReport(report) {
  latestReport = report;
  metadataButton.disabled = false;

  const signals = report.signals ?? [];
  const verdictClass = `verdict-${report.verdict}`;

  output.innerHTML = `
    <div class="score-card">
      <div class="mini-score ${verdictClass}"><strong>${escapeHtml(report.score)}</strong><span>${escapeHtml(report.verdict)}</span></div>
      <div>
        <h3 class="report-title">${escapeHtml(report.name)}${report.version ? `@${escapeHtml(report.version)}` : ""}</h3>
        <p class="report-summary">${escapeHtml(report.recommendation)}</p>
        <div class="metric-grid">
          <div class="metric"><strong>${escapeHtml(report.license || "unknown")}</strong><span>License</span></div>
          <div class="metric"><strong>${escapeHtml(formatDate(report.lastRelease))}</strong><span>Last release</span></div>
          <div class="metric"><strong>${escapeHtml(report.maintainerActivity?.maintainerCount ?? 0)}</strong><span>Maintainers</span></div>
        </div>
      </div>
    </div>
    ${renderList("Top reasons", report.topReasons?.length ? report.topReasons : ["No major public metadata red flags found."])}
    ${renderSignals(signals)}
    <details class="raw-details">
      <summary>Full install decision JSON</summary>
      <pre class="json-block">${escapeHtml(JSON.stringify(report, null, 2))}</pre>
    </details>
  `;
}

function renderSignals(signals) {
  if (!signals.length) {
    return renderList("Signals", ["No risk signals detected."]);
  }

  return `
    <section class="report-section">
      <h4>Signals</h4>
      <div class="pill-list">
        ${signals.map(signal => `<div class="pill"><strong>${escapeHtml(signal.severity)}</strong> ${escapeHtml(signal.message)}</div>`).join("")}
      </div>
    </section>
  `;
}

function renderList(title, items) {
  return `
    <section class="report-section">
      <h4>${title}</h4>
      <div class="pill-list">
        ${items.map(item => `<div class="pill">${escapeHtml(item)}</div>`).join("")}
      </div>
    </section>
  `;
}

function setMode(nextMode) {
  mode = nextMode;
  tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  setExample();
}

async function copyLatestReport(button) {
  if (!latestReport) return;

  const text = JSON.stringify(latestReport, null, 2);

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    button.textContent = "Copied";
  }

  window.setTimeout(() => {
    button.textContent = "Copy JSON";
  }, 1400);
}

function formatDate(value) {
  if (!value) return "unknown";
  return new Date(value).toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function apiPath(path) {
  return window.location.protocol === "file:" ? `http://127.0.0.1:4021${path}` : path;
}

loadExample.addEventListener("click", setExample);
inspectButton.addEventListener("click", inspect);
metadataButton.addEventListener("click", event => copyLatestReport(event.currentTarget));
tabs.forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

setExample();
