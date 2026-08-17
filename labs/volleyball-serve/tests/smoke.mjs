/**
 * Smoke test: runs the whole assembly against a fake DOM/canvas, then drives
 * the animation clock through complete serves.  node tests/smoke.mjs
 */
import { installDom } from './fake-dom.mjs';

const dom = installDom();
const { el, tick, play, settle } = dom;

const errors = [];
process.on('uncaughtException', (e) => errors.push(e));
process.on('unhandledRejection', (e) => errors.push(e));

await import('../js/main.js');
await settle();

const api = global.window.__vb;
const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });
const control = (sel) => el('#controls').querySelector(sel);

check('assembly ran without errors', errors.length === 0, errors[0]?.stack || '');
check('window.__vb exported', !!api);

try {
  const { store, attempts } = api;

  // ---- aiming ----
  await tick(0.5);
  check('starts in the aiming phase', store.get().phase === 'aim');
  check('no verdict before serving', el('#verdictReadout').textContent === '—');
  check('serve button reads "Serve"', control('#serve').textContent === 'Serve');
  check('task prompt rendered', el('#taskPrompt').textContent.length > 40);
  check('render loop survives aiming', errors.length === 0, errors[0]?.stack || '');

  // ---- slider configured 0–30 in whole m/s ----
  const slider = control('#speed');
  const markup = el('#controls').innerHTML;
  check('slider range is 0–30', /min="0"/.test(markup) && /max="30"/.test(markup));
  check('slider step is 1', /step="1"/.test(markup));

  slider.value = '21';
  slider.dispatch('input');
  check('slider sets the speed', store.get().v === 21);
  check('speed shown as a whole number', control('#speedOut').textContent === '21');
  check('still aiming after moving the slider', store.get().phase === 'aim');

  // ---- serve ----
  control('#serve').dispatch('click');
  check('serving phase entered', store.get().phase === 'serve');
  await tick(0.4);
  check('slider locked during flight', control('#speed').disabled === true);
  check('no verdict mid-flight', el('#verdictReadout').textContent === '—');

  await tick(4);
  await settle();
  check('phase done after the ball lands', store.get().phase === 'done');
  check('verdict revealed', el('#verdictReadout').textContent === 'In');
  check('serve logged automatically', attempts.summary().total === 1);
  check('button offers another serve', control('#serve').textContent === 'Serve again');
  check('slider unlocked', control('#speed').disabled === false);

  // ---- a new speed resets to aiming ----
  slider.value = '25';
  slider.dispatch('input');
  check('new speed returns to aiming', store.get().phase === 'aim');
  check('verdict hidden again', el('#verdictReadout').textContent === '—');

  control('#serve').dispatch('click');
  await tick(4);
  await settle();
  check('second serve judged out', store.get().result.verdict === 'out');
  check('two serves logged', attempts.summary().total === 2);
  check('CSV export works', attempts.toCSV().split('\n').length === 3);

  // ---- a serve too slow to reach the net still resolves ----
  slider.value = '5';
  slider.dispatch('input');
  control('#serve').dispatch('click');
  await tick(4);
  await settle();
  check('5 m/s lands short of the net', store.get().result.xLand < store.get().problem.netDistance);
  check('and is judged a fault', store.get().result.verdict === 'net');
  check('phase still resolves to done', store.get().phase === 'done');
  attempts.reset();

  // ---- the coach reacts to a serve into the net ----
  const coachLog = () => el('#coach').querySelector('#coachLog').children;
  const coachOptions = () => el('#coach').querySelector('#coachOptions').children;
  check('the coach greeted on load', coachLog().length > 0);

  slider.value = '15';
  slider.dispatch('input');
  control('#serve').dispatch('click');
  await tick(4);
  await play(1200); // the coach speaks on a real clock
  check('15 m/s goes into the net', store.get().result.verdict === 'net');
  check('the coach asks a question about it', coachOptions().length === 2,
    [...coachLog()].map((c) => c.textContent).join(' | '));
  check(
    'and it names the height at the net',
    [...coachLog()].some((c) => /1\.40 m/.test(c.textContent)),
  );

  // the wrong answer makes the coach demonstrate: several serves, no verdict
  [...coachOptions()].find((b) => b.textContent === 'Too fast').dispatch('click');
  await play(2600); // long enough for the first of the slower serves to land
  check('a demonstration is running', store.get().phase === 'demo');
  check('slider locked while the coach demonstrates', control('#speed').disabled === true);
  check('a demo never shows a verdict', el('#verdictReadout').textContent === '—');
  check('demo serves are not logged', attempts.summary().total === 1);
  check('earlier paths are kept on screen', store.get().trails.length >= 2,
    `trails: ${JSON.stringify(store.get().trails)}`);

  // taking over: serving interrupts the coach and clears its trails
  slider.value = '21';
  slider.dispatch('input');
  control('#serve').dispatch('click');
  check('the student can take over', store.get().phase === 'serve');
  check('trails cleared when the student serves', store.get().trails.length === 0);
  await tick(4);
  await settle();
  check('their serve is judged as usual', el('#verdictReadout').textContent === 'In');

  await tick(0.5);
  check('render loop ran without errors', errors.length === 0, errors[0]?.stack || '');
} catch (e) {
  check('smoke test ran to the end', false, e?.stack || String(e));
}

let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
  if (!r.ok) fails++;
}
console.log(fails ? `\n${fails} failed` : '\nsmoke test passed');
process.exit(fails ? 1 : 0);
