/**
 * The coach's teaching sequence.
 *
 * A serve is only the starting observation. The coach takes the student to
 * the two limiting paths that define the answer:
 *
 *   A: slowest legal serve, at the top of the net  → v > vMin
 *   C: fastest legal serve, at the far baseline    → v ≤ vMax
 *
 * The surrounding UI supplies a small async DSL. Keeping this file concerned
 * with teaching decisions and language makes the sequence easy to read, test,
 * and change without coupling it to DOM or canvas code.
 */
import { flightTime, timeToFall } from '../core/physics.js';

const fmt = (x, n = 2) => Number(x).toFixed(n);

const textPart = (text) => ({ type: 'text', text });
const mathPart = (tex, fallback, display = false) => ({
  type: 'math',
  tex,
  fallback,
  display,
});
const rich = (...parts) => ({ parts });

const FAST_SLOW = [
  { id: 'fast', label: 'Faster' },
  { id: 'slow', label: 'Slower' },
];

const POINTS = (problem) => [
  { id: 'A', x: problem.netDistance, y: problem.netHeight },
  { id: 'B', x: problem.netDistance, y: 0 },
  { id: 'C', x: problem.courtEnd, y: 0 },
];

const POINT_CHOICES = [
  { id: 'A', label: 'A — the top of the net', reply: 'A' },
  { id: 'B', label: 'B — the foot of the net', reply: 'B' },
  { id: 'C', label: 'C — the far baseline', reply: 'C' },
];

function slowerFamily(v, min) {
  const speeds = [];
  for (let speed = v - 1; speed >= Math.max(min, v - 5); speed--) speeds.push(speed);
  return speeds;
}

function pointCorrection(id, target) {
  if (id === 'B') {
    return 'B is below the tape: a ball passing there is already in the net, so it is not legal.';
  }
  if (target === 'A' && id === 'C') {
    return 'C is a real boundary, but it belongs to the fastest legal serve. We are finding the slowest one.';
  }
  if (target === 'C' && id === 'A') {
    return 'A is the other boundary: it sets the slowest legal serve. We are finding the fastest one.';
  }
  return 'That point does not describe the limiting serve we are looking for.';
}

async function chooseBoundaryPoint(dsl, target) {
  const { say, ask, mark, clearCourt, problem } = dsl;
  const isLower = target === 'A';

  clearCourt();
  mark(POINTS(problem));
  await say('The marked points can also be selected directly on the court.');

  const question = isLower
    ? 'Which point does the slowest legal serve just pass through?'
    : 'Which point does the fastest legal serve just pass through?';
  let answer = await ask(question, POINT_CHOICES);

  if (answer !== target) {
    await say(pointCorrection(answer, target));
    answer = await ask(`So which point fixes the ${isLower ? 'slowest' : 'fastest'} legal serve?`, POINT_CHOICES);
  }

  // A second miss should not strand the learner without a route forward. Use
  // the limiting point explicitly, then continue the derivation from it.
  if (answer !== target) {
    await say(`We will use ${target}: it is the ${isLower ? 'slowest' : 'fastest'} legal path's boundary point.`);
    answer = target;
  }

  await say(`Yes — ${target}.`);
  return answer;
}

/** Derive the strict lower bound from the trajectory through A. */
async function teachLowerBound(dsl) {
  const { say, ask, serve, mark, guide, clearCourt, problem, bounds } = dsl;
  const drop = problem.hitHeight - problem.netHeight;

  await say('Now find the minimum speed: the borderline path must go through A, the top of the net.');
  await chooseBoundaryPoint(dsl, 'A');

  await say('Watch the limiting serve. I will hide its speed: it just reaches A.');
  clearCourt();
  mark([{ id: 'A', x: problem.netDistance, y: problem.netHeight }]);
  guide([
    {
      kind: 'horizontal',
      x1: 0,
      x2: problem.netDistance,
      y: problem.hitHeight,
      label: `horizontal distance · ${problem.netDistance} m`,
    },
    {
      kind: 'vertical',
      x: problem.netDistance + 0.55,
      y1: problem.netHeight,
      y2: problem.hitHeight,
      label: `vertical fall · ${fmt(drop, 1)} m`,
    },
  ]);
  await serve(bounds.vMin, { animatePlayer: true, hideSpeed: true });
  await say('The dashed lines show the horizontal distance and the vertical fall for that exact path.');
  await say('How could you calculate its speed? What do you think the hidden speed is?');

  const choices = [
    { id: 'distance', label: `${fmt(problem.netDistance, 1)} m/s`, reply: `${fmt(problem.netDistance, 1)} m/s` },
    { id: 'minimum', label: `${fmt(bounds.vMin, 1)} m/s`, reply: `${fmt(bounds.vMin, 1)} m/s` },
    { id: 'maximum', label: `${fmt(bounds.vMax, 1)} m/s`, reply: `${fmt(bounds.vMax, 1)} m/s` },
    { id: 'double', label: `${fmt(bounds.vMin * 2, 1)} m/s`, reply: `${fmt(bounds.vMin * 2, 1)} m/s` },
  ];
  let answer = await ask('What is the speed of the serve that just reaches A?', choices);

  if (answer !== 'minimum') {
    const tNet = timeToFall(drop, problem.g);
    const tRounded = fmt(tNet, 3);
    const vRounded = fmt(bounds.vMin, 1);
    await say({
      text: 'Write it in two steps:',
      tex: String.raw`\begin{aligned}
        t &= \sqrt{\frac{2 \times ${fmt(drop, 1)}}{${problem.g}}} \approx ${tRounded}\,\mathrm{s} \\
        v &= \frac{${problem.netDistance}}{${tRounded}} \approx ${vRounded}\,\mathrm{m/s}
      \end{aligned}`,
      fallback:
        ` t = √(2 × ${fmt(drop, 1)} / ${problem.g}) ≈ ${tRounded} s; ` +
        `v = ${problem.netDistance} ÷ ${tRounded} ≈ ${vRounded} m/s`,
    });
    answer = await ask('Using that calculation, what is the speed that just reaches A?', choices);
  }

  if (answer === 'minimum') {
    await say(`Yes. The hidden speed is ${fmt(bounds.vMin, 1)} m/s.`);
  } else {
    await say(`The limiting speed is ${fmt(bounds.vMin, 1)} m/s.`);
  }
  await say(`Touching the tape is a fault, so the lower condition is v > ${fmt(bounds.vMin, 1)} m/s.`);
}

