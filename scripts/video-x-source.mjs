import { selectNativePlaybackVariants } from './video-playback-profile.mjs'

function xPostId(sourceUrl) {
  return sourceUrl?.match(/status\/(\d+)/)?.[1] ?? null
}

export async function fetchXVideoSources(item, { fetchImpl = fetch } = {}) {
  const postId = xPostId(item.sourceUrl)
  if (!postId) return null
  const response = await fetchImpl(`https://api.fxtwitter.com/status/${postId}`, {
    headers: { 'User-Agent': 'awesome-minimax-h3-cases/1.0 video-mirror' },
  })
  if (!response.ok) throw new Error(`X video metadata returned HTTP ${response.status}`)
  const payload = await response.json()
  const video = payload.tweet?.media?.videos?.[0]
    ?? payload.tweet?.media?.all?.find((entry) => entry.type === 'video')
  const variants = (video?.variants ?? []).filter((entry) => entry.content_type === 'video/mp4' && entry.url)
  const original = [...variants]
    .sort((left, right) => Number(right.bitrate || 0) - Number(left.bitrate || 0))[0]?.url
    ?? video?.url
  if (!original) throw new Error('No downloadable MP4 variant')
  return {
    original,
    playbackCandidates: selectNativePlaybackVariants(variants).map((variant) => variant.url),
  }
}
