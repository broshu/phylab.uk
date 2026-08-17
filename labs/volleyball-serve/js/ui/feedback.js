/**
 * Coaching panel: shows the verdict and asks the tutor service for an
 * explanation. tutor.hint is async and stale responses are discarded, so a
 * real model call can be dropped in without touching this file.
 */
export function createFeedback(root, store, { tutor, attempts }) {
  root.innerHTML = `
    <div class="section-title"><h2>Coaching</h2><span id="progress" class="progress"></span></div>
    <p id="hintTitle" class="hint-title"></p>
    <p id="hintBody" class="hint-body"></p>
    <p id="hintScaffold" class="hint-scaffold" hidden></p>
  `;

  const titleEl = root.querySelector('#hintTitle');
  const bodyEl = root.querySelector('#hintBody');
  const scaffoldEl = root.querySelector('#hintScaffold');
  const progressEl = root.querySelector('#progress');

  let seq = 0;

  async function update(state) {
    const mine = ++seq;
    root.dataset.verdict = state.result.verdict;
    const hint = await tutor.hint({
      problem: state.problem,
      result: state.result,
      attempts: attempts.summary().total,
    });
    if (mine !== seq) return; // a newer request has already been issued
    titleEl.textContent = hint.title;
    bodyEl.textContent = hint.body;
    if (hint.scaffold) {
      scaffoldEl.textContent = hint.scaffold;
      scaffoldEl.hidden = false;
    } else {
      scaffoldEl.hidden = true;
    }
  }

  function renderProgress() {
    const s = attempts.summary();
    progressEl.textContent = s.total
      ? `${s.total} logged · ${s.successes} good` +
        (s.solved ? ` · first on attempt ${s.firstSuccessAt}` : '')
      : 'Log an attempt once you think it is in.';
  }

  store.subscribe(update);
  renderProgress();

  return { renderProgress };
}
