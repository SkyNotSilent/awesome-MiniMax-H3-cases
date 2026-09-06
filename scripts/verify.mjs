import { execFileSync, spawnSync } from 'node:child_process'
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
console.log(`Verification input: ${sha}; Node ${process.version}; working tree changes are included.`)
for (const task of ['privacy:scan', 'validate:data', 'test', 'lint', 'skills:verify', 'build:reference', 'test:server', 'performance:budget', 'readme:check', 'privacy:scan']) {
  const result = spawnSync('npm', ['run', task], { stdio: 'inherit' })
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break }
}
