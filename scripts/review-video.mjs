import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const candidatesPath = resolve(root, 'data/candidates.json')
const config = JSON.parse(await readFile(resolve(root, 'config/model-routing.json'), 'utf8'))

if (!process.env.MIMO_API_KEY) throw new Error('Missing MIMO_API_KEY.')
if (!process.env.VIDEO_URL) throw new Error('Missing VIDEO_URL. Pass a public creator/official video URL explicitly.')

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
          'Inspect an AI-generated video candidate. Return compact JSON with visualSummary, temporalBeats, camera, audio, visibleText, likelyMode, qualitySignals, failureSignals, and promptMatchesVideo. Do not identify private individuals or infer an unpublished prompt.',
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
          { type: 'text', text: 'Verify this candidate for a provenance-first MiniMax H3 case library.' },
        ],
      },
    ],
  }),
})
if (!response.ok) throw new Error(`MiMo ${response.status}: ${await response.text()}`)
const payload = await response.json()
const analysis = JSON.parse(payload.choices[0].message.content)

if (process.env.CANDIDATE_ID) {
  const candidates = JSON.parse(await readFile(candidatesPath, 'utf8'))
  const merged = candidates.map((item) =>
    item.id === process.env.CANDIDATE_ID
      ? { ...item, videoReview: analysis, videoReviewedBy: config.videoReview.model }
      : item,
  )
  await writeFile(candidatesPath, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`Attached video review to ${process.env.CANDIDATE_ID}.`)
} else {
  console.log(JSON.stringify(analysis, null, 2))
}
