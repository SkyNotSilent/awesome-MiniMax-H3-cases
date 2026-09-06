import { spawn } from 'node:child_process'
const child = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, H3_REFERENCE_BUILD: '1', VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_WEBSITE_ID: '', PUBLIC_SITE_URL: 'https://h3-field-notes-production.up.railway.app' },
})
child.on('exit', code => { process.exitCode = code ?? 1 })
