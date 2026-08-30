import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

import { ensureFaststart, inspectFaststart } from './video-faststart.mjs'

const execFileAsync = promisify(execFile)

export const PLAYBACK_PROFILE = Object.freeze({
  name: 'site-1280-3m-v1',
  prefix: 'play/v1',
  maxLongEdge: 1280,
  targetVideoBitrate: 3_000_000,
  acceptedVideoBitrate: 3_150_000,
  maxRate: 3_300_000,
  bufferSize: 6_000_000,
  audioBitrate: 128_000,
})

function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function summarizeProbe(probeResult) {
  const streams = probeResult.streams ?? []
  const videoStreams = streams.filter((stream) => stream.codec_type === 'video')
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio')
  const otherStreams = streams.filter((stream) => !['video', 'audio'].includes(stream.codec_type))
  const video = videoStreams[0] ?? null
  const audio = audioStreams[0] ?? null
  const totalBitrate = finiteNumber(probeResult.format?.bit_rate)
  const audioBitrate = finiteNumber(audio?.bit_rate)
  const streamVideoBitrate = finiteNumber(video?.bit_rate)
  const estimatedVideoBitrate = totalBitrate === null
    ? null
    : Math.max(0, totalBitrate - (audioBitrate ?? 0))

  return {
    duration: finiteNumber(probeResult.format?.duration),
    totalBitrate,
    videoBitrate: streamVideoBitrate ?? estimatedVideoBitrate,
    width: finiteNumber(video?.width),
    height: finiteNumber(video?.height),
    longEdge: video ? Math.max(Number(video.width) || 0, Number(video.height) || 0) : null,
    videoCodec: video?.codec_name ?? null,
    pixelFormat: video?.pix_fmt ?? null,
    audioCodec: audio?.codec_name ?? null,
    audioBitrate,
    videoStreams: videoStreams.length,
    audioStreams: audioStreams.length,
    otherStreams: otherStreams.length,
  }
}

export function playbackProfileViolations(summary, profile = PLAYBACK_PROFILE) {
  const violations = []
  if (summary.videoStreams !== 1) violations.push('exactly one video stream is required')
  if (!summary.width || !summary.height) violations.push('video dimensions are missing')
  if (summary.longEdge > profile.maxLongEdge) violations.push(`long edge exceeds ${profile.maxLongEdge}`)
  if (summary.videoCodec !== 'h264') violations.push('video codec must be h264')
  if (summary.pixelFormat !== 'yuv420p') violations.push('pixel format must be yuv420p')
  if (summary.videoBitrate === null) violations.push('video bitrate is missing')
  if (summary.videoBitrate > profile.acceptedVideoBitrate) violations.push('video bitrate exceeds the site profile')
  if (summary.audioStreams > 1) violations.push('at most one audio stream is allowed')
  if (summary.audioStreams === 1 && summary.audioCodec !== 'aac') violations.push('audio codec must be aac')
  if (summary.otherStreams) violations.push('non-media streams are not allowed')
  if (!summary.duration) violations.push('duration is missing')
  return violations
}

export function isPlaybackProfileCompliant(summary, profile = PLAYBACK_PROFILE) {
  return playbackProfileViolations(summary, profile).length === 0
}

export function selectNativePlaybackVariants(variants, profile = PLAYBACK_PROFILE) {
  return variants
    .filter((variant) => variant?.content_type === 'video/mp4' && variant.url)
    .map((variant) => ({ ...variant, bitrate: finiteNumber(variant.bitrate) }))
    .filter((variant) => variant.bitrate !== null && variant.bitrate <= profile.acceptedVideoBitrate)
    .sort((left, right) => right.bitrate - left.bitrate)
}

export function playbackEncodingRates(source, profile = PLAYBACK_PROFILE) {
  const targetVideoBitrate = Math.max(1, Math.round(Math.min(
    profile.targetVideoBitrate,
    source.videoBitrate ?? profile.targetVideoBitrate,
  )))
  const maxRate = Math.min(profile.maxRate, Math.round(targetVideoBitrate * 1.1))
  const bufferSize = Math.min(profile.bufferSize, targetVideoBitrate * 2)
  const audioBitrate = Math.max(1, Math.round(Math.min(
    profile.audioBitrate,
    source.audioBitrate ?? profile.audioBitrate,
  )))
  return { targetVideoBitrate, maxRate, bufferSize, audioBitrate }
}

export async function probeVideo(filePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,size,bit_rate:stream=index,codec_type,codec_name,width,height,pix_fmt,bit_rate',
    '-of', 'json',
    filePath,
  ], { maxBuffer: 2 * 1024 * 1024 })
  return JSON.parse(stdout)
}

