import DEBATE_INTRO from '../prompts/debate-intro.md';
import GUIDED_INTRO from '../prompts/guided-intro.md';
import SHARED_RULES from '../prompts/shared-rules.md';
import {
  BRIDGE,
  EXPLORE_CARD,
  EXPLORE_FALLBACKS,
  EXPLORE_HINT,
  EXPLORE_TURNS,
  GUIDED_DONE_CARD,
  GUIDED_OPENERS,
  GUIDED_TO_GALILEO,
  guidedPresence,
} from './guided.js';
import {
  ALL_STEPS,
  ARISTOTLE_ON_HELP,
  DEBATE_CARD,
  DEBATE_FALLBACKS,
  ENTRANCE,
  RETURN_LINE,
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
 * @typedef {{condition: 'debate' | 'guided', step: string, stepTurns: number, debateTurns: number, galileo: boolean}} DebateState
 * @typedef {{type: 'turn' | 'help', message: string, toGalileo: boolean, state: DebateState, transcript: ChatMessage[]}} DebateInput
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
  const message = cleanText(raw.message, MAX_MESSAGE_CHARS);
  // "@Galileo" on its own is the help button; "@Galileo ..." is a message to him.
  const type = raw.type === 'help' || /^@galileo[\s,.:!?]*$/i.test(message) ? 'help' : 'turn';
  const toGalileo = /@galileo\b/i.test(message);
  if (type === 'turn' && !message) throw new Error('Message is empty.');

  const s = raw.state && typeof raw.state === 'object' ? raw.state : {};
  const step = ALL_STEPS.includes(s.step) ? s.step : 'debate';
  // Research groups: "debate" (argue with Aristotle) or "guided" (Galileo leads).
  const condition = s.condition === 'guided' ? 'guided' : 'debate';
  const state = {
    condition,
    step,
    stepTurns: cleanCount(s.stepTurns, 50),
    debateTurns: cleanCount(s.debateTurns, 50),
    // Older pages did not send this; Galileo was always present after joining.
    galileo: condition === 'guided' ? true : step === 'debate' ? false : typeof s.galileo === 'boolean' ? s.galileo : true,
  };

  const transcript = (Array.isArray(raw.transcript) ? raw.transcript : [])
    .slice(-MAX_TRANSCRIPT_ITEMS)
    .map((item) => ({
      speaker: SPEAKERS.has(item?.speaker) ? item.speaker : '',
      text: cleanText(item?.text, 600),
    }))
    .filter((item) => item.speaker && item.text);

  return { type, message, toGalileo, state, transcript };
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

const ASK_GALILEO_CARD = `CURRENT STEP: the student has just called Galileo into the chat with "@Galileo" and a message. Galileo joins now for the first time.
Allowed speakers: galileo only. Write exactly 1 message.

Galileo says in a few words that he is Galileo and on the student's side, then answers the student's message in one or two sentences.
He must not give the final answer (that all bodies fall together). His advice: examples alone will not beat Aristotle, because Aristotle always finds an excuse; a better weapon is Aristotle's own rule.
Do not end with a question: the next question is added automatically.

student_move: "asked". step_done: false.`;

const TO_GALILEO = `THE STUDENT IS TALKING TO GALILEO (the message contains "@Galileo"). Galileo must answer, even if he was not in the chat (then he joins now). If the student asks a question, Galileo answers it in one or two sentences, then ends with the hint. His answer must NOT state or imply the PASS answer of this step, even partly (for example, in the "slower" step he must not say the pair or the heavy stone becomes slower); explain words and set up the picture instead, and let the student draw the conclusion. If the message contains an answer that passes, judge it as usual.`;

/**
 * The step card plus who is present and this turn's hint.
 * @param {DebateState} state
 * @param {boolean} [toGalileo] the student addressed Galileo with "@Galileo"
 */
export function buildCard(state, toGalileo = false) {
  if (state.condition === 'guided') return buildGuidedCard(state, toGalileo);
  if (state.step === 'debate') {
    return toGalileo ? ASK_GALILEO_CARD : `${DEBATE_CARD}\n\nThis is student debate turn ${state.debateTurns + 1}.`;
  }
  const step = STEPS[state.step];
  if (state.step === 'done') return toGalileo ? `${step.card}\n\nThe student asked Galileo directly, so Galileo answers.` : step.card;
  if (toGalileo) state = { ...state, galileo: true };

  const hint = `"${hintFor(state)}"`;
  const presence = state.galileo
    ? `WHO IS IN THE CHAT: Galileo IS here (he came to help). Allowed speakers: galileo, aristotle.
- If step_done is true: Galileo praises in one or two sentences (${step.onPass.galileo}). Aristotle may add one short line (${step.onPass.aristotle}). Do NOT ask a new question: the next question is added automatically.
- If step_done is false: Galileo answers what the student said and ends with this hint as a question: ${hint}. Aristotle stays quiet unless the student argued with him.`
    : `WHO IS IN THE CHAT: Galileo is NOT here. The student is reasoning alone against Aristotle. Allowed speakers: aristotle, galileo.
- If step_done is true: write ONLY one Aristotle message (${step.onPass.aristotle}). No Galileo. Do NOT ask a new question: the next question is added automatically.
- If step_done is false: Galileo comes back to help. First one short Aristotle message reacting to the student (no hint, no answer). Then one Galileo message that ends with this hint as a question: ${hint}.`;

  const reveal = revealDue(state)
    ? `\n\nTHIS TURN: the student has already tried ${state.stepTurns} times. If step_done is false, Galileo writes ONLY one short, kind line about what the student tried, with no question and no answer: the lesson code explains the idea right after your message.`
    : '';
  return `${step.card}\n\n${presence}${reveal}${toGalileo ? `\n\n${TO_GALILEO}` : ''}`;
}

/** @param {DebateState} state @param {boolean} toGalileo */
function buildGuidedCard(state, toGalileo) {
  if (state.step === 'debate') return `${EXPLORE_CARD}\n\nThis is turn ${state.debateTurns + 1} of ${EXPLORE_TURNS}.`;
  if (state.step === 'done') return GUIDED_DONE_CARD;
  const step = STEPS[state.step];
  const reveal = revealDue(state)
    ? `\n\nTHIS TURN: the student has already tried ${state.stepTurns} times. If step_done is false, Galileo writes ONLY one short, kind line about what the student tried, with no question and no answer: the lesson code explains the idea right after your message.`
    : '';
  return `${step.card}\n\n${guidedPresence(step.onPass, `"${hintFor(state)}"`)}${reveal}${toGalileo ? `\n\n${GUIDED_TO_GALILEO}` : ''}`;
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
      { role: 'system', content: `${input.state.condition === 'guided' ? GUIDED_INTRO : DEBATE_INTRO}\n\n${SHARED_RULES}\n\n---\n\n${buildCard(input.state, input.toGalileo)}${reminder}` },
      { role: 'user', content: chatLog(input.transcript, input.message) },
    ],
  };
}

