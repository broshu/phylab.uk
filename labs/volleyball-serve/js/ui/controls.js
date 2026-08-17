/**
 * Input controls. Controls only call store.set — they never compute physics.
 * Sliders for hitHeight / netHeight are already anticipated by
 * problem.adjustable and can be added here for later levels.
 */
export function createControls(root, store, { onCommit, onReset, onReplay } = {}) {
  const { problem } = store.get();
  const s = problem.speed;

  root.innerHTML = `
    <div class="section-title">
      <h2>Controls</h2>
      <button id="replayBtn" class="ghost-button" type="button">Replay</button>
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

    <label class="check">
      <input id="ghosts" type="checkbox">
      <span>Show the two boundary paths</span>
    </label>

    <div class="button-row">
      <button id="record" class="primary-button" type="button">Log this attempt</button>
      <button id="clear" class="ghost-button" type="button">Clear</button>
    </div>
  `;

  const slider = root.querySelector('#speed');
  const out = root.querySelector('#speedOut');
  const ghosts = root.querySelector('#ghosts');

  slider.addEventListener('input', () => store.set({ v: Number(slider.value) }));
  ghosts.addEventListener('change', () => store.set({ showGhosts: ghosts.checked }));
  root.querySelector('#record').addEventListener('click', () => onCommit?.(store.get()));
  root.querySelector('#clear').addEventListener('click', () => onReset?.());
  root.querySelector('#replayBtn').addEventListener('click', () => onReplay?.());

  store.subscribe((state) => {
    out.textContent = `${state.v.toFixed(1)} m/s`;
    if (Number(slider.value) !== state.v) slider.value = String(state.v);
    slider.dataset.verdict = state.result.verdict;
  });

  return { setSpeed: (v) => store.set({ v }) };
}
