# Volleyball Serve

Projectile-motion lab. The student sets a launch speed, commits to it by
serving, and then sees the trajectory, whether the ball cleared the net and
where it landed. Two boundaries have to be satisfied at once, which is the
point of the exercise.

## Flow

```
aim ──serve──▶ serve ──ball lands──▶ done ──▶ the coach comments
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

There is a fourth phase, `'demo'`, for the serves the coach plays itself.

The page is deliberately spare: task, animation, speed, coach.
`ui/derivation.js` (step-by-step numbers) and `ui/feedback.js` (a static
coaching panel) are written and tested but not mounted — see *Extension points*.

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

On screen: the task across the top; below it the animation with the speed strip
under it on the left, and the coach on the right. The two columns are exactly
`--work-h` tall (set in `.layout`), so the coach box is fixed and its
conversation scrolls inside rather than stretching the page.

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
    tutor.js          rule-based coaching text (async interface)
    coach-script.js   what the coach says: one async function per situation
    attempts.js       attempt log, scoring, CSV export
  ui/
    scene.js          canvas: court, net, trajectory, phase clock
    player.js         the server: standing wind-up, toss, jump, contact
    controls.js       the speed strip: value, slider, Serve
    coach.js          the coach panel: messages, options, cancellation
    derivation.js     step-by-step working (not mounted)
    feedback.js       verdict + coaching (not mounted)
    theme.js          canvas palette read from CSS variables
tests/
  fake-dom.mjs        shared DOM/canvas stub and manual frame clock
  check.mjs           numerical self-check
  smoke.mjs           full assembly against a fake DOM
  coach-flow.mjs      the coach scripts, with a stub runtime
```

Data flows one way: `config` → `store` → `evaluator` → subscribed UI modules.
UI code never does physics; `core/` never touches the DOM; modules never call
each other, only the store. A new panel is `createXxx(root, store)` plus one
line in `main.js`.

## The coach

The coach is a permanent panel, not a button: it speaks when the page opens and
again after every serve. It can play serves of its own — phase `'demo'`: no
jump, full-speed flight, so several land in a few seconds — and leave earlier
ones on screen as faint grey trails labelled with their speed. Demo serves never
set a verdict and are never logged as attempts; the slider and Serve are locked
while one is in the air. Serving again interrupts whatever the coach was saying.

A script is an async function in `services/coach-script.js`, and reads like the
conversation it produces:

```js
async function netFault({ say, ask, serve, keep, v, result, bounds }) {
  await say(`${v} m/s reached the net only …`);
  const answer = await ask('Was that too fast, or too slow?', [...]); // waits for a click
  if (answer !== tooFastOrSlow(v, bounds)) {
    keep(v, `${v}`);                                                  // hold their path
    for (const s of slowerFamily(v)) await serve(s, { keep: true });   // waits for landing
  }
}
```

`ui/coach.js` supplies that DSL, renders messages and option buttons, and
abandons a running script the moment something else happens.

What it says now:

- **on load** — introduces itself and offers a way in for a student with no idea
  where to start: it serves the default 15 m/s itself and then treats it exactly
  like a serve of their own. Serving cancels the offer.
- **into the net** — names the height the ball reached at the net and how far
  below the tape that is, then asks whether the serve was too fast or too slow.
  Answer "too fast" and it serves five slower speeds in quick succession, keeping
  every path: each one dies lower on the net and the slowest do not even reach
  it. Slower is worse, which is the surprise the question is for. Then it asks
  again and explains that a slower ball spends longer falling on the way to the
  net, so it has to be hit *faster*.
- **how much faster, at least?** — the follow-up, once the student is on
  "faster". The way in is the borderline serve: the slowest one that still
  counts only just gets away with it, so its path must pass through one
  particular point. The coach clears the court, marks three candidates — **A**
  the top of the net, **B** the foot of the net, **C** the far baseline — and
  asks which one. B is corrected as a ball already under the tape; C is
  acknowledged as the *other* limit, where the fastest legal serve lands. The
  answer is A. What happens after that is the next thing to write; the TODO in
  `criticalPoint()` marks the spot.
- **past the baseline** / **in** — one message from the rule-based `tutor.js`.

The markers are clickable: `scene.js` hit-tests them and calls
`coach.answer(id)`, which resolves the question on screen exactly as the buttons
do. So a student can answer by pointing at the court or by pressing a button.

Which answer is "correct" is derived from `bounds.vMin`, not hard-coded, so the
script stays right if the problem data changes.

## Running it locally

ES modules cannot be opened over `file://`, so serve the folder. Browsers cache
module files aggressively, and a plain reload will happily keep running the old
copy of a script you just edited — so serve with caching switched off:

```bash
cd labs/volleyball-serve
python3 -c "
from http.server import SimpleHTTPRequestHandler, test
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        SimpleHTTPRequestHandler.end_headers(self)
test(H, port=5173)
"
```

Otherwise: hard reload (Cmd+Shift+R), or tick *Disable cache* in the DevTools
Network panel. To check which version the browser actually has, run this in the
console — it bypasses the cache and reports on the file itself:

```js
fetch('js/services/coach-script.js', { cache: 'reload' })
  .then((r) => r.text())
  .then((t) => console.log(t.includes('how much faster') ? 'NEW' : 'OLD'));
```

## Tests

```bash
node tests/check.mjs      # boundary speeds, verdict flips, sample table
node tests/smoke.mjs      # assembly + render loop against a stub DOM
node tests/coach-flow.mjs # the coach scripts: both answers, every verdict
```

`package.json` exists only so node treats the `.js` files as ES modules; the lab
itself is plain static files and needs no build step.

## Extension points

- **More coaching** — add an async function to `services/coach-script.js` and
  route to it from `judge()` or `reaction()`. Nothing else changes: the DSL, the
  demo serves, the trails and the clickable markers are already there. The place
  to continue is the TODO in `criticalPoint()`: point A has to become a number —
  the 1.0 m fall from the hand to the tape gives the time to the net, and 9 m
  divided by that time gives the slowest legal speed. After that, the other
  boundary (point C) is still untouched.
- **Bring back the Working panel** — add a `<section class="panel" id="…">`
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