/**
 * Turn the provider response into a checked model result, or null.
 * @param {unknown} value
 * @param {string} step
 */
export function parseModelReply(value, step, toGalileo = false, condition = 'debate') {
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

  const allowed =
    condition === 'guided' ? ['galileo'] : step === 'debate' ? [toGalileo ? 'galileo' : 'aristotle'] : ['aristotle', 'galileo'];
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

const JOINED = { speaker: 'system', text: 'Galileo joined the chat' };
const LEFT = { speaker: 'system', text: 'Galileo left the chat' };

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
  if (input.state.condition === 'guided') return advanceGuided(input, result);
  if (input.toGalileo && input.state.step === 'debate') return askGalileoFirst(input, result);
  if (input.toGalileo && !input.state.galileo) {
    // Treat Galileo as present, then show him joining before his first line.
    const out = advanceStep({ ...input, state: { ...input.state, galileo: true } }, result);
    const first = out.messages.findIndex((m) => m.speaker === 'galileo');
    if (first >= 0) out.messages.splice(first, 0, JOINED);
    return { ...out, joined: first >= 0 ? 'asked' : out.joined };
  }
  return advanceStep(input, result);
}

/**
 * "@Galileo ..." during the open debate: he joins, answers, and starts the method.
 * @param {DebateInput} input
 * @param {{messages: ChatMessage[]} | null} result
 */
function askGalileoFirst(input, result) {
  const reply = result?.messages.filter((m) => m.speaker === 'galileo') || [];
  return {
    messages: [
      JOINED,
      ...(reply.length ? reply : [{ speaker: 'galileo', text: ENTRANCE.asked }]),
      ...STEPS.premise.opener,
    ],
    state: { ...input.state, step: 'premise', stepTurns: 0, debateTurns: input.state.debateTurns + 1, galileo: true },
    passed: [],
    joined: 'asked',
  };
}

/**
 * @param {DebateInput} input
 * @param {{move: string, stepDone: boolean, messages: ChatMessage[]} | null} result
 */
