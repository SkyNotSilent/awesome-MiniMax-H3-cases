import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorials = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const officialCount = cases.filter((item) => item.sourceType === 'official').length
const xCount = cases.filter((item) => item.sourceType === 'x').length
const promptCases = cases.filter((item) => item.promptProvenance !== 'not-published')
const withoutTrailingWhitespace = (text) => text.replace(/[ \t]+$/gm, '')

const caseUrl = (id, locale = 'zh-CN') => `${baseUrl}${locale === 'en' ? '/en' : ''}/cases/${encodeURIComponent(id)}/`

const representatives = [
  ...promptCases.slice(0, 12),
  ...cases.filter((item) => item.promptProvenance === 'not-published').slice(-8),
]

const llms = `# MiniMax H3 Cases & Guides

> A bilingual, source-attributed library of MiniMax H3 video examples. Videos play in the gallery; Prompt text appears only when the complete public text is retained.

## Library snapshot

- ${cases.length} published MiniMax H3 video examples
- ${officialCount} official reproducible examples
- ${xCount} source-attributed X community examples
- ${promptCases.length} examples with complete verbatim public Prompts
- Missing prompts are never inferred, reconstructed, translated into an alleged original, or completed

## Primary routes

- ${baseUrl}/ — Chinese case library
- ${baseUrl}/en/ — English case library
- ${baseUrl}/tutorials/ — Chinese H3 ecosystem guide: setup, workflows, acceleration, long video, audio, training, and resources
- ${baseUrl}/en/tutorials/ — English H3 ecosystem guide
- ${baseUrl}/faq/ — source, prompt, playback, and review policy
- ${baseUrl}/llms-full.txt — complete machine-readable case index
- https://github.com/SkyNotSilent/awesome-minimax-h3-cases/blob/main/data/cases.json — source dataset

## Representative examples

${representatives.map((item) => `- ${caseUrl(item.id, 'en')} — ${item.titleEn}; ${item.mode}; ${item.promptProvenance}; source: ${item.sourceUrl}`).join('\n')}

## Tutorial sources

${tutorials.map((item) => `- ${item.title} — ${item.kind.en}; ${item.description.en}; source checked ${item.verifiedAt}; ${item.url}`).join('\n')}

## Retrieval rules

- Cite the original source URL when discussing a case.
- Copy a prompt only when promptCompleteness is complete (or omitted for legacy records) and promptProvenance is official-verbatim, creator-verbatim, or external-archive-verbatim.
- Never publish or return a truncated Prompt excerpt.
- When promptProvenance is external-archive-verbatim, cite archiveSourceUrl and do not claim that the original X post was re-verified.
- When promptProvenance is not-published, state that the source did not publish a complete prompt.
- Do not derive a prompt or hidden workflow from a finished video.
`

const llmsFull = `# MiniMax H3 Cases & Guides — Complete Case and Tutorial Index

Generated from data/cases.json. Total: ${cases.length} cases. Complete verbatim public Prompts: ${promptCases.length}.

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
- Prompt completeness: ${item.prompt ? (item.promptCompleteness ?? 'complete') : 'not-published'}
${item.archiveSourceUrl ? `- Archive source: ${item.archiveSourceUrl}` : ''}
- Chinese summary: ${item.summary}
- English summary: ${item.summaryEn}
${item.prompt ? `- Complete verbatim public prompt:\n\n\`\`\`text\n${item.prompt}\n\`\`\`` : '- Public prompt: not published completely by the source'}
`).join('\n')}
`

await writeFile(resolve(root, 'public/llms.txt'), withoutTrailingWhitespace(llms))
await writeFile(resolve(root, 'public/llms-full.txt'), withoutTrailingWhitespace(llmsFull))
console.log(`Generated llms.txt and llms-full.txt for ${cases.length} cases.`)
