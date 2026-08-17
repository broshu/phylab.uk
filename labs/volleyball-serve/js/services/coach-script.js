/**
 * What the coach says — the content, kept apart from the dialogue mechanics in
 * ui/coach.js. A script is an async function driven by the little DSL it is
 * handed, so it reads top to bottom like a conversation:
 *
 *   await say('…')                      one message from the coach
 *   await serve(14, { keep: true })     a demonstration serve, resolves on landing
 *   const a = await ask('…', [...])     buttons, resolves with the id picked
 *   keep(v, label)                      leave a trajectory on screen
 *   mark([{id, x, y}])                  lettered, clickable points on the court
 *   clearCourt()                        wipe the paths and markers
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
    return criticalPoint(dsl);
  }

  await say('Careful — it never got over the net, so it cannot have been too fast.');
}

/**
 * Now the useful question: faster, but how much faster *at least*? The way in is
 * the borderline serve — the slowest one that still counts. It only just gets
 * away with it, so it must pass through one particular point on the court.
 * Three candidates are marked on the diagram and the student picks one, either
 * with the buttons or by clicking the court itself.
 */
async function criticalPoint(dsl) {
  const { say, ask, mark, clearCourt, problem } = dsl;

  await say('So: faster. But how much faster, at least?');
  await say(
    'Think about the borderline serve — the slowest one that still counts. It ' +
      'only just gets away with it, so its path must pass exactly through one ' +
      'particular point.',
  );

  clearCourt();
  mark([
    { id: 'A', x: problem.netDistance, y: problem.netHeight },
    { id: 'B', x: problem.netDistance, y: 0 },
    { id: 'C', x: problem.courtEnd, y: 0 },
  ]);
  await say('I have marked three candidates. You can tap them on the court, too.');

  let answer = await ask('Which point does the slowest legal serve go through?', [
    { id: 'A', label: 'A — the top of the net', reply: 'A' },
    { id: 'B', label: 'B — the foot of the net', reply: 'B' },
    { id: 'C', label: 'C — the far baseline', reply: 'C' },
  ]);

  if (answer === 'B') {
    await say(
      'To reach B the ball would have to be below the tape at the net — that ' +
        'is a serve in the net, not a legal one.',
    );
  } else if (answer === 'C') {
    await say(
      'C is a real limit, but the other one: it is where the *fastest* legal ' +
        'serve lands. We are after the slowest.',
    );
  }

  if (answer !== 'A') {
    answer = await ask('So which point is the slowest legal serve pinned to?', [
      { id: 'A', label: 'A — the top of the net', reply: 'A' },
      { id: 'B', label: 'B — the foot of the net', reply: 'B' },
      { id: 'C', label: 'C — the far baseline', reply: 'C' },
    ]);
  }

  if (answer === 'A') {
    await say('Yes — A. The slowest serve that counts is the one that just brushes the top of the net.');
  } else {
    await say('It is A: the ball just brushing the top of the net. Any slower and it is under the tape.');
  }

  // TODO next stage: turn point A into a number — the fall from 3.2 m to 2.2 m
  // gives the time to the net, and 9 m divided by that time gives the speed.
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
