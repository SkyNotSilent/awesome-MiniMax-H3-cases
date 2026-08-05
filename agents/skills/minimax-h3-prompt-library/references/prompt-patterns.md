# Verified H3 prompt patterns

These patterns are abstractions from MiniMax's official reproducible H3 examples. They are reusable structures, not verbatim prompts.

## Pattern T01 — Timed cinematic beat

Use for text-only cinematic scenes with one decisive transition.

```text
[Shot 1, 00:00–{cut_time}]
Framing + camera motion. Establish subject, environment, pose, lighting, and the physical process that begins to build.

[Shot 2, at {cut_time}]
Cut or transition. Describe the visible impact on the subject and environment, then define a clear ending state.

overall_soundscape:
Baseline ambience → rising causal sound → peak impact → residual room tone.

non_diegetic_music:
Instrument, tempo, emotional arc, and the exact transition at the visual peak.
```

Checklist: visual cause precedes reaction; sound follows the same arc; final state is explicit.

## Pattern F01 — Static composition with rack focus

Use when animating a supplied first frame while preserving composition.

```text
At 0.00 seconds, fully reference <Picture 1>.

Hold a static {shot_type} for {duration}. Begin with {foreground_subject} in crisp focus and {background_subject} softly blurred. Describe continuous foreground motion. Gradually rack focus deeper: foreground softens while background resolves. With focus locked on the background, describe small independent actions without changing the camera position.

overall_soundscape:
Foreground ambience at first, then background activity becomes perceptually dominant as focus shifts.
```

Checklist: no accidental camera movement; frame geometry remains stable; foreground motion continues through the focus change.

## Pattern R01 — Identity-preserving multimodal edit

Use when editing an existing video with optional voice or music references.

```text
subject_definitions:
<Subject 1> is {identity and immutable appearance} in <Video 1>.
<Video 1> is the source video for editing.
<Audio 1> is {reuse purpose}.
<Audio 2> is {voice-timbre reference purpose}.

retention_analysis:
<Subject 1>: fully_preserved — list identity, clothing, props.
<Video 1>: fully_preserved — list framing, lighting, environment, and motion to retain.
<Audio 1>: partially_copy — define what remains.
<Audio 2>: reference — define what is borrowed without copying content.

detailed_description:
Describe only the requested changes in temporal order. Put spoken text in <d>[Language] …</d>. Define the physical mouth state and subject action immediately after speech ends.
```

Checklist: unchanged regions are named; voice reference and copied audio are distinguished; dialogue ending has a stable visual state.

