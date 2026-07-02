# AR Electric Field · beta 2

Plane-only rewrite of the AR electrostatics lab. Printed barcode cards lie flat
on a horizontal desk; all cards are the same size and the card edge **d** is the
unit of length for the whole scene.

| barcode | meaning |
|---------|---------|
| 0 / 6 | **+q** point charge — appears floating **2d above** its card |
| 1 / 7 | **−q** point charge — appears floating **2d above** its card |
| 4 | **+2q plate** — a **2d × 2d** board standing upright on the card (base on the desk, board along the card's x-axis) |
| 5 | **−2q plate** — same geometry, opposite charge |

`markers.pdf` is the single printable page with all six cards and their meanings.

## Physics

k = q = d = 1 internally. Plates are modelled as a uniform 9 × 9 sheet of
sub-charges totalling ±2q (the standard uniformly-charged-sheet idealisation).

- **Field lines** — traced in 3-D with RK4 along **E**; the line count is
  proportional to |q| (16 per unit charge, so a plate gets 32 spread over both
  faces). Lines leave + charges radially, leave plates perpendicular to the
  faces, and terminate on − charges/plates or leave the picture. Arrows show
  the direction of **E**. (Lines are seeded from the positive items; a scene
  with unbalanced charge omits the lines that arrive from infinity.)
- **Equipotential surfaces** — true 3-D isosurfaces of V extracted with
  marching tetrahedra on a 46³ grid, at **equal ΔV steps** (±0.35, ±0.7,
  ±1.05, ±1.4 · kq/d), so tightly packed shells mean a strong field. Surface
  normals are analytic (**n** ∝ ∇V = −**E**), and the V = 0 surface is shown
  when both signs are present. In this view the camera image is hidden — only
  the charges, field lines and shells remain in dark space.

## The jitter fix (rewritten, not copied, from beta 1)

1. **Scan** — every visible card's pose is low-pass filtered.
2. **Lock** — after the visible set of cards is steady for ~1.2 s (or on tap),
   the layout is frozen into one rigid desk frame (origin = card centroid,
   normal from PCA of the card positions) and all geometry is built **once**.
3. **Track** — each frame, every visible card replays its stored offset to give
   one estimate of the desk-frame pose; the estimates are **averaged**, then
   smoothed over time. Marker noise cancels in the average; the field's shape
   can never wobble because it is never rebuilt.
4. **Gyro fallback** — in the equipotential view, if no card is in sight the
   last known pose is rotated by the device's own rotation (DeviceOrientation)
   so the view keeps following the iPad. If motion permission is refused the
   view simply holds until a card reappears.

## Files

```
index.html      the AR page (start gate, HUD, toggles)
app.js          physics + geometry + AR lock + gyro + desktop demo
markers.pdf     the one-page printable card sheet
screenshot.png  hub thumbnail
```

## Run

Camera needs HTTPS (or localhost). Desktop demo without a camera:
`index.html?demo=dipole` (also `like`, `plates`, `mixed`) — drag to orbit.

URL knobs: `?lines=` field lines per unit charge · `?iso=` levels per sign ·
`?grid=` isosurface resolution · `?smooth=` anchor smoothing (lower = steadier)
· `?autolock=0` manual lock only.

Barcode images from the open-source
[artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection).
