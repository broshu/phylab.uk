# PhyLab Literature Maintenance Guide

Literature curates external research. The site owner's own work remains in `research/`. This section uses the main site's colours, typography, cards, and dark mode, and reuses `assets/nav.js` for navigation back to the homepage. The homepage, `/literature/`, and `/literature/library/` share one catalogue and rendering components.

## Files and deployment

- `data/papers.json`: the single published catalogue, with one object per paper and `schema_version: 1`.
- `core.mjs`: field validation, topics, search, sorting, latest additions, and homepage-pick selection.
- `index.html`: the latest-ten single-column list at `/literature/`.
- `library/index.html`: the complete searchable archive at `/literature/library/`.
- `app.mjs`: source-linked cards, the homepage carousel, latest-addition rows, archive filters, and English key findings.
- `literature.css`: scoped styles consistent with the existing site.
- `scripts/`: static publication checks, candidate collection, and reviewed-entry addition.
- `.github/workflows/literature-candidates.yml`: collects candidates every Friday at 08:00 Beijing time and can also be run manually in Actions. GitHub scheduled runs may be delayed or disabled after prolonged repository inactivity.

The existing site uses GitHub Pages to publish the root of the `main` branch, with `.nojekyll` and `CNAME` in the repository. There is no bundling framework, server, database, or new third-party dependency. Maintenance scripts require Node.js 22+. Candidate-source XML is parsed with the Python 3 standard library; Actions prepares the runtime automatically. The directory route redirects `/literature` to `/literature/`.

After changing source files, commit and push through the repository's existing process to update the live site. Confirm publication through the GitHub Pages deployment status.

## Adding weekly recommendations

