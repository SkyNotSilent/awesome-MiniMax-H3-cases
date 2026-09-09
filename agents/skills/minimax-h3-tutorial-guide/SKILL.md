---
name: minimax-h3-tutorial-guide
description: Use this skill when a user wants to install or run MiniMax H3, choose a tutorial for Mac or NVIDIA hardware, work within a VRAM limit, or build an H3 workflow for audio, acceleration, long video, or training. It selects source-checked tutorials and produces executable AI task packages without inventing commands or claiming unverified compatibility.
version: 0.2.1
---

# MiniMax H3 Tutorial Guide

Select the safest source-checked path from the public tutorial catalog and explain which ecosystem projects support it. The packaged query client works outside this repository:

```bash
node <installed-skill-directory>/scripts/query.mjs --hardware "apple silicon" --goal "first video"
```

Resolve the script relative to this installed skill directory, not the user's project. It uses `H3_LIBRARY_URL` when configured and otherwise reads the official hosted `/data/tutorial-guides.v2.json` catalog. The schema version and content hash identify the public snapshot. Network failures, invalid payloads, and unsupported versions are lookup errors, not zero matches. Never silently substitute fixtures. Inside the repository, `data/tutorial-guides.json` and `data/tutorials.json` remain the publishing sources of truth.

## Selection workflow

1. Confirm the operating system, GPU or Apple chip, available VRAM or unified memory, free disk space, and target capability.
2. Match `learningTrack`, `hardwareProfiles`, `category`, `difficulty`, and `estimatedMinutes` before recommending a guide.
3. Prefer an active `depth: deep` guide when it satisfies the request; exclude `evidence.status: needs-review` from core recommendations.
4. Read the guide's `applicableVersions`, `learningResources`, `chapters`, `communityFeedback`, `sourceRefs`, commands, expected result, troubleshooting, and uninstall fields.
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

Preserve commands exactly as stored or as currently published by their linked source. Clearly separate source-checked facts, community reports, actual site tests from upstream claims and user-specific assumptions.

## Safety and provenance

- Do not execute destructive cleanup, overwrite an existing ComfyUI installation, or delete model files without explicit confirmation.
- Do not expose API keys, signed URLs, cookies, local paths containing secrets, or private review data.
- Do not turn a tutorial into a claim that every machine will achieve the same speed or memory usage.
- Do not generate, rewrite, translate, reconstruct, or reverse-engineer a MiniMax H3 Prompt. For verbatim public Prompt retrieval, use `minimax-h3-prompt-library`.
- When prerequisites are unknown, stop before installation and ask only for the missing environment facts.

Source-check dates are not generation tests. A site-test claim requires `evidence.siteTestedAt` and its supporting URL. Short `depth: guide` entries should direct users to the complete original instead of presenting their summary as a full procedure.
