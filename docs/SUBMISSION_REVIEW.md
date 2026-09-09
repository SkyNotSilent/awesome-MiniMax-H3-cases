# Submission Review

This is the single maintainer standard for case, tutorial, and resource submissions. Authors may submit in Chinese or English and never need project storage credentials, JSON edits, or a local build.

## Public status

| Label | Meaning |
|---|---|
| `status: needs-triage` | A maintainer has not reviewed the submission yet. |
| `status: needs-info` | Specific evidence or material is missing; the Issue stays open. |
| `status: in-review` | Source, authorship, content, and links are being checked. |
| `status: published` | A public bilingual page exists and is linked in the Issue. |
| `status: not-planned` | The submission is out of scope, duplicated, promotional, or cannot be sourced. |

Internal scores, discovery channels, private notes, and rejection history never belong in Issue comments.

## Review gates

- Confirm the submitter’s relationship to the work and use the primary source.
- Keep complete public Prompts verbatim; never reconstruct missing text.
- Match the tutorial type to the required material in [`CONTRIBUTING.md`](../CONTRIBUTING.md).
- Verify links, commands, versions, visible checkpoints, and attribution. A source check is not a site generation test.
- Prepare independent Chinese and English pages without changing factual claims.
- For hosted case media, complete the transactional poster and Range-playback gates before publication.

## Reply drafts

### Needs information

> Thanks for sharing this. We are keeping the submission open, but need the following before source review can continue: **[specific missing item]**. Chinese or English is fine. Please do not share API keys, cookies, or storage credentials.

### In review

> Source and authorship are now under review. This is not yet a verification or publication decision. We will link the public pages here if the submission passes the remaining checks.

### Published

> Published with permanent attribution. Chinese: **[URL]** · English: **[URL]**. The original work/profile remains linked on both pages. Thank you for contributing to the H3 creator community.

Generate the draft from a published item, then review it before posting:

```bash
npm run submission:reply -- --type tutorial --id minimax-director-timeline
```

The command prints text only. It never comments on, labels, or closes an Issue. Publication additionally creates an ignored `.review/submission-feedback/<type>-<id>.json` draft when an Issue is associated. Exclusive creation preserves manual edits on retries. The state starts at `awaiting-deployment`; verifying both localized canonical pages advances it to `ready-for-review`. A maintainer must still review and send the comment. Neither state permits automatic posting.

Use `npm run submission:reply -- --type tutorial --id <id> --draft` to prepare a missing draft. After deployment, use the same command with `--verify-deployment` to check both localized canonical pages and update its private status. It still never sends a comment.

### Not planned

> Thank you for the suggestion. We are not publishing this item because **[specific, public reason]**. This does not make a judgment about the creator or the wider resource.

Open queue: [triage, missing information and active reviews](https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/issues?q=is%3Aissue%20is%3Aopen%20-label%3A%22status%3A%20published%22%20-label%3A%22status%3A%20not-planned%22). This intentionally includes unlabeled Issues so missing submission labels cannot hide a contribution. Triage distinguishes submissions from bug reports. Maintain the `submission`, `case`, `tutorial` and template-specific labels alongside the five status labels.
