/**
 * Coach-flow test: drives the teaching script with an instant fake runtime.
 * It verifies the actual learning sequence — observation → boundary point →
 * calculation → interval — rather than only checking isolated messages.
 */
import { installDom, makeEl } from './fake-dom.mjs';

const dom = installDom();

const { getProblem } = await import('../js/config/problem.js');
const { evaluate } = await import('../js/core/evaluator.js');
const { createStore } = await import('../js/core/state.js');
const { createCoach } = await import('../js/ui/coach.js');

const problem = getProblem();
const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });

function harness() {
  const served = [];
  const serveOptions = [];
  const trails = [];
  let markers = [];
  let guides = [];
  let clearCount = 0;
  const store = createStore({
    problem,
    v: problem.speed.default,
    phase: 'aim',
    trails: [],
    result: evaluate(problem, problem.speed.default),
  });
  const root = makeEl('div');
  const coach = createCoach(root, store, {
    attempts: { summary: () => ({ total: 0 }) },
    runtime: {
      async serve(v, options = {}) {
        served.push(v);
        serveOptions.push(options);
        return evaluate(problem, v);
      },
      trail(v, label) {
        if (!trails.some((t) => t.v === v)) trails.push({ v, label });
      },
      mark(list) {
        markers = list;
      },
      guide(list) {
        guides = list;
      },
      clearCourt() {
        clearCount += 1;
        trails.splice(0, trails.length);
        markers = [];
        guides = [];
      },
    },
    timing: { message: 0 },
  });
  const log = root.querySelector('#coachLog');
  const options = root.querySelector('#coachOptions');

  return {
    coach,
    served,
    serveOptions,
    trails,
    get markers() {
      return markers;
    },
    get clearCount() {
      return clearCount;
    },
    get guides() {
      return guides;
    },
    messages: () => log.children.map((c) => c.textContent),
    said: (pattern) => log.children.some((c) => pattern.test(c.textContent)),
    options: () => options.children.map((c) => c.textContent),
    optionByLabel: (label) => options.children.find((c) => c.textContent === label),
    celebration: () => root.querySelector('#coachCelebration').textContent,
    async choose(label) {
      const button = options.children.find((c) => c.textContent === label);
      if (!button) throw new Error(`no option “${label}”; have [${this.options().join(', ')}]`);
      button.dispatch('click');
      await dom.settle(50);
    },
    async chooseMulti(labels) {
      for (const label of labels) await this.choose(label);
    },
    hasNumberInput: () => options.children.some((c) => c.className === 'number-answer'),
    numberHint: () =>
      options.children.find((c) => c.className === 'number-answer')?.children.find((c) => c.tagName === 'p'),
    async enter(value) {
      const row = options.children.find((c) => c.className === 'number-answer');
      if (!row) throw new Error(`no number input; have [${this.options().join(', ')}]`);
      const input = row.children.find((c) => c.tagName === 'input');
      const button = row.children.find((c) => c.tagName === 'button');
      input.value = String(value);
      button.dispatch('click');
      await dom.settle(50);
    },
  };
}

async function startMin(h, answer = 'A') {
  check('asks for the minimum-speed boundary point', /slowest legal serve/i.test(h.messages().at(-1) || ''));
  check('marks A, B, and C', h.markers.map((p) => p.id).join('') === 'ABC');
  await h.choose(answer);
}

const last = (h) => h.messages().at(-1) || '';

/**
 * Walk the calculation for one boundary: distance (typed), fall (typed when
 * whole), time (chosen), speed (chosen). Every answer can be overridden to
 * exercise a mistake; later answers default to the correct ones.
 */
