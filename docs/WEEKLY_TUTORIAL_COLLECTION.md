# Weekly Tutorial Collection

Run this workflow once per week, independently from the daily video-case collector.

## Discover

Check open tutorial-submission Issues first, including author corrections on previously published submissions. Original-author submissions use the same evidence standards as discovered tutorials; popularity is not an entry requirement. Verify the submitter against the original project/channel before adding public `contribution.issueUrl` and `contribution.authorUrl`. These fields enable the 14-day New from creators section (three slots, one per author, newest first); never reset `addedAt` to renew a slot. Keep ordinary third-party discoveries unmarked. After publication, verify both localized pages and prepare an author acknowledgement with the live links. Recommendations stop automatically after the window or while an entry needs review; permanent attribution remains.

Use the existing signed-in Mac browser to search X, YouTube, Reddit, GitHub, Hugging Face and official documentation for recent, high-signal MiniMax H3 / Hailuo H3 tutorials. Combine the model name with `ComfyUI`, `setup`, `deploy`, `Prompt`, `Agent Skill`, `Turbo`, `LoRA`, `long video`, `Motion Context`, `audio`, `training`, `Mac`, and their Chinese equivalents. Popularity is relative to the language and topic; never impose a fixed like threshold.

Record candidates only in `.review/tutorials/candidates.json`. The private record may contain discovery queries, review notes, rejection reasons, and the verification checklist. None of those fields may enter public JSON, UI, SEO, build output, or Git.

## Verify

A tutorial is publishable only when all checks are true:

1. The source is from the original author or clearly links the author's full tutorial.
2. It specifically teaches MiniMax H3 / Hailuo H3, not a generic AI-video workflow.
3. The source remains accessible and is not truncated, promotional-only, copied, or dead.
4. The structured steps are executable and do not invent missing details.
5. Every command is checked against the current upstream README or documentation.
6. Chinese and English fields are complete, independent summaries—not full copies of the post.
7. The poster is public, appropriate, locally cached under `public/tutorial-posters/`, and usable as a square crop. Use a branded fallback when necessary.
8. Author, source URL, publication date, original language, verification date, and any visible engagement snapshot are factual. Omit unavailable metrics.

Deduplicate by normalized platform URL (X status ID, YouTube video ID, Reddit thread ID, or canonical documentation/repository URL) and tutorial slug. Retain documentation anchors when they identify different lessons. A source deletion never deletes an already published tutorial automatically; instead record the issue for review.

## Publish

After browser verification, run `npm run tutorials:check`. When every intended candidate is ready, run `npm run tutorials:publish`; the publish step assigns ISO `addedAt` once when a guide first enters the public catalog, and later re-verification must preserve it. Run `npm run sync:resource-metrics` to refresh dated public GitHub snapshots. Then run `npm run sync:stats`, run `npm run screenshots` when cards or public counts changed, run `npm run validate:data`, tests, lint, `npm run skills:verify`, the production build, and the privacy check. Commit only public data, posters, and code. Push to the existing GitHub repository, wait for Railway, and verify `/tutorials/{slug}/` and `/en/tutorials/{slug}/` return 200.

If X is logged out, a source is ambiguous, a command cannot be verified, translation is incomplete, or the poster fails, leave the candidate private with a factual blocker. Never fabricate a tutorial or a successful deployment.

## Learning tracks and evidence review

Maintain equal running and creation tracks (`learningTrack`: `run` / `create`). Mark full curated learning entries as `depth: deep`; short source introductions remain `guide`, with the original tutorial as their primary action. A deep entry needs a complete original, accessible required resources, explicit hardware/version/cost conditions, actionable bilingual steps, and either official reference support or specific community usage evidence. Do not fill quotas with invented steps or prompts.

For each priority candidate, inspect up to ten top comments and ten newest comments when available. Expand relevant failure reports and author fixes. Record the actual number read, sorting mode, access failures, dated source versions, comment links and candidate decision only in the private review record. Distinguish generic praise, specific usage, failures, and fixes; author claims and reposts are not independent reproduction. Do not compute approval percentages or require a like threshold.

Publish only concise recommendation, known issues, source links and dates. `evidence.sourceCheckedAt` means source review, `communityReviewedAt` means included feedback was reviewed, and `siteTestedAt` requires a public evidence URL for an actual site test. Never infer a generation test from an old `verifiedAt`. Documentation-derived versions belong in `applicableVersions`.

Recheck comments, model/workflow links, software versions and known failures weekly. On a broken source or unresolved material conflict, set `evidence.status: needs-review` to remove it from core recommendations; retain its slug and first `addedAt`, explain the issue and add an accessible replacement through `nextGuideIds` or `learningResources`. Login or rate-limit failures are incomplete checks, not evidence that content is broken. No paid compute is required for editorial review.

Use `relatedCases.relationship: example` only for directly documented examples; use `technique` for similar methods without implying reproduction. Public schemas are the publication allowlist, including resources, chapters, feedback, evidence and next lessons. Run contract tests after modifying the schema or conversion pipeline.
