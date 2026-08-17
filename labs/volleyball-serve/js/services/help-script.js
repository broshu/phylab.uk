/**
 * What the tutor says — the content, kept apart from the dialogue mechanics in
 * ui/help.js. A branch is an async function that drives the conversation with
 * the little DSL it is handed, so a branch reads top to bottom like a script:
 *
 *   await say('…')                     one message from the tutor
 *   await serve(15, { keep: true })    play a serve, resolve when it lands
 *   const a = await ask('…', [...])    show buttons, resolve with the id picked
 *
 * pickBranch() decides which script to run from what the student has done so
 * far, so pressing Help means something different at different moments.
 */

const fmt = (x, n = 2) => Number(x).toFixed(n);

/**
 * Which answer to "too fast or too slow?" is right — read off the physics, not
 * hard-coded, so it stays correct if the problem data changes.
 */
function tooFastOrSlow(v, bounds) {
  return v < bounds.vMin ? 'slow' : 'fast';
}

const FAST_SLOW_OPTIONS = [
  { id: 'fast', label: 'Too fast' },
  { id: 'slow', label: 'Too slow' },
];

/**
 * Nothing served yet. The student has no foothold, so the tutor makes one:
 * try the default speed, look at it, and commit to a guess about which way to
 * move. If the guess is "too fast", a family of slower serves shows that
 * slower is worse — the surprise that makes the idea stick.
 */
async function coldStart({ say, ask, serve, problem, bounds }) {
  await say(
    'No idea where to start? That is exactly what a physicist does: pick a ' +
      'number, hit the ball, and look at what happens.',
  );
  await say(`Let me serve at the speed you have set, ${problem.speed.default} m/s.`);

  const first = await serve(problem.speed.default, {
    keep: true,
    label: `${problem.speed.default}`,
  });

  await say(
    `It reaches the net only ${fmt(first.heightAtNet)} m above the floor, ` +
      `${fmt(-first.netClearance)} m below the ${problem.netHeight} m tape. Into the net.`,
  );

  const right = tooFastOrSlow(problem.speed.default, bounds);
  let answer = await ask('So was that serve too fast, or too slow?', FAST_SLOW_OPTIONS);

  if (answer !== right) {
    await say(
      'Let us test that. If it was too fast, then slower has to be better. ' +
        'Watch five slower serves.',
    );
    for (const v of [14, 13, 12, 11, 10]) {
      await serve(v, { keep: true, label: `${v}` });
    }
    await say(
      'Every slower serve dies lower on the net, and below about 11 m/s it ' +
        'does not even reach the net. Slower is clearly worse.',
    );
    answer = await ask('Try again: was the first serve too fast, or too slow?', FAST_SLOW_OPTIONS);
    if (answer !== right) {
      await say('It was too slow — the slower serves you just watched were all worse.');
    }
  }

  await say(
    'Right. The ball falls all the way from the hand to the net, and a slower ' +
      'ball spends longer on that trip, so it arrives lower. To get over, it ' +
      'has to reach the net sooner: serve faster.',
  );

  // TODO next stage: from here, lead the student to the two boundaries —
  // how fast is fast enough, and what stops them serving as hard as they like.
  await say('Close this panel and try a bigger speed.');
}

/**
 * Provisional branch for when serves have already been made: reuse the
 * rule-based coaching for the last serve. To be replaced by its own script.
 */
async function afterServes({ say, tutor, problem, result, attemptCount }) {
  const hint = await tutor.hint({ problem, result, attempts: attemptCount });
  await say(`${attemptCount} serve${attemptCount === 1 ? '' : 's'} so far. ${hint.title}.`);
  await say(hint.body);
  if (hint.scaffold) await say(hint.scaffold);
}

/**
 * @param {{attemptCount:number}} ctx
 * @returns {{id:string, run:Function}}
 */
export function pickBranch(ctx) {
  if (!ctx.attemptCount) return { id: 'cold-start', run: coldStart };
  return { id: 'after-serves', run: afterServes };
}
