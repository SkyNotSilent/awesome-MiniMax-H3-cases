import { open, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'

const execFileAsync = promisify(execFile)

export async function mp4AtomOrder(filePath) {
  const fileStats = await stat(filePath)
  const handle = await open(filePath, 'r')
  const atoms = []
  let offset = 0
  try {
    while (offset + 8 <= fileStats.size) {
      const header = Buffer.alloc(16)
      const { bytesRead } = await handle.read(header, 0, 16, offset)
      if (bytesRead < 8) break
      let size = header.readUInt32BE(0)
      const type = header.toString('ascii', 4, 8)
      let headerSize = 8
      if (size === 1) {
        if (bytesRead < 16) break
        size = Number(header.readBigUInt64BE(8))
        headerSize = 16
      } else if (size === 0) {
        size = fileStats.size - offset
      }
      if (!Number.isSafeInteger(size) || size < headerSize) throw new Error(`Invalid MP4 atom ${type} at ${offset}`)
      atoms.push({ type, offset, size })
      if (offset + size > fileStats.size) break
      offset += size
    }
  } finally {
    await handle.close()
  }
  return atoms
}

export async function inspectFaststart(filePath) {
  const atoms = await mp4AtomOrder(filePath)
  const moov = atoms.find((atom) => atom.type === 'moov')
  const mdat = atoms.find((atom) => atom.type === 'mdat')
  return { atoms, faststart: Boolean(moov && mdat && moov.offset < mdat.offset), moov, mdat }
}

async function probe(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration:stream=index,codec_type,codec_name',
    '-of', 'json',
    filePath,
  ])
  return JSON.parse(stdout)
}

function streamSignature(probeResult) {
  return (probeResult.streams ?? [])
    .map(({ index, codec_type: type, codec_name: codec }) => ({ index, type, codec }))
    .sort((a, b) => a.index - b.index)
}

export async function ensureFaststart(filePath, tempDirectory) {
  const before = await inspectFaststart(filePath)
  const beforeProbe = await probe(filePath)
  if (before.faststart) return { path: filePath, changed: false, before, after: before, beforeProbe, afterProbe: beforeProbe }

  const outputPath = join(tempDirectory, `${basename(filePath, '.mp4')}.faststart.mp4`)
  await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', filePath, '-map', '0', '-c', 'copy', '-movflags', '+faststart', outputPath])
  const after = await inspectFaststart(outputPath)
  const afterProbe = await probe(outputPath)
  if (!after.faststart) throw new Error('ffmpeg output is not faststart (moov must precede mdat).')

  const beforeDuration = Number(beforeProbe.format?.duration)
  const afterDuration = Number(afterProbe.format?.duration)
  if (!Number.isFinite(beforeDuration) || !Number.isFinite(afterDuration) || Math.abs(beforeDuration - afterDuration) > 0.05) {
    throw new Error(`Duration changed during remux (${beforeDuration} -> ${afterDuration}).`)
  }
  if (JSON.stringify(streamSignature(beforeProbe)) !== JSON.stringify(streamSignature(afterProbe))) {
    throw new Error('Codec streams changed during faststart remux.')
  }
  const beforeBytes = (await stat(filePath)).size
  const afterBytes = (await stat(outputPath)).size
  if (afterBytes < beforeBytes * 0.95 || afterBytes > beforeBytes * 1.05) {
    throw new Error(`Unexpected remux size change (${beforeBytes} -> ${afterBytes}).`)
  }
  return { path: outputPath, changed: true, before, after, beforeProbe, afterProbe }
}