async function solveMinSpeed(h, {
  distance = [9],
  fall = [1],
  time = ['0.45 s'],
  speed = ['20.1 m/s'],
} = {}) {
  check('shows only A for the limiting serve', h.markers.map((p) => p.id).join('') === 'A');
  check('draws horizontal and vertical construction lines', h.guides.map((g) => g.kind).join(',') === 'horizontal,vertical');
  check('construction lines start without their values',
    h.guides.every((g) => / \? m$/.test(g.label)), h.guides.map((g) => g.label).join(' | '));
  check('limiting serve animates the player with its speed hidden',
    h.serveOptions.at(-1)?.animatePlayer === true && h.serveOptions.at(-1)?.hideSpeed === true,
  );
  check('asks for the horizontal distance to A', /horizontally from the hit point to A/i.test(last(h)), last(h));
  check('a whole-number distance is typed, not chosen', h.hasNumberInput());
  for (const value of distance) await h.enter(value);
  check('the found distance appears on the construction line', /· 9 m$/.test(h.guides[0]?.label || ''), h.guides[0]?.label);

  check('asks for the vertical fall to A', /fall between the hit point and A/i.test(last(h)), last(h));
  check('the 1.0 m fall is typed, not chosen', h.hasNumberInput());
  for (const value of fall) await h.enter(value);
  check('the found fall appears on the construction line', /· 1\.0 m$/.test(h.guides[1]?.label || ''), h.guides[1]?.label);

  check('asks for the fall time', /How long does the ball take to fall 1\.0 m/i.test(last(h)), last(h));
  check('the fall time is chosen from three candidates',
    h.options().join(',') === '0.45 s,0.66 s,0.80 s', h.options().join(','));
  for (const value of time) await h.choose(value);

  check('asks for the hidden A-point speed', /speed of the serve that just reaches A/i.test(last(h)), last(h));
  check('speed candidates come from the three fall times',
    h.options().join(',') === '11.25 m/s,13.6 m/s,20.1 m/s', h.options().join(','));
  for (const value of speed) await h.choose(value);
}

async function startMax(h, answer = 'C') {
  check('asks for the maximum-speed boundary point', /fastest legal serve/i.test(h.messages().at(-1) || ''));
  check('marks A, B, and C for the other boundary', h.markers.map((p) => p.id).join('') === 'ABC');
  await h.choose(answer);
}

async function solveMaxSpeed(h, {
  distance = [18],
  fall = ['3.2 m'],
  time = ['0.80 s'],
  speed = ['22.5 m/s'],
} = {}) {
  check('shows only C for the limiting serve', h.markers.map((p) => p.id).join('') === 'C');
  check('draws C horizontal and vertical construction lines',
    h.guides.map((g) => g.kind).join(',') === 'horizontal,vertical');
  check('C limiting serve animates the player with its speed hidden',
    h.serveOptions.at(-1)?.animatePlayer === true && h.serveOptions.at(-1)?.hideSpeed === true,
  );
  check('asks for the horizontal distance to C', /horizontally from the hit point to C/i.test(last(h)), last(h));
  check('the 18 m distance is typed', h.hasNumberInput());
  for (const value of distance) await h.enter(value);

  check('asks for the vertical fall to C', /fall between the hit point and C/i.test(last(h)), last(h));
  check('the 3.2 m fall is chosen, because it is not a whole number',
    !h.hasNumberInput() && h.options().join(',') === '1.0 m,2.2 m,3.2 m', h.options().join(','));
  for (const value of fall) await h.choose(value);

  check('asks for the full fall time', /How long does the ball take to fall 3\.2 m/i.test(last(h)), last(h));
  check('C fall time is chosen from the same three candidates',
    h.options().join(',') === '0.45 s,0.66 s,0.80 s', h.options().join(','));
  for (const value of time) await h.choose(value);

  check('asks for the hidden C-point speed', /speed of the serve that just lands at C/i.test(last(h)), last(h));
  check('C speed candidates come from the three fall times',
    h.options().join(',') === '22.5 m/s,27.1 m/s,40.2 m/s', h.options().join(','));
  for (const value of speed) await h.choose(value);
}

async function finish(h, wrongSpeeds = [], combine = ['Both at once']) {
  check('states the strict minimum-speed condition', h.said(/v > 20\.1 m\/s/));
  check('states the inclusive maximum-speed condition', h.said(/v ≤ 22\.5 m\/s/));
  check('lists the two conditions before combining them', h.said(/You now have two conditions/));
  check('asks whether both conditions must hold', /both conditions/i.test(last(h)), last(h));
  check('offers both-or-one as the choices', h.options().join(',') === 'Both at once,One is enough');
  for (const answer of combine) await h.choose(answer);
  check('confirms that the conditions overlap', h.said(/where the two conditions overlap/));
  check('combines both limits', h.said(/20\.1 < v ≤ 22\.5 m\/s/));
  check('asks for the whole-number answers', /whole-number speeds/i.test(h.messages().at(-1) || ''));
  for (const wrongSpeed of wrongSpeeds) {
    await h.chooseMulti([wrongSpeed]);
    check('a wrong final speed is demonstrated', h.served.at(-1) === Number.parseInt(wrongSpeed, 10));
    check(
      'wrong final speed is explained',
      wrongSpeed === '20 m/s' ? h.said(/still too slow to clear the net/i) : h.said(/lands long beyond the baseline/i),
    );
  }
  await h.chooseMulti(['21 m/s', '22 m/s']);
}

