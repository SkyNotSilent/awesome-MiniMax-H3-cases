# Cost-aware model routing

Do not run the entire pipeline in one long Agent context. Route each stage to the smallest capable model.

| Stage | Default | Why |
| --- | --- | --- |
| HTML/X text cleanup | Deterministic code | No model required |
| Public-text and metadata classification | `mimo-v2.5-pro` | Classify only text visibly published by the source into `data/taxonomy.json`; never produce prompt text |
| Limited video and audio verification | `mimo-v2.5` | Verify eligibility first, then use remaining capacity for evidence-poor taxonomy fields |
| Ambiguous source verification | `mimo-v2.5-pro` | Escalate source conflicts only, capped per day; leave unresolved facts unknown |

Prompt policy is independent of model capability: show a prompt only when the original creator post or an official public script publishes the exact text. Never use any model to generate, complete, translate into an alleged original, rewrite, adapt, reconstruct, reverse-engineer, summarize, or decompose a missing prompt. Never infer a hidden production workflow from a finished video.

Default classification runs with thinking disabled and small output limits. The MiMo video route samples at 0.5 FPS; raise FPS only when visible motion, lip sync, or cuts cannot be verified at that rate. Video analysis must not return a proposed prompt or a decomposed workflow.

Category, styles, and scenes must use only keys from `data/taxonomy.json`. Category is required; use `showcase` when the available evidence does not support a more specific value. Styles and scenes are independent arrays with at most two entries and must be empty arrays when their evidence is insufficient. Classification basis, rejected values, and model diagnostics remain private under `.review/`. A value outside the vocabulary blocks publication. The pipeline has no target fallback rate and must never invent labels merely to reduce `showcase` usage.

For a MiMo Token Plan, set `MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1` and `MIMO_AUTH_SCHEME=bearer`. Keep `MIMO_TEXT_MODEL=mimo-v2.5-pro` and `MIMO_MODEL=mimo-v2.5`. Pay-as-you-go keys can use the regular API endpoint; set `MIMO_AUTH_SCHEME=api-key` when required by that account.

The checked-in price fields are zero because this project targets an existing credit plan rather than metered public pricing. The cost command therefore estimates token volume while reporting no incremental API charge; actual credit consumption remains visible in the provider dashboard.

Run a rough daily estimate:

```bash
npm run cost -- 200 20
```

The estimate is for planning. Actual video tokens depend on duration, FPS, frame resolution, and audio.
