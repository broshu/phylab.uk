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
  ARISTOTLE_TAKES_OVER,
  DEBATE_CARD,
  DEBATE_FALLBACKS,
  ENTRANCE,
  RETURN_LINE,
  STEPS,
  STEP_ORDER,
} from './steps.js';

/** Student turns in the open debate before Aristotle moves on to reasoning. */
export const DEBATE_TURN_LIMIT = 6;
/**
 * Failed tries in one step before Galileo explains the idea and moves on.
 * Debate group: counts only tries while Galileo is helping (helpTurns).
 * Guided group: counts every try (stepTurns).
 */
export const REVEAL_AFTER = 3;
/** Debate group: the only student moves that bring Galileo in (besides @Galileo). */
export const GALILEO_MOVES = new Set(['help', 'concede', 'wrong']);

const MAX_MESSAGE_CHARS = 500;
const MAX_TRANSCRIPT_ITEMS = 16;
const MAX_REPLY_CHARS = 450;
const SPEAKERS = new Set(['student', 'aristotle', 'galileo']);
const CJK = /[぀-ヿ㐀-鿿가-힯＀-￯]/;

/**
 * @typedef {{speaker: string, text?: string, image?: string}} ChatMessage
 * @typedef {{condition: 'debate' | 'guided', step: string, stepTurns: number, helpTurns: number, debateTurns: number, galileo: boolean}} DebateState
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
  // The help button counts as calling Galileo.
  const toGalileo = type === 'help' || /@galileo\b/i.test(message);
  if (type === 'turn' && !message) throw new Error('Message is empty.');

  const s = raw.state && typeof raw.state === 'object' ? raw.state : {};
  const step = ALL_STEPS.includes(s.step) ? s.step : 'debate';
  // Research groups: "debate" (argue with Aristotle) or "guided" (Galileo leads).
  const condition = s.condition === 'guided' ? 'guided' : 'debate';
  const state = {
    condition,
    step,
    stepTurns: cleanCount(s.stepTurns, 50),
    // Debate group: failed tries in this step while Galileo was helping.
    helpTurns: cleanCount(s.helpTurns, 50),
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

/** How many hints Galileo has already given in this step. @param {DebateState} state */
function helpCount(state) {
  return state.condition === 'guided' ? state.stepTurns : state.helpTurns;
}

/** @param {DebateState} state */
function hintFor(state) {
  const step = STEPS[state.step];
  return step ? step.hints[Math.min(helpCount(state), 2)] : '';
}

/**
 * Galileo explains and moves on. In the debate group only while he is
 * helping: without him, Aristotle keeps asking.
 * @param {DebateState} state
 */
function revealDue(state) {
  if (state.step === 'debate' || state.step === 'done') return false;
  if (state.condition !== 'guided' && !state.galileo) return false;
  return helpCount(state) >= REVEAL_AFTER;
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
    if (toGalileo) return ASK_GALILEO_CARD;
    const last =
      state.debateTurns + 1 >= DEBATE_TURN_LIMIT
        ? '\nThis is the LAST debate turn: Aristotle does NOT end with a question. The next part is added automatically.'
        : '';
    return `${DEBATE_CARD}\n\nThis is student debate turn ${state.debateTurns + 1}.${last}`;
  }
  const step = STEPS[state.step];
  if (state.step === 'done') {
    return toGalileo
      ? `${step.card}\n\nThe student wrote "@Galileo", so Galileo answers. Allowed speakers: galileo, aristotle.`
      : `${step.card}\n\nAllowed speakers: aristotle only. Write exactly 1 message.`;
  }
  if (toGalileo) state = { ...state, galileo: true };

  const hint = `"${hintFor(state)}"`;
  const presence = state.galileo
    ? `WHO IS IN THE CHAT: Galileo IS here (he came to help in this step). Allowed speakers: galileo, aristotle.
- If step_done is true: Galileo writes ONE short message: he praises (${step.onPass.galileo}) and says in a few words that he steps back now. Aristotle may add one short line (${step.onPass.aristotle}). Do NOT ask a new question: the next question is added automatically.
- If step_done is false: Galileo answers what the student said and ends with this hint as a question: ${hint}. Aristotle stays quiet unless the student argued with him.`
    : `WHO IS IN THE CHAT: Galileo is NOT here. The student is reasoning alone against Aristotle. Galileo comes ONLY if student_move is "help", "concede" or "wrong".
- If step_done is true: write ONLY one Aristotle message (${step.onPass.aristotle}). No Galileo. Do NOT ask a new question: the next question is added automatically.
- If step_done is false and student_move is "help", "concede" or "wrong": Galileo comes to help. You may first write one short Aristotle message reacting to the student (no question, no hint). Then one Galileo message that reacts to the student's idea and ends with this hint as a question: ${hint}. If Galileo has not spoken in the chat before, he first says in a few words that he is Galileo and on the student's side.
- If step_done is false and student_move is anything else ("argue", "partial", "off_topic", ...): write ONLY one Aristotle message. No Galileo. Aristotle reacts to what the student said and asks his question again in other words. He gives no hint and never states or suggests the answer of this step.`;

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
    condition === 'guided'
      ? ['galileo']
      : step === 'debate'
        ? [toGalileo ? 'galileo' : 'aristotle']
        : step === 'done' && !toGalileo
          ? ['aristotle']
          : ['aristotle', 'galileo'];
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

