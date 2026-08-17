/**
 * A DOM/canvas stub just rich enough to run this lab in node, shared by the
 * test files. It is not a browser: it records what the code does to the tree so
 * the tests can assert on it, and it hands out a manual frame clock.
 */
const noop = () => {};

export function makeCtx() {
  return new Proxy(
    {},
    {
      get: (t, k) => {
        if (k === 'canvas') return { width: 1000, height: 260 };
        if (k === 'measureText') return () => ({ width: 30 });
        if (k in t) return t[k];
        return typeof k === 'string' ? noop : undefined;
      },
      set: (t, k, v) => ((t[k] = v), true),
    },
  );
}

export function makeEl(tag = 'div') {
  const el = {
    tagName: tag,
    dataset: {},
    style: {},
    hidden: false,
    disabled: false,
    type: '',
    className: '',
    textContent: '',
    value: '0',
    checked: false,
    scrollTop: 0,
    scrollHeight: 0,
    children: [],
    parentElement: { clientWidth: 1000, clientHeight: 260 },
    listeners: {},

    set innerHTML(v) {
      el._html = v;
      el.children = [];
    },
    get innerHTML() {
      return el._html || '';
    },

    appendChild(child) {
      el.children.push(child);
      child.parentElement = el;
      return child;
    },
    addEventListener(type, fn) {
      (el.listeners[type] ||= []).push(fn);
    },
    dispatch(type) {
      (el.listeners[type] || []).slice().forEach((fn) => fn({ target: el }));
    },
    querySelector(sel) {
      el._q ||= {};
      return el._q[sel] || (el._q[sel] = makeEl(sel));
    },
    getContext: () => makeCtx(),
  };
  return el;
}

/**
 * Install the globals the lab expects. Returns helpers for the tests.
 * `pumpFrame()` runs one animation frame; `tick(seconds)` runs a stretch of
 * animation while still letting promises settle in between.
 */
export function installDom() {
  const registry = {};
  let rafCb = null;
  let clockMs = 0;

  global.document = {
    documentElement: makeEl('html'),
    createElement: (tag) => makeEl(tag),
    querySelector(sel) {
      return (registry[sel] ||= makeEl(sel));
    },
  };
  global.window = { devicePixelRatio: 2, addEventListener: noop };
  global.requestAnimationFrame = (fn) => {
    rafCb = fn;
  };

  function pumpFrame() {
    if (!rafCb) return false;
    const cb = rafCb;
    rafCb = null;
    clockMs += 16;
    cb(clockMs);
    return true;
  }

  function pump(seconds) {
    const end = clockMs + seconds * 1000;
    while (clockMs <= end && pumpFrame());
  }

  async function tick(seconds) {
    const end = clockMs + seconds * 1000;
    while (clockMs <= end) {
      if (!pumpFrame()) break;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const settle = async (rounds = 30) => {
    for (let i = 0; i < rounds; i++) await new Promise((r) => setTimeout(r, 0));
  };

  return { registry, pumpFrame, pump, tick, settle, el: (sel) => document.querySelector(sel) };
}
