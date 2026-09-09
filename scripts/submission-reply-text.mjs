const baseUrl = 'https://h3-field-notes-production.up.railway.app'

export function publishedReply(type, item) {
  const segment = type === 'case' ? 'cases' : 'tutorials'
  const zh = `${baseUrl}/${segment}/${item.id}/`
  const en = `${baseUrl}/en/${segment}/${item.id}/`
  return [
    'Published with permanent attribution. Thank you for contributing to the H3 creator community.',
    '',
    `- 中文：${zh}`,
    `- English: ${en}`,
    `- Original source: ${item.source?.url ?? item.sourceUrl}`,
    '',
    'The original work/profile remains linked on both pages. Please use this Issue for attribution corrections or removal requests.',
  ].join('\n')
}
