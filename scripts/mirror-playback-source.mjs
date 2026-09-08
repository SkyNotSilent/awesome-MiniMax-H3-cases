export async function prepareMirrorPlayback({ preferSource, fetchSources, prepareNative, prepareSource, onLookupError }) {
  // An explicitly selected file may be a later video in a multi-video post.
  if (preferSource) return prepareSource()
  let sources
  try {
    sources = await fetchSources()
  } catch (error) {
    onLookupError(error)
  }
  return await prepareNative(sources?.playbackCandidates ?? []) ?? prepareSource()
}
