import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const value = name => {
  const index = args.indexOf(name)
  return index === -1 ? null : args[index + 1]
}

const excludedScannerPaths = [
  ':(exclude)scripts/privacy-scan.mjs',
  ':(exclude)scripts/privacy-history-scan.mjs',
  ':(exclude)scripts/privacy-history-scan.node-test.mjs',
]

const credentialPattern = [
  '(AKIA|ASIA)[0-9A-Z]{16}',
  'gh[pousr]_[A-Za-z0-9_]{20,}',
  'sk-ant-[A-Za-z0-9_-]{40,}',
  'sk-(proj-)?[A-Za-z0-9_-]{40,}',
  'https?://[^[:space:]"\\x27<>]+[?&]' + 'X-Amz-' + '(Signature|Credential|Security-Token)=',
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY',
  '<heart' + 'beat>',
  'My request ' + 'for Codex',
  '(codex-clipboard-|pasted-text\\.txt)',
].join('|')

const forbiddenPathPatterns = [
  /^\.review\//,
  /^AGENTS\.md$/,
  /^\.env$/,
  /^data\/traffic-history\.json$/,
  /^scripts\/sync-traffic-snapshot\.mjs$/,
  /^\.github\/workflows\/traffic-snapshot\.yml$/,
]

function runGit(repository, commandArgs) {
  return execFileSync('git', commandArgs, {
    cwd: repository,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  })
}

function changedLocations(repository, pattern, pathspec = ['.']) {
  const output = runGit(repository, [
    'log',
    '--all',
    '--extended-regexp',
    '--format=@@%H',
    '--name-only',
    '-G',
    pattern,
    '--',
    ...pathspec,
    ...excludedScannerPaths,
  ])
  const findings = []
  let commit = null
  for (const line of output.split('\n')) {
    if (line.startsWith('@@')) {
      commit = line.slice(2)
    } else if (commit && line.trim()) {
      findings.push({ commit, path: line.trim() })
    }
  }
  return findings
}

export function scanHistory(repository = root) {
  const findings = []
  const historicalPaths = new Set(runGit(repository, ['log', '--all', '--format=', '--name-only'])
    .split('\n')
    .map(path => path.trim())
    .filter(Boolean))

  for (const path of historicalPaths) {
    if (forbiddenPathPatterns.some(pattern => pattern.test(path))) {
      findings.push({ rule: 'private path', commit: null, path })
    }
  }

  for (const finding of changedLocations(repository, credentialPattern)) {
    findings.push({ rule: 'credential or session artifact', ...finding })
  }

  for (const finding of changedLocations(
    repository,
    '/Users/[A-Za-z0-9._-]+/(\\.codex|Documents)/',
    ['.', ':(exclude)data/skill-originals/**', ':(exclude)data/tutorial-originals/**'],
  )) {
    findings.push({ rule: 'local user path', ...finding })
  }

  const artifactPaths = ['data', 'public', 'README.md', 'README.zh-CN.md', 'CATALOG.md', 'src']
  for (const finding of changedLocations(repository, '"(discovery|review|internal|archive)[A-Za-z0-9_]*"[[:space:]]*:', artifactPaths)) {
    findings.push({ rule: 'private artifact field', ...finding })
  }

  return [...new Map(findings.map(finding => [JSON.stringify(finding), finding])).values()]
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const repository = resolve(value('--repo') || root)
  const findings = scanHistory(repository)
  if (findings.length) {
    for (const finding of findings) {
      const commit = finding.commit ? ` ${finding.commit.slice(0, 12)}` : ''
      console.error(`${finding.rule}:${commit} ${finding.path}`)
    }
    process.exit(1)
  }
  console.log('History privacy scan passed: all reachable refs are free of generic credentials and private artifacts.')
}
