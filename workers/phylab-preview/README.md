# preview.phylab.uk

A public working site next to phylab.uk.

- **`/` — paper screening** (the first section). Candidates proposed by an AI, or added by hand, appear as cards showing the one-line recommendation, a short summary and the full abstract in English with a Chinese translation. Reviewers tick topics, choose a priority and one of two key findings, star a paper for the homepage shelf, write a reason, and press 收录 (approve) or 放弃 (reject). They can also leave a note without deciding. Every action is a commit to this repository. Reviewing is anonymous: no name is asked for or recorded. Approved papers reach phylab.uk about a minute later; any decision can be undone.
- **`/site/` — site preview.** A live copy of phylab.uk read straight from GitHub. Pick any branch in the 网站预览 tab to see it before merging; the public site is untouched. HTML pages carry a small badge that leads back to the desk.
- **筛选标准** — topics, keywords, journals, notes and a score threshold, saved as `literature/review/profile.json` for whoever proposes papers to read.

The copy and the desk send `noindex` so the duplicate of phylab.uk stays out of search results. Write actions are limited to 20 per minute per IP and must come from the page itself.

## Where the data lives

All paper data is in the repository, so it can be synced with GitHub Desktop and edited by hand or by another AI. The format is documented in [`literature/review/README.md`](../../literature/review/README.md).

```
literature/review/pending/<id>.md   waiting for a decision
literature/review/done/<id>.md      approved or rejected, with who and why
literature/review/profile.json      interest profile
literature/review/kept-old.json     older catalogue entries to keep
literature/data/papers.json         published catalogue (unchanged format)
```

Approving moves the file to `done/` and adds the catalogue entry in one commit, after running the site's own `validateCatalog` from `literature/core.mjs`, so nothing the literature build check would reject can be published. Commits use GitHub's `createCommitOnBranch`, and retry when someone else pushed in between.

## Where new papers come from

The site does not search for papers itself. Any AI with GitHub access (Claude, ChatGPT, Gemini, a scheduled task, …) follows [`literature/review/FIND-PAPERS.md`](../../literature/review/FIND-PAPERS.md) and commits new files to `literature/review/pending/`. The desk reads `main` live, so they appear on the next page load; an open page checks every two minutes and offers to refresh. The activity feed is the list of recent commits touching `literature/review/`.

## Settings

| Name | Kind | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | build secret | Fine-grained token for `broshu/phylab.uk` only, **Contents: Read and write**. Reads the repository and makes the commits. |
| `GITHUB_REPO`, `GITHUB_BRANCH`, `PREVIEW_DEFAULT_BRANCH` | vars in `wrangler.jsonc` | |

The build secret is copied to the runtime secret by `scripts/deploy.sh` on every deploy, as in `phylab-debate`.

## Deploy (Workers Builds)

Cloudflare dashboard → Workers & Pages → Create → Import a repository → `broshu/phylab.uk`:

- Root directory: `workers/phylab-preview`
- Deploy command: `npm run deploy`
- Build watch paths: `workers/phylab-preview/*`, `literature/core.mjs` (otherwise every decision and every new paper triggers a rebuild)
- Build variables and secrets: `GITHUB_TOKEN`

`preview.phylab.uk` is a custom-domain route in `wrangler.jsonc`, so the deploy creates its DNS record.

The desk commits to `main`. Pull (GitHub Desktop: Fetch origin) before editing locally.

## Check locally

```bash
npm install
npm run check
```
