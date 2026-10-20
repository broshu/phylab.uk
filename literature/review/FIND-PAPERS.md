# Finding new papers: instructions for any AI

These instructions work with any model or assistant (Claude, ChatGPT, Gemini, DeepSeek, a scheduled task, a chat). To use them, give the assistant access to the GitHub repository `broshu/phylab.uk` and say:

> Follow `literature/review/FIND-PAPERS.md` in broshu/phylab.uk and propose a batch of new papers.

Or paste this whole file into the assistant. New candidates appear at <https://preview.phylab.uk> for people to approve or reject; nothing is published until a person approves it.

---

You maintain the review queue for a curated physics education research reading list in the GitHub repository `broshu/phylab.uk`, branch `main`.

## 1. Read before searching

- `literature/review/profile.json`: the reviewers' criteria. `topics`, `keywords`, `journals` (use those with `"on": true`), `notes` (what the reader studies and wants), `threshold` (minimum relevance score, 1–5) and `window_days` (how far back to look).
- `literature/review/done/*.md`: papers already decided. Files with `status: rejected` have a `decision.reason`; avoid papers like those. Files with `status: approved` show what the reviewers value.
- `literature/review/pending/*.md`: papers already waiting. Do not propose them again, and use them to avoid near-duplicates.
- `literature/review/README.md` and `literature/review/TEMPLATE.md`: the file format. Follow it exactly.

## 2. Find candidates

Use only the open scholarly APIs below. They need no login, no browser and no one's approval, so the task can run unattended. Do not open publisher web pages (APS, IOP, Springer, Elsevier, Wiley, Taylor & Francis): they block automated access.

| What | Where |
| --- | --- |
| Recent articles per journal | `https://api.crossref.org/works?filter=issn:<ISSN>,from-pub-date:<today minus window_days>,type:journal-article&rows=200` |
| Metadata for one DOI | `https://api.crossref.org/works/<doi>` |
| Abstract, if Crossref has none | `https://api.openalex.org/works/doi:<doi>` (rebuild the text from `abstract_inverted_index`), then `https://api.semanticscholar.org/graph/v1/paper/DOI:<doi>?fields=abstract` |

- Query every journal with `"on": true` in `profile.json` by its ISSN, then screen titles against `notes`, `topics` and `keywords`.
- Every paper must be real: its DOI must return a record from Crossref, and title, authors, journal and date come from that record. Never guess or reconstruct metadata. Crossref sometimes swaps given and family names (for example `Kozlova Zoya`); put them in the usual order, but do not add or change names.
- `published_date`: use Crossref `published-online` if present; otherwise leave the field out rather than use an issue month.
- If none of the three sources has an abstract, leave the paper out and list it under "skipped" in your report.
- Skip any DOI that already appears in `literature/data/papers.json`, `literature/review/pending/` or `literature/review/done/`.
- Score each paper 1–5 for relevance to `notes` and `topics`. Keep only papers scoring at least `threshold`. Prefer empirical studies and reviews over opinion pieces. Usually 3–10 papers per run is right; zero is fine in a quiet week.

## 3. Write one file per paper

- Path: `literature/review/pending/<id>.md`, where `<id>` is lowercase `surname-year-three-title-words` (letters, digits, hyphens), unique across the repository.
- Copy the structure of `TEMPLATE.md`. Set `status: pending`, `added:` today's date, `proposed_by:` your own model or assistant name (for example `Claude`, `ChatGPT`, `Gemini`), `score:` your score.
- Choose `topics` only from: `hands-on`, `simulation`, `ai`, `transfer`, `assessment`, `icap`, `scaffolding`, `cognitive-load`, `visualization`. Set `reading_priority` (`core`, `read` or `skim`) and `evidence_type`.
- Write the notes from the abstract (or full text if available). Do not invent sample sizes, effects or methods; if the abstract gives no results, say so.
  - `## Why recommended` and `## Summary`: Chinese.
  - `## Key finding A` (short plain version) and `## Key finding B` (adds design and the most specific result): British English, at most 55 words each, paraphrased, then a `>` line with the Chinese translation.
  - `## PhD relevance`, `## Reading recommendation`, `## Limitations`: English, then `>` Chinese.
  - `## Abstract`: the complete original abstract in English; then the complete Chinese translation of the whole abstract in `>` lines (translate every sentence, do not shorten or summarise); then a `Source:` line (authors, title, journal, DOI link) and a line saying which API the abstract came from and that the summaries are yours, based on the abstract. The review page shows both versions in full.
- English sections must contain no Chinese characters.

## 4. Commit

- Commit all new files to `main` in one commit with the message `Literature review: <n> new candidates (<your name>)`.
- Only add files in `literature/review/pending/`. Never edit `literature/data/papers.json`, files in `done/`, or `profile.json`; the reviewers change those through the website.
- If you can only open a pull request, open one with the same title; the files appear on the website once it is merged.
- If you cannot write to GitHub at all, give each file's path and full contents in your reply so a person can add them.

## 5. Report

Reply with a short list: each paper's title, score and one-line reason, plus any DOI you skipped and why.
