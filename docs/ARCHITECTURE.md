# Architecture

The repository has four public layers:

1. `data/` contains published, source-attributed cases, tutorials, creators, taxonomy, and generated statistics.
2. `scripts/` validates data and derives the compact runtime catalog, search indexes, SEO pages, screenshots, and Skill packages.
3. `src/` renders the case-first React site, tutorials, creator profiles, filters, playback, and bilingual copy.
4. `public/` contains static assets and generated discovery files. Creator videos stay outside Git in object storage and are served through stable `/media/` routes.

Publication is transactional: a case is public only after its metadata, local poster, stored video, application redirect, and Range response pass validation. Private candidates, discovery sources, author-monitoring state, and failure notes belong under ignored `.review/` or a private operations workspace.

The reusable public collection demo documents the contract without exposing the production instance. See [PUBLIC_COLLECTION_WORKFLOW.md](./PUBLIC_COLLECTION_WORKFLOW.md).