function advanceStep(input, result) {
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
      next = { ...state, step: 'premise', stepTurns: 0, debateTurns, galileo: true };
    } else {
      next = { ...state, debateTurns };
    }
    return { messages, state: next, passed, joined: reason };
  }

  if (state.step === 'done') {
    if (result) messages.push(...result.messages);
    else messages.push({ speaker: 'galileo', text: 'Sorry, I lost my train of thought. Could you ask that again?' });
    return { messages, state: { ...state, stepTurns: state.stepTurns + 1 }, passed, joined: null };
  }

  const passedNow = Boolean(result?.stepDone);
  if (passedNow || revealDue(state)) {
    // Progress. Galileo (if here) says his piece and steps out; the next
    // question comes from Aristotle. For the final reflection he comes back.
    passed.push(state.step);
    const step = nextStep(state.step);
    let galileo = state.galileo;
    if (passedNow) {
      const reply = /** @type {NonNullable<typeof result>} */ (result).messages;
      messages.push(...(galileo ? reply : reply.filter((m) => m.speaker !== 'galileo')));
    } else {
      if (result) messages.push(...result.messages);
      if (!galileo) messages.push(JOINED);
      galileo = true;
      messages.push({ speaker: 'galileo', text: `Let's put it together. ${STEPS[state.step].reveal}` });
    }
    if (step === 'method' || step === 'done') {
      if (!galileo) messages.push(JOINED);
      galileo = true;
    } else if (galileo) {
      const leave = STEPS[state.step].leave;
      if (leave) messages.push({ speaker: 'galileo', text: leave });
      messages.push(LEFT);
      galileo = false;
    }
    messages.push(...openerFor(step));
    return { messages, state: { ...state, step, stepTurns: 0, galileo }, passed, joined: null };
  }

  // Not yet: Galileo is (or comes back) here with a hint.
  if (result) {
    const firstGalileo = result.messages.findIndex((m) => m.speaker === 'galileo');
    const reply = [...result.messages];
    if (firstGalileo < 0) reply.push({ speaker: 'galileo', text: hintFor(state) });
    if (!state.galileo) reply.splice(reply.findIndex((m) => m.speaker === 'galileo'), 0, JOINED);
    messages.push(...reply);
  } else {
    if (!state.galileo) messages.push(JOINED, { speaker: 'galileo', text: `${RETURN_LINE} ${hintFor(state)}` });
    else messages.push({ speaker: 'galileo', text: hintFor(state) });
  }
  return {
    messages,
    state: { ...state, stepTurns: state.stepTurns + 1, galileo: true },
    passed,
    joined: state.galileo ? null : 'return',
  };
}

/**
 * The guided group: Galileo is always here and asks every question.
 * Same pass rules, hints, reveals and pictures as the debate group.
 * @param {DebateInput} input
 * @param {{move: string, stepDone: boolean, messages: ChatMessage[]} | null} result
 */
function advanceGuided(input, result) {
  const { state } = input;
  /** @type {ChatMessage[]} */
  const messages = [];
  /** @type {string[]} */
  const passed = [];
  const reply = result ? result.messages.filter((m) => m.speaker === 'galileo') : [];
  const opener = (/** @type {string} */ step) => GUIDED_OPENERS[step].map((m) => ({ ...m }));

  if (state.step === 'debate') {
    const debateTurns = state.debateTurns + 1;
    const move = result ? result.move : guessMove(input.message);
    messages.push(...(reply.length ? reply : [{ speaker: 'galileo', text: EXPLORE_FALLBACKS[state.debateTurns % EXPLORE_FALLBACKS.length] }]));
    if (move === 'thought_experiment' || debateTurns >= EXPLORE_TURNS) {
      messages.push({ speaker: 'galileo', text: move === 'thought_experiment' ? BRIDGE.spark : BRIDGE.idea }, ...opener('premise'));
      return { messages, state: { ...state, step: 'premise', stepTurns: 0, debateTurns }, passed, joined: null };
    }
    return { messages, state: { ...state, debateTurns }, passed, joined: null };
  }

  if (state.step === 'done') {
    messages.push(...(reply.length ? reply : [{ speaker: 'galileo', text: 'Sorry, I lost my train of thought. Could you ask that again?' }]));
    return { messages, state: { ...state, stepTurns: state.stepTurns + 1 }, passed, joined: null };
  }

  const passedNow = Boolean(result?.stepDone);
  if (passedNow || revealDue(state)) {
    passed.push(state.step);
    messages.push(...reply);
    if (!passedNow) messages.push({ speaker: 'galileo', text: `Let's put it together. ${STEPS[state.step].reveal}` });
    const step = nextStep(state.step);
    messages.push(...opener(step));
    return { messages, state: { ...state, step, stepTurns: 0 }, passed, joined: null };
  }

  messages.push(...(reply.length ? reply : [{ speaker: 'galileo', text: hintFor(state) }]));
  return { messages, state: { ...state, stepTurns: state.stepTurns + 1 }, passed, joined: null };
}

/**
 * The help button. Never calls the AI.
 * @param {DebateInput} input
 */
export function helpTurn(input) {
  const { state } = input;
  if (state.condition === 'guided' && state.step === 'debate') {
    return {
      messages: [{ speaker: 'galileo', text: EXPLORE_HINT }],
      state: { ...state },
      passed: [],
      joined: null,
    };
  }
  if (state.condition === 'guided') return advanceGuided(input, null);
  if (state.step === 'debate') {
    return {
      messages: [{ speaker: 'aristotle', text: ARISTOTLE_ON_HELP }, ...galileoJoins('asked')],
      state: { ...state, step: 'premise', stepTurns: 0, debateTurns: state.debateTurns, galileo: true },
      passed: [],
      joined: 'asked',
    };
  }
  return advance(input, null);
}
