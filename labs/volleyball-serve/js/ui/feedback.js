/**
 * Coaching panel. The verdict is only revealed once the ball has landed, so
 * the student has to commit to a speed before finding out.
 * tutor.hint is async and stale responses are discarded, so a real model call
 * can be dropped in without touching this file.
 */
import { createLocalizer } from '../i18n.js?v=20260823-1';

export function createFeedback(root, store, { tutor, attempts, localizer } = {}) {
  const resolvedLocalizer = localizer ?? createLocalizer('en');
  const t = resolvedLocalizer.t.bind(resolvedLocalizer);
  const WAITING = {
    aim: { title: t('readyToServe'), body: t('readyToServeBody') },
    serve: { title: t('ballInAir'), body: t('ballInAirBody') },
  };
  root.innerHTML = `
    <div class="section-title"><h2>${t('coaching')}</h2><span id="progress" class="progress"></span></div>
    <p id="hintTitle" class="hint-title"></p>
    <p id="hintBody" class="hint-body"></p>
    <p id="hintScaffold" class="hint-scaffold" hidden></p>
  `;

  const titleEl = root.querySelector('#hintTitle');
  const bodyEl = root.querySelector('#hintBody');
  const scaffoldEl = root.querySelector('#hintScaffold');
  const progressEl = root.querySelector('#progress');

  let seq = 0;

  function show({ title, body, scaffold }) {
    titleEl.textContent = title;
    bodyEl.textContent = body;
    if (scaffold) {
      scaffoldEl.textContent = scaffold;
      scaffoldEl.hidden = false;
    } else {
      scaffoldEl.hidden = true;
    }
  }

  async function update(state) {
    const mine = ++seq;
    root.dataset.verdict = state.phase === 'done' ? state.result.verdict : 'waiting';

    if (state.phase !== 'done') {
      show(WAITING[state.phase]);
      return;
    }

    const hint = await tutor.hint({
      problem: state.problem,
      result: state.result,
      attempts: attempts.summary().total,
    });
    if (mine !== seq) return; // a newer request has already been issued
    show(hint);
  }

  function renderProgress() {
    const s = attempts.summary();
    progressEl.textContent = s.total
      ? t('serveProgress', {
        total: s.total,
        successes: s.successes,
        first: s.solved ? t('firstSuccess', { attempt: s.firstSuccessAt }) : '',
      })
      : t('everyServeLogged');
  }

  store.subscribe(update);
  renderProgress();

  return { renderProgress };
}
