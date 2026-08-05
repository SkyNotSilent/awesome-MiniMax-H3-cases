# Cost-aware model routing

Do not run the entire pipeline in one long Agent context. Route each stage to the smallest capable model.

| Stage | Default | Why |
| --- | --- | --- |
| HTML/X text cleanup | Deterministic code | No model required |
| Prompt extraction and taxonomy | `mimo-v2.5-pro` | Use the existing Token Plan for structured text analysis |
| Video and audio verification | `mimo-v2.5` | Xiaomi's video-understanding endpoint currently supports this model only |
| Ambiguous cross-source reasoning | `mimo-v2.5-pro` | Escalation only, capped per day |
| Video generation | MiniMax H3 / Seedance provider | Separate job and budget from discovery |

Default classification runs with thinking disabled and small output limits. The MiMo video route samples at 0.5 FPS; raise FPS only when fast motion, lip sync, or cuts cannot be judged at that rate.

For a MiMo Token Plan, set `MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1` and `MIMO_AUTH_SCHEME=bearer`. Keep `MIMO_TEXT_MODEL=mimo-v2.5-pro` and `MIMO_MODEL=mimo-v2.5`. Pay-as-you-go keys can use the regular API endpoint; set `MIMO_AUTH_SCHEME=api-key` when required by that account.

The checked-in price fields are zero because this project targets an existing credit plan rather than metered public pricing. The cost command therefore estimates token volume while reporting no incremental API charge; actual credit consumption remains visible in the provider dashboard.

Run a rough daily estimate:

```bash
npm run cost -- 200 20
```

The estimate is for planning. Actual video tokens depend on duration, FPS, frame resolution, and audio.
