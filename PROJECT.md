# Project decisions

## Scope and constraints

- A static React/TypeScript/Vite application deployed through GitHub Actions to GitHub Pages. Keep the build/deploy workflow; no backend, proxy, scheduled collector, hosted price snapshots, or data branch.
- Toolbox’s developer approved use of either public endpoint without a usage restriction. A Chromium check on November 8, 2026 found HTTP access blocked by CORS, while WebSocket access worked; use the working WebSocket transport with LZ-String decoding.
- Preserve Toolbox source and per-quote timestamps independently of browser response times. A successful connection can still return old data; show that age honestly and retain valid prices through outages.
- The reference covers every bundled artisan recipe and the three known intermediate routes. Common-input buy/sell valuation is selectable; rare inputs and outputs retain sell valuation.
- Bundle the fixed material icons locally, with original wiki file links, so icon display does not depend on wiki availability. Display prices in gold with thousands separators and a small `g` label.
- Prefer a small source tree and existing platform features over additional libraries or abstraction layers. Keep automated tests independent of live Toolbox data; verify browser access and presentation separately.

## Possible later work

These are ideas, not implemented features or approval to add them:

- Additional valuation choices for rare inputs or outputs.
- Owned-material quantities and comparisons across an inventory.
- Focused views for disposing of one material.

No live inventory integration is planned. User-visible additions should be proposed before implementation.
