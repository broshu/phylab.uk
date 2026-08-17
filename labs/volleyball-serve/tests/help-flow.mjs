/**
 * The tutor script, driven directly with a stub runtime so it runs instantly.
 * node tests/help-flow.mjs
 */
import { installDom, makeEl } from './fake-dom.mjs';

const dom = installDom();

const { getProblem } = await import('../js/config/problem.js');
const { evaluate } = await import('../js/core/evaluator.js');
const { createStore } = await import('../js/core/state.js');
const { createHelp } = await import('../js/ui/help.js');
const { createTutor } = await import('../js/services/tutor.js');

const problem = getProblem();
const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });

/** Build a help panel wired to a runtime that records instead of animating. */
function harness({ attemptCount = 0 } = {}) {
  const served = [];
  const trails = [];
  const store = createStore({
    problem,
    v: problem.speed.default,
    phase: 'aim',
    trails: [],
    result: evaluate(problem, problem.speed.default),
  });
  const root = makeEl('div');
  let closed = false;

  const help = createHelp(root, store, {
    tutor: createTutor(),
    attempts: { summary: () => ({ total: attemptCount }) },
    runtime: {
      async serve(v) {
        served.push(v);
        return evaluate(problem, v);
      },
      trail: (v, label) => trails.push({ v, label }),
      clearTrails: () => trails.splice(0, trails.length),
    },
    onClose: () => {
      closed = true;
    },
    timing: { message: 0 },
  });

  const log = root.querySelector('#helpLog');
  const options = root.querySelector('#helpOptions');

  return {
    help,
    root,
    served,
    trails,
    get closed() {
      return closed;
    },
    messages: () => log.children.map((c) => c.textContent),
    tutorSays: () => log.children.filter((c) => c.className.includes('tutor')).map((c) => c.textContent),
    optionLabels: () => options.children.map((c) => c.textContent),
    async choose(label) {
      const btn = options.children.find((c) => c.textContent === label);
      if (!btn) throw new Error(`no option "${label}" — have ${options.children.map((c) => c.textContent)}`);
      btn.dispatch('click');
      await dom.settle();
    },
  };
}

// ---------------------------------------------------------------- cold start
{
  const h = harness({ attemptCount: 0 });
  h.help.open();
  await dom.settle();

  check('cold-start branch chosen', h.help.branch === 'cold-start');
  check('opens with an encouragement', /no idea where to start/i.test(h.messages()[0] || ''));
  check('serves the default speed first', h.served.join(',') === '15');
  check('the first serve is kept on screen', h.trails.length === 1 && h.trails[0].label === '15');
  check(
    'quotes the height at the net',
    h.tutorSays().some((m) => m.includes('1.40 m')),
    h.tutorSays().join(' | '),
  );
  check('asks too fast or too slow', /too fast, or too slow/i.test(h.messages().at(-1) || ''));
  check('offers exactly two options', h.optionLabels().join(',') === 'Too fast,Too slow');

  // ---- wrong answer: the five slower serves ----
  await h.choose('Too fast');
  check('wrong answer triggers the slower family', h.served.join(',') === '15,14,13,12,11,10');
  check('all six are kept on screen', h.trails.length === 6);
  check(
    'and it points out they are worse',
    h.tutorSays().some((m) => /does not even reach the net/i.test(m)),
  );
  check('then asks again', /try again/i.test(h.messages().at(-1) || ''));

  await h.choose('Too slow');
  check('no extra serves on the second answer', h.served.length === 6);
  check(
    'ends on the physical reason',
    h.tutorSays().some((m) => /spends longer on that trip/i.test(m)),
  );
  check(
    'and sends them back to the slider',
    /close this panel and try a bigger speed/i.test(h.messages().at(-1) || ''),
  );
}

// ---------------------------------------------------------------- right first time
{
  const h = harness({ attemptCount: 0 });
  h.help.open();
  await dom.settle();
  await h.choose('Too slow');
  check('correct answer skips the demonstration', h.served.join(',') === '15');
  check(
    'correct answer still explains why',
    h.tutorSays().some((m) => /arrives lower/i.test(m)),
  );
}

// ---------------------------------------------------------------- closing early
{
  const h = harness({ attemptCount: 0 });
  h.help.open();
  await dom.settle();
  const before = h.served.length;
  h.help.close();
  await dom.settle();
  check('closing reports back to main', h.closed);
  check('closing clears the kept trails', h.trails.length === 0);
  check('closing stops the script', h.served.length === before);
}

// ---------------------------------------------------------------- after serves
{
  const h = harness({ attemptCount: 3 });
  h.help.open();
  await dom.settle();
  check('a different branch once serves exist', h.help.branch === 'after-serves');
  check('it mentions how many serves', /3 serves so far/i.test(h.messages()[0] || ''));
  check('and it does not serve by itself', h.served.length === 0);
}

let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
  if (!r.ok) fails++;
}
console.log(fails ? `\n${fails} failed` : '\nhelp flow passed');
process.exit(fails ? 1 : 0);
