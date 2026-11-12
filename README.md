# Guild Wars Artisans

Compare Guild Wars artisan crafting returns using current trader quotes. Browse 13 recipes, find artisans, and calculate fees and ingredients for a batch.

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

Common materials trade in lots of 10; rare lots contain one unit. Input values are prorated for the recipe quantity, so a partial lot is a valuation rather than an executable trade. Calculations retain full precision. Values are displayed in gold with thousands separators and up to one decimal place.

Sort buttons keep intermediate routes beside their direct recipe. Search matches output materials or ingredients. **Craftable only**, in the rare-price heading, hides rare materials without an artisan recipe while keeping common materials visible.

Click a craftable rare material’s icon or name anywhere in the app to see its artisans. The dialog highlights the most convenient artisan and groups the others by campaign, with wiki links and locally served location maps. Campaigns start expanded and remember their expanded or collapsed state across materials and page reloads. Click a map to open its bundled copy.

Use **Amount needed** (1–250) in the material dialog to calculate total crafting fees and ingredient quantities. Enable **Intermediate craft** to include the starting ingredients and all fees for an available intermediate route.

The browser remembers common-material valuation, intermediate-craft visibility, the craftable-only filter, and the sort column/direction. Searches are not saved. The sun/moon switch follows the system theme initially and saves a manual choice. Controls still work for the current visit if browser storage is unavailable.

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
- `src/MaterialArtisans.tsx`, `src/artisans.ts`, `src/data/artisans.json`: material pop-ups, convenience order, artisan recipe availability, and wiki/map sources.
- `src/prices.ts`, `src/usePrices.ts`: price access, normalized schema, validation, cache, and React subscription.
- `src/catalog.ts`, `src/data/`, `src/calculations.ts`: bundled materials/recipes, intermediate routes, and calculations.
- `public/icons/`: bundled material icons, with original file links in `sources.json`.
- `public/maps/artisans/`: bundled wiki location maps; original image links are recorded with each artisan.
- `tests/`: deterministic calculation, normalization, cache, and connection-lifecycle coverage.

See [PROJECT.md](PROJECT.md) for scope decisions and [AGENTS.md](AGENTS.md) for contributor working rules. Treat all browser assets and public repository history as public information; never add credentials or private data.

## Credits

Recipes: [Guild Wars Wiki — Artisan](https://wiki.guildwars.com/wiki/Artisan#All_offered_materials), verified November 5, 2026. Prices: [Kamadan / GWToolbox](https://kamadan.gwtoolbox.com/). This independent fan tool is not affiliated with ArenaNet, NCSoft, or GWToolbox. Guild Wars names and game content belong to their respective owners.

Material icons and artisan location maps are served locally. [Icon sources](public/icons/sources.json) and [artisan sources](src/data/artisans.json) record the original Guild Wars Wiki links. ArenaNet game artwork remains the property of ArenaNet / NCSoft and is not covered by the wiki text’s GFDL license; see the [wiki copyright information](https://wiki.guildwars.com/wiki/Guild_Wars_Wiki:Copyrights).
