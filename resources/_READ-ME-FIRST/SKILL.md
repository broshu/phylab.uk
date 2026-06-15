---
name: phylab-lesson-pdf
description: >-
  Turn a source physics lesson PPT/PPTX into a polished English 16:9 teaching
  PDF in the PhyLab house style, saved into the phylab.uk resources folder.
  Use this skill whenever the user points at a .ppt/.pptx (often a Chinese
  physics lesson in a `ppt/` folder) and wants a re-built English lecture deck,
  slide PDF, teaching handout, or "授课 PDF" — even if they only say "remake this
  lesson", "make an English version of this PPT", "build a deck for this topic",
  or "add this to resources". The skill understands the original teaching logic,
  re-sequences it for high-school students, reuses figures from the PPT, draws
  new diagrams, renders an exact 960x540pt PDF, makes a thumbnail, and registers
  it in resources/index.html. Default to this skill for any "PPT → English
  teaching PDF for phylab.uk" request.
---

# PhyLab Lesson PDF

Rebuild a source physics PPT into an **English, 16:9, slide-style teaching PDF**
in the established PhyLab house style, then file it into the website's resources
section. The audience is **high-school students**. You are not translating the
PPT — you are re-teaching the lesson: understand what the original is trying to
get across, then design the clearest possible lecture for it.

## Core principle (read this first)

1. **Read the PPT and master its teaching logic.** Before designing anything,
   understand the lesson the source is teaching — its essential question, the
   conceptual steps, and why they're ordered the way they are. Fidelity is to the
   *physics and the pedagogy*, not to the slides.
2. **Design your own PDF courseware from that logic.** You are the author of a new
   deck. Re-sequence, cut, and add freely so the lesson lands for high schoolers.
   The only thing you reuse verbatim from the PPT is its **images** (apparatus
   photos, instrument scales, textbook figures) — everything else you rebuild.
3. **Author the PDF directly. Never make a PPT and export it.** The deck is built
   as HTML/CSS/SVG and rendered straight to PDF with WeasyPrint. Do not create or
   round-trip through PowerPoint/Keynote/python-pptx at any point.
4. **Build the slides in HTML, not in Python.** Write the deck by hand as plain
   HTML/CSS/SVG — do *not* generate slides from a Python script. Hand-written HTML
   needs no environment or toolchain to create or preview (just open it in a
   browser); only the final HTML→PDF render step calls a tool.

## What "good" looks like

The output is a deck of full-bleed 16:9 slides on warm paper, each with a tiny
coloured kicker label, one bold idea as the headline, minimal supporting text,
and a clean custom diagram. One slide = one idea. See
`references/design-system.md` for the exact palette, type, and page grammar, and
look at any existing PDF in `phylab.uk/resources/` as a reference for the bar.

## Workflow

Work through these steps in order. Do the thinking (steps 1–3) before touching
the template.

### 1. Read the source and reconstruct the teaching logic
- Extract images and text:
  `python3 scripts/extract_ppt.py "<source.pptx>" build/<slug>/img`
  This writes every picture to the image folder plus `manifest.json` and prints
  the slide text outline. Read the outline.
- Then read `references/teaching-logic.md` and use it to work out the lesson's
  spine: the essential question, the 3–5 conceptual moves that answer it, and
  the order that makes them land for a 15–17 year old. **You may re-sequence,
  cut, and add freely** — fidelity is to the physics, not to the slide order.

### 2. Decide the deck outline
- Sketch the slides: a title slide, a "lesson map" overview, one slide per
  conceptual move, and a closing takeaway. Aim for ~10–16 slides (the existing
  decks are 13–14 pages).
- Decide which extracted images are worth reusing (photos of apparatus, real
  instrument scales, textbook figures). Schematic diagrams are almost always
  better redrawn as clean inline SVG in the house colours — see the template.

### 3. Write the English for high schoolers
- Short, plain sentences. Define every symbol the first time it appears.
- Each slide: kicker (one or two words, the *mode* of the slide — OBSERVE,
  MODEL, MEASURE, DESIGN, APPLY…), a headline that states the idea as a claim,
  and a one-line subtitle. Keep body text to a few lines.

### 4. Build the HTML deck
- Copy `assets/template.html` to `build/<slug>/index.html`.
- It is a working multi-slide deck showing every page type with the full house
  CSS already wired up. Keep the `<head>` (CSS + fonts) intact; replace the
  `<body>` slides with yours. Reuse the page-type blocks as starting points.
