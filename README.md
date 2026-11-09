# Guild Wars Artisans

Compare Guild Wars artisan crafting returns using current trader quotes. Includes 13 recipes, 3 intermediate crafting routes, sorting, ingredient search, and a material-price panel.

Site: [nbcraft.github.io/gw-artisans](https://nbcraft.github.io/gw-artisans/)

## Run locally

Use Node.js 24 or newer and npm; `.node-version` pins the version used for development and deployment.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Tests use fixed fixtures and simulated connections, without live prices or repository commands. The build produces a static site in `dist/`.

## Calculations and controls

**Benefit = output trader sell price − all crafting fees − starting ingredient value.**

Choose **Sell price** (the default) to value owned common materials at what a trader would pay, or **Buy price** to use their purchase cost. Rare inputs and crafted outputs always use sell prices. Intermediate routes value their starting common materials using the same choice and include every crafting fee.

Common materials trade in lots of 10; rare lots contain one unit. Input values are prorated for the recipe quantity, so a partial lot is a valuation rather than an executable trade. Calculations retain full precision. Displayed values stay in gold, with thousands separators, up to one decimal place, and a smaller `g` label (for example, `1,200 g`).

Sort buttons keep intermediate routes beside their direct recipe. Search matches output materials or ingredients. **Craftable only**, in the rare-price heading, hides rare materials without an artisan recipe while keeping common materials visible.

The browser remembers common-material valuation, intermediate-craft visibility, the craftable-only filter, and the sort column/direction. Searches are not saved. The sun/moon switch follows the system theme initially and saves a manual choice. Theme changes share a 220ms fade where supported; reduced-motion settings use an instant switch. Controls still work for the current visit if browser storage is unavailable.

## Price freshness

The browser connects directly to [Kamadan / GWToolbox](https://kamadan.gwtoolbox.com/) over WebSocket. The first visit needs a working connection; subsequent visits can display the last valid cached prices during an outage.

Prices are requested every two minutes while the tab is visible. Hidden tabs pause requests and retain the connection. Returning requests prices immediately if the last query was at least two minutes ago; otherwise it waits the remaining time. Failed or silent connections reconnect automatically, with one concise console warning per outage.

**Prices last refreshed** shows the age of Toolbox’s source data, not the age of the connection. Hover for the exact date/time. The dot is green below five minutes, orange from five through fifteen minutes, and red above fifteen. The question mark shows the last successful validated response separately, with the same indicator beside its relative age and the full date/time in parentheses. Each buy/sell quote also has its own observation-time tooltip. Receiving unchanged prices does not make their source timestamp newer.

Only validated, complete prices replace cached data; older source timestamps cannot roll prices backward. Local storage is optional. Unrelated chat/status frames are discarded. No account, API key, backend, hosted price snapshot, or scheduled collection is needed.

## Deploy to GitHub Pages

The intended repository is `nbcraft/gw-artisans`, serving [https://nbcraft.github.io/gw-artisans/](https://nbcraft.github.io/gw-artisans/).

1. Keep source files, `package-lock.json`, `.node-version`, and `.github/workflows/pages.yml` in the repository. Exclude dependencies, build output, verification artifacts, caches, and private configuration.
2. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. GitHub Free requires a public repository for Pages; supported paid plans also allow private repositories.
3. Push the release changes to `main` or manually run **Build and publish Pages**. The workflow installs dependencies, runs tests, builds, and deploys `dist/`. A release/tag alone does not trigger it.

Vite’s relative `base: './'` supports the repository subpath without hard-coding the account or repository name. No custom domain, data branch, `gh-pages` branch, or committed `dist/` is required. If the deployment branch changes, update `push.branches` in the workflow. The workflow uses read-only repository access plus Pages/OIDC deployment permissions.

## Source and maintenance

- `src/App.tsx`, `src/styles.css`: interface, preferences, and theme.
- `src/prices.ts`, `src/usePrices.ts`: price access, normalized schema, validation, cache, and React subscription.
- `src/catalog.ts`, `src/data/`, `src/calculations.ts`: bundled materials/recipes, intermediate routes, and calculations.
- `public/icons/`: bundled material icons, with original file links in `sources.json`.
- `tests/`: deterministic calculation, normalization, cache, and connection-lifecycle coverage.

See [PROJECT.md](PROJECT.md) for scope decisions and [AGENTS.md](AGENTS.md) for contributor working rules. Treat all browser assets and public repository history as public information; never add credentials or private data.

## Credits

Recipes: [Guild Wars Wiki — Artisan](https://wiki.guildwars.com/wiki/Artisan#All_offered_materials), verified November 5, 2026. Prices: [Kamadan / GWToolbox](https://kamadan.gwtoolbox.com/). This independent fan tool is not affiliated with ArenaNet, NCSoft, or GWToolbox. Guild Wars names and game content belong to their respective owners.

Material icons are copied from [Guild Wars Wiki](https://wiki.guildwars.com/) and served locally so wiki outages do not affect them. [Icon sources](public/icons/sources.json) records each original image and file page. ArenaNet game artwork remains the property of ArenaNet / NCSoft and is not covered by the wiki text’s GFDL license; see the [wiki copyright information](https://wiki.guildwars.com/wiki/Guild_Wars_Wiki:Copyrights).
