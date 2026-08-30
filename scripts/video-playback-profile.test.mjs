import { expect, test } from 'vitest'

import {
  isPlaybackProfileCompliant,
  playbackEncodingRates,
  playbackProfileViolations,
  PLAYBACK_PROFILE,
  selectNativePlaybackVariants,
  summarizeProbe,
} from './video-playback-profile.mjs'
import { fetchXVideoSources } from './video-x-source.mjs'

function probe(overrides = {}) {
  return {
    format: { duration: '15.0', bit_rate: '2500000', ...overrides.format },
    streams: overrides.streams ?? [
      { index: 0, codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, pix_fmt: 'yuv420p', bit_rate: '2300000' },
      { index: 1, codec_type: 'audio', codec_name: 'aac', bit_rate: '128000' },
    ],
  }
}

test('accepts the fixed site playback profile at its boundaries', () => {
  const summary = summarizeProbe(probe())
  expect(isPlaybackProfileCompliant(summary)).toBe(true)
  expect(summary.longEdge).toBe(1280)
  expect(playbackProfileViolations(summary)).toEqual([])
})

test('rejects oversized, high-bitrate, or browser-incompatible media', () => {
  const summary = summarizeProbe(probe({
    streams: [
      { index: 0, codec_type: 'video', codec_name: 'hevc', width: 2160, height: 2700, pix_fmt: 'yuv444p', bit_rate: '14500000' },
      { index: 1, codec_type: 'audio', codec_name: 'opus', bit_rate: '192000' },
      { index: 2, codec_type: 'data', codec_name: 'bin_data' },
    ],
  }))
  expect(playbackProfileViolations(summary)).toEqual([
    `long edge exceeds ${PLAYBACK_PROFILE.maxLongEdge}`,
    'video codec must be h264',
    'pixel format must be yuv420p',
    'video bitrate exceeds the site profile',
    'audio codec must be aac',
    'non-media streams are not allowed',
  ])
})

test('estimates video bitrate when the stream omits it', () => {
  const summary = summarizeProbe(probe({
    format: { bit_rate: '2550000' },
    streams: [
      { index: 0, codec_type: 'video', codec_name: 'h264', width: 1024, height: 1280, pix_fmt: 'yuv420p' },
      { index: 1, codec_type: 'audio', codec_name: 'aac', bit_rate: '128000' },
    ],
  }))
  expect(summary.videoBitrate).toBe(2_422_000)
  expect(isPlaybackProfileCompliant(summary)).toBe(true)
})

test('selects the highest native MP4 variant under the playback cap', () => {
  const variants = selectNativePlaybackVariants([
    { content_type: 'application/x-mpegURL', bitrate: 800_000, url: 'hls' },
    { content_type: 'video/mp4', bitrate: 10_000_000, url: 'too-large' },
    { content_type: 'video/mp4', bitrate: 832_000, url: 'small' },
    { content_type: 'video/mp4', bitrate: 2_176_000, url: 'best' },
    { content_type: 'video/mp4', url: 'unknown' },
  ])
  expect(variants.map((variant) => variant.url)).toEqual(['best', 'small'])
})

test('treats 3Mbps as a ceiling and never targets above the source bitrate', () => {
  expect(playbackEncodingRates({ videoBitrate: 1_150_000, audioBitrate: 64_000 })).toEqual({
    targetVideoBitrate: 1_150_000,
    maxRate: 1_265_000,
    bufferSize: 2_300_000,
    audioBitrate: 64_000,
  })
  expect(playbackEncodingRates({ videoBitrate: 14_000_000, audioBitrate: 192_000 })).toEqual({
    targetVideoBitrate: 3_000_000,
    maxRate: 3_300_000,
    bufferSize: 6_000_000,
    audioBitrate: 128_000,
  })
})

test('keeps the highest X variant as source and a separate ordered playback candidate list', async () => {
  const sources = await fetchXVideoSources({ sourceUrl: 'https://x.com/example/status/123' }, {
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          tweet: {
            media: {
              videos: [{
                variants: [
                  { content_type: 'video/mp4', bitrate: 832_000, url: 'small' },
                  { content_type: 'video/mp4', bitrate: 10_000_000, url: 'source' },
                  { content_type: 'video/mp4', bitrate: 2_176_000, url: 'playback' },
                ],
              }],
            },
          },
        }
      },
    }),
  })
  expect(sources.original).toBe('source')
  expect(sources.playbackCandidates).toEqual(['playback', 'small'])
})

test('does not query metadata when the source is not an X status', async () => {
  let called = false
  const sources = await fetchXVideoSources({ sourceUrl: 'https://example.com/video' }, {
    fetchImpl: async () => {
      called = true
      throw new Error('unexpected')
    },
  })
  expect(sources).toBeNull()
  expect(called).toBe(false)
})
