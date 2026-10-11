import { spawn } from 'node:child_process'
import { resolveSiteOrigin } from '../shared/site-config.mjs'
const child = spawn('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, H3_REFERENCE_BUILD: '1', VITE_UMAMI_SCRIPT_URL: '', VITE_UMAMI_WEBSITE_ID: '', PUBLIC_SITE_URL: resolveSiteOrigin() },
})
child.on('exit', code => { process.exitCode = code ?? 1 })
