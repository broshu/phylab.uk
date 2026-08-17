/**
 * Smoke test: runs the whole assembly against a fake DOM/canvas to catch
 * typos, undefined variables and broken subscriptions.  node tests/smoke.mjs
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
let frames = 0;
global.requestAnimationFrame = (fn) => {
  if (frames++ < 3) setTimeout(() => fn(frames * 16), 0);
};

const errors = [];
process.on('uncaughtException', (e) => errors.push(e));
process.on('unhandledRejection', (e) => errors.push(e));

await import('../js/main.js');
await new Promise((r) => setTimeout(r, 60));

const api = global.window.__vb;
const results = [];
const check = (name, cond, detail = '') => results.push({ name, ok: !!cond, detail });

check('assembly ran without errors', errors.length === 0, errors[0]?.stack || '');
check('window.__vb exported', !!api);

if (api) {
  const { store, attempts } = api;
  check('initial v = 15', store.get().v === 15);
  check('initial verdict = net', store.get().result.verdict === 'net');

  store.set({ v: 21 });
  check('21 m/s → in', store.get().result.verdict === 'in');
  check('derived result stays in sync', store.get().result.v === 21);

  store.set({ v: 25 });
  check('25 m/s → out', store.get().result.verdict === 'out');

  store.set({ showGhosts: true });
  check('boundary paths toggle', store.get().showGhosts === true);

  attempts.record(store.get().result);
  check('attempt logged', attempts.summary().total === 1);
  check('CSV export works', attempts.toCSV().split('\n').length === 2);
  attempts.reset();

  check('header read-out updated', document.querySelector('#speedReadout').textContent === '25.0 m/s');
  check('verdict read-out updated', document.querySelector('#verdictReadout').textContent === 'Out — long');
}

await new Promise((r) => setTimeout(r, 80));
check('render loop ran without errors', errors.length === 0, errors[0]?.stack || '');

let fails = 0;
for (const r of results) {
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
  if (!r.ok) fails++;
}
console.log(fails ? `\n${fails} failed` : '\nsmoke test passed');
process.exit(fails ? 1 : 0);
