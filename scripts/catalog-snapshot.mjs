import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

export function encodeCatalogSnapshot(data) {
  const { cases, ...metadata } = data
  return [JSON.stringify({ ...metadata, caseCount: cases.length }), ...cases.map(item => JSON.stringify(item))].join('\n') + '\n'
}
export async function readCatalogSnapshot(path) {
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  let metadata
  const cases = []
  for await (const line of lines) {
    if (!metadata) metadata = JSON.parse(line)
    else if (line) cases.push(JSON.parse(line))
  }
  if (!metadata || cases.length !== metadata.caseCount) throw new Error('Incomplete catalog snapshot')
  return { ...metadata, cases }
}
