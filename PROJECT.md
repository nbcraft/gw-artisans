# Project decisions

This file records architectural decisions and their rationale. Working instructions are in [AGENTS.md](AGENTS.md).

## Architecture

- The React/TypeScript/Vite application runs entirely in the browser and is deployed as static assets to GitHub Pages through GitHub Actions. Direct price access makes a backend, proxy, scheduled collector, hosted snapshots, and data branch unnecessary.
- Prices use Toolbox’s WebSocket endpoint with LZ-String decoding. A Chromium check on November 8, 2026 found HTTP access blocked by CORS while WebSocket access worked. Toolbox’s developer approved use of either public endpoint without a usage restriction.
- Material icons, artisan recipe availability, convenience rankings, and location maps are bundled with the application. Artisan lookups and images remain available during wiki outages; original source links support attribution and maintenance.

## Possible later work

These ideas are outside the implemented scope:

- Additional valuation choices for rare inputs or outputs.
- Owned-material quantities and comparisons across an inventory.
- Focused views for disposing of one material.

No live inventory integration is planned.
