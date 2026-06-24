# Semi-AR Field &amp; Potential

A "lock-once" AR lab. The charge cards are detected **a single time**, then the whole
charge layout is **frozen in place**. After that you can move the iPad around and view the
field and potential from any angle — the charges stay anchored to the desk and **don't
jitter**, because they are never re-detected. This fixes the constant jumping of the live
AR lab while keeping a real moving viewpoint.

Uses the **same printed cards** as the other labs.

## How to use

1. Lay the cards on a desk (positive `1–5`, negative `7–11`, + gun `0`, − gun `12`).
2. **Start camera**, point at all the cards so they're seen, then tap **Lock charges**.
3. Move the iPad freely to observe. Toggle **Grid / Field lines / Potential**.
4. Tap **Re-scan** to capture a new layout.

Keep at least one of the locked cards in view while you move — that's what the camera uses
to stay registered. The more cards stay visible, the steadier the anchor.

## How it works (the "semi-AR" trick)

- **Lock.** When you tap Lock, the app fits the desk plane (PCA best-fit) and records each
  charge's position in a fixed *reference frame*. It also stores, for every card currently
  visible, that card's transform within the reference frame.
- **Track.** AR.js keeps detecting the cards each frame only to recover the **camera pose**.
  From whichever locked cards are visible, the app reconstructs the reference frame's pose
  (averaged across all visible cards and smoothed over time) and applies it to a single
  *anchor* that carries all the frozen geometry. Because the charges themselves are never
  re-measured, their relative positions are perfectly rigid — no inter-charge jitter — and
  the global pose is smoothed, so the scene sits calmly on the desk as you walk around.
- Everything else (field lines, potential surface with hills/wells, and the two particle
  guns with their trajectories) is the same as the AR lab, but built once into the anchor.

## Tunable URL parameters

`?smooth=0.3` anchor smoothing (lower = steadier, higher = more responsive) ·
`?k=` field strength · `?soft=` softening · `?height=` / `?hclamp=` potential scale ·
`?pspeed=` `?pforce=` gun particles · `?gundir=1` rotate the beams.
