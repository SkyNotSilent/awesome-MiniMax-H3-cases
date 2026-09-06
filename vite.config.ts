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
    testTimeout: 20_000,
  },
})
