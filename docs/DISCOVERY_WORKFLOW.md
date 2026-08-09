# Daily discovery workflow

The project uses a signed-in browser for X discovery and feeds a human-reviewed queue.

## Browser-first collection

Use this when Codex has access to a signed-in browser session and X search results.

1. Search posts from the last 24 hours for `MiniMax H3`, `MiniMax-H3`, `Hailuo 3.0`, and `Hailuo-3.0` with videos.
2. Open promising original posts. Ignore repost-only accounts, compilations without attribution, and claims that do not identify the model.
3. Record the post URL, author, date, visible caption, media type, engagement snapshot, and the exact prompt text only when it is visibly published in the original post.
4. Classify mode, category, style, scene, and input types using public post metadata and visible media. Keep classifications factual and bounded by the available evidence.
5. Mark prompt provenance accurately. Use a verbatim provenance only when the exact text is public in the original creator post or an official public script. Otherwise record `prompt: null` and mark the provenance `not-published`.
6. Never generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, summarize, or decompose a missing prompt. Never infer a hidden production workflow from the finished video.
7. Compare the post ID, normalized prompt fingerprint when a public prompt exists, and visual thumbnail against the queue.
8. Add qualified items to `data/candidates.json`. Do not modify `data/cases.json` yet.
9. Run `npm run classify` with MiMo V2.5 Pro when `MIMO_API_KEY` is available. Use it only to classify public text and metadata; do not ask it to produce prompt text.
10. Send only ambiguous or shortlisted videos to `mimo-v2.5` for low-FPS verification. Limit verification to case eligibility, visible content, media properties, and obvious quality signals; do not ask for prompt reconstruction or workflow decomposition.
11. Present a compact review summary. Publish only entries explicitly approved by a reviewer.

Browser automation stores source URLs, attribution, public metadata, and verbatim prompt text only when the source displays it. It does not need to download media during discovery. Public case pages use the official X embedded-post player so visitors can watch in the catalog. If a post cannot be embedded, a hosted media fallback may be added only after redistribution permission is recorded and a maintainer explicitly approves the ingest. Never bypass login controls or download restricted media.

The browser task does not need an X developer token. It requires the user's existing X login session to remain valid on the Mac. If the session expires, stop and request login instead of bypassing access controls.

## Review outcomes

- `approved`: move into `data/cases.json`, add a factual editorial title/summary, preserve any public prompt verbatim, then regenerate the catalog.
- `approved-with-media-fallback`: document redistribution permission, ingest the approved video outside the discovery task, and set `mediaUrl` to the hosted asset while preserving the original post URL.
- `needs-context`: keep in the candidate queue and note the missing evidence.
- `rejected`: retain the source ID in the rejection log so it is not rediscovered.
- `removal-requested`: remove from public data immediately while ownership is reviewed.

Uncertainty never expires into automatic publication. A timeout leaves the item pending.
