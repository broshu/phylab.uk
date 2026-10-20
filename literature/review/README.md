# Literature review queue

待筛选的论文。每篇论文一个 Markdown 文件，在 <https://preview.phylab.uk> 上筛选，也可以直接在这里用任何编辑器或 AI 修改。

This folder is the review queue for the Literature section of phylab.uk. The review desk at <https://preview.phylab.uk> (`workers/phylab-preview`) reads it live from `main`, so a file pushed here shows up on the desk at once. New candidates are added by an AI task (see `FIND-PAPERS.md`; any model can follow it) or by hand; reviewers decide on the desk.

```
literature/review/
  pending/<id>.md     papers waiting for a decision
  done/<id>.md        approved or rejected papers, with who decided and why
  profile.json        reviewing criteria the proposing AI reads first (topics, keywords, journals, notes, threshold)
  kept-old.json       ids of catalogue entries older than two years that should stay
  TEMPLATE.md         copy this to add a paper by hand
  FIND-PAPERS.md      instructions for any AI that proposes papers
```

The published catalogue is still `literature/data/papers.json`. Approving a paper on the desk adds its entry there and moves its file from `pending/` to `done/` in the same commit. Undoing moves it back.

## Adding a candidate (for people and AIs)

1. Copy `TEMPLATE.md` to `pending/<id>.md`. The file name must equal `id`.
2. Fill the front matter from the publisher's page or Crossref. Only add papers that really exist and have a DOI; check the DOI resolves.
3. Write the notes from the abstract or full text. Do not invent sample sizes, effects or methods. English sections go first; Chinese goes in `>` quote lines under them.
4. Do not add a paper whose DOI is already in `papers.json`, `pending/` or `done/`.

## File format

YAML front matter, then `##` sections. The desk ignores sections it does not know and keeps going if optional fields are missing; approval still requires everything the catalogue needs.

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Lowercase letters, digits and hyphens, e.g. `smith-2026-ai-feedback-labs`. Stable: it becomes the catalogue id. |
| `status` | yes | `pending`, `approved` or `rejected`. Files in `pending/` are `pending`. |
| `title`, `authors`, `year`, `source`, `doi`, `url` | yes | `authors` is a list. `doi` is bare (`10.xxxx/...`). `url` is HTTPS. |
| `published_date` | if known | `YYYY-MM-DD`. Leave out rather than guess. |
| `added` | yes | Date the file was created. |
| `proposed_by` | yes | Who found it: the model (`Claude`, `ChatGPT`, `Gemini`, …) or a person's name |
| `score` | no | 1–5 relevance from whoever proposed it. |
| `topics` | yes | Any of `hands-on`, `simulation`, `ai`, `transfer`, `assessment`, `icap`, `scaffolding`, `cognitive-load`, `visualization`. |
| `reading_priority` | yes | `core` (必读), `read` (精读) or `skim` (浏览). |
| `evidence_type` | yes | e.g. Randomised experiment, Quasi-experiment, Systematic review, Case study, Instrument validation. |
| `featured` | no | `true` to put it on the homepage shelf when approved. |
| `finding` | no | `A` or `B`: which key finding is published. Default `A`. |
| `decision` | set by the desk | `by`, `at`, `reason`. |
| `notes` | set by the desk | List of `{ by, at, text }` comments from reviewers. |

Sections, in this order (headings must match exactly):

- `## Why recommended` — Chinese, one sentence.
- `## Summary` — Chinese, two sentences.
- `## Key finding A`, `## Key finding B` — English (≤ 55 words) plus `>` Chinese. The chosen one is published on phylab.uk.
- `## PhD relevance`, `## Reading recommendation`, `## Limitations` — English plus `>` Chinese.
- `## Abstract` — the original abstract.

The English sections must contain no Chinese characters, because they are published on the English site.
