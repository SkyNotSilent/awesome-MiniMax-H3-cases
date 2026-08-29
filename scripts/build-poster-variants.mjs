import { mkdir, readdir, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(root, 'public/posters')
const outputRoot = resolve(root, 'public/posters-optimized')
const widths = [360, 720]

async function findJpegs(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return findJpegs(path)
    return /\.jpe?g$/i.test(entry.name) ? [path] : []
  }))
  return nested.flat()
}

async function needsBuild(source, output) {
  try {
    const [sourceStats, outputStats] = await Promise.all([stat(source), stat(output)])
    return outputStats.mtimeMs < sourceStats.mtimeMs || outputStats.size === 0
  } catch {
    return true
  }
}

const sources = await findJpegs(sourceRoot)
const work = sources.flatMap((source) => widths.map((width) => ({ source, width })))
let cursor = 0
let generated = 0

async function worker() {
  while (cursor < work.length) {
    const { source, width } = work[cursor++]
    const relativeSource = relative(sourceRoot, source)
    const extension = extname(relativeSource)
    const output = resolve(outputRoot, `${relativeSource.slice(0, -extension.length)}-${width}.webp`)
    if (!(await needsBuild(source, output))) continue
    await mkdir(dirname(output), { recursive: true })
    await sharp(source)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(output)
    generated += 1
  }
}

await Promise.all(Array.from({ length: Math.min(8, work.length) }, worker))
console.log(`Poster variants ready: ${sources.length} sources, ${work.length} outputs, ${generated} generated.`)
