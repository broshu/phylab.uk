import CHARACTERS from '../prompts/characters.md';
import {
  ALL_STEPS,
  ARISTOTLE_ON_HELP,
  DEBATE_CARD,
  DEBATE_FALLBACKS,
  ENTRANCE,
  STEPS,
  STEP_ORDER,
} from './steps.js';

/** Student turns in the open debate before Galileo joins anyway. */
export const DEBATE_TURN_LIMIT = 6;
/** Failed tries in one step before Galileo explains the idea and moves on. */
export const REVEAL_AFTER = 3;

const MAX_MESSAGE_CHARS = 500;
const MAX_TRANSCRIPT_ITEMS = 16;
const MAX_REPLY_CHARS = 450;
const SPEAKERS = new Set(['student', 'aristotle', 'galileo']);
const CJK = /[぀-ヿ㐀-鿿가-힯＀-￯]/;

/**
 * @typedef {{speaker: string, text?: string, image?: string}} ChatMessage
 * @typedef {{step: string, stepTurns: number, debateTurns: number}} DebateState
 * @typedef {{type: 'turn' | 'help', message: string, state: DebateState, transcript: ChatMessage[]}} DebateInput
 */

/** @param {unknown} value @param {number} max */
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

/** @param {unknown} value @param {number} max */
function cleanCount(value, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : 0;
}

/**
 * Validate the request body. Throws on anything the page would never send.
 * @param {unknown} body
 * @returns {DebateInput}
 */
export function normalizeInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Body must be a JSON object.');
  const raw = /** @type {Record<string, any>} */ (body);
  const type = raw.type === 'help' ? 'help' : 'turn';
  const message = cleanText(raw.message, MAX_MESSAGE_CHARS);
  if (type === 'turn' && !message) throw new Error('Message is empty.');

  const s = raw.state && typeof raw.state === 'object' ? raw.state : {};
  const step = ALL_STEPS.includes(s.step) ? s.step : 'debate';
  const state = {
    step,
    stepTurns: cleanCount(s.stepTurns, 50),
    debateTurns: cleanCount(s.debateTurns, 50),
  };

  const transcript = (Array.isArray(raw.transcript) ? raw.transcript : [])
    .slice(-MAX_TRANSCRIPT_ITEMS)
    .map((item) => ({
      speaker: SPEAKERS.has(item?.speaker) ? item.speaker : '',
      text: cleanText(item?.text, 600),
    }))
    .filter((item) => item.speaker && item.text);

  return { type, message, state, transcript };
}

/** @param {string} step */
export function nextStep(step) {
  const index = STEP_ORDER.indexOf(step);
  return index >= 0 && index < STEP_ORDER.length - 1 ? STEP_ORDER[index + 1] : 'done';
}

/** @param {DebateState} state */
function hintFor(state) {
  const step = STEPS[state.step];
  return step ? step.hints[Math.min(state.stepTurns, 2)] : '';
}

/** @param {DebateState} state */
function revealDue(state) {
  return state.step !== 'debate' && state.step !== 'done' && state.stepTurns >= REVEAL_AFTER;
}

/** The step card plus this turn's hint instruction. @param {DebateState} state */
export function buildCard(state) {
  if (state.step === 'debate') {
    return `${DEBATE_CARD}\n\nThis is student debate turn ${state.debateTurns + 1}.`;
  }
  const step = STEPS[state.step];
  if (state.step === 'done') return step.card;
  const extra = revealDue(state)
    ? `THIS TURN: the student has already tried ${state.stepTurns} times. If step_done is false, Galileo writes ONLY one short, kind line about what the student tried. No question and no answer: the lesson code explains the idea right after your message.`
    : `HINT FOR THIS TURN (use it if step_done is false; adapt it to what the student said): "${hintFor(state)}"`;
  return `${step.card}\n\n${extra}`;
}

/** @param {ChatMessage[]} transcript @param {string} message */
function chatLog(transcript, message) {
  const name = { student: 'Student', aristotle: 'Aristotle', galileo: 'Galileo' };
  const lines = transcript.map((m) => `${name[/** @type {keyof typeof name} */ (m.speaker)]}: ${m.text}`);
  return `CHAT SO FAR (oldest first):\n${lines.join('\n') || '(empty)'}\n\nTHE STUDENT'S NEW MESSAGE:\n${message}\n\nWrite the JSON object now.`;
}

/**
 * @param {DebateInput} input
 * @param {string} model
 * @param {boolean} [strictEnglish]
 */
export function buildPayload(input, model, strictEnglish = false) {
  const reminder = strictEnglish
    ? '\n\nIMPORTANT: your last answer contained Chinese characters. Write every message in English only.'
    : '';
  return {
    model,
    thinking: { type: 'disabled' },
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 700,
    stream: false,
    messages: [
      { role: 'system', content: `${CHARACTERS}\n\n---\n\n${buildCard(input.state)}${reminder}` },
      { role: 'user', content: chatLog(input.transcript, input.message) },
    ],
  };
}

/**
 * Turn the provider response into a checked model result, or null.
 * @param {unknown} value
 * @param {string} step
 */