// Opening is deliberately quiet: the student begins by trying a serve.
{
  const h = harness();
  h.coach.greet();
  await dom.settle(50);
  check('opening gives a short welcome', h.said(/Welcome.*Have a try.*Good luck/i));
  check('opening offers no choices', h.options().length === 0);
  check('opening does not run a demonstration', h.served.length === 0);
}

// A net fault opens the minimum-speed boundary; the other end follows.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  check('net fault reports the observed height', h.said(/1\.40 m/));
  await h.choose('Slower');
  check('wrong net diagnosis triggers two full slower serves', h.served.join(',') === '14,13');
  check('slower comparisons keep the full player animation',
    h.serveOptions.every((options) => options.animatePlayer === true));
  check('comparison explains the longer fall', h.said(/spends longer falling/i));
  await h.choose('Faster');
  check('a net fault starts at the minimum-speed boundary', h.said(/Start with the minimum-speed boundary/i));
  await startMin(h, 'B');
  check('choosing B gets the deterministic preset answer',
    h.said(/B is on the floor at the foot of the net/i) && h.said(/11\.25 m\/s/));
  check('minimum-speed point question is repeated', h.options().length === 3);
  check('canvas marker answers are accepted', h.coach.answer('A') === true);
  await dom.settle(50);
  await solveMinSpeed(h, { speed: ['11.25 m/s', '20.1 m/s'] });
  check('a wrong speed shows the two-step calculation', h.said(/Write it in two steps/i));
  check('the other end is introduced as a peer, not a sequel',
    h.said(/That leaves the maximum-speed boundary/i) && !h.said(/second boundary/i));
  await startMax(h);
  await solveMaxSpeed(h);
  await finish(h);
  check('correct final answer is confirmed', h.said(/Exactly\. 21 m\/s and 22 m\/s/i));
  check('court was reset for both point choices and limiting serves', h.clearCount === 4);
}

// A long serve opens the maximum-speed boundary first, and still closes the other.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 25));
  await dom.settle(50);
  check('long serve reports the overshoot', h.said(/2\.0 m beyond/i));
  await h.choose('Faster');
  check('wrong long diagnosis triggers two full faster serves', h.served.join(',') === '26,27');
  check('faster comparisons keep the full player animation',
    h.serveOptions.every((options) => options.animatePlayer === true));
  check('comparison explains the increasing overshoot', h.said(/faster serve travels farther/i));
  await h.choose('Slower');
  check('wrong long diagnosis is corrected', h.said(/must be slower/i));
  check('a long serve starts at the maximum-speed boundary', h.said(/Start with the maximum-speed boundary/i));
  await startMax(h);
  await solveMaxSpeed(h, { speed: ['40.2 m/s', '22.5 m/s'] });
  check('a wrong C speed shows the two-step calculation in math',
    h.said(/Write it in two steps/i) && h.said(/18.*0\.800.*22\.5/i));
  check('the remaining end is introduced as a peer', h.said(/That leaves the minimum-speed boundary/i));
  await startMin(h);
  await solveMinSpeed(h);
  await finish(h, ['20 m/s', '23 m/s'], ['One is enough', 'Both at once']);
  check('"one is enough" is tested with one serve per condition', h.served.includes(16) && h.served.includes(25));
  check('the counter-example serves are explained', h.said(/meets one condition and still fails/));
  check('wrong final answer is corrected with both failure modes',
    h.said(/20 m\/s is still too slow/i) && h.said(/23 m\/s lands long/i));
}

