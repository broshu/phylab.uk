/**
 * The coach scripts, driven directly with a stub runtime so they run instantly.
 * node tests/coach-flow.mjs
 */
import { installDom, makeEl } from './fake-dom.mjs';

const dom = installDom();

const { getProblem } = await import('../js/config/problem.js');
const { evaluate } = await import('../js/core/evaluator.js');
const { createStore } = await import('../js/core/state.js');
const { createCoach } = await import('../js/ui/coach.js');
const { createTutor } = await import('../js/services/tutor.js');

const problem = getProblem();
const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });

/** A coach panel wired to a runtime that records instead of animating. */
function harness({ attemptCount = 0 } = {}) {
  const served = [];
  const trails = [];
  let markers = [];
  let cleared = 0;
  const store = createStore({
    problem,
    v: problem.speed.default,
    phase: 'aim',
    trails: [],
    result: evaluate(problem, problem.speed.default),
  });
  const root = makeEl('div');

  const coach = createCoach(root, store, {
    tutor: createTutor(),
    attempts: { summary: () => ({ total: attemptCount }) },
    runtime: {
      async serve(v) {
        served.push(v);
        return evaluate(problem, v);
      },
      trail: (v, label) => {
        if (!trails.some((t) => t.v === v)) trails.push({ v, label });
      },
      clearTrails: () => trails.splice(0, trails.length),
      mark: (list) => {
        markers = list;
      },
      clearCourt: () => {
        cleared += 1;
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
    get cleared() {
      return cleared;
    },
    messages: () => log.children.map((c) => c.textContent),
    coachSays: () =>
      log.children.filter((c) => c.className.includes('coach')).map((c) => c.textContent),
    said: (re) => log.children.some((c) => re.test(c.textContent)),
    optionLabels: () => options.children.map((c) => c.textContent),
    async choose(label) {
      const btn = options.children.find((c) => c.textContent === label);
      if (!btn) throw new Error(`no option "${label}" — have [${options.children.map((c) => c.textContent)}]`);
      btn.dispatch('click');
      await dom.settle();
    },
  };
}

const netResult = evaluate(problem, 15);

// ---------------------------------------------------------------- opening
{
  const h = harness();
  h.coach.greet();
  await dom.settle();
  check('introduces itself', /i am your coach/i.test(h.messages()[0] || ''));
  check('offers to start you off', h.optionLabels().length === 2);
  await h.choose('I will try first');
  check('and says nothing more if declined', h.served.length === 0);
  check('no options left waiting', h.optionLabels().length === 0);
}

// ---------------------------------------------------------------- opening → demo
{
  const h = harness();
  h.coach.greet();
  await dom.settle();
  await h.choose('I have no idea where to start');
  check('serves the default speed itself', h.served.join(',') === '15');
  check('keeps that serve on screen', h.trails.length === 1);
  check('then asks too fast or too slow', /too fast, or too slow/i.test(h.messages().at(-1) || ''));
}

// ---------------------------------------------------------------- net fault
{
  const h = harness({ attemptCount: 1 });
  h.coach.reactTo(netResult);
  await dom.settle();

  check('quotes the height at the net', h.said(/1\.40 m/), h.messages().join(' | '));
  check('quotes how far below the tape', h.said(/0\.80 m below/));
  check('asks the question', /too fast, or too slow/i.test(h.messages().at(-1) || ''));
  check('two options offered', h.optionLabels().join(',') === 'Too fast,Too slow');

  await h.choose('Too fast');
  check('wrong answer triggers slower serves', h.served.join(',') === '14,13,12,11,10');
  check("keeps the student's serve plus the five", h.trails.length === 6);
  check('and points out they are worse', h.said(/do not\s+even reach it/i), h.messages().join(' | '));
  check('then asks again', /too fast, or too slow/i.test(h.messages().at(-1) || ''));

  await h.choose('Too slow');
  check('no further serves', h.served.length === 5);
  check('ends on the physical reason', h.said(/spends longer on that trip/i));
  check('then moves on to how much faster', h.said(/how much faster, at least/i));
  check('with three candidates marked', h.markers.length === 3);
}

// ---------------------------------------------------------------- net fault, right away
{
  const h = harness({ attemptCount: 1 });
  h.coach.reactTo(netResult);
  await dom.settle();
  await h.choose('Too slow');
  check('correct answer skips the demonstration', h.served.length === 0);
  check('but still explains why', h.said(/arrives lower/i));

  // ---- and moves straight on to "how much faster, at least?" ----
  check('asks how much faster', h.said(/how much faster, at least/i));
  check('clears the court for the geometry question', h.cleared === 1);
  check('marks three candidates', h.markers.length === 3);
  check(
    'A is the top of the net',
    h.markers[0].id === 'A' &&
      h.markers[0].x === problem.netDistance &&
      h.markers[0].y === problem.netHeight,
    JSON.stringify(h.markers),
  );
  check(
    'B is the foot of the net',
    h.markers[1].id === 'B' && h.markers[1].x === problem.netDistance && h.markers[1].y === 0,
  );
  check(
    'C is the far baseline',
    h.markers[2].id === 'C' && h.markers[2].x === problem.courtEnd && h.markers[2].y === 0,
  );
  check('says the marks can be tapped', h.said(/tap them on the court/i));
  check('offers three options', h.optionLabels().length === 3, h.optionLabels().join(' / '));
  check('and labels them with what they are', /top of the net/i.test(h.optionLabels()[0] || ''));

  // a wrong pick is corrected, then the question comes back
  await h.choose('B — the foot of the net');
  check('B is corrected as a serve in the net', h.said(/below the tape at the net/i));
  check('and the question is asked again', h.optionLabels().length === 3);

  // answering by clicking the court instead of the buttons
  check('the marker click is accepted', h.coach.answer('A') === true);
  await dom.settle();
  check('A is confirmed', h.said(/just brushes the top of the net/i), h.messages().join(' | '));
  check('nothing left waiting', h.optionLabels().length === 0);
  check('an unknown answer is ignored', h.coach.answer('Z') === false);
}

// ---------------------------------------------------------------- picking C
{
  const h = harness({ attemptCount: 1 });
  h.coach.reactTo(netResult);
  await dom.settle();
  await h.choose('Too slow');
  await h.choose('C — the far baseline');
  check('C is named as the other limit', h.said(/fastest\* legal|fastest.{0,3} legal/i),
    h.messages().join(' | '));
  check('and the question returns', h.optionLabels().length === 3);
  await h.choose('A — the top of the net');
  check('A accepted after a detour', h.said(/just brushes the top of the net/i));
}

// ---------------------------------------------------------------- long, and good
{
  const h = harness({ attemptCount: 2 });
  h.coach.reactTo(evaluate(problem, 25));
  await dom.settle();
  check('a long serve is explained', h.said(/overshooting the baseline/i), h.messages().join(' | '));
  check('no question for a long serve', h.optionLabels().length === 0);
  check('and no demonstration serves', h.served.length === 0);
}
{
  const h = harness({ attemptCount: 2 });
  h.coach.reactTo(evaluate(problem, 21));
  await dom.settle();
  check('a good serve is praised', h.said(/good serve/i));
  check('and the narrow window is mentioned', h.said(/2\.4 m\/s wide/));
}

// ---------------------------------------------------------------- interruption
{
  const h = harness({ attemptCount: 1 });
  h.coach.reactTo(netResult);
  await dom.settle();
  const before = h.messages().length;
  h.coach.interrupt();
  await dom.settle();
  check('interrupting clears the options', h.optionLabels().length === 0);
  check('and stops the script', h.messages().length === before);

  h.coach.reactTo(evaluate(problem, 21));
  await dom.settle();
  check('a new reaction still works afterwards', h.said(/good serve/i));
}

let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
  if (!r.ok) fails++;
}
console.log(fails ? `\n${fails} failed` : '\ncoach flow passed');
process.exit(fails ? 1 : 0);
