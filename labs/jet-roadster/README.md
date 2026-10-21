# Jet Roadster · PhyLab

A playable 3D lab on momentum and circular motion. The player drives a 2000 kg car that carries 90 kg of compressed air: accelerate on a frictionless ice straight, then hold a quarter-circle curve with static friction plus a side jet — or skid off. Static page; Three.js 0.180.0 is bundled in `vendor/`, no CDN, fonts, backend or data collection.

## Playing

- Hold **↑ / W** (or the *Tail jet* button) to fire the tail jet: 20 kN, 40 kg/s.
- Hold **← / A** (or *Side jet*) for the side jet, which exhausts outward and pushes the car toward O. **Q / E** or the slider set its power (0–20 kN, 2 kg/s per kN).
- **Space** pause · **R** restart · **V** cycle cameras: *Chase*, *Cockpit* (driver's view with a dashboard: speed, air reserve, flow, jet lamps, grip), *Overview* (drag to orbit), *Top*.
- Time runs at 0.5× by default (0.25×–1× selectable). The tab pauses when hidden. Best times are kept per fan setting in the browser.
- **Side-jet interlock** (on by default): holding ← before B arms the jet and it fires the moment the car enters the curve. Turned off, the jet fires anywhere — on the ice it gives a sideways drift that nothing can cancel.
- **Autopilot**: *Ideal plan* replays the optimal allocation with the same physics as the player; *All air on the straight* shows the skid at B.

URL parameters: `?embed=1` hides the header, `fan=0` starts with the fan off, `interlock=0` starts with the interlock off.

## Model

m = 2000 kg (constant), g = 10 m/s², u = 500 m/s, μ = 0.1, AB = 45 m, R = 20 m, road 6 m wide. Fan suction adds 2mg to N and uses no air. No drag or rolling resistance; nozzle exit pressure equals ambient, so F = u·Δm/Δt.

- **Ice** (x < 0): no friction. Tail thrust along the lane; side thrust toward the inner edge. Leaving |z| > 3 m ends the run; reaching B with any sideways velocity means the tyres are already sliding.
- **Curve**: the tyres roll freely along the lane, so friction acts only across it. While they grip, static friction supplies f = mv²/r − S, allowed only while |f| ≤ μN. Outside the window mv²/r − μN ≤ S ≤ mv²/r + μN the tyres slide: friction becomes kinetic (μN, against the slide), the jets cut and the run is lost (a skidding car cannot be steered back onto the arc). Beyond the road edge the run-off is frictionless.
- The game uses true circle geometry (π = 3.14159…). Ideal plan with the fan on: v = 11.85 m/s, 47.4 kg + 42.6 kg, 7.04 s. The notes on the page also give the textbook π = 3 answer (v = 12 m/s, 48 + 42 kg, 6.85 s).
- Integration step 1/600 s; constant-force steps are exact on the ice and exact rolling on the arc. Making a curve skid a loss is what keeps the ideal plan the true optimum: if the car could slide outward and regain grip, faster entries would beat it.

## Files

- `physics.js` — closed-form plans (textbook π = 3 or true π), used for par times and the notes.
- `sim.js` — real-time model: jets, ice, static/kinetic friction, skid and run-off, autopilots.
- `scene.js` — Three.js scene in the site palette (light and dark), cameras, exhaust, trail, force arrows.
- `app.js` — input, HUD, dashboard, results. `style.css` — layout on top of `/assets/theme.css`.
- Tests: `npm test` (or `node --test tests/physics.test.mjs tests/sim.test.mjs`) — budgets, autopilot reaching C at par with an empty tank, no burn/coast/side-jet strategy beating par, the friction window, ice drift, gas never negative.

The car is a generic, procedurally built roadster shape for teaching. Three.js is MIT-licensed, see `vendor/LICENSE-three.txt`. References: [NASA thrust equation](https://www.grc.nasa.gov/WWW/k-12/BGP/thrsteq.html), [OpenStax centripetal force](https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force).
