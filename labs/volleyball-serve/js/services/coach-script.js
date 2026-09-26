/**
 * The coach's teaching sequence.
 *
 * The answer is one interval with two ends, and the two ends are peers:
 *
 *   minimum-speed boundary — through A, the top of the net  → v > vMin
 *   maximum-speed boundary — through C, the far baseline    → v ≤ vMax
 *
 * Neither is a follow-up to the other. Both are found by the same four moves
 * (name the boundary point, watch the limiting serve, calculate its speed,
 * state the inequality), so `teachBoundary` handles both and nothing in the
 * wording implies an order. The calculation is itself broken into the three
 * quantities students most often confuse — horizontal distance, vertical fall,
 * and fall time — before the speed. Whole-number quantities are typed by the
 * student; anything else is chosen, because typing 0.447 against 0.45 is a
 * rounding argument rather than physics.
 *
 * Which one comes first is decided by the student:
 * a net fault opens the minimum-speed boundary, a long serve opens the
 * maximum-speed boundary, and a student who has not served anything starts at
 * the minimum-speed boundary.
 *
 * The surrounding UI supplies a small async DSL. Keeping this file concerned
 * with teaching decisions and language makes the sequence easy to read, test,
 * and change without coupling it to DOM or canvas code.
 */
import { flightTime, timeToFall } from '../core/physics.js';

const fmt = (x, n = 2) => Number(x).toFixed(n);

/** Floating-point tidy-up: 3.2 − 2.2 is 1.0000000000000004 in binary. */
const tidy = (x) => Math.round(Number(x) * 1e6) / 1e6;

/** A whole-number answer is typed by the student; anything else is chosen. */
const isWhole = (x) => Number.isInteger(tidy(x));

const sameValue = (a, b) => Math.abs(tidy(a) - tidy(b)) < 1e-6;

/** Horizontal distances read as the problem states them: 9 m, 18 m. */
const fmtDistance = (x) => String(tidy(x));

/** Heights and falls keep one decimal, as the problem does: 1.0 m, 3.2 m. */
const fmtHeight = (x) => fmt(x, 1);

/** Fall times keep two decimals: 0.45 s, 0.80 s. */
const fmtTime = (x) => fmt(x, 2);

/** Speeds keep exact short values (11.25, 22.5) and round the rest (20.1). */
function fmtSpeed(x) {
  const hundredths = x * 100;
  if (Math.abs(hundredths - Math.round(hundredths)) < 1e-6) return String(Math.round(hundredths) / 100);
  return fmt(x, 1);
}

const FAST_SLOW = [
  { id: 'fast', label: 'Faster' },
  { id: 'slow', label: 'Slower' },
];