1. Download the `literature-candidates` artifact from the **Weekly literature candidates** GitHub Actions run, or run this command from the repository root:

   ```sh
   node literature/scripts/collect.mjs work/literature-candidates-2026-10-09.json
   ```

   Collection searches the official PRPER RSS feed and Crossref for topic candidates from the past 45 days, excluding already catalogued papers by DOI. Crossref rate limits trigger bounded retries, and successful RSS results are retained. Incomplete source coverage is recorded in the candidate file's `warnings`. If both sources fail, collection reports an error rather than presenting the failure as a week with no papers.

   Candidates are metadata leads, and Crossref indexing can lag. Also check [recent PRPER papers](https://journals.aps.org/prper/recent) and publisher pages. The automated job does not change the published catalogue or generate unverified English conclusions.

2. Select 0–3 papers of clear value. Read the original sources and verify authors, dates, DOI, participants, intervention, assessment measures, and limitations. Copy each candidate's `paper` object into a separate JSON object or array file. You can also prepare entries directly from the existing examples without using automated collection.

3. Complete these fields and set `status: "published"`:

   | Field | Requirement |
   | --- | --- |
   | `id` | A stable, unique ID using lowercase letters, numbers, and hyphens. Do not change an existing ID, because that breaks its permalink. |
   | `title`, `authors` | The original title and a complete array of author names. |
   | `year`, `published_date` | The volume/issue or publication year. Use `YYYY-MM-DD` for a known exact date and `null` when uncertain; do not invent a month or day. |
   | `source`, `doi`, `url` | Journal or source name, a bare DOI, and a required HTTPS original-source URL. The DOI may be empty for sources without one. |
   | `topics` | An array drawn from `hands-on`, `simulation`, `ai`, `transfer`, `assessment`, `icap`, `scaffolding`, and `cognitive-load`. |
   | `evidence_type` | For example, an experiment, comparative study, systematic review, theoretical framework, or instrument validation. Clearly label evidence from other disciplines. |
   | `key_finding_en` | An English account of findings supported by the source. Do not copy the abstract. |
   | `phd_relevance_en` | Relevance to the PhD direction in English. This is curatorial judgement and must be distinguished from the paper's findings. |
   | `reading_priority` | `core` for essential PhD reading, `read` for full-text reading, or `skim` for background reading. |
   | `reading_recommendation_en` | English guidance on which sections to read and why. |
   | `limitations_en` | Evidence limitations in English. Distinguish immediate performance, experimental capability, and independent transfer. |
   | `featured` | A boolean affecting only the main-site homepage carousel. Within the same `date_added`, featured entries rank first, followed by publication date in descending order. The carousel includes up to six published `core`/`read` entries; `featured: true` is not required. The `/literature/` latest-ten list includes all published priorities and ignores `featured`. |
   | `date_added` | The actual date the entry was added, in `YYYY-MM-DD` format. |
   | `verified_at`, `verification_url` | The editorial verification date and an HTTPS original-source link supporting the interpretation. A collection date cannot substitute for source verification. |

4. Check the reviewed entries, then add them from the repository root:

   ```sh
   node literature/scripts/add.mjs work/reviewed-papers.json --dry-run
   node literature/scripts/add.mjs work/reviewed-papers.json
   npm run build --prefix literature
   npm test --prefix literature
   ```

   The addition script checks duplicate IDs and DOIs, missing fields, English notes, dates, and safe links. It writes `papers.json` atomically only when all checks pass. It does not commit or push.

   To revise an existing entry, edit that object and update the catalogue's `updated_at`; do not add a duplicate. Manual additions can also be made directly in `papers.json`, followed by the build and test checks above.

5. Review the changes and publish through the site's existing process. New published entries appear in the complete Library automatically and enter the latest-ten list according to their addition date. New `core`/`read` entries also become eligible for the main-site homepage carousel. No changes to HTML or a `featured` flag are required. Keep candidate files and reviewed working files in `work/`; they are not the published catalogue.

## Browsing and verification

The homepage Literature section follows Labs, and the section navigation follows Research → Labs → Literature. All public page text is in English. Existing `_zh` notes remain in the data as editorial reference and are not required for future entries. The English `_en` notes are required for published entries.

Every paper card on the main-site homepage, `/literature/`, and `/literature/library/` opens its original source URL directly from anywhere inside the card. Cards show compact English content: title, authors, journal/source, topic labels, and key finding, with reading priority and dates. There is no intermediate internal reading-note or explanation page.

`/literature/` displays up to ten latest additions as full-width rows in a single column for vertical browsing. Entries are ordered by `date_added` descending, then publication date (or year when an exact date is unknown), then title. All published reading priorities are eligible. Older entries remain in Library; selecting the latest ten never removes them from the catalogue.

The main-site homepage keeps its separate carousel of up to six `core`/`read` recommendations, showing three cards on desktop and approximately one on mobile. Only the homepage carousel uses horizontal scrolling, touch swipes, previous/next buttons, and arrow-key navigation when the shelf is focused.

`/literature/library/` contains every published entry, including the latest ten, using the same compact cards that open original sources directly. Topic chips inside all paper cards are plain labels; topic filtering is available only through the Library controls. The complete Library supports matching multiple topics simultaneously (AND), Chinese and English keyword searches, DOI and author searches, and sorting by addition date, publication date, or reading priority. Filters are stored in the URL for sharing.

Full English editorial notes—PhD relevance, reading recommendations, and evidence limitations—remain in `data/papers.json` for maintenance and source verification. They remain required for published entries but are no longer displayed as an internal detail view. The key finding remains visible on every paper card. Existing `_zh` fields remain editorial reference in the same data file.

The catalogue-entry permalink is `/literature/library/#stable-id`. Existing `/literature/#stable-id` links and older filtered links such as `/literature/?topic=ai#library` are routed to the archive, preserving access to older entries and filters. The archive identifies the paper; selecting its card opens the original source. Drafts are hidden. Each data request revalidates the cache, so a refresh after deployment loads the updated catalogue.

Start a standard static server from the repository root for local preview:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8765/literature/` for the latest additions or `http://127.0.0.1:8765/literature/library/` for the complete archive. Do not open the HTML file directly, because browsers restrict data loading from local files. A retry is available when the network or data request fails. A link to the complete data file remains available when JavaScript is disabled.

`npm run build --prefix literature` checks static publication integrity; it does not generate a new output directory. CI validates fields, resource paths, and core behaviour on literature-related pushes and pull requests. The existing GitHub Pages deployment mechanism remains in place; these CI checks do not automatically become a prerequisite for Pages deployment.

Sources for the initial 11 entries were checked on 2026-10-03. They include recent October 2026 papers and foundational frameworks. This catalogue is a selective reading recommendation list, rather than a systematic review claiming to cover all PER literature.

## Automation status and next step

The current weekly workflow collects candidate metadata into a GitHub Actions artifact only. It uses read-only `contents` permission and no model API credential. Automated note generation, draft-PR creation, and publication are not live.

A planned expansion, not yet implemented, would follow this sequence:

Original-source checks → AI-assisted English drafts of findings, PhD relevance, reading guidance, and limitations → data validation, build checks, and tests → draft pull request → editorial approval → merge to `main` and GitHub Pages publication.

This expansion needs a model API credential and repository write capability sufficient to create a branch and a draft pull request. Editorial approval would remain the gate for publishing interpretations and recommendations.
