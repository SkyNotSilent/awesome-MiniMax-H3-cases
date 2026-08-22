---
name: minimax-h3-prompt-library
description: This skill should be used when the user asks to "find a MiniMax H3 case", "show the original prompt", "look up a Hailuo 3.0 example", "verify whether a prompt was published", or "retrieve source-attributed H3 examples". It retrieves real cases and verbatim public prompts only; it refuses prompt generation, rewriting, reconstruction, reverse engineering, translation, or workflow decomposition.
version: 0.2.0
---

# MiniMax H3 Case and Public Prompt Lookup

Retrieve source-attributed MiniMax H3 / Hailuo 3.0 video cases from the catalog. Return prompt text only when its provenance and completeness fields support that the full public text is retained.

Keep this skill lookup-only. Never create a new prompt, adapt an existing prompt, combine prompt fragments, reconstruct a missing prompt, reverse-engineer a video, or decompose a hidden production workflow.

## Source of truth

Read `data/cases.json` as the catalog source of truth. Treat each original `sourceUrl` as the attribution authority.

Use case metadata to search by model, mode, category, style, scene, creator, title, or visible result. Keep editorial summaries separate from source-published prompt text.

## Retrieval workflow

1. Identify the requested model, mode, scene, style, creator, or result.
2. Search `data/cases.json` for the closest factual matches.
3. Return the case title, short factual summary, model, mode, author, catalog identifier, and original source URL.
4. Check `promptProvenance` before returning prompt text.
5. Return a complete prompt only when `promptCompleteness` is `complete` (or omitted for legacy records) and provenance is `official-verbatim`, `creator-verbatim`, or `external-archive-verbatim`.
6. Never return a Prompt whose text is truncated or ends as an incomplete excerpt; treat it as unavailable.
7. For `external-archive-verbatim`, disclose the archive source instead of claiming creator re-verification.
8. Treat `unknown`, `official-adapted`, `reconstructed`, or any unrecognized provenance as unavailable. Do not present stored text under those labels as an original prompt.
9. Preserve public prompt wording, order, punctuation, timestamps, formatting, and language exactly. Do not clean, translate, shorten, expand, or normalize it.

## Output contract

Return these sections:

```text
CASE MATCHES
PUBLIC PROMPT
SOURCE AND PROVENANCE
DISCLOSURE
```

For each match, distinguish the visible case result from the availability of a public prompt.

When a complete verbatim public prompt exists, reproduce only that exact prompt and link its source. If only an excerpt exists, state that no complete public Prompt is available.

When no verbatim public prompt exists, write:

```text
No verbatim public prompt is available for this case in the catalog.
```

Do not substitute a scene summary, inferred shot list, workflow explanation, or newly written prompt.

## Refusal rules

When asked to create, improve, adapt, translate, reconstruct, reverse-engineer, or infer a prompt:

1. State that this library only retrieves source-attributed cases and verbatim public prompts.
2. Refuse to produce or modify prompt text.
3. Offer the closest real cases and their original source links.
4. Return an exact public prompt only if one of those cases meets the provenance rule.

Never combine multiple public prompts into a new prompt. Never turn a caption, video summary, camera analysis, visible action sequence, or audio description into a proposed prompt. Never infer a private prompt from model output.

## Provenance safeguards

- Prefer the original creator post over reposts, compilations, screenshots, or copied captions.
- Preserve the exact source URL with every returned prompt.
- Keep a missing or uncertain prompt explicitly unavailable.
- Avoid claiming that an observed result proves which prompt wording or workflow produced it.
- Separate public facts from editorial metadata.
- Refuse any request that would make generated text appear to be source-published text.
