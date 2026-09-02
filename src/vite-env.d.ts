/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UMAMI_SCRIPT_URL?: string
  readonly VITE_UMAMI_WEBSITE_ID?: string
}

interface Window {
  umami?: {
    track: (event: string, props?: Record<string, unknown>) => void
  }
}
