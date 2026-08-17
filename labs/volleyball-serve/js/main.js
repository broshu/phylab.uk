/**
 * Assembly entry point: wires config, core, services and UI together.
 * Adding a panel means importing one more create* here; nothing else changes.
 *
 * Flow: phase 'aim' (choose a speed) → 'serve' (animation) → 'done' (verdict).
 * Help swaps the Speed block for the tutor dialogue, which plays its own
 * 'demo' serves through `runtime` and never sets a verdict.
 *
 * ui/derivation.js (live working) and ui/feedback.js (coaching) are written and
 * tested but deliberately not mounted — the page is kept to task, speed and
 * animation. Mount them by adding one line each, as below.
 */
import { getProblem, DEFAULT_PROBLEM_ID } from './config/problem.js';
import { createStore } from './core/state.js';
import { evaluate, Verdict } from './core/evaluator.js';
import { createTutor } from './services/tutor.js';
import { createAttemptLog } from './services/attempts.js';
import { createScene } from './ui/scene.js';
import { createControls } from './ui/controls.js';
import { createHelp } from './ui/help.js';

const problem = getProblem(DEFAULT_PROBLEM_ID);
const tutor = createTutor();
const attempts = createAttemptLog({ problemId: problem.id });

const store = createStore({
  problem,
  v: problem.speed.default,
  phase: 'aim',
  showGhosts: false,
  trails: [], // earlier serves the tutor is keeping on screen
  result: evaluate(problem, problem.speed.default),
});

// Derived state: intercept set() so result always matches v / problem.
const rawSet = store.set;
store.set = (patch) => {
  const cur = store.get();
  const next = typeof patch === 'function' ? patch(cur) : patch;
  const merged = { ...cur, ...next };
  if ('v' in next || 'problem' in next) {
    merged.result = evaluate(merged.problem, merged.v);
    if (!('phase' in next)) merged.phase = 'aim'; // a new speed means a new serve
  }
  return rawSet(merged);
};

const VERDICT_LABEL = {
  [Verdict.IN]: 'In',
  [Verdict.NET]: 'Into the net',
  [Verdict.OUT]: 'Out — long',
};

document.querySelector('#taskPrompt').textContent = problem.prompt;

// A demo serve resolves this promise when the ball stops, which is how the
// tutor script can `await serve(14)` and then talk about what happened.
let pendingDemo = null;
function settleDemo(result) {
  const resolve = pendingDemo;
  pendingDemo = null;
  resolve?.(result);
}

const scene = createScene(document.querySelector('#stage'), store, {
  onLanded: (result, { demo } = {}) => {
    if (demo) {
      settleDemo(result);
      return;
    }
    store.set({ phase: 'done' });
    attempts.record(result);
  },
});

const controlsEl = document.querySelector('#controls');
const helpEl = document.querySelector('#help');

/** What the tutor script is allowed to do to the scene. */
const runtime = {
  serve(v) {
    return new Promise((resolve) => {
      pendingDemo = resolve;
      store.set({ v, phase: 'demo' });
      scene.serve({ demo: true });
    });
  },
  trail(v, label) {
    store.set({ trails: [...store.get().trails, { v, label }] });
  },
  clearTrails() {
    store.set({ trails: [] });
  },
};

let speedBeforeHelp = store.get().v;

const help = createHelp(helpEl, store, {
  tutor,
  attempts,
  runtime,
  onClose: () => {
    settleDemo(store.get().result); // let an abandoned script unwind
    helpEl.hidden = true;
    controlsEl.hidden = false;
    store.set({ v: speedBeforeHelp, phase: 'aim', trails: [] });
    scene.reset();
  },
});

createControls(controlsEl, store, {
  onServe: () => {
    store.set({ phase: 'serve' });
    scene.serve();
  },
  onAim: () => scene.reset(),
  onHelp: () => {
    speedBeforeHelp = store.get().v;
    controlsEl.hidden = true;
    helpEl.hidden = false;
    help.open();
  },
});

const verdictReadout = document.querySelector('#verdictReadout');
store.subscribe(({ phase, result }) => {
  verdictReadout.textContent = phase === 'done' ? VERDICT_LABEL[result.verdict] : '—';
  verdictReadout.dataset.verdict = phase === 'done' ? result.verdict : '';
});

// Handy in the console while developing
window.__vb = { store, problem, attempts, tutor, scene, help, runtime };
