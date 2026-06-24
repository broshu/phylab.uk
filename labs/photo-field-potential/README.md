# Photo Field &amp; Potential

A **still-photo** companion to the live AR lab. Instead of a shaky live camera feed, you
upload a single photo of the charge cards on a desk. The cards are detected **once** in
the image, so the result is completely stable — no AR jitter — which makes it ideal for
testing and for capturing clean screenshots.

It uses the **same printed cards** as the AR lab (no reprinting).

## How to use

1. Print and lay out the cards (see the AR lab's `print-cards.html`):
   positive `1–5`, negative `7–11`, **positive gun** `0`, **negative gun** `12`.
2. Photograph them on a desk from roughly above, sharp and evenly lit.
3. Open this page, tap **Upload a photo**, and pick the image.
4. Toggle **Grid / Field lines / Potential**, or tap **New photo** to try another.

## What it shows

- **Plane fit** — one card uses its own plane; three or more use the least-squares
  best-fit plane (PCA). A translucent tech grid is laid on it.
- **Field lines** traced in the plane, from + to −, with direction arrows.
- **Potential surface** — height = V; positive charges raise sharp hills, negative
  charges sink dark "black-hole" wells.
- **Particle guns** — the + gun fires + test charges, the − gun fires − test charges.
  Each test charge's full trajectory is integrated under F = qE and drawn as a faint
  line, with animated dots travelling along it. In the potential view the dots ride the
  surface (because a charge's potential energy U = qV equals the surface height).

## How detection works

The page reuses AR.js in **still-image mode** (`sourceType: image`): the uploaded photo
is loaded as a Blob URL and the 3×3 matrix codes are decoded from it. Because the image
never changes, every charge's position is fixed and the visualization never flickers.

For best detection: a near top-down angle, no motion blur, even lighting, no glare on the
codes, and keep the white border (quiet zone) around each code visible.

## Tunable URL parameters

`?k=` field strength · `?soft=` softening · `?height=` / `?hclamp=` potential surface
scale · `?pspeed=` `?pforce=` gun particle speed/deflection · `?gundir=1` rotate the beams.
