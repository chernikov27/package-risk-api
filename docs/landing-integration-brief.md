# DepScout Landing Integration Brief

## Decision

Do not hand off the whole landing page blindly. The current `public/` demo is already wired to the working DepScout API, so the safest path is to integrate the best mockup direction into the existing functional page.

Use another agent only for narrow visual polish after the functional merge is complete.

## Source Files

- Functional demo: `public/index.html`, `public/styles.css`, `public/app.js`
- Landing concepts: `landing-mockups/index.html`, `landing-mockups/styles.css`
- Brand assets: `Brand/`

## Recommended Direction

Use **Variant 01 / Report-first SaaS** as the main landing direction.

Reason:

- It matches what DepScout actually sells: package risk verdicts and install decisions.
- It naturally leads into the live demo.
- It is less abstract than the radar/protocol variants.
- It avoids over-indexing on marketplace visuals before payment integration is live.

Borrow from **Variant 05 / Bazaar-ready listing** for the route/pricing section.

## Product Flow

Landing page should follow this order:

1. Hero: DepScout + slogan + short value proposition
2. Report preview: score, risks, candidates, pricing
3. Live demo: npm/PyPI/GitHub tabs wired to POST /risk/package
4. Install decision JSON: verdict, score, reasons, license, activity, copy JSON
5. Pricing/routes: `/risk/package`
6. x402 readiness note: paid routes will be enabled with production x402 middleware

## Copy

Hero:

DepScout

Install decisions for coding agents.

Check package risk before npm, pip, or repo install. Return a compact safe, caution, or block verdict in one call.

Primary CTA:

Check a package

Secondary CTA:

View install verdict

## Constraints

- Keep the live demo working.
- Do not replace `public/app.js` with static mockup-only UI.
- Do not show destructive tools as Bazaar candidates.
- Keep card radius at 8px or less.
- Avoid a generic landing page with no working product surface.
- Use the selected DepScout logo from `Brand/depscout-logo-source.svg` or `public/assets/depscout-logo.svg`.
