/**
 * Speed control. Controls only call store.set or the callbacks — they never
 * compute physics. The flow is: choose a speed, then serve.
 * Sliders for hitHeight / netHeight are anticipated by problem.adjustable and
 * can be added here for later levels.
 */
const SERVE_LABEL = {
  aim: 'Serve',
  serve: 'Serving…',
  done: 'Serve again',
};

export function createControls(root, store, { onServe, onHelp, onAim } = {}) {
  const { problem } = store.get();
  const s = problem.speed;
  const decimals = Number.isInteger(s.step) ? 0 : 1;

  root.innerHTML = `
    <div class="section-title"><h2>Speed</h2></div>

    <div class="speed-value">
      <output id="speedOut">${store.get().v.toFixed(decimals)}</output>
      <span class="unit">${s.unit ?? 'm/s'}</span>
    </div>

    <input id="speed" type="range" min="${s.min}" max="${s.max}"
           step="${s.step}" value="${store.get().v}"
           aria-label="Launch speed in ${s.unit ?? 'm/s'}">
    <div class="scale"><span>${s.min}</span><span>${s.max}</span></div>

    <div class="button-col">
      <button id="serve" class="primary-button" type="button">Serve</button>
      <button id="help" class="ghost-button" type="button">Help</button>
    </div>
  `;

  const slider = root.querySelector('#speed');
  const out = root.querySelector('#speedOut');
  const serveBtn = root.querySelector('#serve');

  slider.addEventListener('input', () => {
    store.set({ v: Number(slider.value) });
    onAim?.(); // moving the slider takes us back to the standing pose
  });
  serveBtn.addEventListener('click', () => onServe?.(store.get()));
  root.querySelector('#help').addEventListener('click', () => onHelp?.(store.get()));

  store.subscribe((state) => {
    out.textContent = state.v.toFixed(decimals);
    if (Number(slider.value) !== state.v) slider.value = String(state.v);

    const flying = state.phase === 'serve';
    slider.disabled = flying;
    serveBtn.disabled = flying;
    serveBtn.textContent = SERVE_LABEL[state.phase];
    slider.dataset.verdict = state.phase === 'done' ? state.result.verdict : '';
  });

  return { setSpeed: (v) => store.set({ v }) };
}
