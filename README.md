# Artisan Ledger

A small Guild Wars crafting reference: React, TypeScript, Vite, and plain CSS. Hosted entirely on GitHub Pages. No database, application server, accounts, API keys, or additional hosting provider.

## Run locally

Use Node.js 26 or newer (the project and workflow select Node 26) and npm:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The included price snapshot works immediately. To fetch new data manually:

```sh
npm run prices:update
```

Useful checks:

```sh
npm test
npm run prices:check
npm run build
npm run preview
```

Vite provides the development server and builds ordinary static files in `dist/`. Node is used for development and GitHub Actions only; visitors need just a browser.

## Publish to GitHub Pages

1. Create a GitHub repository with `main` as its default branch. A public repository is the simplest Pages setup.
2. Copy **the contents of this project folder** into its root and commit them. Include `.github/workflows/pages.yml`, `.node-version`, `.gitignore`, `package-lock.json`, and both files under `public/data/`. Do not upload `node_modules/` or `dist/`. GitHub's browser upload may omit hidden folders: ensure the workflow exists at `.github/workflows/pages.yml` (you can create it with **Add file → Create new file**).
3. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
4. Open **Actions → Refresh prices and publish Pages → Run workflow** on `main`. Subsequent source commits and the five-minute schedule trigger it automatically.
5. Open the Pages URL shown by the successful deployment.

The default `GITHUB_TOKEN` is sufficient. The workflow requests `contents: write` to maintain the data branch and the normal Pages/OIDC deployment permissions. If repository or organization policies prohibit branch writes or Pages deployments, adjust those settings. If the default branch has a different name, update `push.branches` in the workflow.

Relative asset and data paths support both `https://username.github.io/repository/` and a root/custom-domain site without changing the Vite base setting.

## Price updates and storage

One workflow:

1. Restores the last successful snapshot from the separate **`price-data` branch**; the bundled files provide the first-run fallback.
2. Makes one request to `https://kamadan.gwtoolbox.com/trader_quotes`.
3. Validates all 36 material quotes and converts them into our versioned schema.
4. Runs tests and builds the site when prices changed, or on a manual/source-triggered run.
5. Publishes the static site, then saves the validated data to `price-data`.

The data branch is created automatically and contains only `prices.json` and `toolbox-raw.json`. Source history stays on `main`; scheduled updates do not commit to `main`. The source-bundled snapshot may consequently be older than the live data branch. When working locally, use `npm run prices:update` to refresh it.

Invalid responses, missing material quotes, network failures, and older snapshots never replace valid data. A failed fetch appears as a warning in Actions; the previous snapshot remains available. Unchanged scheduled runs skip deployment and data commits. A failed deployment is retried on a later run. Browser visitors only request our own Pages JSON, never Toolbox.

The schedule runs at minutes 2, 7, 12, etc. GitHub scheduling is best-effort: jobs may be delayed or dropped, and scheduled workflows on inactive public repositories can be disabled after 60 days. This is a five-minute refresh target, **not a maximum data age**. Toolbox itself may provide older observations. The interface always shows Toolbox's source timestamp and age; each quote has its own observation-time tooltip.

The page checks for a newer shared JSON snapshot every five minutes while visible and uses a versioned browser cache. It retains the last valid browser snapshot on a network error. No service worker is installed, which avoids trapping visitors on an old application version.

## Data contract

The website reads **only `public/data/prices.json`**, not Toolbox's raw format:

```json
{
  "schemaVersion": 1,
  "source": {
    "name": "Kamadan / GWToolbox",
    "url": "https://kamadan.gwtoolbox.com/trader_quotes",
    "updatedAt": "2026-11-05T22:31:26.000Z"
  },
  "materials": {
    "dust": {
      "buy": { "gold": 380, "quantity": 10, "observedAt": "2026-11-05T22:28:00.000Z" },
      "sell": { "gold": 280, "quantity": 10, "observedAt": "2026-11-05T22:28:05.000Z" }
    }
  }
}
```

This is an illustrative excerpt; the actual file contains all 36 crafting materials. `gold` is the total price for `quantity`, not the per-unit value. `buy` is what the player pays; `sell` is what the player receives. All timestamps are ISO 8601 UTC strings, displayed in the visitor's browser timezone.

`public/data/toolbox-raw.json` retains the **entire upstream response**, including other trader items, for future conversion work. Adding a UI feature never requires reading raw Toolbox fields in React. Stable material IDs and Toolbox mappings live in `src/data/materials.json`; validation and conversion live in `src/prices.ts`. If the upstream format changes, update the converter. Deliberate changes to our public contract must also change `schemaVersion`, its validator, and the browser cache key.

## Calculation rules

Every row produces one rare material:

**Benefit = output trader sale price − all crafting fees − starting ingredients' trader sale value.**

All starting ingredients are assumed owned, including rare inputs in direct recipes. Common quotes are for lots of 10; rare quotes are for one. Calculations prorate common prices, so they represent opportunity cost rather than an executable quote for a partial lot. No rounding occurs in the calculations; display formatting permits one decimal place.

Secondary rows replace the owned intermediate ingredient with its own starting ingredients and include both crafting fees. The three current alternatives are crafted charcoal for Steel/Deldrimor Steel and crafted glass for Ink. Alternative rows remain attached to their primary recipe when sorting; numeric sorting uses the direct recipe's value.

The first version includes 13 recipes, 3 alternative routes, sortable columns, ingredient/material search, a chain toggle, and all 36 buy/sell quotes. Prices may move as you transact; the page cannot predict bulk price changes.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/App.tsx`, `src/styles.css` | Table, price panel, source age, presentation |
| `src/data/materials.json` | Stable IDs, names, groups, lot sizes, Toolbox identifiers |
| `src/data/recipes.json` | Bundled wiki recipes and verification date |
| `src/catalog.ts` | Recipe types and intermediate-route expansion |
| `src/calculations.ts` | Pure crafting calculations |
| `src/prices.ts` | Normalized contract, upstream converter, validation |
| `src/usePrices.ts` | Loading, five-minute browser cache, refresh/error behavior |
| `scripts/update-prices.mjs` | Fetch, validate, normalize, atomic file replacement |
| `scripts/price-branch.mjs` | Restore/compare/publish data without changing the source checkout |
| `.github/workflows/pages.yml` | Scheduled refresh and Pages deployment |
| `tests/` | Fixed calculation fixtures, schema failures, local Git round-trip |

## Credits

Recipes: [Guild Wars Wiki — Artisan / All offered materials](https://wiki.guildwars.com/wiki/Artisan#All_offered_materials), verified November 5, 2026. Prices: [Kamadan / GWToolbox](https://kamadan.gwtoolbox.com/). This independent fan tool is not affiliated with ArenaNet, NCSoft, or GWToolbox. Guild Wars names and game content belong to their respective owners.