let detectedEncoders

async function availableEncoders() {
  if (!detectedEncoders) {
    detectedEncoders = execFileAsync('ffmpeg', ['-hide_banner', '-encoders'], { maxBuffer: 4 * 1024 * 1024 })
      .then(({ stdout }) => stdout)
  }
  return detectedEncoders
}

export async function resolvePlaybackEncoder(requested = process.env.VIDEO_TRANSCODE_ENCODER || 'auto') {
  if (!['auto', 'h264_videotoolbox', 'libx264'].includes(requested)) {
    throw new Error('VIDEO_TRANSCODE_ENCODER must be auto, h264_videotoolbox, or libx264.')
  }
  const encoders = await availableEncoders()
  if (requested !== 'auto') {
    if (!encoders.includes(requested)) throw new Error(`Requested ffmpeg encoder is unavailable: ${requested}`)
    return requested
  }
  if (encoders.includes('h264_videotoolbox')) return 'h264_videotoolbox'
  if (encoders.includes('libx264')) return 'libx264'
  throw new Error('No supported H.264 encoder is available in ffmpeg.')
}

function playbackScaleFilter(profile) {
  const edge = profile.maxLongEdge
  return `scale=w='min(iw,${edge})':h='min(ih,${edge})':force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos`
}

function streamPresence(summary) {
  return { audio: summary.audioStreams > 0, video: summary.videoStreams > 0 }
}

export async function verifyPlaybackFile({ sourcePath, outputPath, profile = PLAYBACK_PROFILE }) {
  const [sourceProbe, outputProbe, outputInspection, outputStats] = await Promise.all([
    probeVideo(sourcePath),
    probeVideo(outputPath),
    inspectFaststart(outputPath),
    stat(outputPath),
  ])
  const source = summarizeProbe(sourceProbe)
  const output = summarizeProbe(outputProbe)
  const violations = playbackProfileViolations(output, profile)
  if (!outputInspection.faststart) violations.push('MP4 is not faststart')
  if (source.duration === null || output.duration === null || Math.abs(source.duration - output.duration) > 0.05) {
    violations.push(`duration changed (${source.duration} -> ${output.duration})`)
  }
  if (streamPresence(source).audio !== streamPresence(output).audio) violations.push('audio stream presence changed')
  if (!outputStats.size || outputStats.size < 10_000) violations.push('output file is unexpectedly small')
  if (violations.length) throw new Error(`Playback profile validation failed: ${violations.join('; ')}`)
  return { source, output, bytes: outputStats.size, faststart: true }
}

export async function preparePlaybackFile(sourcePath, tempDirectory, { profile = PLAYBACK_PROFILE, encoder } = {}) {
  const sourceProbe = await probeVideo(sourcePath)
  const source = summarizeProbe(sourceProbe)
  if (isPlaybackProfileCompliant(source, profile)) {
    const prepared = await ensureFaststart(sourcePath, tempDirectory)
    const verification = await verifyPlaybackFile({ sourcePath, outputPath: prepared.path, profile })
    return { ...verification, path: prepared.path, state: prepared.changed ? 'remuxed' : 'copied', encoder: null }
  }

  const selectedEncoder = await resolvePlaybackEncoder(encoder)
  const outputPath = join(tempDirectory, `${basename(sourcePath, '.mp4')}.${profile.name}.mp4`)
  const videoArguments = selectedEncoder === 'libx264' ? ['-preset', 'medium'] : []
  const rates = playbackEncodingRates(source, profile)
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', sourcePath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    '-vf', playbackScaleFilter(profile),
    '-c:v', selectedEncoder,
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    ...videoArguments,
    '-b:v', String(rates.targetVideoBitrate),
    '-maxrate', String(rates.maxRate),
    '-bufsize', String(rates.bufferSize),
    '-c:a', 'aac',
    '-b:a', String(rates.audioBitrate),
    '-map_metadata', '-1',
    '-sn',
    '-dn',
    '-movflags', '+faststart',
    outputPath,
  ], { maxBuffer: 8 * 1024 * 1024 })
  const verification = await verifyPlaybackFile({ sourcePath, outputPath, profile })
  const sourceBytes = (await stat(sourcePath)).size
  if (verification.bytes > sourceBytes * 1.05) {
    throw new Error(`Playback transcode grew unexpectedly (${sourceBytes} -> ${verification.bytes} bytes).`)
  }
  return { ...verification, path: outputPath, state: 'transcoded', encoder: selectedEncoder, rates }
}
