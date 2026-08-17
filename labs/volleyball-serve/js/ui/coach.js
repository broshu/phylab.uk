/**
 * The coach panel: a running conversation beside the court. It speaks when the
 * page opens and again after every serve, and it can ask a question or play a
 * few demonstration serves of its own.
 *
 * This module is only mechanics: render messages, wait for a button, drive the
 * scene through the runtime it is given, and abandon whatever it was saying if
 * something new happens. What the coach actually says lives in
 * services/coach-script.js.
 */
import { opening, reaction } from '../services/coach-script.js';

const CANCELLED = Symbol('coach-cancelled');

/**
 * @param {HTMLElement} root
 * @param {ReturnType<import('../core/state.js').createStore>} store
 * @param {{
 *   tutor: {hint: Function},
 *   attempts: {summary: Function},
 *   runtime: {serve: Function, trail: Function, clearTrails: Function},
 *   timing?: {message?: number}
 * }} deps
 */
export function createCoach(root, store, { tutor, attempts, runtime, timing } = {}) {
  const messagePause = timing?.message ?? 700;
  let token = 0; // bumped whenever a script is abandoned

  root.innerHTML = `
    <h2>Coach</h2>
    <div class="coach-log" id="coachLog" aria-live="polite"></div>
    <div class="coach-options" id="coachOptions"></div>
  `;

  const log = root.querySelector('#coachLog');
  const options = root.querySelector('#coachOptions');

  // the question currently on screen, so it can also be answered by clicking
  // the court instead of the buttons
  let pending = null;

  function bubble(text, who = 'coach') {
    const p = document.createElement('p');
    p.className = `msg msg-${who}`;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Every step checks that its script is still the current one. */
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
          const pick = (choice) => {
            pending = null;
            options.innerHTML = '';
            bubble(choice.reply ?? choice.label, 'mine');
            resolve(choice.id);
          };
          pending = { choices, pick };
          options.innerHTML = '';
          choices.forEach((choice) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ghost-button option';
            btn.textContent = choice.label;
            btn.addEventListener('click', () => pick(choice));
            options.appendChild(btn);
          });
        });
        guard(mine);
        await wait(Math.min(messagePause, 400));
        guard(mine);
        return id;
      },

      /** Play a demonstration serve; resolves once the ball has stopped. */
      async serve(v, { keep = false, label = null } = {}) {
        guard(mine);
        const result = await runtime.serve(v);
        guard(mine);
        if (keep) runtime.trail(v, label);
        await wait(Math.min(messagePause, 350));
        guard(mine);
        return result;
      },

      /** Keep a trajectory on screen without replaying it. */
      keep(v, label) {
        runtime.trail(v, label);
      },

      /** Put lettered, clickable points on the court. */
      mark(markers) {
        runtime.mark(markers);
      },

      /** Wipe the court back to a clean standing pose. */
      clearCourt() {
        runtime.clearCourt();
      },
    };
  }

  /** Start a script, abandoning any script still running. */
  function run(script, extra = {}) {
    token += 1;
    const mine = token;
    pending = null;
    options.innerHTML = '';

    const state = store.get();
    return Promise.resolve(
      script({
        ...makeDsl(mine),
        tutor,
        problem: state.problem,
        bounds: state.result.bounds,
        attemptCount: attempts.summary().total,
        ...extra,
      }),
    ).catch((e) => {
      if (e !== CANCELLED) throw e;
    });
  }

  return {
    /** First words, before anything has been served. */
    greet() {
      log.innerHTML = '';
      return run(opening);
    },

    /** Called after the student's ball has landed. */
    reactTo(result) {
      return run(reaction, { result, v: result.v });
    },

    /**
     * Answer the question on screen from somewhere else — clicking a marker on
     * the court. Ignored if that id is not one of the choices being offered.
     */
    answer(id) {
      const choice = pending?.choices.find((c) => c.id === id);
      if (choice) pending.pick(choice);
      return !!choice;
    },

    /** Drop whatever is being said (the student has taken over). */
    interrupt() {
      token += 1;
      pending = null;
      options.innerHTML = '';
    },
  };
}
