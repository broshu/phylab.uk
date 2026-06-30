# AR Electric Field Lines

A browser-based augmented-reality app for teaching electric fields. Students point an
iPad camera at printed charge markers and see 3D electric field lines anchored in space.

- Scan the **+** marker → field lines radiate **outward**.
- Scan the **−** marker → field lines converge **inward**.
- Show **both markers at once** → a **dipole** field flows from + to −.

Built with [A-Frame](https://aframe.io) + [AR.js](https://ar-js-org.github.io/AR.js-Docs/)
using robust 3×3 **barcode** markers (no marker training required).

## Files

- `index.html` — the AR application.
- `print-flat.html` — printable **flat** scheme: lay the + / − tiles on a desk.
- `print-cube.html` — printable **cube** scheme: stickers for a small box.
- `print-cube-net.html` — printable fold-up cube nets (cardstock).
- `print-markers.html` — minimal printable page with just the flat + / − markers.
- `markers/0.png … 11.png` — the barcode markers (see scheme below).
- `README.md` — this file.

## Marker scheme

| Use | Value(s) | Meaning |
|-----|----------|---------|
| Flat + | `0` | positive charge, charge sits AT the marker |
| Flat − | `1` | negative charge, charge sits AT the marker |
| Cube + | `2,3,4,5,6` | one per face of the + cube |
| Cube − | `7,8,9,10,11` | one per face of the − cube |

A cube uses **five different** markers (one per visible face). Each face
reports its own pose; the app offsets every face inward along its normal by
half the cube edge, so all faces resolve to the **same point — the cube
centre** — where the charge actually is. This (a) puts the field at the
centre instead of on a face, and (b) removes the position jump you'd get
when the camera switches between two identical faces while circling the cube.

The inward offset is `?cube=` in the URL — the cube half-edge in marker-width
units, default `1.0` (a cube whose edge ≈ 2× the printed marker's black
square). The fold-up nets are pre-sized for this default.

## Run it (HTTPS is required for camera access)

iOS Safari only grants camera access over **https://** (or `http://localhost`).

Quick local test on a computer:

```bash
cd efield-ar
python3 -m http.server 8000
# open http://localhost:8000 on the same machine
```

To use on an iPad you need HTTPS. Easiest options:

- **GitHub Pages**: push this folder to a repo, enable Pages — you get an https URL.
- **Netlify / Vercel**: drag-and-drop the folder for an instant https URL.
- **ngrok**: `ngrok http 8000` to expose your local server over https.

Then open that https URL in **Safari on the iPad** and tap **Start camera**.

## Print the markers

Open `print-markers.html` in any browser and click **Print**. Print on plain white paper.

**Important:** keep the white border around each black square — that quiet zone is what
lets the camera lock onto the marker. Don't crop it tight. Cut the two markers apart so
students can move + and − independently.

## How it works

Each frame the app reads the world position of any visible marker and integrates field
lines through space using Coulomb's law, `E = Σ q·(r−rᵢ)/|r−rᵢ|³`. Lines are seeded on a
small sphere around each charge and traced along the field direction, then drawn as
coloured 3D tubes (red = +, blue = −) with arrowheads showing direction. When both markers
are visible the two charges are combined into a dipole and the lines connect + to −.

## Tips for stable tracking

- Use even, bright lighting; avoid glare on the paper.
- Lay markers flat on a matte (non-glossy) surface.
- Keep markers fully in frame; hold the iPad ~20–50 cm away.
- A larger printed marker tracks from farther away.

## Credit

Barcode marker images from the open-source
[artoolkit-barcode-markers-collection](https://github.com/nicolocarpignoli/artoolkit-barcode-markers-collection).
