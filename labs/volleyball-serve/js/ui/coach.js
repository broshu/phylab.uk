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
import { renderRichText } from './math.js';

const CANCELLED = Symbol('coach-cancelled');

/**
 * @param {HTMLElement} root
 * @param {ReturnType<import('../core/state.js').createStore>} store
 * @param {{
 *   tutor: {hint: Function},
 *   attempts: {summary: Function},
 *   runtime: {serve: Function, trail: Function, clearTrails: Function, guide: Function},
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
    <div class="coach-celebration" id="coachCelebration" aria-live="polite" hidden></div>
  `;

  const log = root.querySelector('#coachLog');
  const options = root.querySelector('#coachOptions');
  const celebration = root.querySelector('#coachCelebration');

  // the question currently on screen, so it can also be answered by clicking
  // the court instead of the buttons
  let pending = null;

  function bubble(text, who = 'coach') {
    const p = document.createElement('p');
    p.className = `msg msg-${who}`;
    if (typeof text === 'string') {
      p.textContent = text;
    } else if (Array.isArray(text?.parts)) {
      renderRichText(p, text.parts);
    } else {
      const source = text?.fallback ?? text?.text ?? text?.tex ?? '';
      p.textContent = source;
      if (text?.tex) {
        renderRichText(p, [
          { type: 'text', text: text.text ?? '' },
          {
            type: 'math',
            tex: text.tex,
            fallback: text.fallback ?? source,
            display: true,
          },
        ]);
      }
    }
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

      /**
       * Ask for a set of answers. Correct choices stay selected until the
       * complete set is chosen; a wrong choice resolves immediately so the
       * coach can demonstrate that speed and then clear the selection.
       */
      async askMulti(text, choices, { correctIds = [] } = {}) {
        guard(mine);
        bubble(text);
        const answer = await new Promise((resolve) => {
          const selected = new Set();
          const clear = () => {
            pending = null;
            options.innerHTML = '';
          };

          pending = null;
          options.innerHTML = '';
          choices.forEach((choice) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ghost-button option multi-option';
            btn.textContent = choice.label;
            btn.setAttribute?.('aria-pressed', 'false');
            btn.addEventListener('click', () => {
              if (!correctIds.includes(choice.id)) {
                clear();
                bubble(choice.reply ?? choice.label, 'mine');
                resolve({ status: 'wrong', id: choice.id, label: choice.label });
                return;
              }

              if (selected.has(choice.id)) {
                selected.delete(choice.id);
                btn.dataset.selected = 'false';
                btn.setAttribute?.('aria-pressed', 'false');
              } else {
                selected.add(choice.id);
                btn.dataset.selected = 'true';
                btn.setAttribute?.('aria-pressed', 'true');
              }

              if (correctIds.every((id) => selected.has(id))) {
                clear();
                const reply = choices
                  .filter((item) => selected.has(item.id))
                  .map((item) => item.reply ?? item.label)
                  .join(' and ');
                bubble(reply, 'mine');
                resolve({ status: 'correct', ids: [...selected] });
              }
            });
            options.appendChild(btn);
          });
        });
        guard(mine);
        await wait(Math.min(messagePause, 400));
        guard(mine);
        return answer;
      },

      /** Play a demonstration serve; resolves once the ball has stopped. */
      async serve(v, { keep = false, label = null, animatePlayer = false, hideSpeed = false } = {}) {
        guard(mine);
        const result = await runtime.serve(v, { animatePlayer, hideSpeed });
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

      /** Show a small completion celebration without interrupting the log. */
      celebrate(message = '🎉 Correct! 🎉') {
        guard(mine);
        celebration.textContent = message;
        celebration.hidden = false;
      },

      /** Draw construction lines while discussing a trajectory. */
      guide(guides) {
        runtime.guide(guides);
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
    celebration.hidden = true;
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
      celebration.hidden = true;
    },
  };
}
