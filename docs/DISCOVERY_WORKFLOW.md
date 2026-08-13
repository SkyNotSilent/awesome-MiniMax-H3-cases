# Daily discovery workflow

The project uses a signed-in browser for X discovery. Clear, source-backed cases are published automatically; only ambiguous items enter the review queue.

## Browser-first collection

Use this when Codex has access to a signed-in browser session and X search results.

1. Search posts from the last 24 hours for `MiniMax H3`, `MiniMax-H3`, `Hailuo 3.0`, and `Hailuo-3.0` with videos.
2. Open promising original posts. Ignore repost-only accounts, compilations without attribution, and claims that do not identify the model.
3. Record the post URL, author, date, visible caption, media type, engagement snapshot, and the exact prompt text only when it is visibly published in the original post.
4. Classify mode, category, style, scene, and input types using public post metadata and visible media. Keep classifications factual and bounded by the available evidence.
5. Mark prompt provenance accurately. Use a verbatim provenance only when the exact text is public in the original creator post or an official public script. Otherwise record `prompt: null` and mark the provenance `not-published`.
6. Never generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, summarize, or decompose a missing prompt. Never infer a hidden production workflow from the finished video.
7. Compare the post ID, normalized prompt fingerprint when a public prompt exists, and visual thumbnail against the queue.
8. Automatically publish a post when the original caption explicitly attributes the native video to MiniMax H3/Hailuo 3.0, the author and source are clear, the media is playable, and it is not an obvious repost, bulk advertisement, news/tutorial clip, or unrelated model output. Download the highest-quality public MP4, upload it to the project's private Railway bucket, set `mediaUrl` to `/media/{case-id}.mp4`, cache its poster, add it to `data/cases.json`, and remove it from the candidate queue. Preserve `sourceUrl` so the case player can keep its X source icon.
9. Run `npm run classify` with MiMo V2.5 Pro when `MIMO_API_KEY` is available. Use it only to classify public text and metadata; do not ask it to produce prompt text.
10. Send only ambiguous or shortlisted videos to `mimo-v2.5` for low-FPS verification. Limit verification to case eligibility, visible content, media properties, and obvious quality signals; do not ask for prompt reconstruction or workflow decomposition.
11. Keep only ambiguous, incomplete, or disputed items in `data/candidates.json` with a factual review note. Clear cases do not require a second manual confirmation.
12. Do not publish a case until its hosted video exists and can be played through `/media/{case-id}.mp4`. Run data validation, tests, and the production build. If all checks pass, commit and push the related changes to GitHub so Railway can deploy them automatically, then verify both the deployment and a ranged video response.

Browser automation stores source URLs, attribution, public metadata, and verbatim prompt text only when the source displays it. Public case pages play a project-hosted copy so visitors are not blocked by X embed delays or availability. The server issues short-lived signed Railway bucket URLs; bucket credentials remain server-side and must never be written to the repository, frontend bundle, logs, or task report. Preserve an X icon link on every X-sourced player. Never bypass login controls or download restricted media.

The browser task does not need an X developer token. It requires the user's existing X login session to remain valid on the Mac. If the session expires, stop and request login instead of bypassing access controls.

## Review outcomes

- `auto-approved`: for a clear original H3 case, mirror its video to Railway storage, move it directly into `data/cases.json`, add a factual editorial title/summary, preserve any complete public prompt verbatim, regenerate the catalog, push, and verify deployment.
- `approved`: the same publication path, used when a previously ambiguous item is later confirmed.
- `media-failed`: keep the item out of the public catalog until its video has been uploaded and verified; retain it in the candidate queue with the factual failure reason.
- `needs-context`: keep in the candidate queue and note the missing evidence.
- `rejected`: retain the source ID in the rejection log so it is not rediscovered.
- `removal-requested`: remove from public data immediately while ownership is reviewed.

Uncertainty never expires into automatic publication. A timeout leaves the ambiguous item pending, but it does not block other clear cases from publishing.
