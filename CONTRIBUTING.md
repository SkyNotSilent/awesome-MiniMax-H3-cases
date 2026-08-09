# Contributing

Thanks for helping document MiniMax H3 experiments. This catalog values real cases and verifiable provenance over volume.

## Add a verified case

1. Add one object to `data/cases.json` using the existing schema.
2. Link to the original creator's post, not a repost or compilation.
3. Include prompt text only when it is publicly visible in the original creator's post or an official public script. Copy it verbatim and preserve the source URL.
4. When no prompt was published, use `prompt: null` with `promptProvenance: "not-published"`. Never generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, or decompose a prompt from the video, caption, or surrounding discussion.
5. Keep editorial summaries limited to visible media and facts explicitly stated by the source. Do not present an inferred production workflow as a disclosed workflow.
6. Use the official X embed by default. A downloaded video may be committed or hosted only when the embed is unavailable, redistribution permission is documented, and a maintainer approves the fallback.
7. Run `npm test`, `npm run lint`, `npm run build`, and `npm run catalog`.

Set `verified` to `false` when the model, public prompt text, or authorship still needs confirmation. Unverified submissions remain in the review queue and are not shown in the public catalog. Verification never authorizes filling a missing prompt.

## Removal requests

Creators can open an Issue with the source URL. Maintainers should remove disputed content promptly while the request is reviewed.
