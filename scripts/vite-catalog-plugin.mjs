import { readCatalogSnapshot } from './catalog-snapshot.mjs'
import { createCatalogIndex } from '../shared/catalog-query.mjs'
import { loadEnv } from 'vite'
import { createAccountApi } from './auth/api.mjs'
import { handleCatalogApi } from './catalog-api.mjs'
export default function catalogPlugin() {
  const configure = async server => {
    const data = await readCatalogSnapshot(new URL('../build/server-data/catalog.ndjson', import.meta.url))
    const index = createCatalogIndex(data)
    const accountApi = createAccountApi({ env: { ...loadEnv(server.config.mode, server.config.root, ''), ...process.env } })
    server.httpServer?.once('close', () => { void accountApi.close() })
    server.middlewares.use((request, response, next) => {
      accountApi.handle(request, response, index).then(handled => handled || handleCatalogApi(request, response, index, accountApi)).then(handled => { if (!handled) next() }).catch(next)
    })
  }
  return { name: 'catalog-api', configureServer: configure, configurePreviewServer: configure }
}
