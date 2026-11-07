# Project decisions

## Agreed scope, version 0.1

- GitHub Pages, with GitHub Actions as the only scheduled processing infrastructure.
- React + TypeScript + Vite, with plain CSS.
- A sortable reference table for every artisan recipe, using the wiki as the bundled recipe source.
- Owned starting ingredients valued at trader **sale** prices; output also valued at trader sale price.
- Alternative rows for routes involving crafted intermediate materials.
- Toolbox source refresh time and relative age, plus all common/rare material buy/sell quotes in a compact adjacent panel on wide screens.
- Five-minute refresh target with last-valid-data preservation. Source data age must not be represented as the time our job fetched it.
- Normalize upstream prices in the update job. The frontend consumes our stable schema; keep the full raw response alongside it.
- Initial handoff is source files copied manually to GitHub. No GitHub account connection or publication from this chat.

## Potential later features (not yet implemented)

- Buy/sell valuation choices for ingredients and output.
- Owned-material checkboxes or quantities, distinguishing opportunity cost from purchases.
- Views for disposing of a selected material or comparing whole inventory scenarios.
- No live inventory integration is planned.

## Maintenance

Keep `main` for source and `price-data` for automated snapshots. Keep tests independent of live prices. When returning to this conversation with changes made elsewhere, provide the updated source archive so work continues from the correct version.
