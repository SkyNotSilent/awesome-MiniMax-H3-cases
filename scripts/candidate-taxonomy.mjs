import { sanitizeTaxonomyClassification } from './taxonomy.mjs'

const comparisonPattern = /(?:\b(?:vs\.?|versus|compare|comparison|benchmark|a\/b)\b|对比|比较|比較|比拼|同(?:一|场景|词)|モデル.*比較)/iu
const workflowPattern = /(?:\b(?:local(?:ly)?|comfyui|workflow|benchmark|rtx|gpu|quantiz|upscal|install|setup|render test)\b|本地|工作流|部署|安装|ローカル|導入|生成テスト)/iu
const dancePattern = /(?:\b(?:dance|dancer|dancing|choreograph|ballet|flamenco)\b|舞蹈|跳舞|舞步|起舞|编舞|ダンス|踊|バレエ)/iu

function withoutModelNames(value) {
  return String(value ?? '').replace(/seedance(?:\s*\d+(?:\.\d+)?)?/giu, ' ')
}

export function categoryForCandidate(candidate, caption = '') {
  const text = withoutModelNames(caption)
  if (comparisonPattern.test(text)) return 'comparison'
  if (dancePattern.test(text)) return 'dance'
  if (workflowPattern.test(text)) return 'workflow'
  const declared = candidate.classification?.category ?? candidate.initialClassification?.category
  return declared || 'showcase'
}

export function sanitizeCandidateClassification(raw = {}) {
  const taxonomy = sanitizeTaxonomyClassification(raw)
  return {
    ...raw,
    category: taxonomy.category,
    styles: taxonomy.styles,
    scenes: taxonomy.scenes,
    styleBasis: typeof raw.styleBasis === 'string' ? raw.styleBasis.trim().slice(0, 60) : '',
    sceneBasis: typeof raw.sceneBasis === 'string' ? raw.sceneBasis.trim().slice(0, 60) : '',
    invalidValues: taxonomy.invalidValues,
  }
}

export function taxonomyClassifierPrompt() {
  return ''
}
