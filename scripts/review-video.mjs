import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const candidatesPath = resolve(root, 'data/candidates.json')
const config = JSON.parse(await readFile(resolve(root, 'config/model-routing.json'), 'utf8'))

if (!process.env.MIMO_API_KEY) throw new Error('Missing MIMO_API_KEY.')
if (!process.env.VIDEO_URL) throw new Error('Missing VIDEO_URL. Pass a public creator/official video URL explicitly.')

const candidateId = process.env.CANDIDATE_ID
const candidates = candidateId ? JSON.parse(await readFile(candidatesPath, 'utf8')) : null
const candidate = candidateId ? candidates.find((item) => item.id === candidateId) : null
if (candidateId && !candidate) throw new Error(`Candidate not found: ${candidateId}`)

const candidatePrompt = [
  candidate?.classification?.prompt,
  candidate?.visiblePrompt,
  candidate?.promptProvenance === 'creator-verbatim' ? candidate?.prompt : null,
].find((value) => typeof value === 'string' && value.trim().length > 0) ?? null

const mimoAuthHeaders = process.env.MIMO_AUTH_SCHEME === 'api-key'
  ? { 'api-key': process.env.MIMO_API_KEY }
  : { Authorization: `Bearer ${process.env.MIMO_API_KEY}` }

const response = await fetch(`${process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1'}/chat/completions`, {
  method: 'POST',
  headers: {
    ...mimoAuthHeaders,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: process.env.MIMO_MODEL || config.videoReview.model,
    thinking: { type: config.videoReview.thinking },
    max_completion_tokens: config.videoReview.maxOutputTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Perform a minimal provenance-first review of an AI video candidate. Return JSON only with isH3Case (true|false|"uncertain"), isNativeVideo (true|false|"uncertain"), basicQualitySignals (short array), visibleText (exact visible strings only), and promptMatchesVideo (true|false|"uncertain"|null). Do not produce a visual summary, temporal beats, camera analysis, audio analysis, likely generation mode, or any prompt text. Never infer, reconstruct, complete, paraphrase, or translate an unpublished prompt. Set promptMatchesVideo:null unless an explicitPrompt is supplied.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: { url: process.env.VIDEO_URL },
            fps: Number(process.env.MIMO_VIDEO_FPS || config.videoReview.fps),
            media_resolution: config.videoReview.mediaResolution,
          },
          {
            type: 'text',
            text: JSON.stringify({
              task: 'Verify H3 relevance, native-video status, basic quality, and exact visible text only.',
              sourceText: candidate?.text ?? null,
              sourceUrl: candidate?.sourceUrl ?? null,
              explicitPrompt: candidatePrompt,
            }),
          },
        ],
      },
    ],
  }),
})
if (!response.ok) throw new Error(`MiMo ${response.status}: ${await response.text()}`)
const payload = await response.json()
const raw = JSON.parse(payload.choices[0].message.content)
const analysis = {
  isH3Case: raw.isH3Case ?? 'uncertain',
  isNativeVideo: raw.isNativeVideo ?? 'uncertain',
  basicQualitySignals: Array.isArray(raw.basicQualitySignals) ? raw.basicQualitySignals : [],
  visibleText: Array.isArray(raw.visibleText) ? raw.visibleText : [],
  promptMatchesVideo: candidatePrompt ? (raw.promptMatchesVideo ?? 'uncertain') : null,
}

if (candidateId) {
  const merged = candidates.map((item) =>
    item.id === candidateId
      ? { ...item, videoReview: analysis, videoReviewedBy: config.videoReview.model }
      : item,
  )
  await writeFile(candidatesPath, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`Attached video review to ${candidateId}.`)
} else {
  console.log(JSON.stringify(analysis, null, 2))
}
