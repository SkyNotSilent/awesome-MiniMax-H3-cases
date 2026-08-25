import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const repositoryRoot = resolve(import.meta.dirname, '..')
const scannerPath = resolve(import.meta.filename)
const forbiddenTrackedPaths = new Set(['AGENTS.md', 'data/candidates.json'])
const forbiddenPublicFields = [
  'reviewStatus',
  'reviewNote',
  'discoveryQuery',
  'discoverySource',
  'nextCheckAt',
  'discoveryPriority',
  'consecutiveEmptyChecks',
  'lastCheckFailure',
  'manualNotes',
  'backfillCursor',
  'rejectedStatusIds',
  'reviewedStatusIds',
]
const secretPatterns = [
  { label: 'signed URL signature', pattern: /X-Amz-Signature=/i },
  { label: 'signed URL credential', pattern: /X-Amz-Credential=/i },
  { label: 'Bearer JWT', pattern: /Bearer\s+eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/ },
  { label: 'private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'storage endpoint', pattern: /https:\/\/[^\s"'<>]+\.storageapi\.dev(?:[/?][^\s"'<>]*)?/i },
]
const textExtensions = new Set(['', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.svg', '.ts', '.tsx', '.txt', '.yaml', '.yml'])

function walk(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function textContent(path) {
  const bytes = readFileSync(path)
  if (bytes.includes(0)) return null
  return bytes.toString('utf8')
}

function lineNumber(text, index) {
  return text.slice(0, index).split('\n').length
}

export function scanText(path, text, { scanPrivateFields = false, scanSecrets = false } = {}) {
  const findings = []
  if (scanPrivateFields) {
    for (const field of forbiddenPublicFields) {
      const index = text.indexOf(field)
      if (index >= 0) findings.push({ path, line: lineNumber(text, index), reason: `private review field ${field}` })
    }
  }
  if (scanSecrets) {
    for (const { label, pattern } of secretPatterns) {
      const match = text.match(pattern)
      if (match?.index !== undefined) findings.push({ path, line: lineNumber(text, match.index), reason: label })
    }
  }
  return findings
}

export function scanRepository(root = repositoryRoot) {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)
  const findings = []

  for (const path of tracked) {
    if (path.startsWith('.review/') || forbiddenTrackedPaths.has(path)) {
      findings.push({ path, line: 1, reason: 'private path is tracked by Git' })
    }
  }

  const publicFiles = ['data', 'public', 'dist']
    .flatMap((directory) => walk(resolve(root, directory)))
    .filter((path) => textExtensions.has(extname(path)))
  for (const path of publicFiles) {
    const text = textContent(path)
    if (text === null) continue
    findings.push(...scanText(relative(root, path), text, { scanPrivateFields: true }))
  }

  for (const trackedPath of tracked) {
    const path = resolve(root, trackedPath)
    if (path === scannerPath || !existsSync(path)) continue
    const text = textContent(path)
    if (text === null) continue
    findings.push(...scanText(trackedPath, text, { scanSecrets: true }))
  }

  return findings
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const findings = scanRepository()
  if (findings.length) {
    for (const finding of findings) console.error(`${finding.path}:${finding.line}: ${finding.reason}`)
    process.exit(1)
  }
  console.log('Privacy scan passed: private review data and live credentials are absent from public files.')
}
