/**
 * What the coach says — the content, kept apart from the dialogue mechanics in
 * ui/coach.js. A script is an async function driven by the little DSL it is
 * handed, so it reads top to bottom like a conversation:
 *
 *   await say('…')                      one message from the coach
 *   await serve(14, { keep: true })     a demonstration serve, resolves on landing
 *   const a = await ask('…', [...])     buttons, resolves with the id picked
 *   keep(v, label)                      leave a trajectory on screen
 *
 * Two entry points: opening() before anything is served, and reaction() after
 * every serve the student makes.
 */
const fmt = (x, n = 2) => Number(x).toFixed(n);

const FAST_SLOW = [
  { id: 'fast', label: 'Too fast' },
  { id: 'slow', label: 'Too slow' },
];

/** Read the right answer off the physics rather than hard-coding it. */
function tooFastOrSlow(v, bounds) {
  return v < bounds.vMin ? 'slow' : 'fast';
}

/** Five speeds below v, for showing that slower is worse. */
function slowerFamily(v) {
  const out = [];
  for (let s = v - 1; s >= Math.max(1, v - 5); s--) out.push(s);
  return out;
}

/**
 * The ball went into the net. Ask which way to move, and if the student thinks
 * the serve was too fast, show a family of slower serves: each one dies lower
 * on the net and the slowest do not even reach it. That surprise is the lesson.
 */
async function netFault(dsl) {
  const { say, ask, serve, keep, problem, bounds, v, result } = dsl;

  await say(
    `${v} m/s reached the net only ${fmt(result.heightAtNet)} m up — ` +
      `${fmt(-result.netClearance)} m below the ${problem.netHeight} m tape.`,
  );

  const right = tooFastOrSlow(v, bounds);
  let answer = await ask('Was that too fast, or too slow?', FAST_SLOW);

  if (answer !== right && right === 'slow') {
    keep(v, `${v}`); // hold the student's own serve on screen for comparison
    await say('Let us test that. If it was too fast, slower has to be better. Watch.');
    for (const s of slowerFamily(v)) {
      await serve(s, { keep: true, label: `${s}` });
    }
    await say(
      'Every slower serve dies lower on the net, and the slowest ones do not ' +
        'even reach it. Slower is clearly worse.',
    );
    answer = await ask('So: too fast, or too slow?', FAST_SLOW);
    if (answer !== right) {
      await say('It was too slow — the serves you just watched were all worse.');
    }
  }

  if (right === 'slow') {
    await say(
      'Right. The ball falls all the way from the hand to the net, and a ' +
        'slower ball spends longer on that trip, so it arrives lower. To get ' +
        'over, it has to reach the net sooner: serve faster.',
    );
    // TODO next stage: lead on to the other boundary — how hard is too hard?
    await say('Try a bigger speed.');
  } else {
    await say('Careful — it never got over the net, so it cannot have been too fast.');
  }
}

/** Past the baseline: the flight time is fixed, so harder only means further. */
async function tooLong({ say, tutor, problem, result, attemptCount }) {
  const hint = await tutor.hint({ problem, result, attempts: attemptCount });
  await say(hint.body);
  await say('Come down a little and serve again.');
}

/** In. Say why it worked and how little room there was. */
async function goodServe({ say, tutor, problem, result, attemptCount }) {
  const hint = await tutor.hint({ problem, result, attempts: attemptCount });
  await say(`${hint.title}! ${hint.body}`);
}

/** Route on the verdict of a serve. */
async function judge(dsl) {
  if (dsl.result.verdict === 'net') return netFault(dsl);
  if (dsl.result.verdict === 'out') return tooLong(dsl);
  return goodServe(dsl);
}

/**
 * Before anything has been served. Offer a way in for a student who has no
 * idea where to start: the coach serves the default speed itself and then asks
 * the same question. Serving cancels this, which is the point — the offer is
 * there if it is wanted and harmless if it is not.
 */
export async function opening(dsl) {
  const { say, ask, serve, problem } = dsl;

  await say('I am your coach. Set a speed, serve, and I will tell you what happened.');

  const answer = await ask('Or shall I start you off?', [
    { id: 'self', label: 'I will try first' },
    { id: 'demo', label: 'I have no idea where to start' },
  ]);
  if (answer === 'self') return;

  await say(
    'Fair enough — that is what a physicist does too: pick a number, hit the ' +
      'ball, and look at what happens.',
  );
  const v = problem.speed.default;
  await say(`Let me serve at ${v} m/s.`);
  const result = await serve(v, { keep: true, label: `${v}` });
  return judge({ ...dsl, v, result });
}

/** After every serve the student makes. */
export async function reaction(dsl) {
  return judge(dsl);
}