/** Derive the inclusive upper bound from the trajectory through C. */
async function teachUpperBound(dsl) {
  const { say, problem, bounds } = dsl;

  await say('There is a second boundary: how fast can the serve be before it lands beyond the far baseline?');
  await chooseBoundaryPoint(dsl, 'C');
  const tLand = flightTime(problem.hitHeight, problem.g);
  await say(
    rich(
      textPart(`The ball always falls from ${fmt(problem.hitHeight, 1)} m to the floor in `),
      mathPart(
        String.raw`t = \sqrt{\frac{2 \times ${fmt(problem.hitHeight, 1)}}{${problem.g}}} = ${fmt(tLand)}\,\mathrm{s}`,
        `t = √(2 × ${fmt(problem.hitHeight, 1)} / ${problem.g}) = ${fmt(tLand)} s`,
      ),
      textPart('. That time does not depend on speed.'),
    ),
  );
  await say(
    rich(
      textPart(`At the limit it travels ${problem.courtEnd} m, so `),
      mathPart(
        String.raw`v_{\max} = \frac{${problem.courtEnd}}{${fmt(tLand)}} = ${fmt(bounds.vMax, 1)}\,\mathrm{m/s}`,
        `v_max = ${problem.courtEnd} ÷ ${fmt(tLand)} = ${fmt(bounds.vMax, 1)} m/s`,
      ),
      textPart('. A ball on the baseline is in, so '),
      mathPart(
        String.raw`v \le ${fmt(bounds.vMax, 1)}\,\mathrm{m/s}`,
        `v ≤ ${fmt(bounds.vMax, 1)} m/s`,
      ),
      textPart('.'),
    ),
  );
}

async function finishWindow(dsl) {
  const { ask, say, bounds } = dsl;
  const min = fmt(bounds.vMin, 1);
  const max = fmt(bounds.vMax, 1);

  await say(
    rich(
      textPart('Both conditions must hold: '),
      mathPart(String.raw`v > ${min}\,\mathrm{m/s}`, `v > ${min} m/s`),
      textPart(' and '),
      mathPart(String.raw`v \le ${max}\,\mathrm{m/s}`, `v ≤ ${max} m/s`),
      textPart('.'),
    ),
  );
  await say(
    rich(
      textPart('So the legal interval is '),
      mathPart(String.raw`${min} < v \le ${max}\,\mathrm{m/s}`, `${min} < v ≤ ${max} m/s`),
      textPart('.'),
    ),
  );
  const answer = await ask('With a whole-number slider, which speeds can work?', [
    { id: '20-21', label: '20 and 21 m/s', reply: '20 and 21 m/s' },
    { id: '21-22', label: '21 and 22 m/s', reply: '21 and 22 m/s' },
    { id: '22-23', label: '22 and 23 m/s', reply: '22 and 23 m/s' },
  ]);

  if (answer === '21-22') {
    await say('Exactly. 21 m/s and 22 m/s are the two whole-number speeds inside the interval.');
  } else {
    await say('The answer is 21 m/s and 22 m/s: 20 is too slow to clear the net, while 23 lands long.');
  }
}

