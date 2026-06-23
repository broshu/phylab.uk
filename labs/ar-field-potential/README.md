# AR Field &amp; Potential

A browser-based augmented-reality demo for electrostatics. Students scatter printed
charge cards on a desk, point an iPad camera at them, and see the **electric field
lines** and the **potential** (drawn as a height surface) anchored to the tabletop.

Built with [A-Frame](https://aframe.io) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/)
using robust 3×3 **matrix-code (barcode)** markers — no marker training required.

## How to use

1. Open `print-cards.html`, print the sheet, and cut out the cards.
2. Lay any number of **+** (red) and **−** (blue) cards flat on a desk.
3. Open `index.html` in **Safari on an iPad** (camera needs HTTPS), tap **Start camera**,
   and point it at the cards.
4. Use the bottom buttons to toggle **Grid**, **Field lines**, and **Potential**.

## What it does

- **Plane fitting.** Every card lies on the same surface (the desk). With one card the
  app uses that card's own plane; with two it averages their normals; with **three or
  more** it computes the least-squares best-fit plane (PCA on the card positions), which
  is the most accurate. The plane is smoothed over time to remove jitter, and a
  translucent tech grid is laid on it.
- **Field lines.** Because all charges lie in the plane, the field at any in-plane point
  is also in-plane, so the lines are traced exactly within the surface. They leave
  positive charges, curve into negative charges, and carry arrowheads showing direction
  (out of **+**, into **−**).
- **Potential surface.** A mesh is displaced perpendicular to the plane by the local
  potential V = Σ k·q/r. Positive charges raise a sharp **hill** (the peak is pointed,
  as the math demands); negative charges sink a **funnel well** whose opaque dark core
  masks the desk behind it — a "black hole" — ringed by a glowing rim.

## Marker scheme

| Use | Barcode values |
|-----|----------------|
| Positive cards (+) | `1, 2, 3, 4, 5, 6` |
| Negative cards (−) | `7, 8, 9, 10, 11, 12` |

Each physical card has a **distinct** code, which is what lets AR.js track many cards at
the same time. One printed sheet gives up to 12 simultaneous charges; print more codes
(or duplicate carefully) for larger arrays.

## Tunable URL parameters

`?k=` Coulomb strength · `?soft=` softening radius · `?height=` potential→height scale ·
`?hclamp=` max surface height. Example: `index.html?height=0.8&soft=0.12`.

## Run locally (HTTPS required for the camera)

iOS Safari only grants camera access over **https://** (or `http://localhost`).

```bash
cd ar-field-potential
python3 -m http.server 8000   # then open http://localhost:8000 on this machine
```

For an iPad, publish over HTTPS (GitHub Pages, Netlify/Vercel, or `ngrok http 8000`).
