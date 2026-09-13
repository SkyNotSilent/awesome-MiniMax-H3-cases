# Skills Collection

The Skills section lists Agent Skill packages built for MiniMax H3. Each package page reproduces its `SKILL.md` files at the captured commit, with author credit, the repository license, and a dated star snapshot.

## Inclusion

A package is listed when all of the following hold:

1. The skill is about MiniMax H3: its name or description targets H3, or it ships in an official `MiniMax-AI` repository.
2. It is the author's own work, not a copy of the official `h3-prompt-writing` skill, a vendored copy of another project, or a mirror collection.
3. H3 is central. Multi-model generation skills that list H3 among several providers are excluded.
4. The repository has at least 10 stars or is itself a dedicated H3 project. Skills embedded in unrelated applications are excluded.

Skills in a package are listed explicitly in `data/skills.json` by path. A package with more than twelve skills is marked `catalog`: its README and a complete index of every `SKILL.md` (name, author description, link) are captured instead of each file.

## Refresh

```bash
GITHUB_TOKEN=$(gh auth token) npm run skills:originals [-- --only id,id]
```

The command resolves each repository's default branch and head commit, captures the listed files from that commit, mirrors images under `public/skill-media/{id}/`, and refreshes the branch, author, license, stars, `starsAt`, and `updatedAt`. `addedAt` is set once. A package whose captured content is unchanged keeps its previous `capturedAt`; a failed fetch leaves the previous capture and metadata in place.

Install commands are derived, not stored: a single-skill package installs from its directory with `npx skills add https://github.com/{owner}/{repo}/tree/{branch}/{dir}`, while multi-skill and catalog packages use `npx skills add {owner}/{repo}` so the CLI offers every skill for selection.

Known limits: mirrored images are keyed by their repository path, so an image replaced upstream at the same path keeps its earlier mirror until the file under `public/skill-media/{id}/` is deleted and the package is recaptured. Nested ordered lists always number from 1.

Run `npm run validate:data` after a refresh. It checks package metadata, category, CJK-free English summaries, the capture contract, and mirrored images. Removal requests follow the takedown Issue; delete the capture file and the package entry together.
