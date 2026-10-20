/**
 * The guided (control) group. Same steps, pass rules, hints, reveals,
 * pictures and animations as the debate group (steps.js); only the social
 * setting changes. Galileo is the only character, present from the start, and
 * asks every question himself in a positive "let's work it out" voice.
 * Aristotle is mentioned as a person from history and never speaks.
 *
 * Each line below mirrors the debate line at the same point, with the same
 * physics content and a similar length. Keep them in step when editing.
 */

/** Student turns in the opening exploration before the method starts. */
export const EXPLORE_TURNS = 2;

export const EXPLORE_CARD = `CURRENT STEP: explore (opening; only Galileo and the student are in the chat)
Allowed speakers: galileo only. Write exactly 1 message.

Galileo has shown everyday examples (a stone lands before a feather, an apple before a leaf) and Aristotle's old rule: the heavier a body, the faster it falls. He asked the student what they think and why.
Goal: the student shares their own ideas. There is no right answer to reach yet.

Galileo answers positively: he names one thing in the student's idea that is worth thinking about, and gently adds one everyday observation that helps them think (for example: a flat sheet of paper and a crumpled one of the same weight). He does not say whether heavy things fall faster, and he does not argue.
If this is turn 1, he ends with one short open question about the student's idea.
If this is turn 2, he does NOT ask a question: the next part is added automatically.

Classify the student's message as student_move:
- "idea": any idea or opinion about falling bodies.
- "thought_experiment": the student reasons from the rule by imagining bodies joined or split (tying, gluing, cutting).
- "stuck": "I don't know", very short or empty reply, or asks for help.
- "off_topic": nothing to do with falling bodies.
step_done is always false in this step.`;

/** Galileo's lines when the AI is unavailable in the exploration. */
export const EXPLORE_FALLBACKS = [
  'Good, thank you. Now look at a flat sheet of paper and the same sheet crumpled into a ball. Same weight, but do they fall the same way? What do you think?',
  'That is worth thinking about. Notice how air seems to push more on wide, light things, like a feather or an open sheet of paper.',
];

/** Galileo's line for the help button during the exploration. */
export const EXPLORE_HINT = 'There is no wrong answer yet. Do you think a heavy stone falls faster than a light one? Say why you think so.';

/** Bridges from the exploration into the method. */
export const BRIDGE = {
  idea: "Thank you for sharing your ideas. Examples can be tricky, because air gets in the way. So let's test the rule with a sharper tool: pure reasoning.",
  spark: 'Joining stones together? That is exactly my idea! Let us build it carefully, one step at a time.',
};

/**
 * Openers for each step, spoken by Galileo.
 * @type {Record<string, Array<{speaker: 'galileo', text: string, image?: string}>>}
 */
export const GUIDED_OPENERS = {
  premise: [
    {
      speaker: 'galileo',
      text: "Here is a smart first move: let's take Aristotle's rule as TRUE, just for now, so we can test it. In one short sentence, what exactly is the rule about weight and falling?",
    },
  ],
  slower: [
    {
      speaker: 'galileo',
      text: "Let's test the rule with two stones. By the rule, the heavy stone falls at speed 8 and the light stone at speed 4.",
      image: 'stones',
    },
    {
      speaker: 'galileo',
      text: 'Now I tie them together with a short rope. Think about it with me: does the light stone speed up the heavy one, or hold it back?',
      image: 'tied',
    },
  ],
  faster: [
    {
      speaker: 'galileo',
      text: 'Now look at the tied pair as one body. Is it heavier or lighter than the heavy stone alone, and what does the rule say about that?',
    },
  ],
  contradiction: [
    {
      speaker: 'galileo',
      text: 'So you said this pair falls slower than 8, and now faster than 8, both from the same rule. What do these two answers show?',
      image: 'contradiction',
    },
  ],
  objection: [
    {
      speaker: 'galileo',
      text: 'Someone might say: two stones on a rope are not ONE body. They are two bodies. So the rule is safe! How would you answer that?',
    },
  ],
  conclusion: [
    {
      speaker: 'galileo',
      text: 'Then the rule leads to nonsense. So what IS true? How fast does the tied pair fall, if there is to be no contradiction at all?',
    },
  ],
  method: [
    {
      speaker: 'galileo',
      text: "Bravo! And Aristotle's feather? Air pushes hard on a light, wide feather. Pump the air out of a glass tube, and a feather and a coin fall side by side.",
      image: 'tube',
    },
    {
      speaker: 'galileo',
      text: 'So the air fooled people for a very long time. Aristotle saw real things; the air was hiding the true rule. You found it with your own reasoning.',
    },
    {
      speaker: 'galileo',
      text: 'You did it with no lab and no tools, only your mind. That is called a thought experiment. In your own words: what steps did you follow?',
    },
  ],
  done: [
    {
      speaker: 'galileo',
      text: "Here is your method, the same one I used: take the rule as true, just for now, imagine a simple case, reason it two ways, find the contradiction, and reject the rule. You can use it on any claim.",
      image: 'method',
    },
    {
      speaker: 'galileo',
      text: 'Great work today. You may ask me anything now.',
    },
  ],
};

export const GUIDED_DONE_CARD = `CURRENT STEP: done (the lesson is finished; free questions)
Allowed speakers: galileo only.
Answer any short follow-up question about falling bodies or thought experiments in 1 or 2 short messages. Galileo answers physics questions simply and correctly (air resistance, why a feather is slow, falling in a tube with no air). If the student wants another challenge, Galileo suggests trying the same method on another claim, for example "a heavier ball rolls down a slope faster".

student_move labels: "question", "chat", "off_topic".
step_done is always false.`;

/**
 * Who-is-here block for the guided group.
 * @param {{galileo: string}} onPass
 * @param {string} hint
 */
export function guidedPresence(onPass, hint) {
  return `WHO IS IN THE CHAT: only Galileo (the student's tutor) and the student. Aristotle is NOT in the chat. Allowed speakers: galileo only.
- If step_done is true: Galileo praises in one or two sentences (${onPass.galileo}). Do NOT ask a new question: the next question is added automatically.
- If step_done is false: Galileo answers what the student said, kindly and positively, and ends with this hint as a question: ${hint}.`;
}

export const GUIDED_TO_GALILEO = `THE STUDENT IS TALKING TO GALILEO directly (the message contains "@Galileo"). If the student asks a question, Galileo answers it in one or two sentences, then ends with the hint. His answer must NOT state or imply the PASS answer of this step, even partly (for example, in the "slower" step he must not say the pair or the heavy stone becomes slower); explain words and set up the picture instead, and let the student draw the conclusion. If the message contains an answer that passes, judge it as usual.`;
