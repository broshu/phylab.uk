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
import { CONTRADICTION_OPENER, COUNTER } from './counter.js';
import { toZh } from './zh.js';
import { ARGUMENT_REPLIES, ARISTOTLE_IDEAS, BEFORE_GALILEO, COUNTED_MOVES, DEBATE_TAILS, PISA, PRESET_MOVES, REPEAT_LIMIT, THOUGHT_REPLIES, TIE_TAIL } from './replies.js';
import {
  ALL_STEPS,
  ARISTOTLE_ON_HELP,
  DEBATE_ONLY_STEPS,
  RETIRED_STEPS,
  GUIDED_ONLY_STEPS,
  DEBATE_CARD,
  DEBATE_FALLBACKS,
  ENTRANCE,
  RETURN_LINE,
  STEPS,
  STEP_ORDER,
} from './steps.js';

// The open debate has no turn limit: Aristotle holds his position until the
// student invents the thought experiment, asks for help, or gives in.
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
 * @typedef {{condition: 'debate' | 'guided', step: string, stepTurns: number, helpTurns: number, debateTurns: number, galileo: boolean, spark?: boolean, pisaSeen?: boolean, view?: 'faster' | 'slower', used?: Record<string, number>}} DebateState
 * @typedef {{type: 'turn' | 'help', message: string, toGalileo: boolean, session: string, state: DebateState, transcript: ChatMessage[]}} DebateInput
 */

/** @param {unknown} value @param {number} max */
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
}

/** @param {unknown} value */
function cleanUsed(value) {
  /** @type {Record<string, number>} */
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const key of COUNTED_MOVES) {
    const n = cleanCount(/** @type {any} */ (value)[key], 50);
    if (n) out[key] = n;
  }
  return out;
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
  const type = raw.type === 'help' || /^@(galileo|伽利略)[\s,.:!?，。：！？]*$/i.test(message) ? 'help' : 'turn';
  // The help button counts as calling Galileo.
  const toGalileo = type === 'help' || /@(galileo\b|伽利略)/i.test(message);
  if (type === 'turn' && !message) throw new Error('Message is empty.');

  const s = raw.state && typeof raw.state === 'object' ? raw.state : {};
  const step = ALL_STEPS.includes(s.step) ? s.step : 'debate';
  // Research groups: "debate" (argue with Aristotle) or "guided" (Galileo leads).
  const condition = s.condition === 'guided' ? 'guided' : 'debate';
  const state = {
    condition,
    // Chat language: "zh" for browsers in Chinese, else "en".
    lang: s.lang === 'zh' ? 'zh' : 'en',
    step,
    stepTurns: cleanCount(s.stepTurns, 50),
    // Debate group: failed tries in this step while Galileo was helping.
    helpTurns: cleanCount(s.helpTurns, 50),
    // The student invented the tied stones in the open debate: skip the "tie" step.
    spark: s.spark === true,
    // The Pisa easter egg (Galileo steps in once) has been shown.
    pisaSeen: s.pisaSeen === true,
    // How often each preset reply has been given in this chat, so a repeated argument gets new words.
    used: cleanUsed(s.used),
    // Debate group: which way Aristotle reasoned about the tied pair (counter step).
    ...(s.view === 'faster' || s.view === 'slower' ? { view: s.view } : {}),
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

  // Random id of one chat, made by the page; used only to group the saved turns.
  const session = typeof raw.session === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(raw.session) ? raw.session : '';

  return { type, message, toGalileo, session, state, transcript };
}

/**
 * @param {string} step
 * @param {{condition?: string, spark?: boolean}} [state]
 */
export function nextStep(step, state = {}) {
  let index = STEP_ORDER.indexOf(step);
  if (index < 0) return 'done';
  // Skip debate-only steps for the guided group, and "tie" after a spark.
  while (index < STEP_ORDER.length - 1) {
    index += 1;
    const next = STEP_ORDER[index];
    if (RETIRED_STEPS.includes(next)) continue;
    if (DEBATE_ONLY_STEPS.includes(next) && state.condition === 'guided') continue;
    if (next === 'tie' && state.spark) continue;
    if (GUIDED_ONLY_STEPS.includes(next) && state.condition !== 'guided') continue;
    return next;
  }
  return 'done';
}

