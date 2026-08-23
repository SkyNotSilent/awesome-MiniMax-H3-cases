# Contributing

Thanks for helping document MiniMax H3 experiments. This catalog values playable evidence, executable tutorials, and verifiable provenance over volume.

## Add a verified case

1. Add one object to `data/cases.json` using the existing schema. Set ISO `addedAt` only when the case first enters the public catalog; later copy, Prompt, metric, or review changes must preserve it.
2. Link to the original creator's post, not a repost or compilation.
3. Include prompt text only when the complete text is publicly visible in the original creator's post, an official public script, or a disclosed public archive approved by a maintainer. Copy it verbatim, preserve the source URL, and set `promptCompleteness` to `complete`. Do not publish excerpts.
4. When no prompt was published, use `prompt: null` with `promptProvenance: "not-published"`. Never generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, or decompose a prompt from the video, caption, or surrounding discussion.
5. Keep editorial summaries limited to visible media and facts explicitly stated by the source. Do not present an inferred production workflow as a disclosed workflow.
6. Host approved videos in project storage, keep the original source link, and add `archiveSourceUrl` whenever a public archive is used to recover unavailable media or Prompt text.
7. Run `npm run sync:stats`, `npm test`, `npm run lint`, `npm run validate:data`, `npm run skills:verify`, `npm run build`, and `npm run catalog`.

Use `data/candidates.json` and `reviewStatus` for unpublished review work. In the public case dataset, `verified: true` is reserved for official reproducible examples; human-reviewed X community cases remain `verified: false` and are labeled as community sources. Publication approval never authorizes filling a missing prompt.

Do not edit `data/creators.json` by hand. It is generated from published cases and community X tutorials by `npm run sync:stats`. Verified handle migrations belong in `data/creator-aliases.json`; use a stable creator ID, current handle, and previous aliases so old public profile links can redirect. Creator monitoring scores, statuses, empty checks, rejected posts, and discovery sources belong only in ignored `.review/` files.

## Add or improve a tutorial

Use the tutorial submission Issue form before editing `data/tutorial-guides.json`. A publishable tutorial must identify its target result, reader, OS and hardware, VRAM or unified memory, tested versions, expected time, exact commands, success criteria, common failures, rollback steps, original author, and source documentation. Do not copy an entire source post; write a structured, bilingual guide and preserve attribution.

All commands must be supported by a linked README or documentation page and rechecked on the recorded `verifiedAt` date. Missing flags, package names, compatibility claims, and performance numbers must stay unknown rather than being guessed. A new public guide receives ISO `addedAt` once; re-verification and later edits must not replace it. Changes to tutorial data also require matching schema, SEO, and language-isolation checks.

## Pull requests

Keep changes focused and use imperative commit subjects such as `feat: add local case favorites` or `docs: verify Mac tutorial commands`. Visual changes need desktop and mobile screenshots. Never commit `.review/`, credentials, signed URLs, browser data, or creator video files.

## Removal requests

Creators can use the dedicated creator-profile Issue template for attribution corrections, handle migrations, duplicate-profile merges, or removal. Rights holders can use the takedown template. Maintainers should remove disputed content promptly while the request is reviewed.
