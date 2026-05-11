import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/">
          <img className="brand-logo" src="/assets/depscout-logo.svg" alt="" />
          <span className="brand-word">Dep<span>Scout</span></span>
        </a>
        <nav className="nav" aria-label="Primary">
          <a href="#reports">Reports</a>
          <a href="#inspect">Demo</a>
          <a href="#routes">Routes</a>
          <a href="/openapi.json">OpenAPI</a>
        </nav>
      </header>

      <main>
        <section className="hero report-first-hero">
          <div className="hero-copy">
            <div className="hero-lockup">
              <img className="hero-logo" src="/assets/depscout-logo.svg" alt="" />
              <span>Dep<span>Scout</span></span>
            </div>
            <p className="eyebrow">Package risk API</p>
            <h1>Install decisions for coding agents.</h1>
            <div className="trust-badges" aria-label="DepScout trust signals">
              <span className="trust-badge">x402 paid route</span>
              <span className="trust-badge">npm, PyPI, GitHub</span>
            </div>
            <p className="support">Check npm, PyPI, or GitHub risk before an agent changes dependencies. DepScout returns one compact verdict: safe, caution, or block.</p>
            <div className="hero-actions">
              <a className="button primary" href="#inspect">Check a package</a>
              <a className="button secondary" href="#reports">View install verdict</a>
            </div>
          </div>

          <div className="dashboard-board report-panel" id="reports" aria-label="DepScout risk report preview">
            <div className="board-top">
              <div><span className="status-dot" />npm: react</div>
              <strong>safe / 94</strong>
            </div>
            <div className="score-grid">
              <div className="score-ring">
                <span>94</span>
                <small>risk score</small>
              </div>
              <div className="readiness-bars">
                <label>License clarity<i style={{ "--w": "98%" }} /></label>
                <label>Maintainer activity<i style={{ "--w": "93%" }} /></label>
                <label>Release freshness<i style={{ "--w": "88%" }} /></label>
                <label>Install surface<i style={{ "--w": "84%" }} /></label>
              </div>
            </div>
            <div className="endpoint-table">
              <div><span>license</span><strong>MIT</strong><em>clear</em><b>safe</b></div>
              <div><span>activity</span><strong>recent</strong><em>healthy</em><b>safe</b></div>
              <div><span>decision</span><strong>allow</strong><em>show to agent</em><b>safe</b></div>
            </div>
          </div>
        </section>

        <section className="feature-band" aria-label="DepScout workflow">
          <div>
            <span>Check</span>
            <strong>npm, PyPI, GitHub</strong>
          </div>
          <div>
            <span>Score</span>
            <strong>license, activity, red flags</strong>
          </div>
          <div>
            <span>Decide</span>
            <strong>safe, caution, block</strong>
          </div>
        </section>

        <section className="workspace" id="inspect">
          <div className="workspace-header">
            <div>
              <p className="eyebrow">Live local demo</p>
              <h2>Check dependency risk</h2>
            </div>
            <div className="workspace-actions">
              <div className="tabs" role="tablist" aria-label="Inspection type">
                <button className="tab active" id="openapiTab" type="button" data-mode="npm">npm</button>
                <button className="tab" id="mcpTab" type="button" data-mode="pypi">PyPI</button>
                <button className="tab" type="button" data-mode="github">GitHub</button>
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
                  <button className="button secondary compact" id="metadataButton" type="button" disabled>Copy JSON</button>
                  <button className="button primary compact" id="inspectButton" type="button">Check</button>
                </div>
              </div>
              <div className="report-shell" id="resultOutput">
                <p className="empty-state">Load the example or paste a package target, then run DepScout.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="launchpad">
          <div className="section-copy">
            <p className="eyebrow">Before install</p>
            <h2>Give coding agents one install verdict before dependency changes.</h2>
            <p>DepScout turns public registry and repository metadata into a compact decision agents can show before running package manager commands.</p>
          </div>
          <div className="listing-cloud" aria-label="Bazaar listing examples">
            <article className="listing-card featured">
              <span className="badge">Safe verdict</span>
              <h3>npm: react</h3>
              <p>Clear license, recent release activity, and established maintainer surface.</p>
              <dl>
                <div><dt>Route</dt><dd>POST /risk/package</dd></div>
                <div><dt>Price</dt><dd>0.02 USDC / call</dd></div>
              </dl>
            </article>
            <article className="listing-card">
              <span className="badge warning">Caution verdict</span>
              <h3>lookalike package</h3>
              <p>Similar name to a popular dependency, missing license, or stale release activity.</p>
            </article>
          </div>
        </section>

        <section className="routes" id="routes">
          <div className="section-copy narrow">
            <p className="eyebrow">Paid route plan</p>
            <h2>Small checks, clear prices.</h2>
            <p>DepScout is designed as a microservice surface: each call returns a machine-readable install decision.</p>
          </div>
          <div className="route-grid">
            <article><span>POST</span><strong>/risk/package</strong><em>0.02 USDC</em></article>
            <article><span>npm</span><strong>package metadata</strong><em>license, scripts, release</em></article>
            <article><span>PyPI</span><strong>package metadata</strong><em>yanked, vulnerabilities</em></article>
            <article><span>GitHub</span><strong>repo metadata</strong><em>activity, license</em></article>
          </div>
        </section>

        <section className="features">
          <article>
            <h3>Install verdicts</h3>
            <p>Return safe, caution, or block decisions that coding agents can use before installing dependencies.</p>
          </article>
          <article>
            <h3>Package hygiene</h3>
            <p>Check license, last release, maintainer surface, deprecation, yanked releases, and dependency footprint.</p>
          </article>
          <article>
            <h3>Typosquat suspicion</h3>
            <p>Flag names that look close to popular packages so agents can ask before adding them to a repo.</p>
          </article>
        </section>

        <section className="final-cta">
          <div>
            <p className="eyebrow">Agent tool ready</p>
            <h2>Check before your agent installs.</h2>
            <p>The route is x402-ready and returns compact JSON that IDE agents, CI bots, and repo assistants can consume directly.</p>
          </div>
          <a className="button primary" href="#inspect">Run DepScout</a>
        </section>
      </main>

      <Script src="/app.js" type="module" strategy="afterInteractive" />
    </>
  );
}
