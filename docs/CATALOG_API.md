# Catalog query contract

The existing Node server loads an immutable, public-only snapshot from `build/server-data/catalog.ndjson` before listening. Streaming startup avoids holding the full serialized catalog and its parsed copy in memory together. The snapshot is outside `dist/`. `data/cases.json` remains the content source of truth.

`GET /api/catalog` accepts `language`, `q` (at most 300 characters), `category`, `style`, `scene`, `duration`, `prompt`, `collection`, `added`, `since`, `through`, `from`, `to`, `creator`, `limit`, and `cursor`. The first page contains at most 36 cards; subsequent requests use 24. Search is a normalized substring across public titles, summaries, original published Prompts, author attribution, taxonomy keys and localized labels. Facet counts query the full matching catalog while omitting their own dimension. Date presets send browser-local day boundaries as explicit UTC instants. `since` is exclusive and `through` inclusive.

The version hashes all query-relevant public content, including taxonomy and featured membership. Cursors bind version, filter scope and position. A deployment version mismatch returns 409; the client retains filters and restarts pagination. Other query failures retain displayed results and offer retry. Abort signals and a request sequence prevent stale responses replacing newer filters.

`GET /api/catalog/summary` returns channel maxima and bounded aggregate counts. It accepts `casesSince`, `casesThrough`, `tutorialsSince`, `tutorialsThrough`, `todayFrom`, and `todayThrough`. It never returns all case IDs. The browser continues to store time-based update acknowledgements, not per-video viewing histories.

For the favorites collection, `POST /api/catalog` accepts only `{ "favorites": ["case-id"] }`, capped at 256 KiB and 10,000 syntactically valid IDs. The request is read-only. Favorites remain in browser storage; the service sees IDs supplied for that query, writes none, and never logs the body, search string or ID list. API responses use `private, no-store`; platform access-log retention must be reviewed during deployment activation. Other collections do not send the stored favorites list.

Cards include immediate media and source URLs; detail and Prompt text load only when requested. Creator case lists paginate through the same API; creator mosaics use three public poster URLs. Existing localized static SEO pages remain generated from complete public content. The old `data/catalog.json` and search indexes remain available for one compatibility release; they no longer define first-load budgets.

Run `npm run performance:budget` for response and bundle limits, `npm run performance:capacity` for isolated current/5k/10k fixtures with 20 concurrent requests, and `npm run test:server` for HTTP boundaries. Capacity tests measure processing p95 separately from queued end-to-end latency; local results are not Railway capacity evidence. No database, worker service or paid resource is added.
