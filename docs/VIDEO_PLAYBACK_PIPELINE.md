# Video playback pipeline

The public media URL remains `/media/{id}.mp4`, while object storage keeps two immutable tiers:

- `videos/{id}.mp4`: highest-quality source retained for recovery.
- `play/v1/{id}.mp4`: browser playback copy selected by `VIDEO_S3_PLAYBACK_PREFIX=play/v1`.

The site profile is H.264 High / `yuv420p`, AAC 128Kbps when audio exists, a 1280px maximum long edge, a 3Mbps video target with a 3.3Mbps maximum rate, unchanged frame rate and aspect ratio, and MP4 faststart. Small media is never enlarged.

## Publishing

`npm run mirror:videos -- --apply --staging <path>` stores the highest-quality source first. It then prefers the highest native X MP4 that satisfies the site profile, otherwise it transcodes the retained source. Both objects are checked with HEAD and Range requests before the item can continue to publication.

## Historical migration

Run commands with the production bucket variables available:

```bash
npm run videos:playback:audit
npm run videos:playback:migrate -- --apply --limit 20
npm run videos:playback:migrate -- --apply
npm run videos:playback:verify
```

Use `--only id-1,id-2` or `VIDEO_PLAYBACK_ONLY` to retry a bounded set. `VIDEO_PLAYBACK_CONCURRENCY` defaults to 2 and accepts 1–8. Runs are idempotent and write private reports under `.review/video-playback-migrations/`. `--replace` is reserved for explicitly rebuilding a known bad playback object; it never overwrites the source tier.

## Cutover and rollback

Deploy prefix support while leaving the variable unset, populate and verify every `play/v1` object, then set `VIDEO_S3_PLAYBACK_PREFIX=play/v1`. To roll back, set the variable to `videos` and redeploy. Cached 307 responses may remain for up to five minutes; both tiers stay valid throughout that window. Never delete or overwrite the source tier as part of a playback migration.
