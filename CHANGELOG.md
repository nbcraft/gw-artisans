# Changelog

## 0.2.0 — 2026-11-08

- Fetch prices directly from Toolbox in the browser over LZ-compressed WebSocket, with validation, last-valid-price caching, automatic reconnects, and concise failure warnings.
- Refresh every two minutes while visible and catch up on return without replacing the connection. Keep source/per-quote timestamps separate from the last successful response time.
- Remove scheduled collection, hosted price snapshots, and data-branch machinery; retain the application build and Pages deployment workflow.
- Add common-material buy/sell valuation for direct and intermediate routes, plus a craftable-only rare-price filter.
- Remember valuation, filter, intermediate-craft, sort, and theme choices in browser storage.
- Simplify the bench header, enlarge table text, use uniform recipe-row backgrounds, and keep positive benefits green without cell shading.
- Add light/dark themes with a shared 220ms page and toggle fade, reduced-motion handling, and an instant fallback where view transitions are unavailable.
- Show relative price age with freshness indicators, exact timestamps on hover, and an explanation of Toolbox refresh delays that can be dismissed with Escape.

## 0.1.0 — 2026-11-05

- Initial artisan table with 13 recipes and 3 intermediate crafting routes.
- Sorting, recipe/ingredient search, and intermediate-route visibility toggle.
- Compact common/rare material price panel with buy/sell lot prices.
- Source update timestamp, relative data age, and per-quote observation tooltips.
- Versioned price normalization and validation; full raw response retained.
- Scheduled GitHub Actions refresh, separate data branch, and GitHub Pages deployment.
- Fixed-fixture calculation tests and data-branch integration tests.
