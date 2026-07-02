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

k = q = d = 1 internally. For the **electric field** (line tracing), plates are
modelled as a uniform 9 × 9 sheet of sub-charges totalling ±2q; for the
**potential** (shells and relief), plates use the exact closed-form potential
of a uniformly charged rectangle — finite everywhere, no sub-charge
graininess even on the desk right at the plate's base.

- **Field lines** — traced in 3-D with RK4 along **E**; the line count is
  proportional to |q| (16 per unit charge, so a plate gets 32 spread over both
  faces). Lines leave + charges radially, leave plates perpendicular to the
  faces, and terminate on − charges/plates or leave the picture. Arrows show
  the direction of **E**. Lines are traced forward from every + item and
  backward from every − item; a backward trace that lands on a + item would
  retrace a forward line and is skipped, so − items get their full complement
  of arriving lines without duplicates.
- **Equipotential shells** — true 3-D isosurfaces of V extracted with
  marching tetrahedra on a 46³ grid, at **equal ΔV steps** (±0.35, ±0.7,
  ±1.05, ±1.4 · kq/d), so tightly packed shells mean a strong field. Surface
  normals are analytic (**n** ∝ ∇V = −**E**), and the V = 0 surface is shown
  when both signs are present. In this view the camera image is hidden — only
  the charges, field lines and shells remain.
- **Potential relief** — the beta-1 height-map idea, made rigorous: the desk
  plane rises to h(x,z) = s · V(x,0,z), where V is the true potential
  evaluated **on the desk** and s is one single linear scale (tallest feature
  = 1.5 d). No clamping, no smoothing — the shape *is* the potential.
  Contour rings are drawn at equal ΔV steps; since h ∝ V they sit at equal
  height steps, a live topographic map. A drop line links each floating
  charge to the relief directly beneath it.

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

Camera needs HTTPS (or localhost). Two camera-free test modes:

- **Test with a photo** (button on the start screen) — upload a picture of the
  printed cards; it is fed through the exact AR pipeline (AR.js
  `sourceType: image`), so detection, locking and rendering are the real thing.
- **Desktop demo** — `index.html?demo=dipole` (also `like`, `plates`, `mixed`),
  synthetic layouts with an orbit camera, no marker detection.

URL knobs: `?lines=` field lines per unit charge · `?iso=` levels per sign ·
`?grid=` isosurface resolution · `?smooth=` anchor smoothing (lower = steadier)
· `?autolock=0` manual lock only.

Note for future edits: never style the AR source with a bare `video` CSS
selector. AR.js gives its feed (`#arjs-video`) an inline `z-index: −2` so the
3-D canvas can composite above it; an `!important` z-index on `video` puts the
feed on top of the canvas and every virtual object silently disappears.

Barcode images from the open-source
[artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection).