// A legal serve opens the fast track: name the whole set, then name both
// boundary points. Getting both right ends the lesson immediately.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 21));
  await dom.settle(50);
  check('a legal serve is reported before anything is asked', h.said(/21 m\/s worked/i));
  check('the fast track asks what else works', /every whole-number speed that works/i.test(h.messages().at(-1) || ''));
  check('the fast track offers every candidate speed', h.options().join(',') === '20 m/s,21 m/s,22 m/s,23 m/s');
  check('the speed the student already served starts selected',
    h.optionByLabel('21 m/s')?.dataset.selected === 'true' &&
      h.optionByLabel('22 m/s')?.dataset.selected === 'false');
  await h.choose('22 m/s');
  check('the complete set is confirmed', h.said(/21 m\/s and 22 m\/s, and nothing else/i));
  check('the fast track then asks for both boundary points',
    /Select both boundary points/i.test(h.messages().at(-1) || '') &&
      h.markers.map((p) => p.id).join('') === 'ABC');
  await h.chooseMulti(['A', 'C']);
  check('the fast track states both conditions', h.said(/v > 20\.1 m\/s/) && h.said(/v ≤ 22\.5 m\/s/));
  check('the fast track combines the interval', h.said(/20\.1 < v ≤ 22\.5 m\/s/));
  check('the fast track celebrates without re-deriving', h.celebration() !== '' && h.served.length === 0);
  check('the fast track marks the whole lesson complete',
    h.coach.progress().complete === true && h.coach.progress().min === true && h.coach.progress().max === true);
  check('the fast track never asks a boundary point one at a time', !h.said(/slowest legal serve just pass through/i));
}

// A wrong speed in the fast track demonstrates the failure and hands the
// student back to the ordinary derivation, so both ends still get thought about.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 22));
  await dom.settle(50);
  check('the served speed is preselected whichever legal speed it was',
    h.optionByLabel('22 m/s')?.dataset.selected === 'true');
  await h.choose('23 m/s');
  check('a wrong fast-track speed is demonstrated', h.served.at(-1) === 23);
  check('a wrong fast-track speed is explained', h.said(/23 m\/s lands long beyond the baseline/i));
  check('the fast track hands back to the derivation', h.said(/two edges we have not found yet/i));
  await startMin(h);
  await solveMinSpeed(h);
  await startMax(h);
  await solveMaxSpeed(h);
  await finish(h);
  check('the fallback path still derives both ends', h.said(/minimum-speed boundary is strict/) && h.said(/maximum-speed boundary includes its own value/));
}

// Choosing B in the fast track gets the same deterministic preset answer.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 21));
  await dom.settle(50);
  await h.choose('22 m/s');
  await h.choose('B');
  check('B in the fast track gets the preset explanation', h.said(/B is on the floor at the foot of the net/i));
  check('B in the fast track returns to the derivation', h.said(/build both limits properly/i));
  await startMin(h);
}

// A second wrong point selection is resolved as the correct boundary point so
// the student is never left without another option or a way to continue.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  await h.choose('Faster');
  await startMin(h, 'B');
  await h.choose('C');
  check('two wrong point choices are resolved as A', h.said(/We will use A/i));
  await solveMinSpeed(h);
}

// Teaching progress survives a new serve: a boundary that is already derived is
// never taught twice, and the coach resumes at the one still open.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  await h.choose('Faster');
  await h.choose('A');
  await solveMinSpeed(h);
  check('the minimum-speed boundary is recorded as derived', h.coach.progress().min === true);
  check('the maximum-speed boundary is still open', h.coach.progress().max === false);

  h.coach.interrupt();
  h.coach.reactTo(evaluate(problem, 25));
  await dom.settle(50);
  check('a new serve keeps the derivation already done', h.coach.progress().min === true);
  await h.choose('Slower');
  check('the coach resumes at the boundary still open', /fastest legal serve/i.test(h.messages().at(-1) || ''));
  await h.choose('C');
  await solveMaxSpeed(h);
  check('the finished boundary is not taught again', /both conditions/i.test(h.messages().at(-1) || ''));
  await h.choose('Both at once');
  await h.chooseMulti(['21 m/s', '22 m/s']);
  check('the lesson closes once both ends are established', h.coach.progress().complete === true);

  h.coach.interrupt();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  check('a serve after the lesson only gets a comment',
    h.said(/too slow, as expected/i) && h.options().length === 0);
}

