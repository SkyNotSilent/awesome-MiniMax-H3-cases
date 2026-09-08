import catalogPlugin from './scripts/vite-catalog-plugin.mjs'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react(), catalogPlugin()],
  define: process.env.H3_REFERENCE_BUILD === '1' ? { 'import.meta.env.VITE_UMAMI_SCRIPT_URL': JSON.stringify(''), 'import.meta.env.VITE_UMAMI_WEBSITE_ID': JSON.stringify('') } : {},
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, '.review/**'],
    // Data-contract suites exercise the complete public catalog; CI runners need
    // enough headroom without turning these checks into flaky false negatives.
    testTimeout: 60_000,
  },
})
