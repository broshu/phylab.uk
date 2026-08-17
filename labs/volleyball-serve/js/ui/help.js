/**
 * The tutor dialogue. Pressing Help turns the Speed block into a conversation;
 * the ✕ in its corner turns it back into the slider.
 *
 * This module is only mechanics: render messages, wait for a button, drive the
 * scene through the runtime it is given. What the tutor actually says lives in
 * services/help-script.js.
 */
import { pickBranch } from '../services/help-script.js';

const CANCELLED = Symbol('help-cancelled');

const CLOSE_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M6 6l12 12M18 6L6 18"/></svg>';

/**
 * @param {HTMLElement} root
 * @param {ReturnType<import('../core/state.js').createStore>} store
 * @param {{
 *   tutor: {hint: Function},
 *   attempts: {summary: Function},
 *   runtime: {serve: Function, trail: Function, clearTrails: Function},
 *   onClose?: Function,
 *   timing?: {message?: number}
 * }} deps
 */
export function createHelp(root, store, { tutor, attempts, runtime, onClose, timing } = {}) {
  const messagePause = timing?.message ?? 700;
  let token = 0; // bumped on close, so a running script unwinds

  root.innerHTML = `
    <div class="help-head">
      <h2>Tutor</h2>
      <button class="help-close" type="button" aria-label="Back to the speed slider">
        ${CLOSE_ICON}
      </button>
    </div>
    <div class="help-log" id="helpLog" aria-live="polite"></div>
    <div class="help-options" id="helpOptions"></div>
  `;

  const log = root.querySelector('#helpLog');
  const options = root.querySelector('#helpOptions');
  root.querySelector('.help-close').addEventListener('click', () => close());

  function bubble(text, who = 'tutor') {
    const p = document.createElement('p');
    p.className = `msg msg-${who}`;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Every step checks the session is still the current one. */
  function guard(mine) {
    if (mine !== token) throw CANCELLED;
  }

  function makeDsl(mine) {
    return {
      async say(text) {
        guard(mine);
        bubble(text);
        await wait(messagePause);
        guard(mine);
      },

      async ask(text, choices) {
        guard(mine);
        bubble(text);
        const id = await new Promise((resolve) => {
          options.innerHTML = '';
          choices.forEach((choice) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ghost-button option';
            btn.textContent = choice.label;
            btn.addEventListener('click', () => {
              options.innerHTML = '';
              bubble(choice.label, 'mine');
              resolve(choice.id);
            });
            options.appendChild(btn);
          });
        });
        guard(mine);
        await wait(Math.min(messagePause, 400));
        guard(mine);
        return id;
      },

      /** Play a serve and resolve once the ball has stopped. */
      async serve(v, { keep = false, label = null } = {}) {
        guard(mine);
        const result = await runtime.serve(v);
        guard(mine);
        if (keep) runtime.trail(v, label);
        await wait(Math.min(messagePause, 350));
        guard(mine);
        return result;
      },
    };
  }

  function open() {
    token += 1;
    const mine = token;
    log.innerHTML = '';
    options.innerHTML = '';
    runtime.clearTrails();

    const state = store.get();
    const branch = pickBranch({ attemptCount: attempts.summary().total });
    root.dataset.branch = branch.id;

    Promise.resolve(
      branch.run({
        ...makeDsl(mine),
        tutor,
        problem: state.problem,
        bounds: state.result.bounds,
        result: state.result,
        attemptCount: attempts.summary().total,
      }),
    ).catch((e) => {
      if (e !== CANCELLED) throw e;
    });
  }

  function close() {
    token += 1; // unwinds any script waiting on a step
    options.innerHTML = '';
    runtime.clearTrails();
    onClose?.();
  }

  return { open, close, get branch() { return root.dataset.branch; } };
}
