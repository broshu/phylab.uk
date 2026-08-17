/**
 * Input controls. Controls only call store.set or the callbacks — they never
 * compute physics. The flow is: choose a speed, then serve.
 * Sliders for hitHeight / netHeight are anticipated by problem.adjustable and
 * can be added here for later levels.
 */
const SERVE_LABEL = {
  aim: 'Serve',
  serve: 'Serving…',
  done: 'Serve again',
};

export function createControls(root, store, { onServe, onClear, onAim } = {}) {
  const { problem } = store.get();
  const s = problem.speed;

  root.innerHTML = `
    <div class="section-title">
      <h2>Controls</h2>
    </div>

    <div class="task">
      <h3>Task</h3>
      <p>${problem.prompt}</p>
    </div>

    <label class="slider-row">
      <span>${s.min}</span>
      <input id="speed" type="range" min="${s.min}" max="${s.max}"
             step="${s.step}" value="${store.get().v}"
             aria-label="Launch speed in metres per second">
      <output id="speedOut"></output>
    </label>

    <p class="hint-line" id="flowHint">Set a speed, then serve.</p>

    <label class="check">
      <input id="ghosts" type="checkbox">
      <span>Show the two boundary paths</span>
    </label>

    <div class="button-row">
      <button id="serve" class="primary-button" type="button">Serve</button>
      <button id="clear" class="ghost-button" type="button">Clear log</button>
    </div>
  `;

  const slider = root.querySelector('#speed');
  const out = root.querySelector('#speedOut');
  const ghosts = root.querySelector('#ghosts');
  const serveBtn = root.querySelector('#serve');
  const hint = root.querySelector('#flowHint');

  slider.addEventListener('input', () => {
    store.set({ v: Number(slider.value) });
    onAim?.(); // moving the slider takes us back to the standing pose
  });
  ghosts.addEventListener('change', () => store.set({ showGhosts: ghosts.checked }));
  serveBtn.addEventListener('click', () => onServe?.(store.get()));
  root.querySelector('#clear').addEventListener('click', () => onClear?.());

  store.subscribe((state) => {
    out.textContent = `${state.v.toFixed(1)} m/s`;
    if (Number(slider.value) !== state.v) slider.value = String(state.v);

    const flying = state.phase === 'serve';
    slider.disabled = flying;
    serveBtn.disabled = flying;
    serveBtn.textContent = SERVE_LABEL[state.phase];
    slider.dataset.verdict = state.phase === 'done' ? state.result.verdict : '';
    hint.textContent =
      state.phase === 'aim'
        ? 'Set a speed, then serve.'
        : flying
          ? 'Ball in the air…'
          : 'Move the slider to try another speed.';
  });

  return { setSpeed: (v) => store.set({ v }) };
}
