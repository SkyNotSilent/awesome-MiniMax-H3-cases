# Developer Setup

## Requirements

- Node.js 22
- npm
- No production credentials for the public catalog, tutorials, creators, tests, or build

## Local development

```bash
git clone https://github.com/SkyNotSilent/awesome-minimax-h3-cases.git
cd awesome-minimax-h3-cases
npm ci
npm run dev
```

The Vite URL printed in the terminal opens the public-data experience. `/media/{id}.mp4` requires compatible S3-style storage variables; without them, use each card's original-source link.

## Before a pull request

```bash
npm run privacy:scan
npm run validate:data
npm test
npm run lint
npm run skills:verify
npm run build
```

Run `npm run screenshots` for intentional user-interface changes. Do not commit `.review/`, browser sessions, candidate queues, creator monitoring, credentials, signed URLs, or creator video files.

Architecture and data flow are summarized in [ARCHITECTURE.md](./ARCHITECTURE.md). Content-only submissions do not require this setup; use the public Issue forms instead.
