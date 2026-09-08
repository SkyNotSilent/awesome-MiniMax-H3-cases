import { describe, expect, it, vi } from 'vitest'
import { prepareMirrorPlayback } from './mirror-playback-source.mjs'

describe('mirror playback source selection', () => {
  it('preserves the reviewed second video instead of looking up the first video again', async () => {
    const fetchSources = vi.fn(async () => ({ playbackCandidates: ['first-video.mp4'] }))
    const prepareNative = vi.fn()
    const prepareSource = vi.fn(async () => ({ path: 'reviewed-second-video.mp4' }))
    expect(await prepareMirrorPlayback({ preferSource: true, fetchSources, prepareNative, prepareSource })).toEqual({ path: 'reviewed-second-video.mp4' })
    expect(fetchSources).not.toHaveBeenCalled()
    expect(prepareNative).not.toHaveBeenCalled()
  })

  it('uses a native variant for ordinary automatic imports', async () => {
    const prepareSource = vi.fn()
    const prepareNative = vi.fn(async () => ({ path: 'native.mp4' }))
    expect(await prepareMirrorPlayback({ preferSource: false, fetchSources: async () => ({ playbackCandidates: ['native.mp4'] }), prepareNative, prepareSource })).toEqual({ path: 'native.mp4' })
    expect(prepareNative).toHaveBeenCalledWith(['native.mp4'])
    expect(prepareSource).not.toHaveBeenCalled()
  })

  it('falls back to the stored source when lookup fails', async () => {
    const error = new Error('metadata unavailable')
    const onLookupError = vi.fn()
    expect(await prepareMirrorPlayback({ preferSource: false, fetchSources: async () => { throw error }, prepareNative: async () => null, prepareSource: async () => ({ path: 'stored.mp4' }), onLookupError })).toEqual({ path: 'stored.mp4' })
    expect(onLookupError).toHaveBeenCalledWith(error)
  })
})
