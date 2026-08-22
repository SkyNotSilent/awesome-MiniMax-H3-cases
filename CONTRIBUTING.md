# Contributing

Thanks for helping document MiniMax H3 experiments. This catalog values real cases and verifiable provenance over volume.

## Add a verified case

1. Add one object to `data/cases.json` using the existing schema.
2. Link to the original creator's post, not a repost or compilation.
3. Include prompt text only when it is publicly visible in the original creator's post, an official public script, or a disclosed public archive approved by a maintainer. Copy it verbatim, preserve the source URL, and set `promptCompleteness` to `complete` or `excerpt` accurately.
4. When no prompt was published, use `prompt: null` with `promptProvenance: "not-published"`. Never generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, or decompose a prompt from the video, caption, or surrounding discussion.
5. Keep editorial summaries limited to visible media and facts explicitly stated by the source. Do not present an inferred production workflow as a disclosed workflow.
6. Host approved videos in project storage, keep the original source link, and add `archiveSourceUrl` whenever a public archive is used to recover unavailable media or Prompt text.
7. Run `npm test`, `npm run lint`, `npm run build`, and `npm run catalog`.

Use `data/candidates.json` and `reviewStatus` for unpublished review work. In the public case dataset, `verified: true` is reserved for official reproducible examples; human-reviewed X community cases remain `verified: false` and are labeled as community sources. Publication approval never authorizes filling a missing prompt.

## Removal requests

Creators can open an Issue with the source URL. Maintainers should remove disputed content promptly while the request is reviewed.