const BOTH_OR_ONE = [
  { id: 'both', label: 'Both at once' },
  { id: 'one', label: 'One is enough' },
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

/**
 * Everything that differs between the two ends of the interval. Both entries
 * have the same shape, which is what keeps the two routes genuinely parallel.
 */
const BOUNDARIES = {
  min: {
    key: 'min',
    other: 'max',
    point: 'A',
    name: 'minimum-speed boundary',
    serve: 'slowest legal serve',
    /** @param {any} p */
    reach: (p) => `${p.netDistance} m away and ${p.netHeight} m up`,
    limit: 'only just passes the top of the net',
    demo: 'it just reaches A',
    pointQuestion: 'Which point does the slowest legal serve just pass through?',
    speedQuestion: 'What is the speed of the serve that just reaches A?',
    retryQuestion: 'Using that calculation, what is the speed that just reaches A?',
    span: (p) => p.netDistance,
    drop: (p) => p.hitHeight - p.netHeight,
    speed: (bounds) => bounds.vMin,
    marker: (p) => ({ id: 'A', x: p.netDistance, y: p.netHeight }),
    /**
     * @param {any} p
     * @param {{span: boolean, drop: boolean}} shown  values the student has already found
     */
    guides: (p, shown = { span: true, drop: true }) => [
      {
        kind: 'horizontal',
        x1: 0,
        x2: p.netDistance,
        y: p.hitHeight,
        label: `horizontal distance · ${shown.span ? fmtDistance(p.netDistance) : '?'} m`,
      },
      {
        kind: 'vertical',
        x: p.netDistance + 0.55,
        y1: p.netHeight,
        y2: p.hitHeight,
        label: `vertical fall · ${shown.drop ? fmtHeight(p.hitHeight - p.netHeight) : '?'} m`,
      },
    ],
    /** @param {any} p */
    distanceStep: (p) => ({
      question: 'How far does the ball travel horizontally from the hit point to A?',
      retry: 'Try again: how far is A horizontally from the hit point?',
      unit: 'm',
      answer: p.netDistance,
      format: fmtDistance,
      distractors: [
        {
          value: p.courtEnd,
          note: `${fmtDistance(p.courtEnd)} m takes the ball all the way to the far baseline. A is at the net.`,
        },
      ],
      miss: 'Follow the dashed horizontal line from the hit point to the net.',
    }),
    /** @param {any} p */
    fallStep: (p) => ({
      question: 'How far does the ball fall between the hit point and A?',
      retry: 'Try again: how far has the ball dropped when it reaches A?',
      unit: 'm',
      answer: p.hitHeight - p.netHeight,
      format: fmtHeight,
      distractors: [
        {
          value: p.netHeight,
          note:
            `${fmtHeight(p.netHeight)} m is how high A is above the floor, not how far the ball has fallen. ` +
            `The ball starts ${fmtHeight(p.hitHeight)} m up.`,
        },
        {
          value: p.hitHeight,
          note:
            `${fmtHeight(p.hitHeight)} m is the fall all the way to the floor. ` +
            `At A the ball is still ${fmtHeight(p.netHeight)} m above the floor.`,
        },
      ],
      miss: 'Compare the height of the hit point with the height of A.',
    }),
    rule: (v) =>
      `Touching the tape is a fault, so the minimum-speed boundary is strict: v > ${v} m/s.`,
  },
  max: {
    key: 'max',
    other: 'min',
    point: 'C',
    name: 'maximum-speed boundary',
    serve: 'fastest legal serve',
    reach: (p) => `${p.courtEnd} m away`,
    limit: 'only just lands on the far baseline',
    demo: 'it just lands at C',
    pointQuestion: 'Which point does the fastest legal serve just land on?',
    speedQuestion: 'What is the speed of the serve that just lands at C?',
    retryQuestion: 'Using that calculation, what is the speed that just lands at C?',
    span: (p) => p.courtEnd,
    drop: (p) => p.hitHeight,
    speed: (bounds) => bounds.vMax,
    marker: (p) => ({ id: 'C', x: p.courtEnd, y: 0 }),
    /**
     * @param {any} p
     * @param {{span: boolean, drop: boolean}} shown  values the student has already found
     */
    guides: (p, shown = { span: true, drop: true }) => [
      {
        kind: 'horizontal',
        x1: 0,
        x2: p.courtEnd,
        y: p.hitHeight,
        label: `horizontal distance · ${shown.span ? fmtDistance(p.courtEnd) : '?'} m`,
      },
      {
        kind: 'vertical',
        x: p.courtEnd - 0.55,
        y1: 0,
        y2: p.hitHeight,
        label: `vertical fall · ${shown.drop ? fmtHeight(p.hitHeight) : '?'} m`,
      },
    ],
    /** @param {any} p */
    distanceStep: (p) => ({
      question: 'How far does the ball travel horizontally from the hit point to C?',
      retry: 'Try again: how far is C horizontally from the hit point?',
      unit: 'm',
      answer: p.courtEnd,
      format: fmtDistance,
      distractors: [
        {
          value: p.netDistance,
          note: `${fmtDistance(p.netDistance)} m only reaches the net. C is on the far baseline, a full court away.`,
        },
      ],
      miss: 'Follow the dashed horizontal line from the hit point to the far baseline.',
    }),
    /** @param {any} p */
    fallStep: (p) => ({
      question: 'How far does the ball fall between the hit point and C?',
      retry: 'Try again: how far has the ball dropped when it lands at C?',
      unit: 'm',
      answer: p.hitHeight,
      format: fmtHeight,
      distractors: [
        {
          value: p.hitHeight - p.netHeight,
          note:
            `${fmtHeight(p.hitHeight - p.netHeight)} m only takes the ball down to the top of the net. ` +
            'C is on the floor.',
        },
        {
          value: p.netHeight,
          note:
            `${fmtHeight(p.netHeight)} m is the height of the net. ` +
            'C is on the floor, so the ball falls the full height of the hit point.',
        },
      ],
      miss: 'Compare the height of the hit point with the height of C.',
    }),
    rule: (v) =>
      `A ball on the baseline is in, so the maximum-speed boundary includes its own value: v ≤ ${v} m/s.`,
  },
};

/** Whole-number speeds worth putting on a button: one below vMin to one above vMax. */
function candidateSpeeds(bounds) {
  const speeds = [];
  for (let speed = Math.floor(bounds.vMin); speed <= Math.ceil(bounds.vMax); speed++) {
    speeds.push(speed);
  }
  return speeds;
}

/** The whole-number speeds that actually satisfy vMin < v ≤ vMax. */
function legalSpeeds(bounds) {
  return candidateSpeeds(bounds).filter((s) => s > bounds.vMin && s <= bounds.vMax);
}

function speedChoices(bounds) {
  return candidateSpeeds(bounds).map((speed) => ({
    id: String(speed),
    label: `${speed} m/s`,
    reply: `${speed} m/s`,
  }));
}

function wrongSpeedNote(speed, bounds) {
  return speed <= bounds.vMin
    ? `${speed} m/s is still too slow to clear the net. Try again.`
    : `${speed} m/s lands long beyond the baseline. Try again.`;
}

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

/**
 * B is the one distractor the AI never has to improvise about: this is the
 * deterministic answer, and it is deliberately quantitative. B is not "a worse
 * boundary" — it is not a boundary at all, and the arithmetic shows why.
 */
function pointBReply(problem) {
  const tFloor = flightTime(problem.hitHeight, problem.g);
  const vB = problem.netDistance / tFloor;
  return (
    `B is on the floor at the foot of the net. To arrive there the ball has to fall the whole ` +
    `${fmt(problem.hitHeight, 1)} m within ${problem.netDistance} m, which takes the full ` +
    `${fmt(tFloor, 2)} s, so that path is only ${fmt(vB, 2)} m/s. That serve is buried in the net, ` +
    `not on the edge of anything. A boundary point is the exact place where legal turns into illegal.`
  );
}

function pointCorrection(chosen, boundary) {
  const other = BOUNDARIES[boundary.other];
  if (chosen === other.point) {
    return (
      `${other.point} is the other boundary point, and it matters just as much — but it fixes the ` +
      `${other.serve}. Here we want the ${boundary.serve}.`
    );
  }
  return `That point does not describe the ${boundary.serve}.`;
}

async function chooseBoundaryPoint(dsl, boundary) {
  const { say, ask, mark, clearCourt, stage, problem } = dsl;

  stage(boundary.key, 'point');
  clearCourt();
  mark(POINTS(problem));
  await say('The marked points can also be selected directly on the court.');

  let answer = await ask(boundary.pointQuestion, POINT_CHOICES);

  if (answer !== boundary.point) {
    await say(answer === 'B' ? pointBReply(problem) : pointCorrection(answer, boundary));
    answer = await ask(`So which point fixes the ${boundary.name}?`, POINT_CHOICES);
  }

  // A second miss should not strand the learner without a route forward. Use
  // the limiting point explicitly, then continue the derivation from it.
  if (answer !== boundary.point) {
    if (answer === 'B') await say(pointBReply(problem));
    await say(`We will use ${boundary.point}: it is where the ${boundary.serve} reaches its limit.`);
    answer = boundary.point;
  }

  await say(`Yes — ${boundary.point}.`);
}

/**
 * The three fall times a student can reach for on this court. Only one of them
 * is right for a given boundary; the other two are the classic mistakes:
 * using the whole flight time at the net (the ball would already be on the
 * floor there), or using the net's height as the fall.
 * @param {any} p
 */
function fallTimes(p) {
  return {
    toNetTop: timeToFall(p.hitHeight - p.netHeight, p.g),
    netHeight: timeToFall(p.netHeight, p.g),
    toFloor: timeToFall(p.hitHeight, p.g),
  };
}

/** @param {any} p @param {any} boundary */
function timeStep(p, boundary) {
  const drop = boundary.drop(p);
  const times = fallTimes(p);
  const netTop = fmtHeight(p.hitHeight - p.netHeight);
  const common = {
    question: `How long does the ball take to fall ${fmtHeight(drop)} m?`,
    retry: `So how long does the ball take to reach ${boundary.point}?`,
    unit: 's',
    format: fmtTime,
    miss: 'Use the vertical fall you just found, not the horizontal distance.',
    explain: {
      text: 'The fall time depends only on the vertical fall:',
      tex: String.raw`t = \sqrt{\frac{2\,\Delta h}{g}} = \sqrt{\frac{2 \times ${fmtHeight(drop)}}{${p.g}}}`,
      fallback: ` t = √(2Δh / g) = √(2 × ${fmtHeight(drop)} / ${p.g})`,
    },
  };

  if (boundary.key === 'min') {
    return {
      ...common,
      answer: times.toNetTop,
      distractors: [
        {
          value: times.toFloor,
          note:
            `${fmtTime(times.toFloor)} s is the time to fall all the way to the floor. ` +
            `The ball reaches A much sooner, after falling only ${netTop} m.`,
        },
        {
          value: times.netHeight,
          note:
            `${fmtTime(times.netHeight)} s is the time to fall ${fmtHeight(p.netHeight)} m, ` +
            'the height of the net, not the fall to A.',
        },
      ],
    };
  }

  return {
    ...common,
    answer: times.toFloor,
    distractors: [
      {
        value: times.toNetTop,
        note:
          `${fmtTime(times.toNetTop)} s only covers the first ${netTop} m, down to the top of the net. ` +
          `To reach C the ball falls the whole ${fmtHeight(p.hitHeight)} m.`,
      },
      {
        value: times.netHeight,
        note:
          `${fmtTime(times.netHeight)} s is the time to fall ${fmtHeight(p.netHeight)} m, the height of the net. ` +
          `To reach C the ball falls the whole ${fmtHeight(p.hitHeight)} m.`,
      },
    ],
  };
}

/**
 * Ask for one quantity on the way to a boundary speed.
 *
 * A whole-number answer (9 m, 18 m, 1.0 m) is typed; anything else (3.2 m,
 * 0.45 s) is chosen from the correct value and the values the common mistakes
 * produce. A named mistake gets its own diagnosis, then one more try; a second
 * miss states the value so the student is never stranded.
 *
 * @param {any} dsl
 * @param {{
 *   question: string, retry: string, unit: string, answer: number,
 *   format: (x: number) => string,
 *   distractors: {value: number, note: string}[],
 *   miss: string,
 *   explain?: any,
 * }} spec
 * @returns {Promise<boolean>} whether the student reached the value
 */
async function askValue(dsl, spec) {
  const { say, ask, askNumber } = dsl;
  const label = (x) => `${spec.format(x)} ${spec.unit}`;
  const typed = isWhole(spec.answer);

  /** @type {{id: string, label: string, reply: string, value: number}[]} */
  const choices = [];
  if (!typed) {
    for (const value of [spec.answer, ...spec.distractors.map((d) => d.value)].sort((a, b) => a - b)) {
      const text = label(value);
      if (!choices.some((c) => c.id === text)) choices.push({ id: text, label: text, reply: text, value });
    }
  }

  const matches = (a, b) => (typed ? sameValue(a, b) : spec.format(a) === spec.format(b));

  const answerOnce = async (question) => {
    if (typed) return askNumber(question, { unit: spec.unit });
    const id = await ask(question, choices);
    return choices.find((c) => c.id === id)?.value ?? NaN;
  };

  let value = await answerOnce(spec.question);
  if (!matches(value, spec.answer)) {
    const known = spec.distractors.find((d) => matches(value, d.value));
    await say(known ? known.note : spec.miss);
    if (spec.explain) await say(spec.explain);
    value = await answerOnce(spec.retry);
  }

  if (matches(value, spec.answer)) {
    await say(`Yes — ${label(spec.answer)}.`);
    return true;
  }
  await say(`We will use ${label(spec.answer)}.`);
  return false;
}

/**
 * One end of the interval, whichever end it is. The four moves are the same:
 * name the point, watch the limiting serve, calculate its speed, state the
 * inequality that the point implies. The calculation goes through the
 * horizontal distance, the vertical fall and the fall time, in that order, so
 * the two classic slips — using the whole flight time at the net, and using
 * the net's height as the fall — surface as answers the coach can respond to.
 */
async function teachBoundary(dsl, key, { alone = false } = {}) {
  const { say, ask, serve, mark, guide, clearCourt, stage, completeRoute, problem, bounds } = dsl;
  const boundary = BOUNDARIES[key];
  const span = boundary.span(problem);
  const drop = boundary.drop(problem);
  const limitSpeed = boundary.speed(bounds);
  const shown = { span: false, drop: false };
  const drawGuides = () => guide(boundary.guides(problem, shown));

  await say(
    alone
      ? `That leaves the ${boundary.name}. It is found the same way, from the ${boundary.serve}: ` +
        `the path that ${boundary.limit}.`
      : `Start with the ${boundary.name}. It is set by the ${boundary.serve}: ` +
        `the path that ${boundary.limit}, ${boundary.reach(problem)}.`,
  );
  await chooseBoundaryPoint(dsl, boundary);

  stage(key, 'demo');
  await say(`Watch that limiting serve. I will hide its speed: ${boundary.demo}.`);
  clearCourt();
  mark([boundary.marker(problem)]);
  drawGuides();
  await serve(limitSpeed, { animatePlayer: true, hideSpeed: true });
  await say('The dashed lines show the horizontal distance and the vertical fall for that exact path.');
  await say('Work out the hidden speed from those two lines, one step at a time.');

  stage(key, 'distance');
  await askValue(dsl, boundary.distanceStep(problem));
  shown.span = true;
  drawGuides();

  stage(key, 'fall');
  await askValue(dsl, boundary.fallStep(problem));
  shown.drop = true;
  drawGuides();

  stage(key, 'time');
  await askValue(dsl, timeStep(problem, boundary));

  stage(key, 'calculate');
  const correctLabel = `${fmtSpeed(limitSpeed)} m/s`;
  /** @type {{id: string, label: string, reply: string}[]} */
  const choices = [];
  for (const t of Object.values(fallTimes(problem)).map((t) => span / t).sort((a, b) => a - b)) {
    const text = `${fmtSpeed(t)} m/s`;
    if (!choices.some((c) => c.id === text)) choices.push({ id: text, label: text, reply: text });
  }
  let answer = await ask(boundary.speedQuestion, choices);

  if (answer !== correctLabel) {
    const t = timeToFall(drop, problem.g);
    const tRounded = fmt(t, 3);
    const vRounded = fmt(limitSpeed, 1);
    await say({
      text: 'Write it in two steps:',
      tex: String.raw`\begin{aligned}
        t &= \sqrt{\frac{2 \times ${fmtHeight(drop)}}{${problem.g}}} \approx ${tRounded}\,\mathrm{s} \\
        v &= \frac{${fmtDistance(span)}}{${tRounded}} \approx ${vRounded}\,\mathrm{m/s}
      \end{aligned}`,
      fallback:
        ` t = √(2 × ${fmtHeight(drop)} / ${problem.g}) ≈ ${tRounded} s; ` +
        `v = ${fmtDistance(span)} ÷ ${tRounded} ≈ ${vRounded} m/s`,
    });
    answer = await ask(boundary.retryQuestion, choices);
  }

  if (answer === correctLabel) {
    await say(`Yes. The hidden speed is ${fmt(limitSpeed, 1)} m/s.`);
  } else {
    await say(`The limiting speed is ${fmt(limitSpeed, 1)} m/s.`);
  }

  stage(key, 'rule');
  await say(boundary.rule(fmt(limitSpeed, 1)));
  completeRoute(key);
}

/**
 * Two conditions do not make an interval until the student decides how they
 * combine. "Either one is enough" is tested with two real serves, each of which
 * satisfies one condition and still fails.
 */
async function combineConditions(dsl) {
  const { ask, say, serve, clearCourt, stage, problem, bounds } = dsl;
  const min = fmt(bounds.vMin, 1);
  const max = fmt(bounds.vMax, 1);

  stage('interval', 'combine');
  await say(`You now have two conditions: v > ${min} m/s to clear the net, and v ≤ ${max} m/s to land in.`);
  let answer = await ask('Does a legal serve have to meet both conditions, or is one of them enough?', BOTH_OR_ONE);

  if (answer !== 'both') {
    const slow = Math.max(problem.speed.min, Math.floor(bounds.vMin) - 4);
    const fast = Math.min(problem.speed.max, Math.ceil(bounds.vMax) + 2);
    clearCourt();
    await say(`Test that idea. ${slow} m/s meets v ≤ ${max} m/s, and ${fast} m/s meets v > ${min} m/s. Watch both.`);
    await serve(slow, { keep: true, label: `${slow}`, animatePlayer: true });
    await serve(fast, { keep: true, label: `${fast}`, animatePlayer: true });
    await say('Each serve meets one condition and still fails: one hits the net, the other lands long.');
    answer = await ask('So does a legal serve need both conditions, or is one enough?', BOTH_OR_ONE);
  }

  await say(
    answer === 'both'
      ? 'Right — both at once. The speeds that work are where the two conditions overlap.'
      : 'A legal serve has to meet both at once. The speeds that work are where the two conditions overlap.',
  );
}

async function finishWindow(dsl) {
  const { askMulti, say, serve, celebrate, stage, bounds } = dsl;
  const min = fmt(bounds.vMin, 1);
  const max = fmt(bounds.vMax, 1);
  const legal = legalSpeeds(bounds).map(String);

  await combineConditions(dsl);

  stage('interval', 'final');
  await say(`So the legal interval is ${min} < v ≤ ${max} m/s.`);
  const choices = speedChoices(bounds);

  while (true) {
    const answer = await askMulti('Select all the whole-number speeds that can work.', choices, {
      correctIds: legal,
    });
    if (answer.status === 'correct') {
      const list = legal.map((s) => `${s} m/s`).join(' and ');
      celebrate(`🎉 Exactly — ${list} work! 🎉`);
      await say(`Exactly. ${list} are the whole-number speeds inside the interval.`);
      return;
    }

    const speed = Number(answer.id);
    await say(`Let us test ${speed} m/s.`);
    await serve(speed, { animatePlayer: true });
    await say(wrongSpeedNote(speed, bounds));
  }
}

/**
 * A legal serve is a shortcut only if the student can show it was not luck.
 * Two questions decide it: the full set of working speeds, then the two points
 * that create that set. Either miss drops back into the ordinary derivation,
 * so both boundaries still get thought about.
 */
async function fastTrack(dsl) {
  const { say, askMulti, serve, mark, clearCourt, celebrate, stage, problem, bounds, result, v } = dsl;
  const min = fmt(bounds.vMin, 1);
  const max = fmt(bounds.vMax, 1);
  const legal = legalSpeeds(bounds).map(String);

  await say(
    `${v} m/s worked: it clears the tape by ${fmt(result.netClearance)} m and lands ` +
      `${fmt(-result.outBy, 1)} m inside the baseline.`,
  );

  stage('fast-track', 'speeds');
  await say('One speed that works is a start. How much room does the serve actually have?');
  const answer = await askMulti(
    'Select every whole-number speed that works. Yours is already selected.',
    speedChoices(bounds),
    { correctIds: legal, preselectedIds: [String(v)] },
  );

  if (answer.status !== 'correct') {
    const speed = Number(answer.id);
    await say(`Let us test ${speed} m/s.`);
    await serve(speed, { animatePlayer: true });
    await say(wrongSpeedNote(speed, bounds));
    await say('The window has two edges we have not found yet. Let us locate them.');
    return false;
  }

  await say(`Right — ${legal.map((s) => `${s} m/s`).join(' and ')}, and nothing else.`);

  stage('fast-track', 'points');
  clearCourt();
  mark(POINTS(problem));
  await say('Then you already know roughly where the two limits sit. Point at them.');
  const points = await askMulti(
    'Select both boundary points: the one that fixes the minimum speed and the one that fixes the maximum speed.',
    POINT_CHOICES,
    { correctIds: ['A', 'C'] },
  );

  if (points.status !== 'correct') {
    await say(pointBReply(problem));
    await say('Let us build both limits properly, one at a time.');
    return false;
  }

  await say(`Exactly. A fixes the minimum-speed boundary at ${min} m/s, and touching the tape is a fault, so v > ${min} m/s.`);
  await say(`C fixes the maximum-speed boundary at ${max} m/s, and a ball on the line is in, so v ≤ ${max} m/s.`);
  await say(`Together: ${min} < v ≤ ${max} m/s.`);
  celebrate('🎉 Both boundaries — nicely done! 🎉');
  return true;
}

/** A net fault points at the minimum-speed boundary. */
async function diagnoseNetFault(dsl) {
  const { say, ask, serve, keep, stage, problem, result, v } = dsl;

  stage('min', 'diagnose');
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
}

/** A long serve points at the maximum-speed boundary. */
async function diagnoseLongServe(dsl) {
  const { say, ask, serve, keep, stage, problem, result, v } = dsl;

  stage('max', 'diagnose');
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
}

/** Report a serve without reopening a boundary that is already derived. */
async function observeOnly(dsl) {
  const { say, result, v } = dsl;
  if (result.verdict === 'net') {
    await say(
      `${v} m/s reaches the net at ${fmt(result.heightAtNet)} m, ` +
        `${fmt(-result.netClearance)} m below the tape — too slow, as expected.`,
    );
    return;
  }
  if (result.verdict === 'out') {
    await say(
      `${v} m/s lands at ${fmt(result.xLand, 1)} m, ` +
        `${fmt(result.outBy, 1)} m past the baseline — too fast, as expected.`,
    );
    return;
  }
  await say(
    `${v} m/s clears the tape by ${fmt(result.netClearance)} m and lands ` +
      `${fmt(-result.outBy, 1)} m inside the baseline.`,
  );
}

/**
 * The serve the student just played chooses which boundary to open first; it
 * never re-opens one that is already derived.
 */
function teachingOrder(verdict, progress) {
  const preferred = verdict === 'out' ? ['max', 'min'] : ['min', 'max'];
  return preferred.filter((key) => !progress[key]);
}

async function guideFromResult(dsl) {
  const { say, progress, result, bounds, v, finishLesson } = dsl;

  // Everything is already established: comment on the serve and stop.
  if (progress.complete) {
    await observeOnly(dsl);
    await say(
      v > bounds.vMin && v <= bounds.vMax
        ? `That is inside ${fmt(bounds.vMin, 1)} < v ≤ ${fmt(bounds.vMax, 1)} m/s.`
        : `That is outside ${fmt(bounds.vMin, 1)} < v ≤ ${fmt(bounds.vMax, 1)} m/s.`,
    );
    return;
  }

  const untouched = !progress.min && !progress.max;

  if (result.verdict === 'in' && untouched && !progress.fastTrackTried) {
    progress.fastTrackTried = true;
    if (await fastTrack(dsl)) {
      finishLesson();
      return;
    }
  } else if (result.verdict === 'net' && !progress.min) {
    await diagnoseNetFault(dsl);
  } else if (result.verdict === 'out' && !progress.max) {
    await diagnoseLongServe(dsl);
  } else {
    await observeOnly(dsl);
    if (untouched) {
      await say('That is evidence, not yet the explanation. Let us find the two limits behind it.');
    }
  }

  const order = teachingOrder(result.verdict, progress);
  for (const key of order) {
    await teachBoundary(dsl, key, { alone: order.length === 1 || key !== order[0] });
  }

  await finishWindow(dsl);
  finishLesson();
}

/** A quiet welcome: the student starts by trying the experiment. */
export async function opening(dsl) {
  await dsl.say('Welcome! Have a try. Good luck!');
}

/** Every student serve joins the same sequence at the observation it produced. */
export async function reaction(dsl) {
  return guideFromResult(dsl);
}
