# Changelog

All notable public changes are documented here. Release dates use YYYY-MM-DD.

## [Unreleased]

### Added

- A browser-local returning-user update snapshot across cases and tutorials, with shared `Since last visit`, `Today`, `Last 7 days`, `Last 30 days`, and `All` date filters.
- Immutable ISO `addedAt` timestamps for every public case and guide, plus publishing and validation safeguards.
- A bilingual creator discovery module with dynamic video and tutorial leaderboards, creator profiles, local creator bookmarks, and source-linked case/tutorial collections.
- A private creator radar that bootstraps from published cases, schedules due-author checks, backfills H3 history, and preserves at least half of daily discovery capacity for new authors.

### Changed

- Case and tutorial cards now show catalog-added dates and text labels for newly added material; the compatible `collection=latest` view now sorts by `addedAt`.
- Bilingual README screenshots and documentation now cover the update summary, date filters, URL state, and local-only seen state.
- Creator counts, public rankings, SEO pages, sitemap entries, README metrics, and `llms.txt` are generated from the same published-data source of truth.

## [0.2.1] - 2026-08-23

### Added

- A reproducible screenshot command that refreshes bilingual desktop/mobile README visuals from current project data.
- A verified Agent Skills discovery and tutorial-routing screenshot.

### Security

- Updated the transitive Nano ID dependency to a patched release.
- Updated GitHub checkout and Node setup actions to their maintained Node 24 releases.

## [0.2.0] - 2026-08-23

### Added

- Quick case collections, anonymous local favorites, and composable URL filters.
- Goal- and hardware-based tutorial discovery plus a bilingual tool ecosystem map.
- Eight flagship zero-to-one tutorials with tested versions, commands, success checks, troubleshooting, and rollback guidance.
- Installable case lookup and tutorial guide Agent Skills.
- A generated project statistics file shared by the website, README workflow, and public tooling.
- Case, tutorial, broken-media, Prompt-dispute, and takedown Issue forms.

### Changed

- Community tutorial cards now lead to complete internal guides before the original source.
- Resource cards show dated GitHub Star snapshots and practical tradeoffs.

[Unreleased]: https://github.com/SkyNotSilent/awesome-minimax-h3-cases/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/SkyNotSilent/awesome-minimax-h3-cases/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/SkyNotSilent/awesome-minimax-h3-cases/releases/tag/v0.2.0
