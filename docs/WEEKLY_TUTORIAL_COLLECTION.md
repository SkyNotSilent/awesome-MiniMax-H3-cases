# Weekly Tutorial Collection

Run this workflow once per week, independently from the daily video-case collector.

## Discover

Use the existing signed-in Mac browser to search X globally for recent, high-signal MiniMax H3 / Hailuo H3 tutorials. Combine the model name with `ComfyUI`, `setup`, `deploy`, `Prompt`, `Agent Skill`, `Turbo`, `LoRA`, `long video`, `Motion Context`, `audio`, `training`, `Mac`, and their Chinese equivalents. Popularity is relative to the language and topic; never impose a fixed like threshold.

Record candidates only in `.review/tutorials/candidates.json`. The private record may contain discovery queries, review notes, rejection reasons, and the verification checklist. None of those fields may enter public JSON, UI, SEO, build output, or Git.

## Verify

A tutorial is publishable only when all checks are true:

1. The X post is from the original author or clearly links the author's full tutorial.
2. It specifically teaches MiniMax H3 / Hailuo H3, not a generic AI-video workflow.
3. The source remains accessible and is not truncated, promotional-only, copied, or dead.
4. The structured steps are executable and do not invent missing details.
5. Every command is checked against the current upstream README or documentation.
6. Chinese and English fields are complete, independent summaries—not full copies of the post.
7. The poster is public, appropriate, locally cached under `public/tutorial-posters/`, and usable as a square crop. Use a branded fallback when necessary.
8. Author, source URL, publication date, original language, verification date, and any visible engagement snapshot are factual. Omit unavailable metrics.

Deduplicate by X status ID first and tutorial slug second. A source deletion never deletes an already published tutorial automatically; instead record the issue for review.

## Publish

After browser verification, run `npm run tutorials:check`. When every intended candidate is ready, run `npm run tutorials:publish`, then `npm run validate:data`, tests, lint, production build, and the privacy check. Commit only public data, posters, and code. Push to the existing GitHub repository, wait for Railway, and verify `/tutorials/{slug}/` and `/en/tutorials/{slug}/` return 200.

If X is logged out, a source is ambiguous, a command cannot be verified, translation is incomplete, or the poster fails, leave the candidate private with a factual blocker. Never fabricate a tutorial or a successful deployment.
