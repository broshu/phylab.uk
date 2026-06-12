# Electric Field Lines Visualization

A pure front-end demo of the electric field lines of two point charges. Drag charges, flip polarity, adjust magnitude, and optionally display equipotential lines.

## Features
- Drag the two charges on the canvas; positions scale proportionally when the canvas resizes
- Add more charges with one click, with the field superposed in real time
- Sliders adjust charge magnitude; buttons toggle polarity
- Optional equipotential lines (Marching Squares algorithm)
- Field lines with color gradient and direction arrows
- Responsive layout for desktop and mobile
- "Launch from Point M" test-charge motion card: switch charge polarity, set initial speed/direction, and view velocity vector, force vector, and trajectory in real time

## Usage
Open `index.html` directly in a browser — no build step or dependencies required.

## Interactions
- Magnitude slider: adjust each charge's strength
- Polarity button: toggle between positive and negative
- Reset button: restore default positions and magnitudes
- Add Charge: adds a default positive charge, draggable and adjustable
- Show equipotential lines: renders equipotential lines to visualize equipotential surfaces

## Technical Notes
- Canvas 2D rendering
- Field superposition with a softening term to avoid singularities
- Marching Squares equipotential extraction
- Responsive layout and drag interactions
