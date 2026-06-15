# PhyLab slide design system

This is the house style every lesson PDF must follow. It is reverse-engineered
from the existing decks in `phylab.uk/resources/`. When in doubt, open one of
those PDFs and match it.

## Canvas
- Each slide is a `1280 × 720 px` box (16:9). At WeasyPrint's 96 dpi this renders
  to exactly **960 × 540 pt** — the PowerPoint 16:9 standard the existing decks
  use. Do not change the page size.
- Generous margins: ~64 px top/bottom, ~80 px left/right.
- Lots of breathing room. Whitespace is part of the design — never fill the slide.

## Palette
```
--ink     #1c2b25   near-black, all headlines & body
--paper   #f4f1e8   warm page background (every slide)
--card    #faf8f1   slightly lighter card fill
--line    #d8d2c0   hairline borders / footer rule
--muted   #6b7269   subtitles, captions, footer text
--teal    #2f5d4f   primary accent (kickers, callouts, key terms)
--teal-2  #3f7060   lighter teal
--orange  #d2552f   warm accent (emphasis, "watch out", numerals)
--amber   #e8a33d   third categorical accent / highlights
--olive   #8a9a5b   site accent (use sparingly)
```
Use **teal, orange, amber** as the three rotating categorical colours (e.g. for
01/02/03/04 steps). Ink + muted carry all the text. Never introduce new hues.

## Typography
- Headings: `"Avenir Next", "Manrope", system-ui, sans-serif`, weight 800.
  Manrope is the rendered fallback and matches Avenir Next closely.
- Body / captions: `"Inter", Arial, sans-serif`, weight 400–500.
- Rough sizes on the 1280-wide canvas:
  - Slide headline `h1`: 52–64 px, weight 800, ink, tight line-height (~1.05).
  - Title-slide headline: up to 72 px.
  - Subtitle under headline: 22–26 px, muted.
  - Kicker label: 16–18 px, weight 700, letter-spacing ~2px, UPPERCASE, coloured.
  - Body text in cards: 18–22 px.
  - Footer: 13–14 px, muted, letter-spacing ~1px.
## Mathematics — always LaTeX
All maths is written in **LaTeX** and rendered to crisp vector SVG (Computer
Modern) — never as plain text like `I_g` or `U = I_g R_g`. Authoring tags
(render.py renders them before layout):
- `<m>I_g</m>` — inline symbol/expression, flows with the sentence.
- `<m c="d2552f">I_g</m>` — inline in a house colour (hex without `#`); colour the
  symbol to match the concept it labels.
- `<md>U = I_g(R_g + R_s)</md>` — centred display equation; wrap in `.eq` /
  `.eq.small-eq` for the standard sizes.
Full LaTeX maths is available (`\dfrac`, `\sqrt`, `\mu`, `\Omega`, `\vec`, Greek,
subscripts/superscripts). Size and baseline are controlled by the `.math-inline`
/ `.math-display` CSS, not by editing the formula.

Exception — labels **inside** a hand-drawn diagram `<svg>` can't use these tags
(they'd nest SVG in SVG). There, write the variable italic with a small
`<tspan>` subscript, e.g.
`<tspan font-style="italic">R</tspan><tspan font-style="italic" font-size="12" dy="5">s</tspan>`,
as the template's diagram labels do. The display/colour maths in prose and cards
still goes through the LaTeX tags.

## Page grammar (every content slide)
1. **Kicker** top-left: a one/two-word MODE label in caps, coloured. It tells the
   student what kind of slide this is, not the topic. Vocabulary to draw from:
   `OBSERVE, MODEL, MEASURE, DESIGN, APPLY, ROUTE, LESSON MAP, RECALL, COMPARE,
   DERIVE, CHECK, SUMMARY`. Sometimes prefixed by a small filled dot in the
   accent colour.
2. **Headline** `h1`: the idea stated as a claim ("A galvanometer is sensitive —
   and limited"), not a topic title. One or two lines max.
3. **Subtitle**: a single muted line that adds the nuance.
4. **Body**: cards, a diagram, a list of key terms — kept minimal.
5. **Footer** pinned to the bottom, above a 1px `--line` rule:
   left = LESSON NAME in caps with letter-spacing; right = 2-digit page number.

## Reusable page types (see `assets/template.html` for working markup)
- **Title slide** — bordered kicker "pill", oversized headline, one subtitle, an
  "Essential question" callout box (teal border), and a hero diagram on the right.
- **Lesson map** — the 3–5 conceptual moves as a horizontal timeline of coloured
  numbered circles (01–04) or as a row of numbered cards, each with a coloured
  category word and a one-line description. This previews the whole lesson.
- **Concept slide** — a framed diagram card on the left, a "key parameters /
  three things" list on the right where each item has a big coloured symbol and a
  short gloss.
- **Compare slide** — two side-by-side cards (e.g. WEAKER FIELD vs STRONGER
  FIELD) with parallel diagrams and a coloured one-line caption each.
- **Four-cards row** — 01–04 cards across the slide, each a coloured numeral, a
  coloured category label, and two lines of text; often with a single emphasised
  takeaway bar beneath.
- **Formula / derivation slide** — the diagram with the governing relation set
  large and centred (e.g. `U_g = I_g R_g`), symbols colour-coded.
- **Takeaway slide** — one big sentence the student should leave with.

## Callouts
- **Essential question** box: `--card` fill, 1.5px `--teal` border, ~12px radius;
  a small teal uppercase label "Essential question" then the question in ink bold.
- **Emphasis bar**: a full-width pill with a 1.5px `--orange` border and orange
  bold text for the single thing that must not be missed.

## Cards
- 1px `--line` border, 12–16 px radius, `--card` fill, ~24–28 px padding.
- Optional very soft shadow: `0 12px 32px -16px rgba(28,43,37,.28)`.

## Diagram conventions (inline SVG, in house colours)
- Redraw schematics rather than reusing PPT screenshots. Reuse photos and real
  instrument scales as `<img>`.
- Wires/axes: stroke `--ink`, width 3–4, round caps. Arrowheads as small filled
  triangles in `--orange` for field/current direction.
- Components: rounded rectangles with a coloured 2px stroke (resistor = orange,
  shunt/parallel = teal), labelled in the heading font. Meter/galvanometer = a
  circle with a letter (G, V, A) and a teal stroke.
- Optional / parallel paths: dashed `--line` strokes.
- Equipotential / grid lines: thin `--amber`; field lines: `--teal` arrows.
- Keep labels in the heading font, bold, sized 16–20 px, coloured to match the
  thing they label.

## Renderer gotchas (WeasyPrint)
- Inside inline `<svg>`, set colours and `fill`/`stroke` as **literal hex
  presentation attributes** (e.g. `stroke="#2f5d4f" fill="none"`). WeasyPrint does
  **not** resolve CSS `var(--…)` used directly in SVG attributes, and an open or
  closed `<path>` with no `fill` defaults to **black** — always add `fill="none"`
  on stroked paths. CSS custom properties work fine everywhere outside SVG.
- No JavaScript runs, so everything must be static markup (it already is).

## Don'ts
- No pure white backgrounds, no drop-shadow-heavy "PowerPoint" look, no clip-art.
- No more than one idea per slide. If a slide needs a paragraph, split it.
- No untranslated Chinese anywhere in the output.
