# AI: READ ME FIRST

When the task is "turn a physics PPT into an English 16:9 teaching PDF for
phylab.uk", **read `SKILL.md` in this folder first and follow its workflow
exactly.**

**The core principle, before anything else:** read the source PPT and master its
teaching logic; then design your *own* PDF courseware from that logic, reusing
only the PPT's images; and author the PDF **directly** (HTML/CSS/SVG →
WeasyPrint). Never build a PPT and export it. **Write the deck by hand in HTML,
not via a Python script** — plain HTML needs no environment to create or preview;
only the final HTML→PDF render uses a tool.

Reading order:
1. `SKILL.md` — the full workflow (extract images → rebuild the teaching logic →
   build the HTML deck → render the PDF → make a thumbnail → update index.html).
2. `references/design-system.md` — house style (palette, fonts, layout, math,
   SVG notes). Read before building pages.
3. `references/teaching-logic.md` — how to read the source PPT and re-sequence it
   for high-school students. Read during step 1.
4. `assets/template.html` — the house template with every page type; copy and edit.
5. `scripts/` — extract_ppt.py, render_math.py, render.py, add_to_index.py;
   call them as described in SKILL.md.

Renderer is WeasyPrint (no browser). Math is real LaTeX rendered to SVG. Install
once if missing: `pip install weasyprint --break-system-packages` and ensure
`latex` + `dvisvgm` are available (TeX Live).

Fixed conventions (confirmed by Lango): fixed house template, slide-style PDF,
high-school audience, free re-sequencing of the lesson, PDF generated directly
(only images are reused from the PPT), and all math written in LaTeX.
