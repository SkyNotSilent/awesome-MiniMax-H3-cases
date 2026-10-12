# Advertising operations

The site supports a small number of manual Google AdSense display units. Auto ads must remain off in the AdSense dashboard. No ads are placed inside case detail pages, video dialogs, account collections, sign-in flows or legacy favorite import pages.

## Configuration and verification

Configure these variables on the Railway `h3-field-notes` service. Publisher and slot identifiers are public advertising identifiers; payment information never belongs in these variables.

| Variable | Purpose | Default |
| --- | --- | --- |
| `ADSENSE_CLIENT_ID` | Google-issued `ca-pub-` identifier with 16 digits | Unconfigured |
| `ADSENSE_CATALOG_SLOT` | Ten-digit responsive display slot for directories | Unconfigured |
| `ADSENSE_TUTORIAL_SLOT` | Ten-digit responsive display slot for eligible guides | Unconfigured |
| `ADSENSE_ENABLED` | Master switch, exact value `true` to enable | Off |
| `ADSENSE_SITE_READY` | Set `true` only after the domain is Ready in AdSense | Off |
| `ADSENSE_CMP_PUBLISHED` | Set `true` only after publishing and checking Google consent messages | Off |

The server injects the `google-adsense-account` verification meta tag on the production H3 and root domains when a valid publisher ID is configured. This does not load advertising scripts. `/ads.txt` returns the corresponding Google DIRECT declaration as plain text, or 404 when no valid publisher is configured. GET and HEAD are supported. Existing authorized sellers must be reconciled before replacing an existing root ads.txt file.

`/ads-config.json` contains only public advertising settings and never uses account sessions. It is uncached and emits `enabled: false` on preview, development, root and legacy hosts. The runtime also checks HTTPS and the exact production origin. There is no query parameter that enables real ads in previews.

The root host `zzskysilent.com` serves a small entry page that links to both H3 languages, about, contact and privacy pages. The H3 hostname remains the public application URL. Verify authoritative DNS and HTTPS before submitting the root domain for review; preserve unrelated DNS records.

## Eligible inventory

`config/advertising.json` is the explicit allowlist. Source attribution does not establish permission for commercial reproduction. Add only pages with recorded rights and meaningful editorial value after their content check:

- `approvedCatalogPaths`: exact `/`, `/en/` or numbered `/cases/page/N/` and `/en/cases/page/N/` archive paths with N >= 2.
- `approvedTutorialIds`: guide IDs, enabling both language paths for that guide.

The initial inventory covers both homepages, both page-two archives, and the `official-deployment` and `minimax-director-timeline` guides in both languages. This list does not enable serving by itself. Recheck rights before adding new authors or content to an eligible directory.

Case detail pages and unrelated routes cannot be enabled through this configuration. A catalog unit appears after case 12 and only when at least 12 actual results are rendered. A guide unit appears after the article body. Static archive pages use the same runtime as React. Filters do not refresh an already submitted unit.

Do not infer commercial permission from a source link, public availability, an author submission or a model license alone. Inspect reproduced text, video, audio, posters and embedded images as well as the site's own notes. Keep detailed rights evidence and account status in private operations records. Site approval covers more than the enabled ad pages.

## Consent and behavior

Use Google's Privacy & Messaging CMP; publish the applicable European and US state messages and link to the site privacy policy. Offer refusal and choice management. The Google tag bootstraps those published messages. This site does not submit an ad unit before `CONSENT_DATA_READY`; when TCF applies, refusal of storage or Google vendor consent suppresses the slot. Google handles remaining TCF/GPP purpose and regional restrictions. A missing CMP callback fails closed.

The footer waits for Google's `CONSENT_API_READY` callback. EU choices use `showRevocationMessage()`. In applicable US states, the explicit Do Not Sell or Share control replaces Google's default link and uses `INITIAL_US_STATES_OPT_OUT_DATA_READY`, `getInitialUsStatesOptOutStatus()` and `openConfirmationDialog()`; it remains hidden elsewhere. It hides active units before opening the choice flow. After changing consent, a fresh page visit can render eligible units under the new choice. Disabled or blocked CMP services show an explanation with the privacy policy's Google Ads Settings link as an alternative.

Slots reserve space, load near the viewport, initialize at most once per placement and path during a page visit (filters do not refresh ads), and hide on script failure, rejected consent or unfilled status. Browsing and account features continue without advertising. No emails, account IDs or favorites are sent to the advertising configuration.

## Release and rollback

1. Check content rights and editorial value, DNS, HTTPS, verification meta and root ads.txt; deploy with all advertising switches off.
2. Complete AdSense payment/onboarding requirements in Google's own UI. Request site review after readiness work is complete.
3. Wait for Ready, create the two manual units, turn off Auto ads and publish/test the consent messages. Record the actual settings in private operations notes.
4. Run automated tests with a simulated provider, checks and a production build. Enable approved inventory only after those checks.
5. Verify ordinary display and consent choices without clicking ads or generating artificial impressions. Disable `ADSENSE_ENABLED` and verify the public config to roll back.

After 30 days of genuine traffic, compare AdSense page views, impressions, page RPM and estimated/finalized revenue against the monthly target, with incremental costs recorded separately. Umami page views are not paid ad impressions. Estimated revenue and actual payouts are different records.

References: [site review](https://support.google.com/adsense/answer/12131223), [replicated content](https://support.google.com/publisherpolicies/answer/11190248), [ads.txt](https://support.google.com/adsense/answer/9785052), [Google CMP API](https://developers.google.com/funding-choices/fc-api-docs), [privacy disclosures](https://support.google.com/adsense/answer/1348695).
