<div align="center">

# Awesome MiniMax H3

### Curated MiniMax H3 / Hailuo 3.0 AI video prompts, examples, templates, and reproducible workflows

[![Website](https://img.shields.io/badge/Live-H3_Field_Notes-d8ff3e?style=flat-square&labelColor=0a0b09)](https://h3-field-notes-production.up.railway.app/)
[![Cases](https://img.shields.io/badge/public_cases-25-d8ff3e?style=flat-square&labelColor=0a0b09)](./CATALOG.md)
[![CI](https://github.com/SkyNotSilent/awesome-minimax-h3/actions/workflows/ci.yml/badge.svg)](https://github.com/SkyNotSilent/awesome-minimax-h3/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg?style=flat-square)](./LICENSE)

[Explore the visual library](https://h3-field-notes-production.up.railway.app/) · [中文说明](./README.zh-CN.md) · [Case catalog](./CATALOG.md) · [Contribute](./CONTRIBUTING.md)

</div>

![H3 Field Notes website](./public/og-image.jpg)

Awesome MiniMax H3 is an open, source-attributed library for **MiniMax H3**, also searched as **Hailuo 3.0**. It organizes public AI video generation examples into reusable prompt patterns for text-to-video, first/last-frame video generation, multimodal reference video editing, synchronized audio, camera movement, dialogue, and character consistency.

The project combines a searchable visual website, Prompt-as-Code templates, a machine-readable dataset, and a browser-first X discovery workflow. Every public case keeps its original source and prompt provenance; uncertain discoveries stay in a review queue.

## What is included

| Resource | Purpose |
| --- | --- |
| [Visual case library](https://h3-field-notes-production.up.railway.app/) | Filter MiniMax H3 examples by mode, category, visual style, scene, and keyword |
| [`data/cases.json`](./data/cases.json) | Source-attributed, structured MiniMax H3 video prompts and metadata |
| [`data/templates.json`](./data/templates.json) | Reusable Prompt-as-Code patterns derived from verified cases |
| [`CATALOG.md`](./CATALOG.md) | Lightweight GitHub-native case index |
| [`agents/skills/minimax-h3-prompt-library`](./agents/skills/minimax-h3-prompt-library/) | Agent Skill for retrieving and adapting prompt patterns |
| [`docs/DISCOVERY_WORKFLOW.md`](./docs/DISCOVERY_WORKFLOW.md) | Browser-based X discovery, deduplication, review, and attribution rules |

## Generation modes

- **T2VA — text-to-video with audio:** cinematic shots, camera movement, dialogue, music, ambience, and timeline cues from text.
- **FL2VA — first/last-frame video with audio:** image-conditioned motion, transitions, rack focus, composition, and synchronized sound.
- **Ref2VA — multimodal reference-to-video with audio:** video editing, identity and character consistency, audio reference, lip sync, and controlled dialogue.

## Official reproducible cases

| Mode | Example | Prompt focus | Source |
| --- | --- | --- | --- |
| T2VA | After the Fleet Jumps | cinematic multi-shot sequence, VFX, stereo sound | [MiniMax reproducible script](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-t2va-request.sh) |
| FL2VA | Ramen Rack Focus | first-frame guidance, depth of field, group motion, ambience | [MiniMax reproducible script](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-fl2va-request.sh) |
| Ref2VA | Follow the Wind | video editing, voice reference, lip sync, character consistency | [MiniMax reproducible script](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-ref2va-request.sh) |

The catalog also includes 22 human-approved community cases discovered on X, spanning creator-verbatim prompts, local ComfyUI benchmarks, image and multimodal reference workflows, model comparisons, music videos, multi-shot films, native audio, and post-production pipelines. Community media remains on X; this project publishes structured notes and original-source links rather than re-hosting the videos.

## Discovery and review pipeline

```text
Signed-in X browser search
          ↓
Original post URL + public metadata
          ↓
Deterministic deduplication and filtering
          ↓
MiMo V2.5 Pro text extraction / taxonomy
          ↓
Shortlisted video → MiMo V2.5 low-FPS review
          ↓
data/candidates.json
          ↓
Human approval
          ↓
data/cases.json → website / catalog / Agent Skill
```

X discovery uses the maintainer's existing signed-in browser session, not an X developer token. It never publishes automatically, bypasses access controls, downloads restricted media, or re-hosts creator videos. The recurring task prompt lives in [`docs/DAILY_COLLECTION_PROMPT.md`](./docs/DAILY_COLLECTION_PROMPT.md).

## Model routing

This repository uses the existing Xiaomi MiMo Token Plan:

- `mimo-v2.5-pro` for prompt extraction, classification, and structured text reasoning.
- `mimo-v2.5` for video/audio understanding of shortlisted cases.

Copy `.env.example` to `.env` locally. Never commit a real API key. The static public website does not receive or need model credentials.

## Quick start

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Run the full quality gate:

```bash
npm test
npm run lint
npm run validate:data
npm run build
npm run catalog
```

The build creates discoverable static case pages, `VideoObject` structured data, a video sitemap, `robots.txt`, Open Graph metadata, and [`llms.txt`](./public/llms.txt) for AI search and answer engines.

## Deployment

The live website runs on Railway. The Railway service tracks the public GitHub repository's `main` branch, so every accepted push triggers a fresh build and deployment. Runtime secrets are unnecessary for the public frontend; local MiMo credentials stay outside Git.

## Contribution and copyright

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before submitting a case. Link the original creator, identify the prompt provenance, and do not commit downloaded X videos. Creators may open an Issue to request correction or removal.

Code is MIT licensed. Videos, prompts, names, and other collected material remain subject to their original owners and source-platform terms. MiniMax H3 is distributed under its own license; this community project is not affiliated with MiniMax.

## Inspiration

The information architecture learns from successful open prompt libraries such as [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2), [awesome-seedance](https://github.com/ZeroLu/awesome-seedance), and [awesome-seedance-2-prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts). Content, data, visual design, and implementation in this repository are original and specific to MiniMax H3.
