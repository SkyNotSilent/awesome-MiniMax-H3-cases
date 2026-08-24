import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const baseUrl = (process.env.PUBLIC_SITE_URL || 'https://h3-field-notes-production.up.railway.app').replace(/\/$/, '')
const cases = JSON.parse(await readFile(resolve(root, 'data/cases.json'), 'utf8'))
const tutorialGuides = JSON.parse(await readFile(resolve(root, 'data/tutorial-guides.json'), 'utf8'))
const tutorialResources = JSON.parse(await readFile(resolve(root, 'data/tutorials.json'), 'utf8'))
const creatorCatalog = JSON.parse(await readFile(resolve(root, 'data/creators.json'), 'utf8'))
const officialCount = cases.filter((item) => item.sourceType === 'official').length
const xCount = cases.filter((item) => item.sourceType === 'x').length
const promptCases = cases.filter((item) => item.promptProvenance !== 'not-published')
const withoutTrailingWhitespace = (text) => text.replace(/[ \t]+$/gm, '')

const caseUrl = (id, locale = 'zh-CN') => `${baseUrl}${locale === 'en' ? '/en' : ''}/cases/${encodeURIComponent(id)}/`
const tutorialUrl = (id, locale = 'zh-CN') => `${baseUrl}${locale === 'en' ? '/en' : ''}/tutorials/${encodeURIComponent(id)}/`
const creatorUrl = (slug, locale = 'zh-CN') => `${baseUrl}${locale === 'en' ? '/en' : ''}/creators/${encodeURIComponent(slug)}/`

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
- ${tutorialGuides.filter((item) => item.contentType === 'foundation').length} foundation tutorial routes and ${tutorialGuides.filter((item) => item.contentType === 'community').length} source-attributed community field guides
- ${creatorCatalog.stats.rankedCreators} featured creators ranked from ${creatorCatalog.stats.sourceCreators} source-attributed X authors
- Missing prompts are never inferred, reconstructed, translated into an alleged original, or completed

## Primary routes

- ${baseUrl}/ — Chinese case library
- ${baseUrl}/en/ — English case library
- ${baseUrl}/tutorials/ — Chinese H3 ecosystem guide: setup, workflows, acceleration, long video, audio, training, and resources
- ${baseUrl}/en/tutorials/ — English H3 ecosystem guide
- ${baseUrl}/tutorials/ecosystem/ — Chinese comparison of source-checked H3 tools and open-source projects
- ${baseUrl}/en/tutorials/ecosystem/ — English H3 tool and project comparison
- ${baseUrl}/creators/ — Chinese featured creator leaderboard
- ${baseUrl}/en/creators/ — English featured creator leaderboard
- ${baseUrl}/faq/ — source, prompt, playback, and review policy
- ${baseUrl}/llms-full.txt — complete machine-readable case index
- https://github.com/SkyNotSilent/awesome-minimax-h3-cases/blob/main/data/cases.json — source dataset

## Representative examples

${representatives.map((item) => `- ${caseUrl(item.id, 'en')} — ${item.titleEn}; ${item.mode}; ${item.promptProvenance}; source: ${item.sourceUrl}`).join('\n')}

## Tutorial guides

${tutorialGuides.map((item) => `- ${tutorialUrl(item.id, 'en')} — ${item.title.en}; ${item.category}; source checked ${item.verifiedAt}; original: ${item.source.url}`).join('\n')}

## Featured creators

${creatorCatalog.creators.filter((item) => item.ranks.overall).slice(0, 50).map((item) => `- ${creatorUrl(item.slug, 'en')} — #${item.ranks.overall} @${item.handle}; ${item.caseCount} cases; ${item.promptCount} complete public Prompts; X: ${item.xUrl}`).join('\n')}

## Retrieval rules

- Cite the original source URL when discussing a case.
- Copy a prompt only when promptCompleteness is complete (or omitted for legacy records) and promptProvenance is official-verbatim or creator-verbatim.
- Never publish or return a truncated Prompt excerpt.
- When promptProvenance is not-published, state that the source did not publish a complete prompt.
- Do not derive a prompt or hidden workflow from a finished video.
`

const llmsFull = `# MiniMax H3 Cases & Guides — Complete Case and Tutorial Index

Generated from data/cases.json, data/tutorial-guides.json, and data/creators.json. Total: ${cases.length} cases, ${tutorialGuides.length} tutorials, and ${creatorCatalog.stats.rankedCreators} featured creators. Complete verbatim public Prompts: ${promptCases.length}.

## Creator discovery

The creator leaderboard is derived only from source-attributed content already published in this library. It is not an official X influence ranking. Internal monitoring scores, rejected posts, and review cadence are never public.

${creatorCatalog.creators.map((item) => `### @${item.handle}

- English profile: ${creatorUrl(item.slug, 'en')}
- Chinese profile: ${creatorUrl(item.slug)}
- X profile: ${item.xUrl}
- Roles: ${item.roles.join(', ')}
- Published cases: ${item.caseCount}
- Complete public Prompts: ${item.promptCount}
- Source-checked tutorials: ${item.tutorialCount}
`).join('\n')}

## Tutorials

${tutorialGuides.map((item) => `### ${item.title.en}

- English page: ${tutorialUrl(item.id, 'en')}
- Chinese page: ${tutorialUrl(item.id)}
- Type: ${item.contentType}
- Category: ${item.category}
- Best for: ${item.audience.en}
- Goal: ${item.outcome.en}
- Hardware: ${item.hardware.en}
- Source checked: ${item.verifiedAt}
- Difficulty: ${item.difficulty ?? 'not rated'}
- Estimated time: ${item.estimatedMinutes ? `${item.estimatedMinutes} minutes` : 'not specified'}
${item.testedVersions?.length ? `- Verified versions: ${item.testedVersions.join(' · ')}` : ''}
- Original source: ${item.source.url}
- Start here:
${item.steps.en.map((step, index) => `  ${index + 1}. ${step}`).join('\n')}
${item.commands.length ? `- Commands:\n${item.commands.map((command) => `  - ${command}`).join('\n')}` : ''}
${item.expectedResult ? `- Expected result: ${item.expectedResult.en}` : ''}
${item.troubleshooting?.length ? `- Troubleshooting:\n${item.troubleshooting.map((issue) => `  - ${issue.problem.en}: ${issue.solution.en}`).join('\n')}` : ''}
`).join('\n')}

## Related project resources

${tutorialResources.map((item) => `- ${item.title} — ${item.kind.en}; ${item.description.en}; source checked ${item.verifiedAt}; ${item.url}`).join('\n')}

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
- Chinese summary: ${item.summary}
- English summary: ${item.summaryEn}
${item.prompt ? `- Complete verbatim public prompt:\n\n\`\`\`text\n${item.prompt}\n\`\`\`` : '- Public prompt: not published completely by the source'}
`).join('\n')}
`

await writeFile(resolve(root, 'public/llms.txt'), withoutTrailingWhitespace(llms))
await writeFile(resolve(root, 'public/llms-full.txt'), withoutTrailingWhitespace(llmsFull))
console.log(`Generated llms.txt and llms-full.txt for ${cases.length} cases and ${tutorialGuides.length} tutorials.`)
