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
  wind-up is a direct read-out of the slider. The working panel shows dashes
  and there is no verdict: the answer cannot be read off by dragging.
- **serve** — toss, jump, contact exactly at the apex (the hand reaches
  3.2 m), then the ball flies at half speed with the path drawn progressively.
  The slider is locked while the ball is in the air.
- **done** — the full path, the landing mark, the working and the coaching
  appear. The serve is logged automatically. Moving the slider returns to aim.

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
- legal window **20.1 – 22.5 m/s**; whole-number answers are 21 and 22 m/s

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
    attempts.js       attempt log, scoring, CSV export
  ui/
    scene.js          canvas: court, net, trajectory, phase clock
    player.js         the server: standing wind-up, toss, jump, contact
    controls.js       slider and buttons
    derivation.js     live working
    feedback.js       verdict + coaching
    theme.js          canvas palette read from CSS variables
tests/
  check.mjs           numerical self-check
  smoke.mjs           full assembly against a fake DOM
```

Data flows one way: `config` → `store` → `evaluator` → subscribed UI modules.
UI code never does physics; `core/` never touches the DOM; modules never call
each other, only the store. A new panel is `createXxx(root, store)` plus one
line in `main.js`.

## Tests

```bash
node tests/check.mjs    # boundary speeds, verdict flips, sample table
node tests/smoke.mjs    # assembly + render loop against a stub DOM
```

`package.json` exists only so node treats the `.js` files as ES modules; the lab
itself is plain static files and needs no build step.

## Extension points

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

- x and y share one scale on the canvas, so the parabola is undistorted; the
  cost is that a 0.2 m clearance over the net is only about 9 px on screen.
- Air resistance is ignored. For a real volleyball it is not negligible — worth
  raising in class.
- Judgement: clearing the net is strict (grazing counts as a fault); a ball
  landing exactly on the baseline counts as in.
- `screenshot.png` is a composed mock-up at the same 1200×750 as the other lab
  cards; replace it with a real browser capture whenever convenient.
