<div align="center">

# MiniMax H3 Cases & Guides

### 887 source-attributed videos with in-site playback · 214 cases with Prompt text · 13 source-checked tutorials

**[English](./README.md)** · **[简体中文](./README.zh-CN.md)**

[![Video Gallery](https://img.shields.io/badge/Watch-Live_Video_Gallery-d8ff3e?style=flat-square&labelColor=0a0b09)](https://h3-field-notes-production.up.railway.app/en/)
[![Examples](https://img.shields.io/badge/video_examples-887-d8ff3e?style=flat-square&labelColor=0a0b09)](./CATALOG.md)
[![Prompt Text](https://img.shields.io/badge/prompt_text-214-f5f5ed?style=flat-square&labelColor=0a0b09)](./data/cases.json)
[![Tutorials](https://img.shields.io/badge/source--checked_tutorials-13-f5f5ed?style=flat-square&labelColor=0a0b09)](https://h3-field-notes-production.up.railway.app/en/tutorials/)
[![GitHub Stars](https://img.shields.io/github/stars/SkyNotSilent/awesome-minimax-h3-cases?style=flat-square&labelColor=0a0b09&color=d8ff3e)](https://github.com/SkyNotSilent/awesome-minimax-h3-cases/stargazers)
[![CI](https://github.com/SkyNotSilent/awesome-minimax-h3-cases/actions/workflows/ci.yml/badge.svg)](https://github.com/SkyNotSilent/awesome-minimax-h3-cases/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/code-MIT-blue.svg?style=flat-square)](./LICENSE)

[▶ Browse all 887 video examples](https://h3-field-notes-production.up.railway.app/en/) · [Browse on GitHub](./CATALOG.md) · [中文说明](./README.zh-CN.md) · [Contribute](./CONTRIBUTING.md)

</div>

[![MiniMax H3 Cases & Guides homepage with duration and public-prompt filters](./docs/screenshots/case-library-en.jpg)](https://h3-field-notes-production.up.railway.app/en/)

**See what MiniMax H3 can actually produce before you spend time setting it up.** MiniMax H3 is also commonly searched as Hailuo H3 or Hailuo 3.0. Browse real outputs from X and MiniMax's official examples through duration-first filters, then switch on **With Prompt** to focus on cases with public Prompt text. Complete prompts and archived trailing-ellipsis excerpts are labeled separately. Category, style, and scene remain available as deeper filters. Open any case to watch it inside the gallery and jump back to the original source.

> **Largest public collection in our 2026-08-16 comparison:** the library now contains 887 playable, source-attributed MiniMax H3 video cases. The closest public case or prompt galleries found in that search contained 300, 222, 135, 67, and 28 examples. Prompt-only lists are not counted as video case libraries.

<details>
<summary>How the collection-size claim was checked</summary>

We searched public GitHub repositories and web results for MiniMax H3 / Hailuo H3 video examples, cases, galleries, and prompts on 2026-08-16. The five largest comparable collections found in that snapshot contained 300, 222, 135, 67, and 28 entries. General resource lists and prompt-only collections without matching playable case videos were excluded. This is a dated comparison—not a permanent claim about every future site.

</details>

## Why use this library?

| What you get | Why it matters |
| --- | --- |
| **887 watchable video examples** | Judge MiniMax H3 / Hailuo H3 by real output, not a feature list |
| **Duration-first browsing** | Jump directly to ≤5s, 6–10s, 11–15s, or >15s outputs, then narrow by content, style, or scene |
| **One-switch public Prompt view** | Show 214 cases with Prompt text: 199 complete prompts and 15 explicitly labeled archived excerpts |
| **Case-specific covers and loading states** | Know what each video contains before opening it and whether the X player is still loading |
| **Original creator and source on every case** | Verify context, publication date, and attribution without hunting for the post |
| **Verbatim public prompts when available** | Copy the exact prompt only when the creator or official script published it; missing prompts are never invented |
| **Chinese and English routes** | Browse the same library in either language without mixed-language pages |

**Current snapshot:** 887 video examples · 884 X-attributed cases · 3 official reproductions · 214 cases with Prompt text (199 complete + 15 archived excerpts).

No account, API key, or local model setup is required to browse the public gallery.

### A complete case: hosted video, metadata, source, and public Prompt

[![MiniMax H3 case detail with hosted video metadata and a verbatim public prompt](./docs/screenshots/case-detail-prompt-en.png)](https://h3-field-notes-production.up.railway.app/en/cases/x-2088844629093601702/)

## Start exploring

| What you want to do | Open |
| --- | --- |
| Watch and filter every MiniMax H3 video example | [Live visual gallery](https://h3-field-notes-production.up.railway.app/en/) |
| Scan all cases without leaving GitHub | [`CATALOG.md`](./CATALOG.md) |
| Query the source-attributed dataset | [`data/cases.json`](./data/cases.json) or [`llms-full.txt`](./public/llms-full.txt) |
| Find a case through an Agent Skill | [`minimax-h3-prompt-library`](./agents/skills/minimax-h3-prompt-library/) |
| Choose an H3 setup, workflow, accelerator, training path, or resource index | [Searchable H3 ecosystem guide](https://h3-field-notes-production.up.railway.app/en/tutorials/) |

## H3 tutorials and ecosystem guide

The tutorial hub now explains 13 source-checked H3 projects and routes: what each one solves, who it is for, how to start, and where to find the original documentation.

| Resource | Start here for | Link |
| --- | --- | --- |
| h3.c / h3-metal | Native Apple Silicon inference in pure C + Metal, without Python, PyTorch, or ComfyUI | [antirez/h3.c](https://github.com/antirez/h3.c) |
| Official MiniMax H3 repository | Weights, deployment guidance, and nine bundled Agent Skills including `h3-prompt-writing` | [MiniMax-AI/MiniMax-H3](https://github.com/MiniMax-AI/MiniMax-H3) |
| MiniMax-H3 Turbo LoRA | Few-step synchronized audio-video generation; use 4 steps for previews and typically 6–8 for stronger v4 output | [larryvrh/MiniMax-H3-Turbo-Lora](https://huggingface.co/larryvrh/MiniMax-H3-Turbo-Lora) |
| ComfyUI H3 Motion Context | Chaining clips while carrying motion and audio context across joins | [NikoDemon80/ComfyUI-H3-Motion-Context](https://github.com/NikoDemon80/ComfyUI-H3-Motion-Context) |
| MiniMax H3 Audio T8 | An 86-node native H3 suite for stable audio conditioning and dual-clock sampling plus clearly separated experimental workflows | [T8mars/comfyui-minimax-h3-audio-T8](https://github.com/T8mars/comfyui-minimax-h3-audio-T8) |
| H3 Director | Multi-shot timelines, T2V/FL2V/Ref2VA/V2V workflows, selective runs, and refinement | [AIMixer/ComfyUI_MiniMaxH3_Director](https://github.com/AIMixer/ComfyUI_MiniMaxH3_Director) |
| Spectrum for H3 | Transformer-evaluation forecasting with controlled same-input A/B guidance | [xmarre/ComfyUI-Spectrum-MiniMax-H3](https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3) |
| MiniMax H3 Easy | Unified media input, `@` references, dialogue blocks, and a smaller ComfyUI graph | [nkxx188/ComfyUI-MiniMaxH3-Easy](https://github.com/nkxx188/ComfyUI-MiniMaxH3-Easy) |
| H3 FineTuning | Rectified-flow training, latent caching, LoRA, and multi-GPU ZeRO-3 | [IAmIronMan42/MiniMax-H3-FineTuning](https://github.com/IAmIronMan42/MiniMax-H3-FineTuning) |
| Awesome MiniMax H3 | Models, quantizations, LoRAs, nodes, guides, and workflow index | [wildminder/awesome-minimax-H3](https://github.com/wildminder/awesome-minimax-H3) |

The standalone tutorials page lets users filter official setup, Mac, director workflows, acceleration, long video, audio, fine-tuning, and resource maps. These external resources are documented separately from the case archive; the archive does not derive prompts or production workflows from collected videos.

[![MiniMax H3 tutorials for Mac, official deployment, ComfyUI acceleration, long video, and audio](./docs/screenshots/tutorials-en.png)](https://h3-field-notes-production.up.railway.app/en/tutorials/)

## Generation modes

- **T2VA — text-to-video with audio:** cinematic shots, camera movement, dialogue, music, ambience, and timeline cues from text.
- **FL2VA — first/last-frame video with audio:** image-conditioned motion, transitions, rack focus, composition, and synchronized sound.
- **Ref2VA — multimodal reference-to-video with audio:** video editing, identity and character consistency, audio reference, lip sync, and controlled dialogue.

## Official public examples

| Mode | Example | Public source |
| --- | --- | --- |
| T2VA | After the Fleet Jumps | [MiniMax public script](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-t2va-request.sh) |
| FL2VA | Ramen Rack Focus | [MiniMax public script](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-fl2va-request.sh) |
| Ref2VA | Follow the Wind | [MiniMax public script](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/scripts/readme/reproducible-768p-ref2va-request.sh) |

The catalog now contains 887 public cases: three official reproducible examples and 884 X-attributed community cases. Two hundred fourteen records contain public Prompt text: 199 complete prompts and 15 archived excerpts whose trailing ellipses are preserved and labeled. Three recovered records also disclose that the original X status is unavailable and link to the public archive used for recovery. Every other entry explicitly marks the prompt as not published. Every published case plays inside the gallery through project storage and keeps its original source link.

## Discovery and review pipeline

```text
Signed-in X browser search
          ↓
Original post URL + public metadata
          ↓
Deterministic deduplication and filtering
          ↓
MiMo V2.5 Pro public-text classification
          ↓
Shortlisted video → MiMo V2.5 low-FPS review
          ↓
data/candidates.json
          ↓
Eligibility + playback verification
          ↓
data/cases.json → website / catalog / Agent Skill
```

X discovery uses the maintainer's existing signed-in browser session, not an X developer token, and never bypasses access controls. Discovery stores public metadata and copies a prompt only when the exact text is visibly published in the source post; it never asks a model to recover a missing prompt. Clear cases are published only after source, model, media, storage, and in-site playback checks pass, while ambiguous or failed cases remain in the review queue. Published videos use project storage for reliable in-site playback and always retain the original X source link. The recurring task prompt lives in [`docs/DAILY_COLLECTION_PROMPT.md`](./docs/DAILY_COLLECTION_PROMPT.md).

## Model routing

This repository uses the existing Xiaomi MiMo Token Plan:

- `mimo-v2.5-pro` for classification of public post text and metadata. It does not generate, rewrite, or infer prompts.
- `mimo-v2.5` for limited video/audio verification of shortlisted cases, never for prompt reconstruction or workflow decomposition.

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

Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before submitting a case. Link the original creator and identify the prompt provenance. Include prompt text only when it can be copied verbatim from the original post or an official public script. Videos are stored outside Git in project storage; do not commit downloaded creator media to the repository. Creators may open an Issue to request correction or removal.

Code is MIT licensed. Videos, prompts, names, and other collected material remain subject to their original owners and source-platform terms. MiniMax H3 is distributed under its own license; this community project is not affiliated with MiniMax.

## Inspiration

The information architecture learns from successful open prompt libraries such as [awesome-gpt-image-2](https://github.com/freestylefly/awesome-gpt-image-2), [awesome-seedance](https://github.com/ZeroLu/awesome-seedance), and [awesome-seedance-2-prompts](https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts). Content, data, visual design, and implementation in this repository are original and specific to MiniMax H3.
