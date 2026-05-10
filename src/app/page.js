import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-word">Agent<span>Spec</span></span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="#reports">Reports</a>
          <a href="#inspect">Demo</a>
          <a href="#routes">Routes</a>
          <a href="/openapi.json">OpenAPI</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="radar-field" aria-hidden="true">
            <span className="ring r1" />
            <span className="ring r2" />
            <span className="ring r3" />
            <span className="axis a1" />
            <span className="axis a2" />
            <span className="radar-node n1" />
            <span className="radar-node n2" />
            <span className="radar-node n3" />
            <span className="radar-node n4" />
          </div>
          <div className="hero-copy">
            <div className="hero-mark" aria-hidden="true"><span className="brand-mark" /></div>
            <p className="eyebrow">Discoverable. Understandable. Paid.</p>
            <h1>AgentSpec makes APIs ready for autonomous agents.</h1>
            <p className="support">A paid x402 microservice that scores endpoints, normalizes tool schemas, flags risk, and drafts Bazaar listings agents can evaluate.</p>
            <div className="hero-actions">
              <a className="button primary" href="#inspect">Inspect an API</a>
              <a className="button secondary" href="#reports">View example report</a>
            </div>
          </div>

          <div className="dashboard-board" id="reports" aria-label="Example AgentSpec report">
            <div className="board-top">
              <div><span className="status-dot" />Weather Utility API</div>
              <strong>Score 100 / Grade A</strong>
            </div>
            <div className="score-grid">
              <div className="score-dial">100</div>
              <div className="readiness-bars">
                <label>Discoverability<i style={{ "--w": "98%" }} /></label>
                <label>Schema quality<i style={{ "--w": "100%" }} /></label>
                <label>Safety notes<i style={{ "--w": "88%" }} /></label>
                <label>Examples<i style={{ "--w": "96%" }} /></label>
              </div>
            </div>
            <div className="endpoint-table">
              <div><span>GET</span><strong>/forecast</strong><em>low risk</em><b>candidate</b></div>
              <div><span>POST</span><strong>/inspect/mcp</strong><em>flags destructive tools</em><b>0.03 USDC</b></div>
              <div><span>POST</span><strong>/generate/bazaar-metadata</strong><em>listing draft</em><b>0.05 USDC</b></div>
            </div>
          </div>
        </section>

        <section className="feature-band" aria-label="AgentSpec workflow">
          <div>
            <span>Inspect</span>
            <strong>OpenAPI, MCP, docs</strong>
          </div>
          <div>
            <span>Score</span>
            <strong>schema, safety, clarity</strong>
          </div>
          <div>
            <span>Publish</span>
            <strong>x402 Bazaar metadata</strong>
          </div>
        </section>

        <section className="workspace" id="inspect">
          <div className="workspace-header">
            <div>
              <p className="eyebrow">Live local demo</p>
              <h2>Inspect agent readiness</h2>
            </div>
            <div className="workspace-actions">
              <div className="tabs" role="tablist" aria-label="Inspection type">
                <button className="tab active" id="openapiTab" type="button" data-mode="openapi">OpenAPI</button>
                <button className="tab" id="mcpTab" type="button" data-mode="mcp">MCP</button>
              </div>
              <button className="button secondary compact" id="loadExample" type="button">Load example</button>
            </div>
          </div>

          <div className="inspector">
            <label className="editor-wrap">
              <span>Input</span>
              <textarea id="specInput" spellCheck="false" />
            </label>

            <div className="result-wrap" id="liveReport">
              <div className="result-top">
                <span>Report</span>
                <div className="result-actions">
                  <button className="button secondary compact" id="metadataButton" type="button" disabled>Generate Bazaar Metadata</button>
                  <button className="button primary compact" id="inspectButton" type="button">Inspect</button>
                </div>
              </div>
              <div className="report-shell" id="resultOutput">
                <p className="empty-state">Load the example or paste an OpenAPI/MCP payload, then run inspection.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="launchpad">
          <div className="section-copy">
            <p className="eyebrow">Bazaar launchpad</p>
            <h2>Prepare clean x402 listings before agents ever call you.</h2>
            <p>AgentSpec separates launch-ready resources from risky tools, then packages the strongest candidate into a listing draft with schema, output example, tags, and price.</p>
          </div>
          <div className="listing-cloud" aria-label="Bazaar listing examples">
            <article className="listing-card featured">
              <span className="badge">Verified candidate</span>
              <h3>Weather Utility API</h3>
              <p>Read-only forecast lookup for agents.</p>
              <dl>
                <div><dt>Method</dt><dd>GET /forecast</dd></div>
                <div><dt>Price</dt><dd>0.03 USDC / call</dd></div>
              </dl>
            </article>
            <article className="listing-card">
              <span className="badge warning">Risk note</span>
              <h3>delete_branch</h3>
              <p>Excluded from launch candidates until confirmation rules are explicit.</p>
            </article>
          </div>
        </section>

        <section className="routes" id="routes">
          <div className="section-copy narrow">
            <p className="eyebrow">Paid route plan</p>
            <h2>Small calls, clear prices.</h2>
            <p>AgentSpec is designed as a microservice surface: each route returns a complete agent-readable artifact in one paid request.</p>
          </div>
          <div className="route-grid">
            <article><span>POST</span><strong>/inspect/openapi</strong><em>0.03 USDC</em></article>
            <article><span>POST</span><strong>/inspect/mcp</strong><em>0.03 USDC</em></article>
            <article><span>POST</span><strong>/generate/bazaar-metadata</strong><em>0.05 USDC</em></article>
            <article><span>POST</span><strong>/score/agent-readiness</strong><em>0.02 USDC</em></article>
          </div>
        </section>

        <section className="features">
          <article>
            <h3>Agent-readiness scoring</h3>
            <p>Detect missing operation IDs, weak descriptions, incomplete response schemas, and endpoints that need safer language.</p>
          </article>
          <article>
            <h3>MCP tool review</h3>
            <p>Check tool names, descriptions, input schemas, risky verbs, and agent-facing clarity before publishing.</p>
          </article>
          <article>
            <h3>Bazaar metadata drafts</h3>
            <p>Generate service descriptions, schemas, output examples, tags, and pricing suggestions for x402 listings.</p>
          </article>
        </section>

        <section className="final-cta">
          <div>
            <p className="eyebrow">Ready for the paid adapter</p>
            <h2>Next step: protect these routes with x402.</h2>
            <p>The local product surface is ready. The production pass connects wallet address, facilitator, network, and real 402 Payment Required responses.</p>
          </div>
          <a className="button primary" href="#inspect">Run the demo</a>
        </section>
      </main>

      <Script src="/app.js" type="module" strategy="afterInteractive" />
    </>
  );
}
