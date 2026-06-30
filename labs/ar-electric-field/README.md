# AR Electric Field

One augmented-reality lab for electrostatics, in three modes that share the same
physics and look. Students print barcode markers, point an iPad at them, and see
**electric field lines** (and an optional **potential** height-surface) anchored to
the real scene. The layout is detected once and then **frozen**, so the field shape
stays rigid while the viewpoint moves — the constant AR jitter is gone.

Built with [A-Frame](https://aframe.io) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/)
using robust 3×3 **matrix-code (barcode)** markers — no marker training required.

## The three modes

| Page | Mode | Charge sits… | Shows |
|------|------|--------------|-------|
| `plane.html` | **Plane AR** (live) | **floating 2× the sticker edge above** each flat sticker (`?lift=`) | true 3-D field lines, electron guns, **charged plates** (vertical board, 2× charge) — flat printouts only, no 3-D printer |
| `cube.html`  | **Cube AR** (live)  | at the **cube centre** (each face stepped inward ½ edge, then averaged) | true 3-D field lines, electron guns |
| `photo.html` | **Photo** (static)  | at the marker centre (detected once in a still image) | in-plane field lines, potential surface, a 3-D orbit view that stands the photo up |

Both live modes now show a genuine **3-D** field: the charges' 3-D positions are
recovered from the markers, the field lines are traced in 3-D space, and three.js
projects them through the AR camera. Plane AR lifts the charge above a flat sticker so
you get a 3-D field from paper alone; Cube AR puts it at the centre of a box.

`index.html` is the hub that links all three plus the print pages.

## The jitter fix (how "freeze the shape" works)

This is the core idea the whole lab is built around, in `ar-lock.js`:

1. **Detect & freeze.** Once the markers have been seen steadily for a moment the
   scene **auto-locks**. The charge layout is recorded in a rigid *reference frame*
   and all the field geometry is built **once**. Its shape never changes again.
2. **Recover the viewpoint, averaged.** Every frame, AR.js keeps reading the markers
   only to recover the *camera pose*. Each visible marker gives one (noisy) estimate
   of the reference-frame pose; we **average all of them** into a single pose and
   low-pass filter it over time. So real-world marker error is cancelled by the
   average, the field shape is perfectly rigid, and the scene sits calmly on the desk
   as you move around — fitting the real scene as closely as the markers allow.
3. **Re-scan** any time to capture a new layout.

The same rigid-frame averaging stabilises both the flat markers and the cube faces.
For a cube, every visible face is also stepped inward by ½ the cube edge before being
averaged, so all faces resolve to the **cube centre** where the charge actually sits.

## Markers & encoding

Two **independent** schemes — you only ever run one at a time, so they deliberately
reuse the same barcode values:

**Plane scheme** — `0` positive charge, `1` negative charge, `2` positive electron
gun (fires e⁺), `3` negative electron gun (fires e⁻), `4` positive charged plate,
`5` negative charged plate. A plate raises a square board standing on the desk (side =
4× the marker edge, perpendicular to the desk) carrying a **uniform charge of 2× a
point charge**, modelled as a fine grid of sub-charges so the field is correct.

**Cube scheme** — `0–4` the five faces of the **+** cube, `5–9` the five faces of the
**−** cube, `10` positive electron gun, `11` negative electron gun.

Each electron gun's **firing direction is the arrow printed on its card**, which
echoes the marker's own orientation (the app fires along the marker's local +X axis
projected onto the desk). Both signs of test charge are available: e⁺ and e⁻.

Print pages: `print-plane.html`, `print-cube.html`. Full reference: `encoding.pdf`.

## Run it (HTTPS is required for the camera)

iOS Safari only grants camera access over **https://** (or `http://localhost`).

```bash
cd ar-electric-field
python3 -m http.server 8000   # then open http://localhost:8000 on this machine
```

For an iPad, publish over HTTPS (GitHub Pages, Netlify/Vercel drag-and-drop, or
`ngrok http 8000`), open the page in Safari, and tap **Start camera**. The Photo mode
needs no camera — it works anywhere.

## Tunable URL parameters

`?k=` field strength · `?soft=` field softening · `?height=` / `?hclamp=` potential
scale · `?cube=` cube half-edge in marker-widths (default 1.0) · `?gundir=` rotate the
gun beams (0–3 quarter-turns) · `?pspeed=` `?pforce=` gun particles · `?smooth=` anchor
smoothing (lower = steadier, higher = more responsive) · `?autolock=0` to disable
auto-freeze and lock manually.

## Files

```
index.html         hub (Plane / Cube / Photo)
plane.html         live Plane AR
cube.html          live Cube AR
photo.html         static photo mode
efield-core.js     shared physics + geometry (field lines, potential, guns)
ar-lock.js         the lock-once / averaged-pose AR controllers
print-plane.html   printable plane markers
print-cube.html    printable cube markers
encoding.pdf       full marker-encoding reference
markers/0–11.png   the barcode markers
```

## Credit

Barcode marker images from the open-source
[artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection).
