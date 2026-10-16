# preview.phylab.uk

A private copy of phylab.uk that is always current, plus the literature review desk.

- **Mirror.** Every page is read live from this GitHub repository (branch `main` by default), so a push shows up on the next refresh. Any other branch can be previewed from the review desk's **测试分支** tab; the public site is untouched. HTML pages get a small "预览" badge linking to the desk.
- **Review desk** (`/review`). AI proposes papers; the owner ticks topics, picks a key finding and presses ✅ / ⭐ / ❌. ✅ commits the entry to `literature/data/papers.json` on `main` immediately, and GitHub Pages publishes it about a minute later. Every decision can be undone (撤下 / 恢复).
- **No account.** The site answers 404 to everyone without the access cookie. Opening `https://preview.phylab.uk/k/<key>` once per browser sets it (valid for 400 days). The key is the `PREVIEW_KEY` secret if set, otherwise the `access_key` row in D1. Pages send `noindex` and `robots.txt` disallows everything.

## Weekly pipeline

A cron runs every 30 minutes; most runs only read D1. Every 7 days it collects, then works through the queue a few requests at a time:

1. **Collect** real metadata: the APS PRPER RSS feed, recent articles from the journals in the profile (Crossref by ISSN), and Crossref keyword searches. General-education journals and keyword hits must mention physics; keyword hits must also be about teaching or learning. DOIs already in the catalogue are skipped.
2. **Abstracts** missing from Crossref are looked up in OpenAlex (set `OPENALEX_API_KEY` if you have one) and then Semantic Scholar. Failure is not fatal.
3. **Screen** with DeepSeek, 10 papers per call: a 1–5 score and a Chinese reason. The prompt includes the owner's interest profile and her last 15 rejections (with reasons) and 10 acceptances, so it learns her taste. Papers at or above the threshold (default 4) continue.
4. **Draft** one paper per call: topics, priority, evidence type, two alternative English key findings, PhD relevance, reading recommendation, limitations, and Chinese versions for the owner. Drafts that fail the checks are retried once.

AI never proposes a paper on its own: every candidate is a real DOI from the sources above. Approval builds the entry and runs the site's own `validateCatalog` (from `literature/core.mjs`) before committing, so nothing the literature build check would reject can be published. Entries published more than two years ago appear under **到期** for 删除 or 保留.

Pressing **立即抓取** on the desk runs the same pipeline in small steps while the page shows progress.

## Settings

| Name | Kind | Purpose |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | build secret | AI screening and drafting |
| `GITHUB_TOKEN` | build secret | Fine-grained token for `broshu/phylab.uk` only, **Contents: Read and write**. Reads the mirror (no CDN delay) and commits approvals. |
| `PREVIEW_KEY` | optional build secret | Overrides the access key stored in D1 |
| `OPENALEX_API_KEY` | optional secret | More abstracts |
| `AI_MODEL`, `AI_BASE_URL`, `GITHUB_REPO`, `GITHUB_BRANCH`, `PREVIEW_DEFAULT_BRANCH` | vars in `wrangler.jsonc` | |

Build secrets are copied to runtime secrets by `scripts/deploy.sh` on every deploy, as in `phylab-debate`. The D1 database `phylab-preview` holds the queue, the interest profile, kept-old entries and the activity log.

## Deploy (Workers Builds)

Cloudflare dashboard → Workers & Pages → Create → Import a repository → `broshu/phylab.uk`:

- Root directory: `workers/phylab-preview`
- Deploy command: `npm run deploy`
- Build watch paths (recommended): `workers/phylab-preview/*`, `literature/core.mjs` — otherwise every approved paper triggers a rebuild.
- Build variables and secrets: `DEEPSEEK_API_KEY`, `GITHUB_TOKEN`

`preview.phylab.uk` is a custom-domain route in `wrangler.jsonc`, so the deploy creates its DNS record.

Approvals commit to `main` from the Worker. Pull before editing the repository locally.

## Check locally

```bash
npm install
npm run check
```