export function parseModelReply(value, step) {
  const root = /** @type {any} */ (value);
  const choice = root?.choices?.[0];
  let content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) return null;
  content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const allowed = step === 'debate' ? ['aristotle'] : STEPS[step].speakers;
  const messages = (Array.isArray(data.messages) ? data.messages : [])
    .map((/** @type {any} */ m) => ({
      speaker: typeof m?.speaker === 'string' ? m.speaker.toLowerCase().trim() : '',
      text: cleanText(m?.text, MAX_REPLY_CHARS),
    }))
    .filter((/** @type {ChatMessage} */ m) => allowed.includes(m.speaker) && m.text)
    .slice(0, step === 'debate' ? 1 : 2);
  if (messages.length === 0) return null;

  return {
    move: cleanText(data.student_move, 32).toLowerCase(),
    stepDone: data.step_done === true && step !== 'debate' && step !== 'done',
    messages,
    truncated: choice?.finish_reason === 'length',
    usage: {
      inputTokens: Number.isFinite(root?.usage?.prompt_tokens) ? root.usage.prompt_tokens : null,
      outputTokens: Number.isFinite(root?.usage?.completion_tokens) ? root.usage.completion_tokens : null,
    },
  };
}

/** @param {ChatMessage[]} messages */
export function hasChinese(messages) {
  return messages.some((m) => CJK.test(m.text || ''));
}

/* ------------------------------------------------------------------ */
/* Deterministic lesson flow                                           */
/* ------------------------------------------------------------------ */

/** @param {'concede'|'stuck'|'stalemate'|'asked'|'spark'} reason */
function galileoJoins(reason) {
  return [
    { speaker: 'system', text: 'Galileo joined the chat' },
    { speaker: 'galileo', text: ENTRANCE[reason] },
    ...STEPS.premise.opener,
  ];
}

/** @param {string} step */
function openerFor(step) {
  return STEPS[step].opener.map((m) => ({ ...m }));
}

/**
 * Words that clearly mean "I give up" or "I'm stuck". Used only when the AI
 * is unavailable and cannot classify the message.
 * @param {string} text
 */
export function guessMove(text) {
  const t = text.toLowerCase();
  if (/(you'?re right|you are right|i give up|i lose|fine,? you win|you win|ok,? heavier|认输|你说得对|你是对的|好吧)/.test(t)) return 'concede';
  if (/^(\?+|hmm+|um+|idk|no|ok)\.?$/.test(t.trim()) || /(don'?t know|not sure|no idea|help|stuck|不知道|不会|帮)/.test(t)) return 'stuck';
  return 'argue';
}

/**
 * Apply the model's judgement (or a fallback) to the lesson state.
 * @param {DebateInput} input
 * @param {{move: string, stepDone: boolean, messages: ChatMessage[]} | null} result null when the AI failed
 */
export function advance(input, result) {
  const { state } = input;
  /** @type {ChatMessage[]} */
  const messages = [];
  /** @type {string[]} */
  const passed = [];
  let next = { ...state };

  if (state.step === 'debate') {
    const debateTurns = state.debateTurns + 1;
    const move = result ? result.move : guessMove(input.message);
    messages.push(
      ...(result
        ? result.messages
        : [{ speaker: 'aristotle', text: DEBATE_FALLBACKS[state.debateTurns % DEBATE_FALLBACKS.length] }]),
    );

    /** @type {'concede'|'stuck'|'stalemate'|'spark'|null} */
    let reason = null;
    if (move === 'concede') reason = 'concede';
    else if (move === 'stuck') reason = 'stuck';
    else if (move === 'thought_experiment') reason = 'spark';
    else if (debateTurns >= DEBATE_TURN_LIMIT) reason = 'stalemate';

    if (reason) {
      messages.push(...galileoJoins(reason));
      next = { step: 'premise', stepTurns: 0, debateTurns };
    } else {
      next = { ...state, debateTurns };
    }
    return { messages, state: next, passed, joined: reason };
  }

  if (result) messages.push(...result.messages);

  if (state.step === 'done') {
    if (!result) messages.push({ speaker: 'galileo', text: 'Sorry, I lost my train of thought. Could you ask that again?' });
    return { messages, state: { ...state, stepTurns: state.stepTurns + 1 }, passed, joined: null };
  }

  if (result?.stepDone) {
    passed.push(state.step);
    const step = nextStep(state.step);
    messages.push(...openerFor(step));
    next = { ...state, step, stepTurns: 0 };
  } else if (revealDue(state)) {
    passed.push(state.step);
    messages.push({ speaker: 'galileo', text: `Let's put it together. ${STEPS[state.step].reveal}` });
    const step = nextStep(state.step);
    messages.push(...openerFor(step));
    next = { ...state, step, stepTurns: 0 };
  } else {
    if (!result) messages.push({ speaker: 'galileo', text: hintFor(state) });
    next = { ...state, stepTurns: state.stepTurns + 1 };
  }
  return { messages, state: next, passed, joined: null };
}

/**
 * The help button. Never calls the AI.
 * @param {DebateInput} input
 */
export function helpTurn(input) {
  const { state } = input;
  if (state.step === 'debate') {
    return {
      messages: [{ speaker: 'aristotle', text: ARISTOTLE_ON_HELP }, ...galileoJoins('asked')],
      state: { step: 'premise', stepTurns: 0, debateTurns: state.debateTurns },
      passed: [],
      joined: 'asked',
    };
  }
  return advance(input, null);
}
