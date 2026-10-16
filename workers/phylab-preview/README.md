# preview.phylab.uk

A public working site next to phylab.uk.

- **`/` — paper screening** (the first section). Candidates from the weekly search, or added by hand, appear as cards. Reviewers tick topics, choose a priority and one of two key findings, star a paper for the homepage shelf, write a reason, and press 收录 (approve) or 放弃 (reject). They can also leave a note without deciding. Every action is a commit to this repository, signed with the reviewer's name (asked once, kept in the browser). Approved papers reach phylab.uk about a minute later; any decision can be undone.
- **`/site/` — site preview.** A live copy of phylab.uk read straight from GitHub. Pick any branch in the 网站预览 tab to see it before merging; the public site is untouched. HTML pages carry a small badge that leads back to the desk.
- **兴趣设置** — topics, keywords, journals, notes for the AI and the score threshold, saved as `literature/review/profile.json`.

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

D1 (`phylab-preview`) only holds the weekly search's work in progress and the activity log.

## Weekly search

A cron runs every 30 minutes; idle runs only read D1. Every 7 days it collects, then works through the queue a few requests at a time:

1. **Collect** real metadata: the APS PRPER RSS feed, recent articles from the journals in the profile (Crossref by ISSN), and Crossref keyword searches. General-education journals and keyword hits must mention physics; keyword hits must also be about teaching or learning. DOIs already in the catalogue, `pending/` or `done/` are skipped.
2. **Abstracts** missing from Crossref are looked up in OpenAlex (needs `OPENALEX_API_KEY`) and then Semantic Scholar. Failure is not fatal.
3. **Screen** with DeepSeek, 10 papers per call: a 1–5 score and a Chinese reason. The prompt includes the profile plus the last 15 rejections (with reasons) and 10 approvals from `done/`, so it learns what the reviewers want.
4. **Draft** one paper per call: topics, priority, evidence type, two alternative English key findings, PhD relevance, reading recommendation, limitations, Chinese versions, and a Chinese summary.
5. **Commit** the drafts as Markdown files to `pending/` in one commit.

AI never proposes a paper on its own: every candidate is a real DOI from the sources above. The 立即找新论文 button runs the same steps while the page shows progress.

## Settings

| Name | Kind | Purpose |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | build secret | Screening and drafting |
| `GITHUB_TOKEN` | build secret | Fine-grained token for `broshu/phylab.uk` only, **Contents: Read and write**. Reads the repository and makes the commits. |
| `OPENALEX_API_KEY` | optional build secret | More abstracts |
| `AI_MODEL`, `AI_BASE_URL`, `GITHUB_REPO`, `GITHUB_BRANCH`, `PREVIEW_DEFAULT_BRANCH` | vars in `wrangler.jsonc` | |

Build secrets are copied to runtime secrets by `scripts/deploy.sh` on every deploy, as in `phylab-debate`.

## Deploy (Workers Builds)

Cloudflare dashboard → Workers & Pages → Create → Import a repository → `broshu/phylab.uk`:

- Root directory: `workers/phylab-preview`
- Deploy command: `npm run deploy`
- Build watch paths: `workers/phylab-preview/*`, `literature/core.mjs` (otherwise every decision triggers a rebuild)
- Build variables and secrets: `DEEPSEEK_API_KEY`, `GITHUB_TOKEN`

`preview.phylab.uk` is a custom-domain route in `wrangler.jsonc`, so the deploy creates its DNS record.

The desk commits to `main`. Pull (GitHub Desktop: Fetch origin) before editing locally.

## Check locally

```bash
npm install
npm run check
```
