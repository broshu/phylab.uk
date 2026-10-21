# Jet Roadster · PhyLab

A playable 3D lab on momentum, friction and circular motion, in two modes:

- **Challenge**: a 2000 kg car with 90 kg of compressed air. Accelerate on a frictionless ice straight, then hold a quarter-circle curve with static friction plus a side jet, or skid off.
- **Free drive**: the same car with steering and brakes on an open field: the ice straight and curve, a round ice rink, a 20 m circle and a slalom. Steering and brakes work by friction, so they do nothing on ice.

Static page; Three.js 0.180.0 is bundled in `vendor/`. No CDN, fonts, backend or data collection.

## Playing

Challenge: hold **↑ / W** for the tail jet (20 kN, 40 kg/s); hold **← / A / Q** for the side jet, which pushes toward O. **[ / ]** or the slider set side power (0–20 kN, 2 kg/s per kN). The side-jet interlock (on by default) arms the jet early and opens it at B. Autopilot: *Ideal plan* and *All air on the straight*.

Free drive: **↑** tail jet · **↓** brake · **← →** steer · **Q / E** side jets pushing left / right · **R** back to start. Air is unlimited unless *Limited air* is on.

Both: **Space** pause · **V** cycle cameras (*Chase*, *Cockpit* with dashboard, *Overview*, *Top*) · on-screen buttons for touch. URL parameters: `?mode=free`, `embed=1`, `fan=0`, `interlock=0`, `air=limited`.

## Model

All numbers live in `constants.js`. m = 2000 kg (constant), g = 10 m/s², u = 500 m/s, μ = 0.1, AB = 45 m, R = 20 m, road 6 m wide. The fan adds 2mg to N and uses no air. No drag or rolling resistance; F = u·Δm/Δt.

**Challenge** (`sim.js`). Ice for x < 0: no friction. On the curve the tyres roll along the lane and friction acts only across it: static, f = mv²/r − S, while |f| ≤ μN. Outside mv²/r − μN ≤ S ≤ mv²/r + μN the tyres slide, friction becomes kinetic and the run is lost. A side jet on the ice leaves a sideways drift. The game uses true circle geometry: ideal plan with the fan on is 11.85 m/s, 47.4 + 42.6 kg, 7.04 s; the notes also give the textbook π = 3 answer (12 m/s, 48 + 42 kg, 6.85 s). Making a curve skid a loss keeps the ideal plan the true optimum.

**Free drive** (`drive.js`). Point mass with a heading. The tyres can push in any horizontal direction, at most μN in total (friction circle). Each step asks for the force that keeps the car rolling where its wheels point, turning about radius r = L / tan δ (wheelbase L = 4 m, δ ≤ 0.5 rad, steering moves at 1.8 rad/s). If that force is within μN, friction is static and the car rolls without slipping; otherwise friction is μN against the slide. Brakes ask for 70 % of μN. On ice μ = 0. The field is fenced; cones are markers that topple but do not push back.

## Files

- `constants.js`: every model number and the free-drive world layout.
- `physics.js`: closed-form textbook plan (par times, notes, tests).
- `sim.js` / `challenge.js`: challenge model and its page adapter (readout, view model, results).
- `drive.js` / `free.js`: free-drive model and its page adapter.
- `scene.js`: Three.js scene drawn from a plain view model; site palette in light and dark.
- `app.js`: page shell: mode switching, input, frame loop, HUD. `style.css` sits on `/assets/theme.css`.
- `npm test`: textbook plan, challenge sim (autopilot at par, no strategy beats par, friction window, ice drift), free drive (grip limit, brakes, ice, fan, side jets, fence), and a check that every local import has the same `?v=` tag.
- `npm run bump`: after editing any file, sets a fresh `?v=` tag everywhere so browsers do not mix cached and new modules.

The car is a generic, procedurally built roadster shape. Three.js is MIT-licensed, see `vendor/LICENSE-three.txt`. References: [NASA thrust equation](https://www.grc.nasa.gov/WWW/k-12/BGP/thrsteq.html), [OpenStax centripetal force](https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force).
