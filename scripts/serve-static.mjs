import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const DEFAULT_DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))

const MIME_TYPES = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.otf', 'font/otf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webm', 'video/webm'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
])

const NOT_FOUND_HTML = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>404 Not Found</title></head><body><main><h1>404</h1><p>Page not found.</p></main></body></html>'

function isPathInside(root, candidate) {
  const pathFromRoot = relative(root, candidate)
  return pathFromRoot === '' || (!isAbsolute(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`))
}

function cacheControl(filePath, statusCode) {
  if (statusCode !== 200) return 'no-store'
  const extension = extname(filePath).toLowerCase()
  const normalizedPath = filePath.split(sep).join('/')
  if (/\/assets\/[^/]+-[a-z0-9_-]{8,}\.[^.]+$/i.test(normalizedPath)) return 'public, max-age=31536000, immutable'
  if (extension === '.html' || extension === '.json') return 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
  return 'public, max-age=3600'
}

function mimeType(filePath) {
  return MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream'
}

function writeText(response, requestMethod, statusCode, body, extraHeaders = {}) {
  const encodedBody = Buffer.from(body)
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': encodedBody.byteLength,
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(requestMethod === 'HEAD' ? undefined : encodedBody)
}

function entityTag(fileStats) {
  return `W/"${fileStats.size.toString(16)}-${Math.trunc(fileStats.mtimeMs).toString(16)}"`
}

function isFresh(request, etag, modifiedAt) {
  const ifNoneMatch = request.headers['if-none-match']
  if (ifNoneMatch) {
    return ifNoneMatch.split(',').some((candidate) => candidate.trim() === '*' || candidate.trim() === etag)
  }

  const ifModifiedSince = request.headers['if-modified-since']
  if (!ifModifiedSince) return false

  const parsedDate = Date.parse(ifModifiedSince)
  if (Number.isNaN(parsedDate)) return false
  return Math.trunc(modifiedAt.getTime() / 1000) * 1000 <= parsedDate
}

async function existingPath(root, candidate) {
  let canonicalPath
  try {
    canonicalPath = await realpath(candidate)
  } catch (error) {
    if (['EACCES', 'ELOOP', 'ENOENT', 'ENOTDIR'].includes(error?.code)) return null
    throw error
  }

  if (!isPathInside(root, canonicalPath)) return { forbidden: true }

  const fileStats = await stat(canonicalPath)
  return { canonicalPath, fileStats, forbidden: false }
}

async function sendFile(request, response, file, statusCode = 200) {
  const { canonicalPath, fileStats } = file
  const etag = entityTag(fileStats)
  response.setHeader('Cache-Control', cacheControl(canonicalPath, statusCode))
  response.setHeader('Content-Type', mimeType(canonicalPath))
  response.setHeader('ETag', etag)
  response.setHeader('Last-Modified', fileStats.mtime.toUTCString())
  response.setHeader('X-Content-Type-Options', 'nosniff')

  if (statusCode === 200 && isFresh(request, etag, fileStats.mtime)) {
    response.writeHead(304)
    response.end()
    return
  }

  response.setHeader('Content-Length', fileStats.size)
  response.writeHead(statusCode)
  if (request.method === 'HEAD') {
    response.end()
    return
  }

  await new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(canonicalPath)
    stream.on('error', rejectStream)
    response.on('close', resolveStream)
    response.on('finish', resolveStream)
    stream.pipe(response)
  })
}

function parseRequestTarget(requestUrl) {
  const target = requestUrl || '/'
  const queryIndex = target.indexOf('?')
  const rawPath = queryIndex === -1 ? target : target.slice(0, queryIndex)
  const search = queryIndex === -1 ? '' : target.slice(queryIndex)

  let decodedPath
  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    return null
  }

  const pathSegments = decodedPath.split('/')
  if (
    !decodedPath.startsWith('/')
    || decodedPath.startsWith('//')
    || decodedPath.includes('\0')
    || decodedPath.includes('\\')
    || pathSegments.some((segment) => segment === '.' || segment === '..')
  ) {
    return null
  }

  return { decodedPath, rawPath, search }
}

export function normalizeVideoPlaybackPrefix(value) {
  const prefix = (value || 'videos').replace(/^\/+|\/+$/g, '')
  const segments = prefix.split('/')
  if (
    !/^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/.test(prefix)
    || segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('VIDEO_S3_PLAYBACK_PREFIX contains an invalid object prefix.')
  }
  return prefix
}

function createVideoStoreFromEnv() {
  const endpoint = process.env.VIDEO_S3_ENDPOINT
  const accessKeyId = process.env.VIDEO_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.VIDEO_S3_SECRET_ACCESS_KEY
  const bucket = process.env.VIDEO_S3_BUCKET
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null

  const client = new S3Client({
    endpoint,
    region: process.env.VIDEO_S3_REGION || 'auto',
    forcePathStyle: process.env.VIDEO_S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId, secretAccessKey },
  })

  const playbackPrefix = normalizeVideoPlaybackPrefix(process.env.VIDEO_S3_PLAYBACK_PREFIX)
  return {
    async sign(key, method) {
      const input = { Bucket: bucket, Key: `${playbackPrefix}/${key}.mp4` }
      const command = method === 'HEAD'
        ? new HeadObjectCommand(input)
        : new GetObjectCommand({ ...input, ResponseContentType: 'video/mp4' })
      return getSignedUrl(client, command, { expiresIn: 3_600 })
    },
  }
}

async function redirectVideo(request, response, videoStore, decodedPath) {
  const match = decodedPath.match(/^\/media\/([a-zA-Z0-9._-]+)\.mp4$/)
  if (!match) return false
  if (!videoStore) {
    writeText(response, request.method, 503, '<!doctype html><title>503 Video Storage Unavailable</title><h1>Video storage unavailable.</h1>')
    return true
  }

  const signedUrl = await videoStore.sign(match[1], request.method)
  response.writeHead(307, {
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=60',
    Location: signedUrl,
    'X-Content-Type-Options': 'nosniff',
  })
  response.end()
  return true
}

export async function createStaticServer({ distDir = DEFAULT_DIST_DIR, logger = console, videoStore = createVideoStoreFromEnv() } = {}) {
  const distRoot = await realpath(resolve(distDir))
  const rootStats = await stat(distRoot)
  if (!rootStats.isDirectory()) throw new Error(`Static root is not a directory: ${distRoot}`)

  const server = createServer(async (request, response) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        writeText(response, request.method, 405, '<!doctype html><title>405 Method Not Allowed</title><h1>405 Method Not Allowed</h1>', {
          Allow: 'GET, HEAD',
        })
        return
      }

      const target = parseRequestTarget(request.url)
      if (!target) {
        writeText(response, request.method, 400, '<!doctype html><title>400 Bad Request</title><h1>400 Bad Request</h1>')
        return
      }

      if (await redirectVideo(request, response, videoStore, target.decodedPath)) return

      const requestedPath = resolve(distRoot, `.${target.decodedPath}`)
      if (!isPathInside(distRoot, requestedPath)) {
        writeText(response, request.method, 403, '<!doctype html><title>403 Forbidden</title><h1>403 Forbidden</h1>')
        return
      }

      let requestedFile = await existingPath(distRoot, requestedPath)
      if (requestedFile?.forbidden) {
        writeText(response, request.method, 403, '<!doctype html><title>403 Forbidden</title><h1>403 Forbidden</h1>')
        return
      }

      if (requestedFile?.fileStats.isDirectory()) {
        if (!target.decodedPath.endsWith('/')) {
          response.writeHead(308, {
            'Cache-Control': 'no-store',
            Location: `${target.rawPath}/${target.search}`,
            'X-Content-Type-Options': 'nosniff',
          })
          response.end()
          return
        }
        requestedFile = await existingPath(distRoot, resolve(requestedFile.canonicalPath, 'index.html'))
      }

      if (requestedFile && !requestedFile.forbidden && requestedFile.fileStats.isFile()) {
        await sendFile(request, response, requestedFile)
        return
      }

      const customNotFound = await existingPath(distRoot, resolve(distRoot, '404.html'))
      if (customNotFound && !customNotFound.forbidden && customNotFound.fileStats.isFile()) {
        await sendFile(request, response, customNotFound, 404)
        return
      }

      writeText(response, request.method, 404, NOT_FOUND_HTML)
    } catch (error) {
      logger.error?.('Static server request failed', error)
      if (response.headersSent) {
        response.destroy()
        return
      }
      writeText(response, request.method, 500, '<!doctype html><title>500 Internal Server Error</title><h1>500 Internal Server Error</h1>')
    }
  })

  return server
}

export async function startStaticServer({
  distDir = DEFAULT_DIST_DIR,
  host = process.env.HOST || '0.0.0.0',
  port = process.env.PORT || '4173',
  logger = console,
} = {}) {
  const parsedPort = Number(port)
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
    throw new Error(`Invalid PORT: ${port}`)
  }

  const server = await createStaticServer({ distDir, logger })
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(parsedPort, host, () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  })
  logger.log?.(`Serving ${distDir} on http://${host}:${server.address().port}`)
  return server
}

const isEntryPoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntryPoint) {
  startStaticServer().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
