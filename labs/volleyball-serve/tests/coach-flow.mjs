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
  const trails = [];
  let markers = [];
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
      async serve(v) {
        served.push(v);
        return evaluate(problem, v);
      },
      trail(v, label) {
        if (!trails.some((t) => t.v === v)) trails.push({ v, label });
      },
      mark(list) {
        markers = list;
      },
      clearCourt() {
        clearCount += 1;
        trails.splice(0, trails.length);
        markers = [];
      },
    },
    timing: { message: 0 },
  });
  const log = root.querySelector('#coachLog');
  const options = root.querySelector('#coachOptions');

  return {
    coach,
    served,
    trails,
    get markers() {
      return markers;
    },
    get clearCount() {
      return clearCount;
    },
    messages: () => log.children.map((c) => c.textContent),
    said: (pattern) => log.children.some((c) => pattern.test(c.textContent)),
    options: () => options.children.map((c) => c.textContent),
    async choose(label) {
      const button = options.children.find((c) => c.textContent === label);
      if (!button) throw new Error(`no option “${label}”; have [${this.options().join(', ')}]`);
      button.dispatch('click');
      await dom.settle(50);
    },
  };
}

async function startLower(h, answer = 'A — the top of the net') {
  check('asks for the lower-bound point', /slowest legal serve/i.test(h.messages().at(-1) || ''));
  check('marks A, B, and C', h.markers.map((p) => p.id).join('') === 'ABC');
  await h.choose(answer);
}

async function startUpper(h, answer = 'C — the far baseline') {
  check('asks for the upper-bound point', /fastest legal serve/i.test(h.messages().at(-1) || ''));
  check('marks A, B, and C for the upper bound', h.markers.map((p) => p.id).join('') === 'ABC');
  await h.choose(answer);
}

async function finish(h, answer = '21 and 22 m/s') {
  check('states the strict lower inequality', h.said(/v > 20\.1 m\/s/));
  check('states the inclusive upper inequality', h.said(/v ≤ 22\.5 m\/s/));
  check('combines both inequalities', h.said(/20\.1 < v ≤ 22\.5 m\/s/));
  check('asks for the whole-number answers', /whole-number slider/i.test(h.messages().at(-1) || ''));
  await h.choose(answer);
}

// Opening remains optional: a student can take control, or ask for a single
// observation which then enters the same teaching sequence as a real serve.
{
  const h = harness();
  h.coach.greet();
  await dom.settle(50);
  check('opening frames two boundary conditions', h.said(/two boundary conditions/i));
  await h.choose('I will serve first');
  check('declining the demo does not serve for the student', h.served.length === 0);
}
{
  const h = harness();
  h.coach.greet();
  await dom.settle(50);
  await h.choose('Show me an example');
  check('opening demo uses the default speed', h.served.join(',') === '15');
  check('demo enters the net diagnosis', /faster or slower/i.test(h.messages().at(-1) || ''));
}

// A net fault teaches why slower is worse, then derives A before C.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 15));
  await dom.settle(50);
  check('net fault reports the observed height', h.said(/1\.40 m/));
  await h.choose('Too slow');
  check('wrong net diagnosis triggers slower comparison serves', h.served.join(',') === '14,13,12,11,10');
  check('comparison explains the longer fall', h.said(/spends longer falling/i));
  await h.choose('Too fast');
  await startLower(h, 'B — the foot of the net');
  check('wrong lower point is corrected', h.said(/below the tape/i));
  check('lower-bound question is repeated', h.options().length === 3);
  check('canvas marker answers are accepted', h.coach.answer('A') === true);
  await dom.settle(50);
  await startUpper(h);
  await finish(h);
  check('correct final answer is confirmed', h.said(/Exactly\. 21 m\/s and 22 m\/s/i));
  check('court was reset independently for both boundaries', h.clearCount === 2);
}

// An out serve starts with C, but still completes the lower-bound reasoning.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 25));
  await dom.settle(50);
  check('long serve reports the overshoot', h.said(/2\.0 m beyond/i));
  await h.choose('Too fast');
  check('wrong long diagnosis is corrected', h.said(/must be slower/i));
  await startUpper(h);
  await startLower(h);
  await finish(h, '22 and 23 m/s');
  check('wrong final answer is corrected with both failure modes', h.said(/20 is too slow.*23 lands long/i));
}

// A good serve is evidence rather than a shortcut: it still requires both
// limiting paths and ends with the same interval.
{
  const h = harness();
  h.coach.reactTo(evaluate(problem, 21));
  await dom.settle(50);
  check('good serve does not reveal the interval immediately', h.said(/evidence, not yet the explanation/i));
  await startLower(h);
  await startUpper(h);
  await finish(h);
  check('good-serve path completes both calculations', h.said(/v_min/) && h.said(/v_max/));
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

let failures = 0;
for (const result of results) {
  console.log(`  ${result.ok ? 'ok  ' : 'FAIL'} ${result.name}${result.ok ? '' : `\n       ${result.detail}`}`);
  if (!result.ok) failures += 1;
}
console.log(failures ? `\n${failures} failed` : '\ncoach flow passed');
process.exit(failures ? 1 : 0);