/** One line per step: what the student has reached when they are there. */
const STEP_GOALS = {
  premise: 'states Aristotle\'s rule: heavier bodies fall faster',
  tie: 'proposes putting a heavy and a light body together (tied, joined, in any words)',
  counter: 'gives BOTH lines of reasoning about the joined pair: the light one holds the heavy one back (slower than 8) AND together they are heavier (faster than 8)',
  slower: 'says the joined pair is slower than the heavy one alone, because the light one holds it back',
  faster: 'says the joined pair is heavier, so by the rule it falls faster than the heavy one alone',
  contradiction: 'says the two answers contradict each other, so Aristotle\'s rule must be wrong',
  conclusion: 'says all bodies fall at the same rate: falling speed does not depend on weight',
};

/** @param {{condition?: string, spark?: boolean}} state */
function stepOrder(state) {
  return STEP_ORDER.filter(
    (s) =>
      !(state.condition === 'guided' && DEBATE_ONLY_STEPS.includes(s)) &&
      !(state.condition !== 'guided' && GUIDED_ONLY_STEPS.includes(s)) &&
      !(s === 'tie' && state.spark) &&
      !RETIRED_STEPS.includes(s),
  );
}

/**
 * Steps after the current one that a student may jump to (never past the conclusion).
 * @param {{step: string, condition?: string, spark?: boolean}} state
 */
export function laterSteps(state) {
  const order = stepOrder(state);
  const end = order.indexOf('conclusion');
  return order.slice(order.indexOf(state.step) + 1, end + 1);
}

/** @param {{step: string, condition?: string, spark?: boolean}} state @param {string} [intro] */
function skipCard(state, intro = 'If step_done is true and') {
  const later = laterSteps(state);
  if (!later.length) return '';
  const lines = later.map((s) => `- "${s}": the student ${STEP_GOALS[/** @type {keyof typeof STEP_GOALS} */ (s)]}`);
  return `\n\nSKIPPING AHEAD: the student may already be further on. Later steps:\n${lines.join('\n')}\n${intro} the student's own words (in this message or their recent ones) already STATE the goal of a later step, add "reached": "<the furthest such step>" to the JSON object. Stating means the student says it, not just something that leads towards it: for example, saying the two answers contradict reaches "contradiction" but NOT "conclusion"; "conclusion" needs the student to say that heavy and light bodies fall at the same speed. If unsure, leave "reached" out. When you add "reached", do not ask about any step up to it.`;
}

/**
 * Steps passed when jumping from the current step to `target`, plus the
 * notebook lines they fill.
 * @param {{step: string, condition?: string, spark?: boolean}} state @param {string} target
 */
function jumpPath(state, target) {
  const order = stepOrder(state);
  const from = order.indexOf(state.step);
  const path = order.slice(from < 0 ? 0 : from, order.indexOf(target) + 1);
  if (path.includes('counter')) path.push('slower', 'faster');
  return path;
}

/**
 * The script for the current step; "counter" depends on Aristotle's view.
 * @param {{step: string, view?: string}} state
 */
export function stepFor(state) {
  if (state.step === 'counter') return COUNTER[state.view === 'slower' ? 'slower' : 'faster'];
  return STEPS[state.step];
}

/** How many hints Galileo has already given in this step. @param {DebateState} state */
function helpCount(state) {
  return state.condition === 'guided' ? state.stepTurns : state.helpTurns;
}

/** @param {DebateState} state */
function hintFor(state) {
  const step = stepFor(state);
  const hint = step ? step.hints[Math.min(helpCount(state), 2)] : '';
  return state.lang === 'zh' ? toZh(hint) : hint;
}

const CHINESE_RULES = `LANGUAGE (this overrides the language rules above): this chat is in Chinese. Write every message in simplified Chinese (简体中文), in short, plain sentences that a Chinese high-school student reads easily, at most about 80 characters per message. No English words at all except numbers; to mention Galileo write "@伽利略". Aristotle calls the student 年轻人 or 朋友. The student writes in Chinese; judge their meaning as usual. Keep the JSON keys and the student_move labels in English.`;

/**
 * Every line the student sees, in the chat's language.
 * @template {{messages: ChatMessage[]}} T
 * @param {T} outcome @param {string} lang
 * @returns {T}
 */
export function localize(outcome, lang) {
  if (lang !== 'zh') return outcome;
  return { ...outcome, messages: outcome.messages.map((m) => (m.speaker === 'system' || !m.text ? m : { ...m, text: toZh(m.text) })) };
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
    const ahead = skipCard({ ...state, step: 'tie' }, 'If student_move is "thought_experiment" and');
    const closing = DEBATE_TAILS[state.debateTurns % DEBATE_TAILS.length];
    const said = state.lang === 'zh' ? toZh(closing) : closing;
    return `${DEBATE_CARD}\n\nThis is student debate turn ${state.debateTurns + 1}.\nCLOSING SENTENCE (end Aristotle's message with exactly this): "${said}"${ahead}`;
  }
  const step = stepFor(state);
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
  const tie = state.step === 'tie' && !state.galileo ? `\n\n${TIE_ARISTOTLE}` : '';
  return `${step.card}\n\n${presence}${tie}${reveal}${toGalileo ? `\n\n${TO_GALILEO}` : ''}${skipCard(state)}`;
}