- Reference reused images with a relative path like
  `<img src="img/slide3_pic1.png">` (they sit next to the HTML).
- Set the footer lesson name and page numbers. Page numbers are 2-digit (01, 02).
- **Write all maths in LaTeX**, never as plain underscores. Use the custom tags
  (render.py turns them into real-LaTeX SVG before layout):
  `<m>I_g</m>` inline, `<m c="d2552f">I_g</m>` coloured inline (hex, no #),
  `<md>U = I_g(R_g + R_s)</md>` for a centred display equation. Full LaTeX math
  syntax works (`\dfrac`, `\mu`, `\Omega`, `\mathrm{sh}`, Greek, …). For symbols
  drawn *inside* a hand-made diagram `<svg>`, you can't use these tags — instead
  write the variable italic with a `<tspan>` subscript, as the template does.

### 5. Render the PDF + thumbnail
```
python3 scripts/render.py build/<slug>/index.html \
    phylab.uk/resources/<slug>.pdf \
    --thumb phylab.uk/resources/thumbs/<slug>.jpg
```
This produces an exact **960×540 pt** PDF (PowerPoint 16:9) with fonts embedded,
plus a first-page JPG thumbnail. Render early and often — check the PNG/PDF and
iterate on the HTML.

### 6. Register it on the resources page
```
python3 scripts/add_to_index.py phylab.uk/resources/index.html \
    <slug>.pdf "Human Title" thumbs/<slug>.jpg
```
Inserts a card at the top of the grid, matching the existing markup.

### 7. Verify before finishing
- Render the PDF to PNGs (`pdftoppm -png -r 80 <pdf> /tmp/chk`) and **look at
  every page**. Check: 16:9 with no clipping, headline fits on at most two
  lines, no Chinese left over, diagrams legible, footer/page numbers correct,
  reused images not stretched.
- Open the updated `index.html` and confirm the new card and thumbnail show.
- Present the final PDF (and mention the index was updated).

## Slug & naming
**Keep the filename short** — one or two words, lowercase kebab-case, matching the
existing files (`capacitance.pdf`, `resistance.pdf`, `meters.pdf`,
`electric-potential.pdf`). Prefer the single key noun of the topic
(`friction`, `coulomb-law`, `magnetic-flux`) over a long descriptive phrase. The
card title shown on the page is the full human-readable Title Case name.

## Batch / scheduled use
A daily scheduled task ("daily-phylab-lesson", 11:15) runs this skill on the
`physics class 2025` folder. It tracks which source PPTs are done in
`_processed.txt` (one exact `.pptx` filename per line). When running by hand or on
a schedule: pick a `.pptx` not in that ledger, build the lesson, then append its
filename to `_processed.txt` so it isn't repeated.

## Generation notes
- The renderer is **WeasyPrint** (pure-Python, no browser needed). Install once
  if missing: `pip install weasyprint --break-system-packages`.
- **Maths** is real LaTeX: `scripts/render_math.py` compiles each `<m>`/`<md>`
  snippet with `latex` and converts it to SVG with `dvisvgm` (TeX Live — both are
  normally already installed). render.py calls it automatically; you rarely run
  it by hand. Tune math size/baseline via the `.math-inline` / `.math-display`
  CSS in the template, not by changing the script.
- The template's font stack is `"Avenir Next", "Manrope", …` for headings and
  `"Inter", Arial, …` for body. WeasyPrint pulls Manrope/Inter from Google Fonts
  and embeds them; if the user ever re-prints the HTML on macOS it picks up real
  Avenir Next/Arial, matching the original decks. Don't change this stack.
- Everything is static HTML/CSS/SVG — no JavaScript, which is why WeasyPrint is
  a good fit. Avoid CSS features WeasyPrint doesn't support well (complex grid
  gaps are fine; prefer fl/block layout and explicit sizes as the template does).

## Reference files
- `references/design-system.md` — palette, fonts, spacing, footer, full page
  grammar and the diagram drawing conventions. Read before building.
- `references/teaching-logic.md` — how to read a source PPT and rebuild a
  high-school lesson from it. Read during step 1.
- `assets/template.html` — the house deck skeleton with all page types, incl.
  LaTeX `<m>`/`<md>` math examples and `<tspan>` diagram labels.
- `scripts/render_math.py` — LaTeX→SVG math (called by render.py).
