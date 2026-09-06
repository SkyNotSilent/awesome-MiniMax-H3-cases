import { readCatalogSnapshot } from './catalog-snapshot.mjs'
import { createCatalogIndex } from '../shared/catalog-query.mjs'
import { handleCatalogApi } from './catalog-api.mjs'
export default function catalogPlugin() {
  const configure = async server => {
    const data = await readCatalogSnapshot(new URL('../build/server-data/catalog.ndjson', import.meta.url))
    const index = createCatalogIndex(data)
    server.middlewares.use((request, response, next) => {
      handleCatalogApi(request, response, index).then(handled => { if (!handled) next() }).catch(next)
    })
  }
  return { name: 'catalog-api', configureServer: configure, configurePreviewServer: configure }
}
