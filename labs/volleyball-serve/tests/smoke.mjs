/**
 * Smoke test: runs the whole assembly against a fake DOM/canvas, then drives
 * the animation clock through a complete serve.  node tests/smoke.mjs
 */
const noop = () => {};

function makeCtx() {
  return new Proxy(
    {},
    {
      get: (t, k) => {
        if (k === 'canvas') return { width: 1000, height: 220 };
        if (k === 'measureText') return () => ({ width: 30 });
        if (k in t) return t[k];
        return typeof k === 'string' ? noop : undefined;
      },
      set: (t, k, v) => ((t[k] = v), true),
    },
  );
}

function makeEl(tag = 'div') {
  const el = {
    tagName: tag,
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    textContent: '',
    value: '0',
    checked: false,
    parentElement: { clientWidth: 1000, clientHeight: 240 },
    listeners: {},
    set innerHTML(v) { el._html = v; },
    get innerHTML() { return el._html || ''; },
    addEventListener(type, fn) { (el.listeners[type] ||= []).push(fn); },
    dispatch(type) { (el.listeners[type] || []).forEach((f) => f({ target: el })); },
    querySelector(sel) {
      el._q ||= {};
      return el._q[sel] || (el._q[sel] = makeEl(sel));
    },
    getContext: () => makeCtx(),
  };
  return el;
}

const registry = {};
global.document = {
  documentElement: makeEl('html'),
  querySelector(sel) {
    return (registry[sel] ||= makeEl(sel));
  },
};
global.window = { devicePixelRatio: 2, addEventListener: noop };

// Controllable frame clock so the test can run the serve animation to the end.
let rafCb = null;
let clockMs = 0;
global.requestAnimationFrame = (fn) => {
  rafCb = fn;
};
function pump(seconds) {
  const end = clockMs + seconds * 1000;
  while (rafCb && clockMs <= end) {
    const cb = rafCb;
    rafCb = null;
    clockMs += 16;
    cb(clockMs);
  }
}

const errors = [];
process.on('uncaughtException', (e) => errors.push(e));
process.on('unhandledRejection', (e) => errors.push(e));

await import('../js/main.js');
await new Promise((r) => setTimeout(r, 30));

const api = global.window.__vb;
const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });

const el = (sel) => document.querySelector(sel);
const control = (sel) => el('#controls').querySelector(sel);
const problemNetDistance = (store) => store.get().problem.netDistance;

check('assembly ran without errors', errors.length === 0, errors[0]?.stack || '');
check('window.__vb exported', !!api);

if (api) {
  const { store, attempts } = api;

  // ---- aiming ----
  pump(0.5);
  check('starts in the aiming phase', store.get().phase === 'aim');
  check('no verdict before serving', el('#verdictReadout').textContent === '—');
  check('serve button reads "Serve"', control('#serve').textContent === 'Serve');
  check('task prompt rendered', el('#taskPrompt').textContent.length > 40);
  check('render loop survives aiming', errors.length === 0, errors[0]?.stack || '');

  // ---- slider configured 0–30 in whole m/s ----
  const slider = control('#speed');
  check('slider range is 0–30', /min="0"/.test(el('#controls').innerHTML) && /max="30"/.test(el('#controls').innerHTML));
  check('slider step is 1', /step="1"/.test(el('#controls').innerHTML));

  // ---- choose a speed through the real slider listener ----
  slider.value = '21';
  slider.dispatch('input');
  check('slider sets the speed', store.get().v === 21);
  check('speed shown as a whole number', control('#speedOut').textContent === '21');
  check('still aiming after moving the slider', store.get().phase === 'aim');

  control('#help').dispatch('click'); // reserved, must not throw
  check('help button is inert for now', errors.length === 0, errors[0]?.stack || '');

  // ---- serve ----
  control('#serve').dispatch('click');
  check('serving phase entered', store.get().phase === 'serve');
  pump(0.4);
  check('slider locked during flight', control('#speed').disabled === true);
  check('no verdict mid-flight', el('#verdictReadout').textContent === '—');

  pump(4);
  await new Promise((r) => setTimeout(r, 30));
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
  pump(4);
  await new Promise((r) => setTimeout(r, 30));
  check('second serve judged out', store.get().result.verdict === 'out');
  check('two serves logged', attempts.summary().total === 2);
  check('CSV export works', attempts.toCSV().split('\n').length === 3);

  // ---- a serve too slow to reach the net still resolves ----
  slider.value = '5';
  slider.dispatch('input');
  control('#serve').dispatch('click');
  pump(4);
  await new Promise((r) => setTimeout(r, 30));
  check('5 m/s lands short of the net', store.get().result.xLand < problemNetDistance(store));
  check('and is judged a fault', store.get().result.verdict === 'net');
  check('phase still resolves to done', store.get().phase === 'done');
  attempts.reset();

  check('render loop ran without errors', errors.length === 0, errors[0]?.stack || '');
}

let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
  if (!r.ok) fails++;
}
console.log(fails ? `\n${fails} failed` : '\nsmoke test passed');
process.exit(fails ? 1 : 0);
