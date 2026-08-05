import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const config = JSON.parse(await readFile(resolve(root, 'config/model-routing.json'), 'utf8'))
const posts = Number(process.argv[2] || 200)
const videos = Number(process.argv[3] || 20)
const textInputPerPost = 500
const textOutputPerPost = 150
const videoInputPerClip = 1800
const videoOutputPerClip = 400

function cost(tokens, price) {
  return (tokens / 1_000_000) * price
}

const text = config.textExtraction.priceUsdPerMillion
const video = config.videoReview.priceUsdPerMillion
const textCost = cost(posts * textInputPerPost, text.input) + cost(posts * textOutputPerPost, text.output)
const videoCost = cost(videos * videoInputPerClip, video.input) + cost(videos * videoOutputPerClip, video.output)

console.log(`Daily estimate for ${posts} text posts + ${videos} short video reviews`)
console.log(`Text classification: $${textCost.toFixed(4)}`)
console.log(`Video review:       $${videoCost.toFixed(4)}`)
console.log(`Total:              $${(textCost + videoCost).toFixed(4)}`)
console.log('Video tokens are a planning estimate; actual usage depends on duration, fps, resolution, and audio.')
