# Website domain configuration

The primary website is https://awesome-minimax-h3-cases.zzskysilent.com.
`config/site.json` is the source of truth for the primary and compatibility origins.
Builds, SEO, feedback links, repository metadata and publication checks share it.

`PUBLIC_SITE_URL` and `SITE_BASE_URL` remain supported for explicit local tests.
Conflicting values fail validation. Production must use the primary origin.
`npm run site:sync` refreshes the configuration bundled into the two reading Skills;
`npm run skills:verify` detects stale copies. Installed Skills support an explicit
`H3_LIBRARY_URL` override and do not require a checkout of this repository.

`npm run build:reference` produces an analytics-free documentation build.
Production always uses `npm run build`; the production server rejects reference
artifacts. `npm run site:check` validates generated canonical and discovery URLs.

Set `H3_LEGACY_REDIRECT=temporary` to send legacy HTML pages to their matching
primary-domain URLs using 302, or `permanent` for 308 after verification.
`off` disables the migration redirect. Paths and query strings are preserved;
the browser carries fragments through a redirect with no replacement fragment.
API, data, media, posters, assets and health requests remain compatible.
Responses are not cached during the initial migration. Keep the old domain and
HTTPS binding available for existing links and installed clients.

Favorites, language preferences and analytics opt-out are stored in each browser
origin. They are not deleted, but do not automatically move to the new origin.
This migration does not add account login or a favorites transfer feature.

Keep the existing Umami website identity so its history is retained. Check domain
filters and verify a labeled test event before declaring analytics migration
complete. Automated screenshots and reference builds must not send analytics.

Verify bilingual pages, deep links and filters, both media origins, Skills,
canonical/hreflang/OG/JSON-LD, robots and sitemaps after each deployment. Submit
the new sitemap in Search Console when an authorized property is available.
If migration redirects cause a failure, disable them independently; preserve
the custom domain because clients can cache permanent redirects.
