import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorials = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const officialCount = cases.filter((item) => item.sourceType === 'official').length
const xCount = cases.filter((item) => item.sourceType === 'x').length
const promptCases = cases.filter((item) => item.promptProvenance !== 'not-published')

const caseUrl = (id, locale = 'zh-CN') => `${baseUrl}${locale === 'en' ? '/en' : ''}/cases/${encodeURIComponent(id)}/`

const representatives = [
  ...promptCases.slice(0, 12),
  ...cases.filter((item) => item.promptProvenance === 'not-published').slice(-8),
]

const llms = `# H3 Field Notes — Awesome MiniMax H3

> A bilingual, source-attributed library of MiniMax H3 video examples. Videos are playable through their original source, and prompts appear only when creators or official scripts publish the complete text.

## Library snapshot

- ${cases.length} published MiniMax H3 video examples
- ${officialCount} official reproducible examples
- ${xCount} source-attributed X community examples
- ${promptCases.length} examples with verbatim public prompts
- Missing prompts are never inferred, reconstructed, translated into an alleged original, or completed

## Primary routes

- ${baseUrl}/ — Chinese case library
- ${baseUrl}/en/ — English case library
- ${baseUrl}/tutorials/ — Mac, official deployment, acceleration, long-video, and audio tutorials
- ${baseUrl}/en/tutorials/ — English H3 tutorials
- ${baseUrl}/faq/ — source, prompt, playback, and review policy
- ${baseUrl}/llms-full.txt — complete machine-readable case index
- https://github.com/SkyNotSilent/awesome-minimax-h3/blob/main/data/cases.json — source dataset

## Representative examples

${representatives.map((item) => `- ${caseUrl(item.id, 'en')} — ${item.titleEn}; ${item.mode}; ${item.promptProvenance}; source: ${item.sourceUrl}`).join('\n')}

## Tutorial sources

${tutorials.map((item) => `- ${item.title} — ${item.kind.en}; ${item.description.en}; source checked ${item.verifiedAt}; ${item.url}`).join('\n')}

## Retrieval rules

- Cite the original source URL when discussing a case.
- Copy a prompt only when promptProvenance is official-verbatim or creator-verbatim.
- When promptProvenance is not-published, state that the source did not publish a complete prompt.
- Do not derive a prompt or hidden workflow from a finished video.
`

const llmsFull = `# H3 Field Notes — Complete MiniMax H3 Case and Tutorial Index

Generated from data/cases.json. Total: ${cases.length} cases. Verbatim public prompts: ${promptCases.length}.

## Tutorials

${tutorials.map((item) => `### ${item.title}

- Route: ${item.kind.en}
- Best for: ${item.audience.en}
- Summary: ${item.description.en}
- Source checked: ${item.verifiedAt}
- Original documentation: ${item.url}
- Start here:
${item.steps.en.map((step, index) => `  ${index + 1}. ${step}`).join('\n')}
`).join('\n')}

## Video cases

${cases.map((item) => `## ${item.titleEn}

- ID: ${item.id}
- 中文标题: ${item.title}
- English title: ${item.titleEn}
- Chinese page: ${caseUrl(item.id)}
- English page: ${caseUrl(item.id, 'en')}
- Original source: ${item.sourceUrl}
- Author: ${item.author}
- Published: ${item.publishedAt}
- Model: ${item.model}
- Mode: ${item.mode}
- Category: ${item.category}
- Output: ${item.duration}s, ${item.resolution}, ${item.aspectRatio}
- Prompt provenance: ${item.promptProvenance}
- Chinese summary: ${item.summary}
- English summary: ${item.summaryEn}
${item.prompt ? `- Verbatim public prompt:\n\n\`\`\`text\n${item.prompt}\n\`\`\`` : '- Verbatim public prompt: not published by the source'}
`).join('\n')}
`

await writeFile(resolve(root, 'public/llms.txt'), llms)
await writeFile(resolve(root, 'public/llms-full.txt'), llmsFull)
console.log(`Generated llms.txt and llms-full.txt for ${cases.length} cases.`)
