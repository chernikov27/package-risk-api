import { X402_ROUTES } from "../x402-config.js";

const endpoints = X402_ROUTES.slice(0, 3);

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/">
          <img src="/assets/agentspec-logo.png" alt="AgentSpec" />
        </a>
        <nav aria-label="Primary navigation">
          <a href="#inspect">Inspect</a>
          <a href="/openapi.json">OpenAPI</a>
          <a href="/x402/routes">Routes</a>
        </nav>
      </header>

      <section className="hero">
        <div className="orbital orbital-one" />
        <div className="orbital orbital-two" />
        <p className="eyebrow">Discoverable. Understandable. Paid.</p>
        <h1>AgentSpec makes APIs ready for autonomous agents.</h1>
        <p className="lede">
          A paid x402 microservice that scores endpoints, normalizes tool schemas,
          flags risk, and drafts Bazaar listings agents can evaluate.
        </p>
        <div className="actions">
          <a className="primary" href="#inspect">Inspect an API</a>
          <a className="secondary" href="/openapi.json">View OpenAPI</a>
        </div>
      </section>

      <section id="inspect" className="panel">
        <div>
          <p className="eyebrow">Live x402 service</p>
          <h2>Production routes</h2>
        </div>
        <div className="routes">
          {endpoints.map(route => (
            <article key={route.path}>
              <div>
                <p className="method">{route.method}</p>
                <h3>{route.path}</h3>
                <p>{route.description}</p>
              </div>
              <strong>{route.price} {route.currency}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