// The calculation steps answer the named mistakes directly: the net's height
// used as the fall (E2), the whole flight time used at the net (E1), and half
// the court used for the far baseline (E7). Non-numbers are refused in place.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  await h.choose('Faster');
  await h.choose('A');
  await h.enter('nine');
  check('text that is not a number is refused without using up the attempt',
    h.hasNumberInput() && h.numberHint()?.hidden === false && /horizontally from the hit point to A/i.test(last(h)));
  await h.enter('9 m');
  check('a typed value with its unit is accepted', h.said(/^Yes — 9 m\.$/));
  await h.enter(2.2);
  check('using the net height as the fall gets the E2 diagnosis', h.said(/how high A is above the floor/));
  check('the fall question is asked again', /how far has the ball dropped when it reaches A/i.test(last(h)) && h.hasNumberInput());
  await h.enter('3.2');
  check('a second wrong fall states the value and moves on', h.said(/^We will use 1\.0 m\.$/));
  await h.choose('0.80 s');
  check('using the full flight time at the net gets the E1 diagnosis', h.said(/time to fall all the way to the floor/));
  check('the fall-time formula is shown after a wrong time', h.said(/depends only on the vertical fall/));
  await h.choose('0.45 s');
  check('a corrected time is confirmed', h.said(/^Yes — 0\.45 s\.$/));
  await h.choose('20.1 m/s');
  check('the minimum-speed boundary still completes', h.coach.progress().min === true);

  // the maximum-speed boundary follows; half a court is the E7 slip
  await h.choose('C');
  await h.enter(9);
  check('using the net distance for the baseline gets the E7 diagnosis', h.said(/only reaches the net\. C is on the far baseline/));
  await h.enter(18);
  await h.choose('1.0 m');
  check('a fall only to the net top is diagnosed for C', h.said(/only takes the ball down to the top of the net/));
  await h.choose('3.2 m');
  await h.choose('0.45 s');
  check('a net-top time for C is diagnosed', h.said(/only covers the first 1\.0 m/));
}

// Starting another conversation after interruption must still work.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  h.coach.interrupt();
  check('interruption clears pending choices', h.options().length === 0);
  h.coach.reactTo(evaluate(problem, 21));
  await dom.settle(50);
  check('a later conversation starts cleanly', h.said(/21 m\/s worked/i));
}

