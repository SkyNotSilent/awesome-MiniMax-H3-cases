# Contributing

Thanks for helping document MiniMax H3 experiments. This catalog values provenance over volume.

## Add a verified case

1. Add one object to `data/cases.json` using the existing schema.
2. Link to the original creator's post, not a repost or compilation.
3. Include the prompt only when the creator published it or when it comes from an official reproducible script.
4. Do not commit downloaded X videos. Use the original source or official embed.
5. Run `npm test`, `npm run lint`, `npm run build`, and `npm run catalog`.

Set `verified` to `false` when the model, prompt, or authorship still needs confirmation. Unverified submissions remain in the review queue and are not shown in the public catalog.

## Removal requests

Creators can open an Issue with the source URL. Maintainers should remove disputed content promptly while the request is reviewed.