const TIE_ARISTOTLE = `ARISTOTLE'S LINES IN THIS STEP (when step_done is false and Galileo does not come):
- For "same_time", "experiment", "air", "vacuum", "book", "formula", "pisa": one Aristotle message, 1 to 3 short sentences, following the idea below for that label, and ending with exactly: "${TIE_TAIL}" (in the chat's language).
${ARISTOTLE_IDEAS}
- For "thought_partial": one short Aristotle message that takes up what the student said and asks only which things they mean. He adds nothing the student has not said, and asks for no more detail than that.
- For "other": one Aristotle message that holds his position with an everyday example or excuse. He never suggests any idea.`;

/** @param {DebateState} state @param {boolean} toGalileo */
function buildGuidedCard(state, toGalileo) {
  if (state.step === 'debate') return `${EXPLORE_CARD}\n\nThis is turn ${state.debateTurns + 1} of ${EXPLORE_TURNS}.`;
  if (state.step === 'done') return GUIDED_DONE_CARD;
  const step = STEPS[state.step];
  const reveal = revealDue(state)
    ? `\n\nTHIS TURN: the student has already tried ${state.stepTurns} times. If step_done is false, Galileo writes ONLY one short, kind line about what the student tried, with no question and no answer: the lesson code explains the idea right after your message.`
    : '';
  return `${step.card}\n\n${guidedPresence(step.onPass, `"${hintFor(state)}"`)}${reveal}${toGalileo ? `\n\n${GUIDED_TO_GALILEO}` : ''}${skipCard(state)}`;
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
  const zh = input.state.lang === 'zh';
  const reminder = strictEnglish
    ? zh
      ? '\n\nIMPORTANT: your last answer was not in Chinese. Write every message in simplified Chinese only.'
      : '\n\nIMPORTANT: your last answer contained Chinese characters. Write every message in English only.'
    : '';
  const language = zh ? `\n\n${CHINESE_RULES}` : '';
  return {
    model,
    thinking: { type: 'disabled' },
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 700,
    stream: false,
    messages: [
      { role: 'system', content: `${input.state.condition === 'guided' ? GUIDED_INTRO : DEBATE_INTRO}\n\n${SHARED_RULES}\n\n---\n\n${buildCard(input.state, input.toGalileo)}${language}${reminder}` },
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
  const move = cleanText(data.student_move, 32).toLowerCase();
  // Preset labels need no words from the model: the lesson code adds the reply.
  const presetOk = condition !== 'guided' && (step === 'debate' || step === 'tie') && PRESET_MOVES.has(move);
  if (messages.length === 0 && !presetOk) return null;

  return {
    move,
    lean: data.lean === 'slower' || data.lean === 'faster' ? data.lean : null,
    reached: typeof data.reached === 'string' ? data.reached.trim().toLowerCase() : null,
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

/**
 * True when the model wrote in the wrong language for this chat.
 * @param {ChatMessage[]} messages @param {string} lang
 */
export function wrongLanguage(messages, lang) {
  if (lang === 'zh') return messages.some((m) => m.text && !CJK.test(m.text));
  return hasChinese(messages);
}

/* ------------------------------------------------------------------ */
/* Deterministic lesson flow                                           */
/* ------------------------------------------------------------------ */

/** @param {'concede'|'help'|'asked'|'repeat'} reason */
function galileoJoins(reason) {
  return [
    { speaker: 'system', text: 'Galileo joined the chat' },
    { speaker: 'galileo', text: ENTRANCE[reason] },
    ...STEPS.premise.opener,
  ];
}

/**
 * @param {string} step
 * @param {{condition?: string, view?: string}} [state]
 */
function openerFor(step, state = {}) {
  if (step === 'contradiction' && state.condition !== 'guided' && (state.view === 'faster' || state.view === 'slower')) {
    return [{ speaker: 'aristotle', text: CONTRADICTION_OPENER[state.view], image: 'contradiction' }];
  }
  return stepFor({ step, view: state.view }).opener.map((/** @type {ChatMessage} */ m) => ({ ...m }));
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
  if (/(pisa|leaning tower|比萨|斜塔)/.test(t)) return 'pisa';
  if (/^idk\.?$/.test(t.trim()) || /(don'?t know|no idea|\bhelp\b|\bhint\b|\bstuck\b|不知道|不会做|帮帮|帮我|提示|求助)/.test(t)) return 'help';
  return 'argue';
}

/**
 * Apply the model's judgement (or a fallback) to the lesson state.
 * @param {DebateInput} input
 * @param {{move: string, stepDone: boolean, messages: ChatMessage[]} | null} result null when the AI failed
 */
export function advance(input, result) {
  const out =
    input.state.condition === 'guided'
      ? advanceGuided(input, result)
      : input.toGalileo && input.state.step === 'debate'
        ? askGalileoFirst(input, result)
        : advanceStep(input, result);
  return { ...out, passed: [...new Set(out.passed)] };
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
 * Aristotle's answer to an argument (open debate and "tie"): the fixed reply
 * for a preset label (the next wording each time the same label comes back),
 * the Pisa easter egg once, or else his own words.
 * Pushes onto `messages`; returns the state fields to update.
 * @param {string} move @param {DebateState} state @param {string} tail
 * @param {ChatMessage[]} messages @param {ChatMessage[]} own the model's (or script's) line
 */
function presetReply(move, state, tail, messages, own) {
  const end = (/** @type {string} */ text) => (tail ? `${text} ${tail}` : text);
  if (move === 'pisa' && !state.pisaSeen) {
    messages.push(JOINED, { speaker: 'galileo', ...PISA.galileo }, LEFT, { speaker: 'aristotle', text: end(PISA.aristotle) });
    return { pisaSeen: true };
  }
  const label = move === 'pisa' ? 'experiment' : move;
  const options = ARGUMENT_REPLIES[/** @type {keyof typeof ARGUMENT_REPLIES} */ (label)];
  if (options) {
    const n = state.used?.[label] || 0;
    // The model's own words for this idea; the fixed wording only if it wrote none.
    const preset = options[n % options.length];
    const line = own.find((m) => m.speaker === 'aristotle' && m.text);
    const text = line ? line.text : end(preset.text);
    const image = n === 0 ? options[0].image : undefined;
    messages.push({ speaker: 'aristotle', text, ...(image ? { image } : {}) });
    return { used: { ...state.used, [label]: n + 1 } };
  }
  const n = state.used?.[move] || 0;
  if (move === 'thought_experiment') {
    messages.push({ speaker: 'aristotle', text: THOUGHT_REPLIES[n % THOUGHT_REPLIES.length] });
    return { used: { ...state.used, [move]: n + 1 } };
  }
  messages.push(...(own.length ? own : [{ speaker: 'aristotle', text: end('My rule stands.') }]));
  return COUNTED_MOVES.includes(move) ? { used: { ...state.used, [move]: n + 1 } } : {};
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

    // Galileo comes only for "help" or "concede".
    if (move === 'concede' || move === 'help') {
      messages.push({ speaker: 'aristotle', text: BEFORE_GALILEO[move] }, ...galileoJoins(move));
      return {
        messages,
        state: { ...state, step: 'premise', stepTurns: 0, helpTurns: 0, debateTurns, galileo: true },
        passed,
        joined: move,
      };
    }

    const tail = DEBATE_TAILS[state.debateTurns % DEBATE_TAILS.length];
    const fallback = { speaker: 'aristotle', text: DEBATE_FALLBACKS[state.debateTurns % DEBATE_FALLBACKS.length] };
    const patch = presetReply(move, state, tail, messages, result ? only('aristotle').slice(0, 1) : ARGUMENT_REPLIES[/** @type {keyof typeof ARGUMENT_REPLIES} */ (move)] ? [] : [fallback]);
    const label = move === 'pisa' && !patch.pisaSeen ? 'experiment' : move;

    // The same argument has come back REPEAT_LIMIT times: Galileo steps in to guide.
    if (patch.used && patch.used[label] === REPEAT_LIMIT) {
      messages.push(...galileoJoins('repeat'));
      return {
        messages,
        state: { ...state, ...patch, step: 'premise', stepTurns: 0, helpTurns: 0, debateTurns, galileo: true },
        passed,
        joined: 'repeat',
      };
    }

    // The student invented the thought experiment (which takes the rule as
    // true): Aristotle follows it straight into the tied stones. He never
    // suggests the method himself.
    if (move === 'thought_experiment') {
      const view = result?.lean === 'slower' ? 'slower' : 'faster';
      const sparked = { ...state, step: 'premise', spark: true };
      const target = result?.reached && laterSteps(sparked).includes(result.reached) ? result.reached : null;
      if (target) {
        // The student already went further: skip straight past what they reached.
        const step = nextStep(target, sparked);
        // A question about a step the student already passed would sound odd now.
        while (messages.length && /\?\s*$/.test(messages.at(-1)?.text || '')) messages.pop();
        messages.push(...openerFor(step, sparked));
        return {
          messages,
          state: { ...state, step, stepTurns: 0, helpTurns: 0, debateTurns, galileo: false, spark: true, ...patch },
          passed: ['premise', ...jumpPath(sparked, target)],
          joined: null,
        };
      }
      messages.push(...openerFor('counter', { view }));
      return {
        messages,
        state: { ...state, step: 'counter', stepTurns: 0, helpTurns: 0, debateTurns, galileo: false, spark: true, view, ...patch },
        passed: ['premise', 'slower'],
        joined: null,
      };
    }
    return { messages, state: { ...state, debateTurns, ...patch }, passed, joined: null };
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
  // In "tie" the label "thought_experiment" is the pass, whatever step_done says.
  const passedNow = Boolean(result?.stepDone) || (state.step === 'tie' && move === 'thought_experiment');

  if (passedNow || revealDue(now)) {
    // The student may have reached a later step already: jump past it.
    const target = passedNow && result?.reached && laterSteps(state).includes(result.reached) ? result.reached : state.step;
    passed.push(...(target === state.step ? [state.step] : jumpPath(state, target)));
    // Aristotle's view for "counter" comes from the student's own words in "tie".
    const view = target === 'tie' ? (result?.lean === 'slower' ? 'slower' : 'faster') : state.view;
    const step = nextStep(target, state);
    // Notebook: Aristotle reasons one way on entering "counter"; the student the other way.
    if (step === 'counter') passed.push('slower');
    if (state.step === 'counter') passed.push('faster');
    if (passedNow) {
      let reply = /** @type {NonNullable<typeof result>} */ (result).messages;
      // After a jump, drop lines that still ask about a step already passed.
      if (target !== state.step) reply = reply.filter((m) => !/\?\s*$/.test(m.text || ''));
      if (!helping) messages.push(...reply.filter((m) => m.speaker !== 'galileo'));
      else {
        // One Galileo line at most, then he steps back.
        const g = reply.find((m) => m.speaker === 'galileo') || { speaker: 'galileo', text: stepFor(state).leave || "Well done. I'll step back now." };
        const a = reply.find((m) => m.speaker === 'aristotle');
        messages.push(g, ...(a ? [a] : []));
      }
    } else {
      messages.push(...only('galileo').slice(0, 1));
      messages.push({ speaker: 'galileo', text: `Let's put it together. ${stepFor(state).reveal}` });
    }
    markJoin(messages, wasHere);
    if (helping) messages.push(LEFT);
    messages.push(...openerFor(step, { ...state, view }));
    return {
      messages,
      state: { ...state, step, stepTurns: 0, helpTurns: 0, galileo: false, ...(view ? { view } : {}) },
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
  const own = a.length ? a : [{ speaker: 'aristotle', text: stepFor(state).press }];
  if (state.step === 'tie') {
    const patch = presetReply(move, state, TIE_TAIL, messages, a);
    const label = move === 'pisa' && !patch.pisaSeen ? 'experiment' : move;
    // The same argument has come back REPEAT_LIMIT times: Galileo steps in with a hint.
    if (patch.used && patch.used[label] === REPEAT_LIMIT) {
      const hinted = { ...state, ...patch, galileo: true };
      messages.push(JOINED, { speaker: 'galileo', text: `${ENTRANCE.repeat} ${hintFor(hinted)}` });
      return { messages, state: { ...hinted, stepTurns: state.stepTurns + 1, helpTurns: state.helpTurns + 1 }, passed, joined: 'repeat' };
    }
    return { messages, state: { ...state, stepTurns: state.stepTurns + 1, ...patch }, passed, joined: null };
  }
  messages.push(...own);
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
    const target = passedNow && result?.reached && laterSteps(state).includes(result.reached) ? result.reached : state.step;
    passed.push(...(target === state.step ? [state.step] : jumpPath(state, target)));
    messages.push(...reply);
    if (!passedNow) messages.push({ speaker: 'galileo', text: `Let's put it together. ${STEPS[state.step].reveal}` });
    const step = nextStep(target, state);
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