// An AI question pauses the deterministic multiple-choice path. After the AI
// reply, one acknowledgement restores the exact preset choices that were on
// screen so the learner can continue without mixing two contexts.
{
  const calls = [];
  let failNextResume = false;
  const store = createStore({
    problem,
    v: 21,
    phase: 'done',
    trails: [],
    result: evaluate(problem, 21),
  });
  const root = makeEl('div');
  const coach = createCoach(root, store, {
    attempts: { summary: () => ({ total: 3 }) },
    runtime: {
      async serve(v) {
        return evaluate(problem, v);
      },
      trail() {},
      mark() {},
      guide() {},
      clearCourt() {},
    },
    ai: {
      async ask(request) {
        calls.push(request);
        if (failNextResume && request.requestType === 'resume') {
          failNextResume = false;
          throw new Error('Temporary AI failure');
        }
        return {
          reply: request.requestType === 'resume'
            ? 'That time calculation explains the serve. Now return to the paused boundary question and choose the next step.'
            : 'Use \\(t_{\\mathrm{net}} = 9/v\\).',
          mode: 'ai-assisted',
          notice: '',
        };
      },
    },
    timing: { message: 0 },
  });
  coach.reactTo(evaluate(problem, 21));
  await dom.settle(50);

  const options = root.querySelector('#coachOptions');
  const originalOptions = options.children.map((item) => item.textContent);
  const question = root.querySelector('#coachAiQuestion');
  check('AI composer has no title, test badge, or retention notice',
    !/Ask AI Coach|>Test<|retained for 30 days/.test(root.innerHTML));
  check('AI composer starts as one row', /rows="1"/.test(root.innerHTML));
  check('AI thinking status is above the question box',
    root.innerHTML.indexOf('coach-ai-status') < root.innerHTML.indexOf('coach-ai-composer'));
  question.value = 'How do I calculate time to the net?';
  let prevented = false;
  question.dispatch('keydown', {
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    preventDefault() { prevented = true; },
  });
  await dom.settle(50);

  check('Enter sends the AI question', prevented && calls.length === 1);
  check('AI question uses the current experimental speed', calls[0]?.context.speed === 21);
  check('AI question includes the current serve verdict', calls[0]?.context.verdict === 'in');
  check('AI receives a description of what happened on screen', /finished|landed in bounds/.test(calls[0]?.context.uiState || ''));
  check('AI question includes the attempt count', calls[0]?.context.attemptCount === 3);
  check('AI receives recent preset Coach guidance', calls[0]?.context.recentCoach.length > 0);
  check('AI is told which boundary the lesson is on', calls[0]?.context.lessonRoute === 'fast-track');
  check('AI is told which step of that boundary is open', calls[0]?.context.lessonStep === 'speeds');
  check('AI is told which boundaries are already derived',
    Array.isArray(calls[0]?.context.lessonCompleted) && calls[0]?.context.lessonFinished === false);
  check('AI is told the preset question waiting on screen',
    /whole-number speed that works/i.test(calls[0]?.context.pendingQuestion || ''));
  check('AI reply replaces the preset choices with one continuation action',
    options.children.map((item) => item.textContent).join(',') === 'Got it — continue');
  check('AI composer reopens before the learner acknowledges the reply',
    question.disabled === false);

  question.value = 'Why does a shorter time help the ball clear the net?';
  question.dispatch('keydown', {
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    preventDefault() {},
  });
  await dom.settle(50);
  check('the learner can ask another question without acknowledging first',
    calls.length === 2 && calls[1]?.requestType === 'question');
  check('the continuation action remains while follow-up questions stay open',
    options.children.map((item) => item.textContent).join(',') === 'Got it — continue' && question.disabled === false);

  options.children[0].dispatch('click');
  check('acknowledgement shows thinking above the input while AI makes the bridge',
    root.querySelector('#coachAiStatus').textContent === 'AI Coach is thinking…');
  await dom.settle(50);
  check('acknowledgement calls AI in continuation bridge mode',
    calls.length === 3 && calls[2]?.requestType === 'resume');
  check('continuation receives the paused prompt and latest AI exchange',
    calls[2]?.context.resumeTarget &&
      calls[2]?.context.lastLearnerQuestion === 'Why does a shorter time help the ball clear the net?' &&
      /t_/.test(calls[2]?.context.lastAiReply || ''));
  check('AI bridge restores the exact preset choices',
    options.children.map((item) => item.textContent).join(',') === originalOptions.join(','));
  check('AI bridge returns focus to the AI composer', question.disabled === false);
  check('AI bridge is appended before the restored choices',
    root.querySelector('#coachLog').children.some((item) => /return to the paused boundary question/i.test(item.textContent)));

  let shiftPrevented = false;
  question.value = 'Keep writing';
  question.dispatch('keydown', {
    key: 'Enter',
    shiftKey: true,
    isComposing: false,
    preventDefault() { shiftPrevented = true; },
  });
  check('Shift+Enter keeps editing instead of sending', !shiftPrevented && calls.length === 3);

  store.set({ v: 25, phase: 'aim' });
  question.value = 'What is happening now?';
  question.scrollHeight = 72;
  question.dispatch('input');
  check('the question box grows with its text', question.style.height === '72px');
  question.dispatch('keydown', {
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    preventDefault() {},
  });
  await dom.settle(50);
  check('AI reads a newly selected current speed', calls[3]?.context.speed === 25);
  check('AI does not invent a result before the student serves',
    calls[3]?.context.verdict === 'unknown' && calls[3]?.context.heightAtNet === null);
  check('AI knows the selected speed has not been served',
    /has not served|no result is visible/.test(calls[3]?.context.uiState || ''));
  check('each AI interruption uses the same single continuation action',
    options.children.map((item) => item.textContent).join(',') === 'Got it — continue');
  failNextResume = true;
  options.children[0].dispatch('click');
  await dom.settle(50);
  check('each acknowledgement gets its own contextual AI bridge',
    calls.length === 5 && calls[4]?.requestType === 'resume');
  check('a failed AI bridge still shows a transition before restoring the choices',
    root.querySelector('#coachLog').children.some((item) => /connects to the paused Coach question/i.test(item.textContent)) &&
      options.children.map((item) => item.textContent).join(',') === originalOptions.join(','));
  check(
    'AI answer is appended to the same Coach log',
    root
      .querySelector('#coachLog')
      .children.some((item) => /t_\{\\mathrm\{net\}\}/.test(item.textContent)),
  );
}

let failures = 0;
for (const result of results) {
  console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : `\n       ${result.detail}`}`);
  if (!result.ok) failures += 1;
}
console.log(failures ? `\n${failures} failed` : '\ncoach flow passed');
process.exit(failures ? 1 : 0);
