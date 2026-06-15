# Reading a source PPT and rebuilding the lesson

The source decks are real classroom PPTs (often Chinese senior-physics lessons).
They are the raw material, not the script. Your job is to recover the *physics
the author wanted students to understand*, then design the clearest path to it
for a high-school audience in English. You have wide latitude to re-order, cut,
merge, and add.

## Step 1 — Recover the spine
Read the extracted text outline and skim the figures, then answer:
- **What is the one essential question** this lesson answers? Phrase it the way a
  curious student would ("Why does a voltmeter need a *large* resistance but an
  ammeter a *small* one?"). This becomes the title slide's callout.
- **What are the 3–5 conceptual moves** that get from "no idea" to answering it?
  Each move is one idea and will become one (occasionally two) slides. Typical
  shapes:
  - phenomenon/motivation → model/definition → governing relation → worked
    consequence → real-world application;
  - or: recall prior idea → introduce new quantity → how to measure/compute it →
    what changes it → use it.
- **What must a 15–17 year old already know**, and what is genuinely new here?
  Front-load a one-line recall of the prerequisite, then spend the slides on the
  new idea.

## Step 2 — Re-sequence for understanding, not for the source order
- Lead with a concrete observation or a question, not a definition. Definitions
  land better *after* the student feels the need for them.
- Introduce one symbol at a time and define it on first use. Never show a formula
  before the student knows every letter in it.
- Build the governing relation up, don't drop it. Show where it comes from.
- Put the "design / apply" payoff near the end so the lesson resolves the
  essential question it opened with.
- Cut anything that doesn't serve the spine: administrivia, redundant examples,
  decorative slides, exam meta-talk.

## Step 3 — Pitch and language for high schoolers
- Short declarative sentences. One claim per headline.
- Prefer intuition + a clean diagram over algebra. Keep at most one derivation
  on screen at a time, broken into visible steps.
- Use consistent symbols throughout the deck (pick them once, e.g. `I_g, R_g,
  U_g`, and reuse).
- Make the *why* explicit: every quantity should come with what it physically
  means and why we care.
- Units and orders of magnitude where they aid intuition (a galvanometer's
  full-scale current is tiny — say how tiny).

## Step 4 — Figures
- **Reuse** photographs of apparatus, real instrument faces/scales, and genuine
  experimental setups from the PPT — these are hard to redraw and add realism.
- **Redraw** every schematic (circuits, field lines, force diagrams) as clean
  inline SVG in the house palette. Source schematics are usually low-res
  screenshots; redrawing keeps the deck crisp and on-brand.
- Each figure should make exactly one point. Label only what the slide discusses.

## Step 5 — The map slide
After the title, give a "lesson map": the 3–5 moves as a numbered timeline so the
student sees the whole arc before the details. End the deck with a one-sentence
takeaway that answers the essential question.

## Worked mini-example (from the existing "Voltmeters & Ammeters" deck)
- Essential question: *why large R for a voltmeter, small R for an ammeter?*
- Map: LIMIT → VOLTAGE → CURRENT → RANGE.
- Moves: a galvanometer movement is sensitive but only tolerates a tiny
  full-scale current (motivation) → add a **series** resistor to make a voltmeter
  → add a **parallel** shunt to make an ammeter → choose the resistance to set
  the range.
- Reused vs redrawn: the meter movement and circuits are all redrawn SVG; only
  real instrument photos would have been reused.
This is the level of re-construction expected — the original Chinese order is a
hint, the English lesson is yours to design.
