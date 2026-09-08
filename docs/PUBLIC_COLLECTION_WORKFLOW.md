# Public Collection Workflow

The production catalog is maintained with private accounts, review queues, and storage credentials. This repository deliberately publishes the reusable workflow—not those operating details.

## Pipeline

1. **Import** source-attributed candidate records.
2. **Deduplicate** primarily by the original X status ID.
3. **Verify** that the post names MiniMax H3 or Hailuo H3 and that the media and author are attributable.
4. **Classify** with keys from [`data/taxonomy.json`](../data/taxonomy.json).
5. **Stage** accepted records without touching the public catalog.
6. **Mirror media** only in an authorized maintainer environment.
7. **Publish transactionally** only after poster and Range playback checks pass.
8. **Regenerate** statistics, creators, discovery files, and the site.

Prompt text is retained only when the original creator or official source publishes it completely and verbatim. A caption, summary, partial excerpt, or model reconstruction is not a public Prompt.

## No-key dry run

```bash
npm ci
npm run collection:demo
```

The command reads [`examples/collection/candidates.json`](../examples/collection/candidates.json) and [`examples/collection/config.json`](../examples/collection/config.json), then prints an in-memory staging report. It performs zero network requests, writes no files, never reads `.env`, and cannot publish.

Use another fixture with:

```bash
node scripts/public-collection-demo.mjs --input ./my-candidates.json --config ./my-config.json
```

The demo intentionally stops before browser verification, video download, object storage, Git, and deployment. Those stages require authorization, source-specific access, and secrets. A locked or logged-out desktop browser must be treated as a failed run—not as an empty result.

## Optional scheduling

[`docs/examples/collection-cron.example.yml`](examples/collection-cron.example.yml) is a non-running workflow example. Copy it into `.github/workflows/` only after replacing the sample input with sources you are authorized to process. Keep real account state, credentials, candidate ledgers, rejection notes, and signed media URLs outside the public repository.

See [`docs/DISCOVERY_WORKFLOW.md`](DISCOVERY_WORKFLOW.md) for publication standards and [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for trust boundaries.
