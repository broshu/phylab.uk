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
import { opening, reaction } from '../services/coach-script.js?v=20260819-3';
import { renderDelimitedMath, renderRichText } from './math.js?v=20260819-3';

const CANCELLED = Symbol('coach-cancelled');
const CONTINUE_FALLBACK =
  'That connects to the paused Coach question. Use the idea above, then choose the option that best completes the next step.';

/**
 * @param {HTMLElement} root
 * @param {ReturnType<import('../core/state.js').createStore>} store
 * @param {{
 *   tutor: {hint: Function},
 *   attempts: {summary: Function},
 *   runtime: {serve: Function, trail: Function, clearTrails: Function, guide: Function},
 *   ai?: {ask: Function},
 *   timing?: {message?: number}
 * }} deps
 */
export function createCoach(root, store, { tutor, attempts, runtime, ai, timing } = {}) {
  const messagePause = timing?.message ?? 700;
  let token = 0; // bumped whenever a script is abandoned

  root.innerHTML = `
    <h2>Coach</h2>
    <div class="coach-log" id="coachLog" aria-live="polite"></div>
    <div class="coach-options" id="coachOptions"></div>
    <div class="coach-celebration" id="coachCelebration" aria-live="polite" hidden></div>
    <section class="coach-ai" aria-label="AI Coach">
      <p class="coach-ai-status" id="coachAiStatus" aria-live="polite"></p>
      <div class="coach-ai-composer">
        <textarea id="coachAiQuestion" rows="1" maxlength="600" aria-label="Question for AI Coach" placeholder="Ask about what happened…"></textarea>
        <button id="coachAiSend" type="button">Ask</button>
      </div>
    </section>
  `;

  const log = root.querySelector('#coachLog');
  const options = root.querySelector('#coachOptions');
  const celebration = root.querySelector('#coachCelebration');
  const aiQuestion = root.querySelector('#coachAiQuestion');
  const aiSend = root.querySelector('#coachAiSend');
  const aiStatus = root.querySelector('#coachAiStatus');
  const recentCoach = [];

  // the question currently on screen, so it can also be answered by clicking
  // the court instead of the buttons
  let pending = null;
  let aiPause = null;
  let lastAiExchange = null;

  function rememberCoach(text) {
    const spoken = plainMessage(text).trim();
    if (!spoken) return;
    recentCoach.push(spoken.slice(0, 280));
    if (recentCoach.length > 6) recentCoach.shift();
  }

  function plainMessage(text) {
    if (typeof text === 'string') return text;
    if (Array.isArray(text?.parts)) {
      return text.parts
        .map((part) =>
          typeof part === 'string'
            ? part
            : part?.fallback ?? part?.text ?? part?.tex ?? '',
        )
        .join('');
    }
    return text?.fallback ?? text?.text ?? text?.tex ?? '';
  }

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
    if (who === 'coach') rememberCoach(text);
    return p;
  }

  function renderAiReply(reply, mode) {
    const labels = {
      'ai-assisted': 'AI + preset',
      'preset-fallback': 'Preset fallback',
      'preset-only': 'Preset only',
    };
    const label = labels[mode] || 'AI Coach';
    const p = document.createElement('p');
    p.className = 'msg msg-coach msg-ai';
    p.dataset.label = label;
    renderDelimitedMath(p, reply);
    p.setAttribute?.('aria-label', `${label}: ${reply}`);
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    rememberCoach(reply);
  }

  function currentAiContext() {
    const state = store.get();
    const result = state.result || {};
    const phase = state.phase || 'unknown';
    const speed = Number.isFinite(state.v) ? state.v : null;
    const hasStudentResult = phase === 'done';
    const speedText = speed == null ? 'an unknown speed' : `${speed} m/s`;
    const verdictText = {
      net: 'went into the net',
      in: 'landed in bounds',
      out: 'landed beyond the far baseline',
    }[result.verdict] || 'has no visible verdict';
    const uiState = {
      aim: `The speed control is currently set to ${speedText}. The student has not served this selection yet, so no result is visible.`,
      serve: `The student has served at ${speedText}; the ball is in flight and no result is visible yet.`,
      done: `The student's ${speedText} serve has finished and ${verdictText}.`,
      demo: `The preset Coach is demonstrating ${state.hideSpeed ? 'a hidden-speed serve' : `a ${speedText} serve`}. This is not a scored student attempt.`,
    }[phase] || 'The current interface event is unknown.';

    return {
      phase,
      verdict: hasStudentResult ? result.verdict || 'unknown' : 'unknown',
      speed,
      speedHidden: Boolean(state.hideSpeed),
      uiState,
      heightAtNet: hasStudentResult && Number.isFinite(result.heightAtNet) ? result.heightAtNet : null,
      netClearance: hasStudentResult && Number.isFinite(result.netClearance) ? result.netClearance : null,
      xLand: hasStudentResult && Number.isFinite(result.xLand) ? result.xLand : null,
      outBy: hasStudentResult && Number.isFinite(result.outBy) ? result.outBy : null,
      attemptCount: attempts.summary().total,
      recentCoach: recentCoach.slice(-6),
    };
  }

  function resizeAiQuestion() {
    const minHeight = 36;
    const maxHeight = 96;
    aiQuestion.style.height = `${minHeight}px`;
    const contentHeight = Math.max(minHeight, aiQuestion.scrollHeight || 0);
    aiQuestion.style.height = `${Math.min(contentHeight, maxHeight)}px`;
    aiQuestion.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }

  function unlockAiComposer() {
    aiSend.disabled = false;
    aiQuestion.disabled = false;
    aiQuestion.focus?.();
  }

  function pausePresetOptions() {
    if (aiPause || options.children.length === 0) return null;
    const pause = {
      token,
      pending,
      buttons: Array.from(options.children),
      resumeTarget: recentCoach.at(-1) || '',
      resumeOptions: Array.from(options.children).map((button) => button.textContent || ''),
    };
    aiPause = pause;
    options.innerHTML = '';
    return pause;
  }

  function isCurrentAiPause(pause) {
    return aiPause === pause && token === pause.token && pending === pause.pending;
  }

  function showContinueButton(pause) {
    if (!pause || !isCurrentAiPause(pause)) {
      if (aiPause === pause) aiPause = null;
      unlockAiComposer();
      return;
    }

    options.innerHTML = '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost-button option coach-ai-continue';
    button.textContent = 'Got it — continue';
    button.addEventListener('click', () => {
      if (!isCurrentAiPause(pause)) return;
      void continuePresetPath(pause);
    });
    options.appendChild(button);
    unlockAiComposer();
  }

  function restorePresetOptions(pause) {
    if (!isCurrentAiPause(pause)) return;
    aiPause = null;
    options.innerHTML = '';
    pause.buttons.forEach((original) => options.appendChild(original));
    unlockAiComposer();
  }

  async function continuePresetPath(pause) {
    if (!isCurrentAiPause(pause)) return;

    if (!ai?.ask) {
      renderAiReply(CONTINUE_FALLBACK, 'preset-fallback');
      restorePresetOptions(pause);
      return;
    }

    aiSend.disabled = true;
    aiQuestion.disabled = true;
    options.innerHTML = '';
    aiStatus.textContent = 'AI Coach is thinking…';

    const exchange = lastAiExchange;
    try {
      const response = await ai.ask({
        requestType: 'resume',
        question: exchange?.question || 'Continue the lesson.',
        context: {
          ...currentAiContext(),
          resumeTarget: pause.resumeTarget,
          resumeOptions: pause.resumeOptions,
          lastLearnerQuestion: exchange?.question || '',
          lastAiReply: exchange?.reply || '',
        },
      });
      if (!isCurrentAiPause(pause)) return;
      renderAiReply(response.reply, response.mode);
      aiStatus.textContent = response.notice || '';
    } catch {
      if (!isCurrentAiPause(pause)) return;
      renderAiReply(CONTINUE_FALLBACK, 'preset-fallback');
      aiStatus.textContent = '';
    } finally {
      restorePresetOptions(pause);
    }
  }

  function abandonAiPause() {
    const wasActive = Boolean(aiPause || aiSend.disabled || aiQuestion.disabled);
    aiPause = null;
    if (wasActive) unlockAiComposer();
  }

  async function sendToAi() {
    const question = aiQuestion.value.trim();
    if (!question) {
      aiStatus.textContent = 'Enter a question for Coach.';
      aiQuestion.focus?.();
      return;
    }
    if (!ai?.ask) {
      aiStatus.textContent = 'AI Coach is not configured.';
      return;
    }

    aiSend.disabled = true;
    aiQuestion.disabled = true;
    const pausedOptions = pausePresetOptions();
    aiStatus.textContent = 'AI Coach is thinking…';
    bubble(question, 'mine').className += ' msg-ai-question';
    aiQuestion.value = '';
    resizeAiQuestion();

    try {
      const response = await ai.ask({
        requestType: 'question',
        question,
        context: currentAiContext(),
      });
      renderAiReply(response.reply, response.mode);
      lastAiExchange = { question, reply: response.reply };
      aiStatus.textContent = response.notice || '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI Coach request failed.';
      renderAiReply(message, 'error');
      aiStatus.textContent = 'The preset Coach above is still available.';
    } finally {
      if (pausedOptions) {
        showContinueButton(pausedOptions);
      } else {
        unlockAiComposer();
      }
    }
  }

  aiSend.addEventListener('click', sendToAi);
  aiQuestion.addEventListener('input', resizeAiQuestion);
  aiQuestion.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault?.();
      sendToAi();
    }
  });
  resizeAiQuestion();

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
    abandonAiPause();
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
      if (aiPause) return false;
      const choice = pending?.choices.find((c) => c.id === id);
      if (choice) pending.pick(choice);
      return !!choice;
    },

    /** Drop whatever is being said (the student has taken over). */
    interrupt() {
      token += 1;
      abandonAiPause();
      pending = null;
      options.innerHTML = '';
      celebration.hidden = true;
    },
  };
}