/** @param {'concede'|'help'|'asked'} reason */
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
 * Words that clearly mean "I give up" or "help me". Used only when the AI
 * is unavailable and cannot classify the message. Anything else is "argue",
 * so Aristotle answers.
 * @param {string} text
 */
export function guessMove(text) {
  const t = text.toLowerCase();
  if (/(you'?re right|you are right|i give up|i lose|fine,? you win|you win|ok,? heavier|认输|你说得对|你是对的|你赢了)/.test(t)) return 'concede';
  if (/^idk\.?$/.test(t.trim()) || /(don'?t know|no idea|\bhelp\b|\bhint\b|\bstuck\b|不知道|不会做|帮帮|帮我|提示|求助)/.test(t)) return 'help';
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
    state: { ...input.state, step: 'premise', stepTurns: 0, helpTurns: 0, debateTurns: input.state.debateTurns + 1, galileo: true },
    passed: [],
    joined: 'asked',
  };
}

/**
 * Put "Galileo joined the chat" before his first line, if he was not here.
 * @param {ChatMessage[]} messages @param {boolean} wasHere
 */
function markJoin(messages, wasHere) {
  if (wasHere) return messages;
  const first = messages.findIndex((m) => m.speaker === 'galileo');
  if (first >= 0) messages.splice(first, 0, JOINED);
  return messages;
}

/**
 * The debate group. Galileo comes only when the student asks for help
 * (@Galileo or "help"), sides with Aristotle ("concede"), or states a wrong
 * idea ("wrong"); otherwise Aristotle answers and asks again.
 * @param {DebateInput} input
 * @param {{move: string, stepDone: boolean, messages: ChatMessage[]} | null} result
 */
function advanceStep(input, result) {
  const { state } = input;
  const wasHere = state.galileo;
  /** @type {ChatMessage[]} */
  const messages = [];
  /** @type {string[]} */
  const passed = [];
  const move = result ? result.move : guessMove(input.message);
  const only = (/** @type {string} */ who) => (result ? result.messages.filter((m) => m.speaker === who) : []);

  if (state.step === 'debate') {
    const debateTurns = state.debateTurns + 1;
    messages.push(
      ...(result
        ? result.messages
        : [{ speaker: 'aristotle', text: DEBATE_FALLBACKS[state.debateTurns % DEBATE_FALLBACKS.length] }]),
    );

    // Galileo comes only for "help" or "concede".
    if (move === 'concede' || move === 'help') {
      messages.push(...galileoJoins(move));
      return {
        messages,
        state: { ...state, step: 'premise', stepTurns: 0, helpTurns: 0, debateTurns, galileo: true },
        passed,
        joined: move,
      };
    }
    // A good student: Aristotle himself moves from examples to reasoning.
    const reason = move === 'thought_experiment' ? 'spark' : debateTurns >= DEBATE_TURN_LIMIT ? 'stalemate' : null;
    if (reason) {
      messages.push({ speaker: 'aristotle', text: ARISTOTLE_TAKES_OVER[reason] });
      return {
        messages,
        state: { ...state, step: 'premise', stepTurns: 0, helpTurns: 0, debateTurns, galileo: false },
        passed,
        joined: null,
      };
    }
    return { messages, state: { ...state, debateTurns }, passed, joined: null };
  }

  if (state.step === 'done') {
    const here = wasHere || input.toGalileo;
    if (result) messages.push(...result.messages);
    else if (input.type === 'help') messages.push({ speaker: 'galileo', text: "I'm here. Ask me anything about falling bodies or thought experiments." });
    else if (input.toGalileo) messages.push({ speaker: 'galileo', text: 'Sorry, I lost my train of thought. Could you ask that again?' });
    else messages.push({ speaker: 'aristotle', text: STEPS.done.press });
    markJoin(messages, wasHere);
    return { messages, state: { ...state, stepTurns: state.stepTurns + 1, galileo: here }, passed, joined: here && !wasHere ? 'asked' : null };
  }

  // Galileo is here if he already came in this step, or the student called him.
  const helping = wasHere || input.toGalileo;
  const now = { ...state, galileo: helping };
  const passedNow = Boolean(result?.stepDone);

  if (passedNow || revealDue(now)) {
    passed.push(state.step);
    const step = nextStep(state.step);
    if (passedNow) {
      const reply = /** @type {NonNullable<typeof result>} */ (result).messages;
      if (!helping) messages.push(...reply.filter((m) => m.speaker !== 'galileo'));
      else {
        // One Galileo line at most, then he steps back.
        const g = reply.find((m) => m.speaker === 'galileo') || { speaker: 'galileo', text: STEPS[state.step].leave || "Well done. I'll step back now." };
        const a = reply.find((m) => m.speaker === 'aristotle');
        messages.push(g, ...(a ? [a] : []));
      }
    } else {
      messages.push(...only('galileo').slice(0, 1));
      messages.push({ speaker: 'galileo', text: `Let's put it together. ${STEPS[state.step].reveal}` });
    }
    markJoin(messages, wasHere);
    if (helping) messages.push(LEFT);
    messages.push(...openerFor(step));
    return {
      messages,
      state: { ...state, step, stepTurns: 0, helpTurns: 0, galileo: false },
      passed,
      joined: helping && !wasHere ? 'asked' : null,
    };
  }

  // Not yet. Galileo helps only if he is here, was called, or the move needs him.
  if (helping || GALILEO_MOVES.has(move)) {
    if (result) {
      // At most one short Aristotle line and one Galileo line, in the model's order.
      let a = 0;
      let g = 0;
      for (const m of result.messages) {
        if (m.speaker === 'aristotle' && a++ < 1) messages.push(m);
        if (m.speaker === 'galileo' && g++ < 1) messages.push(m);
      }
      if (!g) messages.push({ speaker: 'galileo', text: hintFor(now) });
    } else {
      if (!wasHere) messages.push({ speaker: 'galileo', text: `${RETURN_LINE} ${hintFor(now)}` });
      else messages.push({ speaker: 'galileo', text: hintFor(now) });
    }
    markJoin(messages, wasHere);
    return {
      messages,
      state: { ...state, stepTurns: state.stepTurns + 1, helpTurns: state.helpTurns + 1, galileo: true },
      passed,
      joined: wasHere ? null : input.toGalileo ? 'asked' : move,
    };
  }

  // Aristotle answers and asks again. No hint, no Galileo.
  const a = only('aristotle').slice(0, 1);
  messages.push(...(a.length ? a : [{ speaker: 'aristotle', text: STEPS[state.step].press }]));
  return { messages, state: { ...state, stepTurns: state.stepTurns + 1 }, passed, joined: null };
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
      state: { ...state, step: 'premise', stepTurns: 0, helpTurns: 0, debateTurns: state.debateTurns, galileo: true },
      passed: [],
      joined: 'asked',
    };
  }
  return advance({ ...input, toGalileo: true }, null);
}
