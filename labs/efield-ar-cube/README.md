# AR Point Charge — Cube

A browser-based AR lab that anchors a **positive point charge at the geometric centre of a
physical cube**. The cube stands on a post on the table; five of its faces (top + four sides,
not the bottom) carry the same printed marker. Aim an iPad at *any* face and the charge — with
its electric field radiating outward — appears floating inside the cube.

This is the "solid" version of the flat `efield-ar` marker app.

## Why one marker on all five faces

Each AR.js barcode marker reports a full 6-DOF pose, with the marker's outward normal as its
local **+Y** axis. The charge is drawn at local `(0, −offset, 0)` — i.e. straight *into* the
cube by `offset` (half the cube edge). Because every face uses the **same** marker and the same
inward offset, all five faces resolve to the **same world point**: the cube centre. So whichever
face the camera locks onto, the charge stays put — no need to tell the faces apart.

Distinct markers per face would let you fuse several faces at once for slightly smoother
tracking, but they aren't required for this goal and aren't bundled here.

## Files

- `index.html` — the AR application.
- `stickers.html` — print / download page for the five (identical) face markers.
- `markers/0.png` — the barcode marker (value 0).
- `README.md` — this file.

## Run it (HTTPS is required for camera access)

iOS Safari only grants camera access over **https://** (or `http://localhost`).

```bash
cd efield-ar-cube
python3 -m http.server 8000
# open http://localhost:8000 on the same machine
```

For the iPad you need HTTPS — GitHub Pages, Netlify/Vercel drag-and-drop, or `ngrok http 8000`.
Then open the https URL in Safari and tap **Start camera**.

## Make the cube

1. Open `stickers.html`, set the **black-square width** to fit your cube face (leave white
   margin on all sides — that quiet zone is what the camera locks onto), then **Print** at
   100% / actual size, or **Download** the PNG.
2. Stick one marker on each of the five faces, centred and flat. In-plane orientation doesn't
   matter (the field is spherically symmetric).
3. Mount the cube on the post; stand it on the table.

## Calibrate the centre

In the app, the **offset** control sets how far behind a face the charge sits, in *marker-width*
units:

```
offset ≈ (half the cube edge) ÷ (marker black-square width)
```

e.g. a 70 mm cube with a 50 mm marker → 35 ÷ 50 ≈ **0.70**. Tick **show cube guide** to display
a wireframe box of edge `2 × offset`; adjust until the box matches your real cube, and the charge
will sit dead centre.

## Tips for stable tracking

- Even, bright lighting; avoid glare on the paper.
- Matte (non-glossy) faces; markers pressed flat with no curl.
- Bigger markers track from farther away — don't make the cube tiny.
- Keep at least one full face (with its white border) in frame; hold the iPad ~20–50 cm away.

## Credit

Barcode marker from the open-source
[artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection).
Built with [A-Frame](https://aframe.io) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/).
