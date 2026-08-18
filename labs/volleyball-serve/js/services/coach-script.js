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
  { id: 'A', label: 'A', reply: 'A' },
  { id: 'B', label: 'B', reply: 'B' },
  { id: 'C', label: 'C', reply: 'C' },
];

function slowerFamily(v, min) {
  const speeds = [];
  for (let speed = v - 1; speed >= Math.max(min, v - 5); speed--) speeds.push(speed);
  return speeds;
}

function fasterFamily(v, max) {
  const speeds = [];
  for (let speed = v + 1; speed <= Math.min(max, v + 5); speed++) speeds.push(speed);
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
  const { say, ask, serve, mark, guide, clearCourt, problem, bounds } = dsl;
  const drop = problem.hitHeight;

  await say('There is a second boundary: how fast can the serve be before it lands beyond the far baseline?');
  await chooseBoundaryPoint(dsl, 'C');

  await say('Watch the limiting serve. I will hide its speed: it just lands at C.');
  clearCourt();
  mark([{ id: 'C', x: problem.courtEnd, y: 0 }]);
  guide([
    {
      kind: 'horizontal',
      x1: 0,
      x2: problem.courtEnd,
      y: problem.hitHeight,
      label: `horizontal distance · ${problem.courtEnd} m`,
    },
    {
      kind: 'vertical',
      x: problem.courtEnd - 0.55,
      y1: 0,
      y2: problem.hitHeight,
      label: `vertical fall · ${fmt(drop, 1)} m`,
    },
  ]);
  await serve(bounds.vMax, { animatePlayer: true, hideSpeed: true });
  await say('The dashed lines show the horizontal distance and the vertical fall for that exact path.');
  await say('How could you calculate its speed? What do you think the hidden speed is?');

  const choices = [
    { id: 'distance', label: `${fmt(problem.courtEnd, 1)} m/s`, reply: `${fmt(problem.courtEnd, 1)} m/s` },
    { id: 'minimum', label: `${fmt(bounds.vMin, 1)} m/s`, reply: `${fmt(bounds.vMin, 1)} m/s` },
    { id: 'maximum', label: `${fmt(bounds.vMax, 1)} m/s`, reply: `${fmt(bounds.vMax, 1)} m/s` },
  ];
  let answer = await ask('What is the speed of the serve that just lands at C?', choices);

  if (answer !== 'maximum') {
    const tLand = flightTime(drop, problem.g);
    const tRounded = fmt(tLand, 3);
    const vRounded = fmt(bounds.vMax, 1);
    await say({
      text: 'Write it in two steps:',
      tex: String.raw`\begin{aligned}
        t &= \sqrt{\frac{2 \times ${fmt(drop, 1)}}{${problem.g}}} \approx ${tRounded}\,\mathrm{s} \\
        v &= \frac{${problem.courtEnd}}{${tRounded}} \approx ${vRounded}\,\mathrm{m/s}
      \end{aligned}`,
      fallback:
        ` t = √(2 × ${fmt(drop, 1)} / ${problem.g}) ≈ ${tRounded} s; ` +
        `v = ${problem.courtEnd} ÷ ${tRounded} ≈ ${vRounded} m/s`,
    });
    answer = await ask('Using that calculation, what is the speed that just lands at C?', choices);
  }

  if (answer === 'maximum') {
    await say(`Yes. The hidden speed is ${fmt(bounds.vMax, 1)} m/s.`);
  } else {
    await say(`The limiting speed is ${fmt(bounds.vMax, 1)} m/s.`);
  }
  await say(`A ball on the baseline is in, so the upper condition is v ≤ ${fmt(bounds.vMax, 1)} m/s.`);
}

async function finishWindow(dsl) {
  const { askMulti, say, serve, celebrate, bounds } = dsl;
  const min = fmt(bounds.vMin, 1);
  const max = fmt(bounds.vMax, 1);

  await say(`Both conditions must hold: v > ${min} m/s and v ≤ ${max} m/s.`);
  await say(`So the legal interval is ${min} < v ≤ ${max} m/s.`);
  const choices = [20, 21, 22, 23].map((speed) => ({
    id: String(speed),
    label: `${speed} m/s`,
    reply: `${speed} m/s`,
  }));

  while (true) {
    const answer = await askMulti('Select all the whole-number speeds that can work.', choices, {
      correctIds: ['21', '22'],
    });
    if (answer.status === 'correct') {
      celebrate('🎉 Exactly — 21 m/s and 22 m/s work! 🎉');
      await say('Exactly. 21 m/s and 22 m/s are the two whole-number speeds inside the interval.');
      return;
    }

    const speed = Number(answer.id);
    await say(`Let us test ${speed} m/s.`);
    await serve(speed, { animatePlayer: true });
    await say(
      speed < 21
        ? '20 m/s is still too slow to clear the net. Try again.'
        : '23 m/s lands long beyond the baseline. Try again.',
    );
  }
}

/** A net fault starts at the lower boundary. */
async function fromNetFault(dsl) {
  const { say, ask, serve, keep, problem, result, v } = dsl;

  await say(
    `At ${v} m/s the ball reaches the net at ${fmt(result.heightAtNet)} m, ` +
      `${fmt(-result.netClearance)} m below the tape.`,
  );
  let answer = await ask('To clear the net, should the next serve be faster or slower?', FAST_SLOW);

  if (answer === 'slow') {
    keep(v, `${v}`);
    const examples = slowerFamily(v, problem.speed.min);
    if (examples.length) {
      await say('Let us test the idea that slower would help. Watch these slower serves.');
      for (const speed of examples.slice(0, 2)) {
        await serve(speed, { keep: true, label: `${speed}`, animatePlayer: true });
      }
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
  const { say, ask, serve, keep, problem, result, v } = dsl;

  await say(
    `At ${v} m/s the ball lands at ${fmt(result.xLand, 1)} m, ` +
      `${fmt(result.outBy, 1)} m beyond the ${result.xLand - result.outBy} m baseline.`,
  );
  let answer = await ask('To bring that landing point back in, should the next serve be faster or slower?', FAST_SLOW);
  if (answer === 'fast') {
    keep(v, `${v}`);
    const examples = fasterFamily(v, problem.speed.max);
    if (examples.length) {
      await say('Let us test the idea that faster would help. Watch these faster serves.');
      for (const speed of examples.slice(0, 2)) {
        await serve(speed, { keep: true, label: `${speed}`, animatePlayer: true });
      }
      await say('They stay in the air for the same time, so each faster serve travels farther and lands even more out.');
    } else {
      await say('This serve is already at the fast end of the slider, so going faster cannot help.');
    }
    answer = await ask('So should a serve that goes long be faster or slower?', FAST_SLOW);
  }

  if (answer === 'slow') {
    await say('Right. It must be slower: the ball is in the air for the same time, so a smaller speed means less horizontal distance.');
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
    `${v} m/s worked: it clears the tape by ${fmt(result.netClearance)} m and lands ` +
      `${fmt(-result.outBy, 1)} m inside the baseline.`,
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
  const result = await serve(v, { keep: true, label: `${v}`, animatePlayer: true });
  return guideFromResult({ ...dsl, result, v });
}

/** Every student serve joins the same sequence at the observation it produced. */
export async function reaction(dsl) {
  return guideFromResult(dsl);
}
