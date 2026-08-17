const requiredFields = ['title', 'titleEn', 'summary', 'summaryEn', 'basis']

const genericChineseTitle = /MiniMax H3.*(?:社区视频案例|本地生成案例|模型对比案例|舞蹈视频案例|音乐视频案例|角色对白案例|动作与视觉特效案例|广告视频案例)/u
const genericEnglishTitle = /^MiniMax H3 (?:Community Video Example|Local Generation|Model Comparison|Dance Video|Music Video|Character Dialogue|Action and VFX|Advertising Video) by /u
const bannedChineseTitleTerms = /(?:案例|视频|测试|展示|本地生成|社区案例)/u
const bannedEnglishTitleTerms = /\b(?:cases?|examples?|videos?|tests?|showcases?)\b|\blocal generation\b/iu
const bannedMetadataTitleTerms = /MiniMax[- ]?H3|Hailuo[- ]?3(?:\.0)?|\b(?:T2VA|FL2VA|Ref2VA|R2V|I2V|T2V)\b|文生视频|图生视频|参考图生成|\b(?:text|image|reference)[- ]to[- ]video\b/iu

function clean(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function editorialCopyErrors(copy) {
  const errors = []
  if (!copy || typeof copy !== 'object') return ['editorialCopy is required']

  for (const field of requiredFields) {
    if (!clean(copy[field])) errors.push(`editorialCopy.${field} is required`)
  }

  if (clean(copy.title).length > 36) errors.push('editorialCopy.title must be 36 characters or fewer')
  if (clean(copy.titleEn).length > 90) errors.push('editorialCopy.titleEn must be 90 characters or fewer')
  if (/[\u3400-\u9fff]/u.test(clean(copy.titleEn))) errors.push('editorialCopy.titleEn must not contain CJK text')
  if (/[\u3400-\u9fff]/u.test(clean(copy.summaryEn))) errors.push('editorialCopy.summaryEn must not contain CJK text')

  for (const field of ['title', 'titleEn', 'summary', 'summaryEn']) {
    if (clean(copy[field]).includes('@')) errors.push(`editorialCopy.${field} must keep account handles in attribution fields`)
  }

  if (genericChineseTitle.test(clean(copy.title))) errors.push('editorialCopy.title must describe the content, not use a generic case template')
  if (genericEnglishTitle.test(clean(copy.titleEn))) errors.push('editorialCopy.titleEn must describe the content, not use a generic case template')
  if (bannedChineseTitleTerms.test(clean(copy.title))) errors.push('editorialCopy.title must omit generic media/template terms')
  if (bannedEnglishTitleTerms.test(clean(copy.titleEn))) errors.push('editorialCopy.titleEn must omit generic media/template terms')
  if (bannedMetadataTitleTerms.test(clean(copy.title))) errors.push('editorialCopy.title must keep model and generation-mode metadata out of the title')
  if (bannedMetadataTitleTerms.test(clean(copy.titleEn))) errors.push('editorialCopy.titleEn must keep model and generation-mode metadata out of the title')

  return errors
}

export function requireEditorialCopy(candidate) {
  const copy = candidate.editorialCopy ?? candidate.classification?.editorialCopy
  const errors = editorialCopyErrors(copy)
  if (errors.length) throw new Error(`${candidate.id}: ${errors.join('; ')}`)
  return Object.fromEntries(requiredFields.map((field) => [field, clean(copy[field])]))
}

export function genericEditorialCopyPattern(value) {
  const text = clean(value)
  return text.includes('@') || genericChineseTitle.test(text) || genericEnglishTitle.test(text)
}

export function genericEditorialTitlePattern(value) {
  const text = clean(value)
  return genericEditorialCopyPattern(text)
    || bannedChineseTitleTerms.test(text)
    || bannedEnglishTitleTerms.test(text)
    || bannedMetadataTitleTerms.test(text)
}
