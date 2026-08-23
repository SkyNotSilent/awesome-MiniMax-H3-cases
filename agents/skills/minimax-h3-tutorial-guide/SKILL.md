---
name: minimax-h3-tutorial-guide
description: Use this skill when a user wants to install or run MiniMax H3, choose a tutorial for Mac or NVIDIA hardware, work within a VRAM limit, or build an H3 workflow for audio, acceleration, long video, or training. It selects source-checked tutorials and produces executable AI task packages without inventing commands or claiming unverified compatibility.
version: 0.2.0
---

# MiniMax H3 Tutorial Guide

Select the safest source-checked path from `data/tutorial-guides.json` and explain which ecosystem projects in `data/tutorials.json` support it. Optimize for the user's hardware, operating system, VRAM, experience, and desired outcome.

## Selection workflow

1. Confirm the operating system, GPU or Apple chip, available VRAM or unified memory, free disk space, and target capability.
2. Match `hardwareProfiles`, `category`, `difficulty`, and `estimatedMinutes` before recommending a guide.
3. Prefer a `flagship: true` guide when it satisfies the request.
4. Read the guide's `testedVersions`, `sourceRefs`, commands, expected result, troubleshooting, and uninstall fields.
5. Verify the latest source README before executing. If current upstream instructions conflict with the catalog snapshot, disclose the difference and follow the current source.
6. Never guess missing packages, flags, paths, node versions, model URLs, memory requirements, or compatibility.

## Output contract

Return these sections:

```text
RECOMMENDED ROUTE
WHY IT FITS
ENVIRONMENT CHECK
EXECUTION PLAN
SUCCESS CRITERIA
ROLLBACK
SOURCES AND VERIFICATION DATE
```

Preserve commands exactly as stored or as currently published by their linked source. Clearly separate catalog-tested facts from upstream claims and user-specific assumptions.

## Safety and provenance

- Do not execute destructive cleanup, overwrite an existing ComfyUI installation, or delete model files without explicit confirmation.
- Do not expose API keys, signed URLs, cookies, local paths containing secrets, or private review data.
- Do not turn a tutorial into a claim that every machine will achieve the same speed or memory usage.
- Do not generate, rewrite, translate, reconstruct, or reverse-engineer a MiniMax H3 Prompt. For verbatim public Prompt retrieval, use `minimax-h3-prompt-library`.
- When prerequisites are unknown, stop before installation and ask only for the missing environment facts.
