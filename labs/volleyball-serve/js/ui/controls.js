/**
 * The speed strip: one horizontal row under the animation — label, value,
 * slider, Serve. Controls only call store.set or the callbacks; they never
 * compute physics. Sliders for hitHeight / netHeight are anticipated by
 * problem.adjustable and can be added here for later levels.
 */
const SERVE_LABEL = {
  aim: 'Serve',
  serve: 'Serving…',
  demo: 'Watch…',
  done: 'Serve again',
};

export function createControls(root, store, { onServe, onAim } = {}) {
  const { problem } = store.get();
  const s = problem.speed;
  const decimals = Number.isInteger(s.step) ? 0 : 1;

  root.innerHTML = `
    <h2 class="strip-title">Speed</h2>

    <div class="speed-value">
      <output id="speedOut">${store.get().v.toFixed(decimals)}</output>
      <span class="unit">${s.unit ?? 'm/s'}</span>
    </div>

    <div class="slider-wrap">
      <span class="tick">${s.min}</span>
      <input id="speed" type="range" min="${s.min}" max="${s.max}"
             step="${s.step}" value="${store.get().v}"
             aria-label="Launch speed in ${s.unit ?? 'm/s'}">
      <span class="tick">${s.max}</span>
    </div>

    <button id="serve" class="primary-button" type="button">Serve</button>
  `;

  const slider = root.querySelector('#speed');
  const out = root.querySelector('#speedOut');
  const serveBtn = root.querySelector('#serve');

  slider.addEventListener('input', () => {
    store.set({ v: Number(slider.value) });
    onAim?.(); // moving the slider takes us back to the standing pose
  });
  serveBtn.addEventListener('click', () => onServe?.(store.get()));

  store.subscribe((state) => {
    out.textContent = state.v.toFixed(decimals);
    if (Number(slider.value) !== state.v) slider.value = String(state.v);

    // locked while a ball is in the air, whether it is the student's or the coach's
    const busy = state.phase === 'serve' || state.phase === 'demo';
    slider.disabled = busy;
    serveBtn.disabled = busy;
    serveBtn.textContent = SERVE_LABEL[state.phase];
    slider.dataset.verdict = state.phase === 'done' ? state.result.verdict : '';
  });

  return { setSpeed: (v) => store.set({ v }) };
}
