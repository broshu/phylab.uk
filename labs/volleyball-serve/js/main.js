/**
 * Assembly entry point: wires config, core, services and UI together.
 * Adding a panel means importing one more create* here; nothing else changes.
 */
import { getProblem, DEFAULT_PROBLEM_ID } from './config/problem.js';
import { createStore } from './core/state.js';
import { evaluate, Verdict } from './core/evaluator.js';
import { createTutor } from './services/tutor.js';
import { createAttemptLog } from './services/attempts.js';
import { createScene } from './ui/scene.js';
import { createControls } from './ui/controls.js';
import { createDerivation } from './ui/derivation.js';
import { createFeedback } from './ui/feedback.js';

const problem = getProblem(DEFAULT_PROBLEM_ID);
const tutor = createTutor();
const attempts = createAttemptLog({ problemId: problem.id });

const store = createStore({
  problem,
  v: problem.speed.default,
  showGhosts: false,
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
  }
  return rawSet(merged);
};

const VERDICT_LABEL = {
  [Verdict.IN]: 'In',
  [Verdict.NET]: 'Into the net',
  [Verdict.OUT]: 'Out — long',
};

const scene = createScene(document.querySelector('#stage'), store);
createDerivation(document.querySelector('#derivation'), store);

const feedback = createFeedback(document.querySelector('#feedback'), store, {
  tutor,
  attempts,
});

createControls(document.querySelector('#controls'), store, {
  onCommit: (state) => {
    attempts.record(state.result);
    feedback.renderProgress();
  },
  onReset: () => {
    attempts.reset();
    feedback.renderProgress();
  },
  onReplay: () => scene.replay(),
});

// Header read-outs
const speedReadout = document.querySelector('#speedReadout');
const verdictReadout = document.querySelector('#verdictReadout');
store.subscribe(({ v, result }) => {
  speedReadout.textContent = `${v.toFixed(1)} m/s`;
  verdictReadout.textContent = VERDICT_LABEL[result.verdict];
  verdictReadout.dataset.verdict = result.verdict;
});

// Handy in the console while developing
window.__vb = { store, problem, attempts, tutor, scene };
