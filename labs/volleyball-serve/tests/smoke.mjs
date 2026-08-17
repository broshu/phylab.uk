/**
 * Smoke test: runs the whole assembly against a fake DOM/canvas, then drives
 * the animation clock through complete serves.  node tests/smoke.mjs
 */
import { installDom } from './fake-dom.mjs';

const dom = installDom();
const { el, tick, settle } = dom;

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

if (api) {
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

  // ---- Help swaps the block, ✕ swaps it back ----
  slider.value = '18';
  slider.dispatch('input');
  control('#help').dispatch('click');
  await settle();
  check('help panel shown', el('#help').hidden === false);
  check('speed block hidden', el('#controls').hidden === true);
  check('tutor greeted the student', el('#help').querySelector('#helpLog').children.length > 0);

  // its demo serves need frames to land, and must not touch the verdict
  await tick(1.5);
  check('demo serve runs in its own phase', ['demo', 'aim'].includes(store.get().phase));
  check('a demo never shows a verdict', el('#verdictReadout').textContent === '—');
  check('demo serves are logged as nothing', attempts.summary().total === 0);

  el('#help').querySelector('.help-close').dispatch('click');
  await settle();
  check('closing brings the slider back', el('#controls').hidden === false);
  check('help panel hidden again', el('#help').hidden === true);
  check('the speed from before help is restored', store.get().v === 18);
  check('trails cleared on close', store.get().trails.length === 0);
  check('back to aiming', store.get().phase === 'aim');

  await tick(0.5);
  check('render loop ran without errors', errors.length === 0, errors[0]?.stack || '');
}

let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
  if (!r.ok) fails++;
}
console.log(fails ? `\n${fails} failed` : '\nsmoke test passed');
process.exit(fails ? 1 : 0);
