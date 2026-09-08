# Contributing

Thanks for helping document MiniMax H3 experiments. This catalog values playable evidence, useful tutorials, and verifiable provenance over volume. You may contribute in Chinese or English.

## Choose your path

### I made a case or tutorial

Use the [case form](https://github.com/SkyNotSilent/awesome-minimax-h3-cases/issues/new?template=case-submission.yml) or [tutorial form](https://github.com/SkyNotSilent/awesome-minimax-h3-cases/issues/new?template=tutorial-submission.yml). Provide the original source and enough material to understand the result. You do **not** need to edit JSON, translate the content, configure storage, or run the codebase. Maintainers handle deduplication, source checks, bilingual presentation, media storage, and publication.

Public statuses are: `needs triage`, `needs info`, `in review`, `published`, and `not planned`. A publication reply should include the localized site links before the Issue is closed.

Maintainers use the shared review gates and reply drafts in [`docs/SUBMISSION_REVIEW.md`](./docs/SUBMISSION_REVIEW.md). This keeps the Issue forms, review language, and publication feedback aligned.

### I want to change code or documentation

Read [developer setup](./docs/DEVELOPMENT.md), keep the pull request focused, and describe what changed and how it was tested. Visual changes need desktop and mobile evidence.

### I maintain the catalog

Maintainers verify provenance, copy only complete public Prompts, prepare bilingual copy, mirror approved media, run the transactional publication checks, and reply to the submitter. Private review notes and operating configuration never enter a public Issue or commit.

## Add a verified case

The steps below are for maintainers and code contributors working on an already reviewed entry. Ordinary submitters should use the form above.

1. Add one object to `data/cases.json` using the existing schema. Set ISO `addedAt` only when the case first enters the public catalog; later copy, Prompt, metric, or review changes must preserve it.
2. Link to the original creator's post, not a repost or compilation.
3. Include prompt text only when the complete text is publicly visible in the original creator's post, the same creator's public reply, or an official public script. Copy it verbatim, preserve the original source URL, and set `promptCompleteness` to `complete`. Do not publish excerpts.
4. When no prompt was published, use `prompt: null` with `promptProvenance: "not-published"`. Never generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, or decompose a prompt from the video, caption, or surrounding discussion.
5. Keep editorial summaries limited to visible media and facts explicitly stated by the source. Do not present an inferred production workflow as a disclosed workflow.
6. Host approved videos in project storage and keep the original creator's source link. Discovery channels and internal review sources belong only in ignored `.review/` files.
7. Run `npm run sync:stats`, `npm test`, `npm run lint`, `npm run validate:data`, `npm run skills:verify`, `npm run build`, and `npm run catalog`.

Unpublished review records never belong in a pull request or public data file; use the case-submission Issue form instead. Maintainers keep review state under ignored `.review/`. In the public case dataset, `verified: true` is reserved for official reproducible examples; human-reviewed X community cases remain `verified: false` and are labeled as community sources. Publication approval never authorizes filling a missing prompt.

Do not edit `data/creators.json` by hand. It is generated from published cases and qualifying community tutorials by `npm run sync:stats`. X handle migrations belong in `data/creator-aliases.json`; GitHub and YouTube authors use distinct platform identities unless public evidence or the author confirms a cross-platform merge. Creator monitoring scores, statuses, empty checks, rejected posts, and discovery sources belong only in ignored `.review/` files.

## Add or improve a tutorial

### Original-author spotlight

Share your own H3 tutorial through the [tutorial form](https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues/new?template=tutorial-submission.yml). You can submit in Chinese or English; maintainers help assemble the bilingual entry. Include a working original, installation steps, requirements, expected output and known problems. Code changes and follower counts are not prerequisites.

Accepted original-author submissions receive permanent author credit, a link to the author's profile/project and their original tutorial, and eligibility for the **New from creators** section for 14 days after first publication. Up to three matching tutorials appear above the regular tutorial lists, newest first, with one slot per author. More eligible submissions share this limited space as new work arrives; impressions and traffic are not guaranteed. Search and learning filters still apply. After the window, the tutorial stays in the normal library with its attribution. Corrections never reset its first publication date. Entries needing review leave recommendations until resolved.

Maintainers verify authorship from the public submission and source, record `contribution.issueUrl` and `contribution.authorUrl`, and retain private review notes outside Git. A repost or link suggestion does not qualify as an original-author submission. Share the published localized page with the author when replying to the submission; close it only after the page is live. Authors can use that same issue for corrections or removal.

Use the tutorial submission Issue form before editing `data/tutorial-guides.json`. Requirements depend on the tutorial type:

- **Setup:** environment, installation, file locations, checkpoints, expected result, and common failures.
- **Practical project:** finished result, input materials, workflow, important parameters, result checks, and relevant video chapters.
- **Video tutorial:** original channel, language, useful timestamps, supporting files, and a concise site summary.
- **Resource or method:** who it helps, what it covers, limits, original author, and source material.

Do not invent commands for content that does not need them. Do not copy an entire source post or transcript; write a structured bilingual guide and preserve attribution. A single-language submission is sufficient because maintainers prepare the second language.

All commands must be supported by a linked README or documentation page and rechecked on the recorded `verifiedAt` date. Missing flags, package names, compatibility claims, and performance numbers must stay unknown rather than being guessed. A new public guide receives ISO `addedAt` once; re-verification and later edits must not replace it. Changes to tutorial data also require matching schema, SEO, and language-isolation checks.

## Pull requests

Keep changes focused and use imperative commit subjects such as `feat: add local case favorites` or `docs: verify Mac tutorial commands`. Visual changes need desktop and mobile screenshots. Never commit `.review/`, credentials, signed URLs, browser data, or creator video files.

Fork pull requests run only against public fixtures and must not receive production credentials. Please follow the [community code of conduct](./CODE_OF_CONDUCT.md) and report vulnerabilities privately through [SECURITY.md](./SECURITY.md).

## Removal requests

Creators can use the dedicated creator-profile Issue template for attribution corrections, handle migrations, duplicate-profile merges, or removal. Rights holders can use the takedown template. Maintainers should remove disputed content promptly while the request is reviewed.
