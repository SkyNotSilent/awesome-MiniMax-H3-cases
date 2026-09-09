# Architecture

The repository has four public layers:

1. `data/` contains published, source-attributed cases, tutorials, creators, taxonomy, and generated statistics.
2. `scripts/` validates data and derives the compact runtime catalog, search indexes, SEO pages, screenshots, and Skill packages.
3. `src/` renders the case-first React site, tutorials, creator profiles, filters, playback, and bilingual copy.
4. `public/` contains static assets and generated discovery files. Creator videos stay outside Git in object storage and are served through stable `/media/` routes.

Publication is transactional: a case is public only after its metadata, local poster, stored video, application redirect, and Range response pass validation. Private candidates, discovery sources, author-monitoring state, and failure notes belong under ignored `.review/` or a private operations workspace.

The reusable public collection demo documents the contract without exposing the production instance. See [PUBLIC_COLLECTION_WORKFLOW.md](./PUBLIC_COLLECTION_WORKFLOW.md).

## Runtime contracts

The homepage requests bounded catalog API pages: 36 cards initially, then 24 per continuation. Search stays in the existing server catalog index; this release does not change playback, pagination, or search architecture. Media and source URLs are available before detail JSON. No video bytes are requested before interaction.

Tutorial Skills use `/data/tutorial-guides.v2.json`: `{ schemaVersion: 2, contentVersion: <SHA-256 of public guides>, guides: [...] }`. Invalid versions or shapes are lookup errors, not zero matches. Requests time out after 15 seconds and never silently use fixtures. The website retains its hashed tutorial asset; the legacy raw-array endpoint remains compatible.

HTML and non-hashed JSON use `public, max-age=0, s-maxage=60, stale-while-revalidate=300` with ETag validation. Hashed JS/CSS use a year-long immutable cache. Media redirects retain the existing short cache and one-hour signatures; errors use `no-store`.

Tutorial filters intersect search, hardware, category, track and date. Setup guides appear in filtered results; default starter navigation remains separate. Date-filtered groups use stable newest-first order; default practical cards retain learning order and author spotlight. Empty searches offer a full reset.

Tutorial authors with a public X, GitHub or YouTube identity can appear regardless of foundation/community classification. Docs sources may provide an evidenced `source.authorProfileUrl`, never a guessed cross-platform identity. Video ranks and tutorial ranks remain separate.

`commandItems[].cwd` identifies the working directory for relative commands. Rendered instructions and Copy for AI retain it alongside command/path and platform labels. Source checks are not GPU generation tests.

## Links and verification

Quick collections clear conflicting filters on entry; subsequent filters narrow the collection. `collection=latest` retains the latest-48 entry; `collection=long|prompt` maps to duration/Prompt controls. Public `added=release` means the latest Shanghai calendar-day publication, not personal tracking. Old snapshot parameters are normalized by the existing release module. Favorites stay browser-local.

Run `npm run verify` for data, unit, server, type/build, privacy and size gates; `npm run skills:install:verify` for isolated offline clients; and the README screenshot/performance scripts for production-browser checks. See [DEVELOPMENT.md](./DEVELOPMENT.md).
