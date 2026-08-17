# Volleyball Serve

Projectile-motion lab. The student sets a launch speed, commits to it by
serving, and then sees the trajectory, whether the ball cleared the net and
where it landed. Two boundaries have to be satisfied at once, which is the
point of the exercise.

## Flow

```
aim ──serve──▶ serve ──ball lands──▶ done
 ▲                                    │
 └────────── move the slider ─────────┘
```

- **aim** — nothing has been served. The player stands on the floor and the
  hitting arm is drawn further back the larger the chosen speed, so the
  wind-up is a direct read-out of the slider. No trajectory and no verdict:
  the answer cannot be read off by dragging.
- **serve** — toss, jump, contact exactly at the apex (the hand reaches
  3.2 m), then the ball flies at half speed with the path drawn progressively.
  The slider is locked while the ball is in the air.
- **done** — the full path, the landing mark and the verdict appear. The serve
  is logged automatically. Moving the slider returns to aim.

The page itself is deliberately spare: task, speed, animation. `ui/derivation.js`
(step-by-step numbers) and `ui/feedback.js` (coaching text) are written and
tested but not mounted — see *Extension points*.

## Problem data

| quantity | value |
|---|---|
| contact height h | 3.2 m |
| net height | 2.2 m |
| server → net | 9 m |
| server → far baseline | 18 m |
| g | 10 m/s² |

- time of flight t = √(2h/g) = 0.80 s, **independent of v**
- upper bound (stay in): 18 ÷ 0.8 = **22.5 m/s**
- lower bound (clear the net): the ball may fall 1.0 m before the net, so
  t₁ = √0.2 s and v = 9 ÷ t₁ = 9√5 ≈ **20.12 m/s**
- legal window **20.1 – 22.5 m/s**; the slider runs 0–30 m/s in steps of 1, so
  the whole-number answers a student can land on are 21 and 22 m/s

A window this narrow is a real feature of the physics: with a 2.43 m men's net
a horizontal serve from the baseline needs a contact point above 3.24 m, which
is why actual serves are hit with topspin and a downward angle rather than flat.

## Layout

```
index.html            markup only, no logic
css/style.css         PhyLab tokens + dark mode
js/
  main.js             assembly: wires config, core, services and UI together
  config/problem.js   the single source of question data
  core/
    physics.js        projectile model, pure functions, testable in node
    evaluator.js      both boundaries → one result object
    state.js          tiny store (get / set / subscribe)
  services/
    tutor.js          coaching text (rule-based today, async interface)
    help-script.js    what the tutor says: one async function per branch
    attempts.js       attempt log, scoring, CSV export
  ui/
    scene.js          canvas: court, net, trajectory, phase clock
    player.js         the server: standing wind-up, toss, jump, contact
    controls.js       speed slider, Serve and Help
    help.js           the tutor dialogue: messages, options, ✕
    derivation.js     step-by-step working (not mounted)
    feedback.js       verdict + coaching (not mounted)
    theme.js          canvas palette read from CSS variables
tests/
  fake-dom.mjs        shared DOM/canvas stub and manual frame clock
  check.mjs           numerical self-check
  smoke.mjs           full assembly against a fake DOM
  help-flow.mjs       the tutor script, with a stub runtime
```

Data flows one way: `config` → `store` → `evaluator` → subscribed UI modules.
UI code never does physics; `core/` never touches the DOM; modules never call
each other, only the store. A new panel is `createXxx(root, store)` plus one
line in `main.js`.

## The tutor (Help)

Help turns the Speed block into a conversation; the ✕ in its corner turns it
back into the slider, restoring the speed the student had set. The tutor can
play its own serves — phase `'demo'`: no jump, full-speed flight, so several
land in a few seconds — and can leave earlier ones on screen as faint trails.
Demo serves never set a verdict and are never logged as attempts.

A branch is an async function in `services/help-script.js`, written as a script:

```js
async function coldStart({ say, ask, serve, problem, bounds }) {
  await say('…');
  const first = await serve(15, { keep: true, label: '15' });  // resolves on landing
  const answer = await ask('Too fast or too slow?', [...]);    // resolves on click
}
```

`ui/help.js` supplies that DSL, renders the messages and buttons, and cancels a
running script if the panel is closed mid-sentence. `pickBranch()` chooses the
script from what the student has done, so Help means different things at
different moments.

Implemented so far:

- **cold-start** (no serves yet) — offers to just try something, serves the
  default 15 m/s, then asks whether that was too fast or too slow. Answer "too
  fast" and it serves 14, 13, 12, 11, 10 in quick succession, keeping every
  path: each one dies lower on the net and the last two do not even reach it.
  Slower is worse, which is the point. Then it asks again and explains that a
  slower ball spends longer falling on its way to the net.
- **after-serves** — provisional: replays the rule-based hint from `tutor.js`
  for the last serve. This is the next branch to write properly.

Which answer is "correct" is derived from `bounds.vMin`, not hard-coded, so the
script stays right if the problem data changes.

## Tests

```bash
node tests/check.mjs      # boundary speeds, verdict flips, sample table
node tests/smoke.mjs      # assembly + render loop against a stub DOM
node tests/help-flow.mjs  # the tutor script, both answers, closing early
```

`package.json` exists only so node treats the `.js` files as ES modules; the lab
itself is plain static files and needs no build step.

## Extension points

- **More tutor branches** — add an async function to `services/help-script.js`
  and a case to `pickBranch()`. Nothing else changes: the DSL, the demo serves
  and the trails are already there.
- **Bring back Working / Coaching** — add a `<section class="panel" id="…">`
  to `index.html` and one line to `main.js`:
  `createDerivation(document.querySelector('#derivation'), store)` or
  `createFeedback(document.querySelector('#feedback'), store, { tutor, attempts })`.
  The CSS they need is still in `style.css`, in its own labelled block.
- **Boundary paths** — `scene.js` still draws the two limiting trajectories
  when `showGhosts` is true in the store; there is simply no control for it.
  `__vb.store.set({ showGhosts: true })` in the console turns it on.
- **Real model instead of the rule-based tutor** — replace the body of
  `createTutor()`; keep returning `{title, body, level, scaffold?}`.
  `feedback.js` already awaits it and discards stale responses.
- **Report attempts to a server** — replace `save()` in `attempts.js`;
  `record/summary/toCSV` are the stable interface.
- **More steps in the working panel** — add a `row(label, value, ok)` call.
- **Change the figure** — `player.js` is self-contained: body proportions in
  `BODY`, timing in `SERVE_TIMELINE`, and the wind-up mapping in
  `hitArmAngle()`. It is handed a world→screen transform and draws itself, so
  nothing else needs to know how the player is built. The jump height is
  derived from the contact height, so raising `hitHeight` makes the player
  jump higher rather than breaking the contact point.
- **More scenarios** — add an entry to `PROBLEMS` in `config/problem.js`.
  `problem.adjustable` is already there for levels where the student is allowed
  to change the contact height or net height and watch the window move.

## Notes

- The canvas is the framed box itself (no panel wrapper), stretched by the grid
  row to the same footprint as the Speed panel. `scene.js` measures that cell
  and never assumes an aspect ratio, so it adapts to any size; because x and y
  share one scale the court is anchored to the bottom and the spare height
  becomes sky, which is the panel colour and so reads as padding.
- x and y share one scale on the canvas, so the parabola is undistorted; the
  cost is that a 0.2 m clearance over the net is only about 11 px on screen.
- Air resistance is ignored. For a real volleyball it is not negligible — worth
  raising in class.
- Judgement: clearing the net is strict (grazing counts as a fault); a ball
  landing exactly on the baseline counts as in.
- `screenshot.png` is a composed mock-up at the same 1200×750 as the other lab
  cards; replace it with a real browser capture whenever convenient.
