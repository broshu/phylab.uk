/**
 * Assembly entry point: wires config, core, services and UI together.
 * Adding a panel means importing one more create* here; nothing else changes.
 *
 * Flow: phase 'aim' (choose a speed) → 'serve' (animation) → 'done' (verdict),
 * after which the coach comments. The coach can play its own 'demo' serves
 * through `runtime`; those never set a verdict and are never logged.
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
import { createCoach } from './ui/coach.js';
import { renderRichText } from './ui/math.js';

const problem = getProblem(DEFAULT_PROBLEM_ID);
const tutor = createTutor();
const attempts = createAttemptLog({ problemId: problem.id });

const store = createStore({
  problem,
  v: problem.speed.default,
  phase: 'aim',
  showGhosts: false,
  trails: [], // earlier serves the coach is keeping on screen
  markers: [], // lettered points the coach is asking about
  guides: [], // construction lines the coach is discussing
  hideSpeed: false, // a boundary demonstration can keep its speed unknown
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

const taskPrompt = document.querySelector('#taskPrompt');
const promptFormula = problem.promptFormula;
if (promptFormula) {
  const at = problem.prompt.indexOf(promptFormula.source);
  if (at >= 0) {
    renderRichText(taskPrompt, [
      { type: 'text', text: problem.prompt.slice(0, at) },
      {
        type: 'math',
        tex: promptFormula.tex,
        fallback: promptFormula.fallback,
      },
      { type: 'text', text: problem.prompt.slice(at + promptFormula.source.length) },
    ]);
  } else {
    taskPrompt.textContent = problem.prompt;
  }
} else {
  taskPrompt.textContent = problem.prompt;
}

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
    coach.reactTo(result);
  },
  // clicking a lettered point on the court answers the coach's question
  onMarkerClick: (id) => coach.answer(id),
});

// the speed the student chose, so the coach's demonstrations can hand it back
let studentSpeed = store.get().v;

/** What a coach script is allowed to do to the scene. */
const runtime = {
  serve(v, { animatePlayer = false, hideSpeed = false } = {}) {
    return new Promise((resolve) => {
      pendingDemo = resolve;
      store.set({ v, phase: 'demo', hideSpeed });
      scene.serve({ demo: true, animatePlayer });
    });
  },
  trail(v, label) {
    const trails = store.get().trails;
    if (trails.some((t) => t.v === v)) return; // never keep the same path twice
    store.set({ trails: [...trails, { v, label }] });
  },
  clearTrails() {
    store.set({ trails: [] });
  },
  mark(markers) {
    store.set({ markers });
  },
  guide(guides) {
    store.set({ guides });
  },
  clearCourt() {
    store.set({ v: studentSpeed, phase: 'aim', trails: [], markers: [], guides: [], hideSpeed: false });
    scene.reset();
  },
};

const coach = createCoach(document.querySelector('#coach'), store, {
  tutor,
  attempts,
  runtime,
});

createControls(document.querySelector('#controls'), store, {
  onServe: () => {
    coach.interrupt(); // the student is taking over from whatever was being said
    studentSpeed = store.get().v;
    store.set({ phase: 'serve', trails: [], markers: [], guides: [], hideSpeed: false });
    scene.serve();
  },
  onAim: () => {
    studentSpeed = store.get().v;
    scene.reset();
  },
});

coach.greet();

const verdictReadout = document.querySelector('#verdictReadout');
store.subscribe(({ phase, result }) => {
  verdictReadout.textContent = phase === 'done' ? VERDICT_LABEL[result.verdict] : '—';
  verdictReadout.dataset.verdict = phase === 'done' ? result.verdict : '';
});

// Handy in the console while developing
window.__vb = { store, problem, attempts, tutor, scene, coach, runtime };
