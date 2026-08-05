# Daily discovery workflow

The project uses a signed-in browser for X discovery and feeds a human-reviewed queue.

## Browser-first collection

Use this when Codex has access to a signed-in browser session and X search results.

1. Search posts from the last 24 hours for `MiniMax H3`, `MiniMax-H3`, `Hailuo 3.0`, and `Hailuo-3.0` with videos.
2. Open promising original posts. Ignore repost-only accounts, compilations without attribution, and claims that do not identify the model.
3. Record the post URL, author, date, visible prompt, media type, and engagement snapshot.
4. Classify mode, category, style, scene, and input types using `data/schema.json`.
5. Mark prompt provenance accurately. Never reconstruct a prompt unless the entry is explicitly labeled `reconstructed`.
6. Compare the post ID, normalized prompt fingerprint, and visual thumbnail against the queue.
7. Add qualified items to `data/candidates.json`. Do not modify `data/cases.json` yet.
8. Run `npm run classify` with MiMo V2.5 Pro when `MIMO_API_KEY` is available.
9. Send only ambiguous or shortlisted videos to `mimo-v2.5` for low-FPS verification.
10. Present a compact review summary. Publish only entries explicitly approved by a reviewer.

Browser automation should store source URLs and attribution. Do not bypass login controls, download restricted media, or re-host creator videos without permission.

The browser task does not need an X developer token. It requires the user's existing X login session to remain valid on the Mac. If the session expires, stop and request login instead of bypassing access controls.

## Review outcomes

- `approved`: move into `data/cases.json`, add editorial title/summary, then regenerate the catalog.
- `needs-context`: keep in the candidate queue and note the missing evidence.
- `rejected`: retain the source ID in the rejection log so it is not rediscovered.
- `removal-requested`: remove from public data immediately while ownership is reviewed.

Uncertainty never expires into automatic publication. A timeout leaves the item pending.
