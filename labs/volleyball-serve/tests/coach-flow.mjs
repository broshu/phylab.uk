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
  };
}

async function startMin(h, answer = 'A') {
  check('asks for the minimum-speed boundary point', /slowest legal serve/i.test(h.messages().at(-1) || ''));
  check('marks A, B, and C', h.markers.map((p) => p.id).join('') === 'ABC');
  await h.choose(answer);
}

async function solveMinSpeed(h, answer = '20.1 m/s') {
  check('shows only A for the limiting serve', h.markers.map((p) => p.id).join('') === 'A');
  check('draws horizontal and vertical construction lines', h.guides.map((g) => g.kind).join(',') === 'horizontal,vertical');
  check('limiting serve animates the player with its speed hidden',
    h.serveOptions.at(-1)?.animatePlayer === true && h.serveOptions.at(-1)?.hideSpeed === true,
  );
  check('asks for the hidden A-point speed', /speed of the serve that just reaches A/i.test(h.messages().at(-1) || ''));
  check('offers three candidate speeds', h.options().length === 3);
  await h.choose(answer);
}

async function startMax(h, answer = 'C') {
  check('asks for the maximum-speed boundary point', /fastest legal serve/i.test(h.messages().at(-1) || ''));
  check('marks A, B, and C for the other boundary', h.markers.map((p) => p.id).join('') === 'ABC');
  await h.choose(answer);
}

async function solveMaxSpeed(h, answer = '22.5 m/s') {
  check('shows only C for the limiting serve', h.markers.map((p) => p.id).join('') === 'C');
  check('draws C horizontal and vertical construction lines',
    h.guides.map((g) => g.kind).join(',') === 'horizontal,vertical');
  check('C limiting serve animates the player with its speed hidden',
    h.serveOptions.at(-1)?.animatePlayer === true && h.serveOptions.at(-1)?.hideSpeed === true,
  );
  check('asks for the hidden C-point speed', /speed of the serve that just lands at C/i.test(h.messages().at(-1) || ''));
  check('offers three candidate speeds for C', h.options().length === 3);
  await h.choose(answer);
}

async function finish(h, wrongSpeeds = []) {
  check('states the strict minimum-speed condition', h.said(/v > 20\.1 m\/s/));
  check('states the inclusive maximum-speed condition', h.said(/v ≤ 22\.5 m\/s/));
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
  await solveMinSpeed(h, '9.0 m/s');
  check('a wrong speed shows the two-step calculation', h.said(/Write it in two steps/i));
  await h.choose('20.1 m/s');
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
  await solveMaxSpeed(h, '18.0 m/s');
  check('a wrong C speed shows the two-step calculation in math',
    h.said(/Write it in two steps/i) && h.said(/18.*0\.800.*22\.5/i));
  await h.choose('22.5 m/s');
  check('the remaining end is introduced as a peer', h.said(/That leaves the minimum-speed boundary/i));
  await startMin(h);
  await solveMinSpeed(h);
  await finish(h, ['20 m/s', '23 m/s']);
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
  await h.choose('20.1 m/s');
  check('the minimum-speed boundary is recorded as derived', h.coach.progress().min === true);
  check('the maximum-speed boundary is still open', h.coach.progress().max === false);

  h.coach.interrupt();
  h.coach.reactTo(evaluate(problem, 25));
  await dom.settle(50);
  check('a new serve keeps the derivation already done', h.coach.progress().min === true);
  await h.choose('Slower');
  check('the coach resumes at the boundary still open', /fastest legal serve/i.test(h.messages().at(-1) || ''));
  await h.choose('C');
  await h.choose('22.5 m/s');
  check('the finished boundary is not taught again', /whole-number speeds/i.test(h.messages().at(-1) || ''));
  await h.chooseMulti(['21 m/s', '22 m/s']);
  check('the lesson closes once both ends are established', h.coach.progress().complete === true);

  h.coach.interrupt();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  check('a serve after the lesson only gets a comment',
    h.said(/too slow, as expected/i) && h.options().length === 0);
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
