---
name: minimax-h3-prompt-library
description: Design, adapt, and review structured prompts for MiniMax H3 / Hailuo 3.0 video generation. Use when creating text-to-audio-video prompts, first/last-frame animation, multimodal reference video, identity-preserving edits, synchronized dialogue, camera choreography, or when selecting a reusable H3 prompt pattern from verified cases.
---

# MiniMax H3 Prompt Library

Turn a video idea into a production-ready H3 request using patterns extracted from verified examples.

## Workflow

1. Identify the intended result: duration, aspect ratio, realism, camera language, dialogue, and ending state.
2. Select the generation mode:
   - Use `T2VA` when text alone defines the scene and sound.
   - Use `FL2VA` when a first frame, last frame, or both must constrain composition.
   - Use `Ref2VA` when identity, motion, voice, music, or an existing clip must be referenced.
3. Read [references/prompt-patterns.md](references/prompt-patterns.md) and choose the smallest matching pattern.
4. Write temporal instructions in observable order. Use timestamps only when a cut, action, or audio cue must land at a precise moment.
5. Separate visual direction, diegetic sound, dialogue, and music. State what must remain unchanged for editing tasks.
6. Return the prompt together with required inputs, recommended duration/aspect ratio, and a short verification checklist.

## Output contract

Return these sections:

```text
MODE
INPUTS
TARGET
PROMPT
VERIFICATION
```

Keep the final prompt directly usable. Do not add camera or style flourishes that contradict the user's intent.

## Provenance rules

- Label adapted patterns as adaptations; never present them as an original creator's verbatim prompt.
- Preserve source links when adapting a cataloged case.
- Do not infer unpublished prompt text from a video.
- Flag third-party likeness, copyrighted characters, logos, voices, or footage that may require permission.

