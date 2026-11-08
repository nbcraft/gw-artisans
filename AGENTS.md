# Working on Guild Wars Artisans

Follow the session’s existing permissions; this file grants no additional access or command approval.

- Keep changes within the requested scope. Suggest additional user-visible features before implementing them.
- Prefer simple React/TypeScript and plain CSS; avoid extra files, dependencies, or layers without a clear benefit.
- Keep Toolbox transport, decoding, normalization, validation, and caching in `src/prices.ts`. UI components consume the normalized schema.
- Preserve source/per-quote timestamps separately from successful-response time. Never make old prices appear fresh after reconnecting.
- Apply the selected buy/sell side only to common starting inputs, including intermediate routes. Rare inputs and crafted outputs use sell prices; include every fee and prorate lot values without rounding calculations.
- Keep two-minute visible-tab requests, overdue refresh on return, one connection per page, last-valid-price preservation, and quiet reconnects.
- Keep automated tests deterministic and offline. Use browser checks separately for transport, accessibility, layout, and theme behavior. Validate meaningful changes with the relevant tests and production build, respecting session permissions.
- Preserve relative deployment paths and the GitHub Pages application workflow. Do not restore scheduled collection, hosted snapshots, or data-branch machinery.
- Treat source, browser assets, and public repository history as public. Never add credentials, tokens, private data, browser profiles, private environment files, or generated caches/artifacts. Vite/browser environment values are public, not a place for secrets. Redact sensitive findings rather than copying their values into logs or documentation.
- Keep README behavior, project decisions, and release notes accurate without duplicating implementation detail across them.