/** A net fault starts at the lower boundary. */
async function fromNetFault(dsl) {
  const { say, ask, serve, keep, problem, result, v } = dsl;

  await say(
    rich(
      textPart('At '),
      mathPart(String.raw`${v}\,\mathrm{m/s}`, `${v} m/s`),
      textPart(' the ball reaches the net at '),
      mathPart(
        String.raw`${fmt(result.heightAtNet)}\,\mathrm{m}`,
        `${fmt(result.heightAtNet)} m`,
      ),
      textPart(', '),
      mathPart(
        String.raw`${fmt(-result.netClearance)}\,\mathrm{m}`,
        `${fmt(-result.netClearance)} m`,
      ),
      textPart(' below the tape.'),
    ),
  );
  let answer = await ask('To clear the net, should the next serve be faster or slower?', FAST_SLOW);

  if (answer === 'slow') {
    keep(v, `${v}`);
    const examples = slowerFamily(v, problem.speed.min);
    if (examples.length) {
      await say('Let us test the idea that slower would help. Watch these slower serves.');
      for (const speed of examples) await serve(speed, { keep: true, label: `${speed}` });
      await say('They reach the net lower, or land before it. A slower ball spends longer falling.');
    } else {
      await say('This serve is already at the slow end of the slider, so slowing down cannot help.');
    }
    answer = await ask('So should a serve that hits the net be faster or slower?', FAST_SLOW);
  }

  if (answer === 'fast') {
    await say('Right. To arrive above the tape, the ball must reach the net sooner, so it needs a larger speed.');
  } else {
    await say('It needs to be faster: a slower ball takes longer to reach the net and falls further.');
  }

  await teachLowerBound(dsl);
  await teachUpperBound(dsl);
  await finishWindow(dsl);
}

/** An out serve starts at the upper boundary. */
async function fromLongServe(dsl) {
  const { say, ask, result, v } = dsl;

  await say(
    rich(
      textPart('At '),
      mathPart(String.raw`${v}\,\mathrm{m/s}`, `${v} m/s`),
      textPart(' the ball lands at '),
      mathPart(
        String.raw`${fmt(result.xLand, 1)}\,\mathrm{m}`,
        `${fmt(result.xLand, 1)} m`,
      ),
      textPart(', '),
      mathPart(
        String.raw`${fmt(result.outBy, 1)}\,\mathrm{m}`,
        `${fmt(result.outBy, 1)} m`,
      ),
      textPart(` beyond the ${result.xLand - result.outBy} m baseline.`),
    ),
  );
  const answer = await ask('To bring that landing point back in, should the next serve be faster or slower?', FAST_SLOW);
  if (answer === 'slow') {
    await say('Right. The ball is in the air for the same time; a smaller speed means less horizontal distance.');
  } else {
    await say('It must be slower: the ball already passed the baseline, and more speed would carry it farther.');
  }

  await teachUpperBound(dsl);
  await teachLowerBound(dsl);
  await finishWindow(dsl);
}

/** A successful serve is evidence, but the coach still asks for the explanation. */
async function fromGoodServe(dsl) {
  const { say, result, v } = dsl;
  await say(
    rich(
      mathPart(String.raw`${v}\,\mathrm{m/s}`, `${v} m/s`),
      textPart(' worked: it clears the tape by '),
      mathPart(
        String.raw`${fmt(result.netClearance)}\,\mathrm{m}`,
        `${fmt(result.netClearance)} m`,
      ),
      textPart(' and lands '),
      mathPart(
        String.raw`${fmt(-result.outBy, 1)}\,\mathrm{m}`,
        `${fmt(-result.outBy, 1)} m`,
      ),
      textPart(' inside the baseline.'),
    ),
  );
  await say('That is evidence, not yet the explanation. Let us find the two boundary speeds that make it work.');
  await teachLowerBound(dsl);
  await teachUpperBound(dsl);
  await finishWindow(dsl);
}

async function guideFromResult(dsl) {
  if (dsl.result.verdict === 'net') return fromNetFault(dsl);
  if (dsl.result.verdict === 'out') return fromLongServe(dsl);
  return fromGoodServe(dsl);
}

/** Offer a demonstration only for students who want an initial observation. */
export async function opening(dsl) {
  const { say, ask, serve, problem } = dsl;

  await say('I will help you turn each serve into two boundary conditions: one for the net and one for the baseline.');
  const answer = await ask('Would you like to make the first serve, or watch one first?', [
    { id: 'self', label: 'I will serve first' },
    { id: 'demo', label: 'Show me an example' },
  ]);
  if (answer === 'self') return;

  const v = problem.speed.default;
  await say(`Let us start with ${v} m/s and use what we see.`);
  const result = await serve(v, { keep: true, label: `${v}` });
  return guideFromResult({ ...dsl, result, v });
}

/** Every student serve joins the same sequence at the observation it produced. */
export async function reaction(dsl) {
  return guideFromResult(dsl);
}
