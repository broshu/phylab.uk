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

/** Student turns in the opening (the vote) before the method starts. */
export const EXPLORE_TURNS = 1;

export const EXPLORE_CARD = `CURRENT STEP: explore (opening vote)
Allowed speakers: galileo only. Write exactly 1 message.

Aristotle has shown his everyday experiment (a stone lands before a feather) and his rule: the heavier a body, the faster it falls. Galileo has told the story of the Leaning Tower of Pisa (a heavy and a light ball landed almost together). Galileo asked the student which idea they agree with.
Goal: the student picks a side or gives an idea. There is no right answer to reach yet.

Galileo answers in one or two short sentences: he thanks the student and names their choice or idea, without saying who is right and without arguing. He does NOT ask any question (no question mark): Aristotle answers next, then the lesson goes on automatically.

Classify the student's message as student_move:
- "idea": any choice, idea or opinion about falling bodies.
- "thought_experiment": the student reasons from the rule by imagining bodies joined or split (tying, gluing, cutting).
- "stuck": "I don't know", very short or empty reply, or asks for help.
- "off_topic": nothing to do with falling bodies.
step_done is always false in this step.`;

/** Galileo's lines when the AI is unavailable in the exploration. */
export const EXPLORE_FALLBACKS = [
  'Thank you for choosing. Let us see who is right.',
];

/** Galileo's line for the help button during the exploration. */
export const EXPLORE_HINT = 'There is no wrong answer yet. Do you agree with Aristotle (heavier falls faster) or with me (they fall together)?';

/** Bridges from the exploration into the method. */
export const BRIDGE = {
  idea: "Then let's not argue about whose eyes are better. Let's prove it with a thought experiment, using only reasoning.",
  spark: 'Joining stones together? That is exactly my idea! Let us build it carefully, one step at a time.',
};

/** Aristotle is not convinced by the tower story (guided group, after the vote). */
export const ARISTOTLE_UNCONVINCED = 'Almost together is not together! There was a small difference, and you did not look closely. My rule stands: the heavier body falls faster.';

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
  faster: [
    {
      speaker: 'galileo',
      text: "First, let's take Aristotle's rule as TRUE, just for now: the heavier a body, the faster it falls. By his rule, a heavy stone falls at speed 8 and a light stone at speed 4.",
      image: 'stones',
    },
    {
      speaker: 'galileo',
      text: "Now put them together with a short rope. Seen as ONE body, the pair is heavier than the heavy stone alone. By Aristotle's rule, how fast should the pair fall?",
      image: 'tied',
    },
  ],
  slower: [
    {
      speaker: 'galileo',
      text: 'But we can also see it another way: the heavy stone pulls the light stone along as they fall, and the light stone alone only wants speed 4. By the same rule, what is the speed of the pair now?',
    },
  ],
  contradiction: [
    {
      speaker: 'galileo',
      text: "So by Aristotle's own rule, the tied pair falls faster than 8, and also slower than 8.",
      image: 'contradiction',
    },
    {
      speaker: 'galileo',
      text: "Then is Aristotle's rule right?",
    },
  ],
  conclusion: [
    {
      speaker: 'galileo',
      text: 'So? If his rule is wrong, what is true? Think about the tied pair first: how fast can it fall, if there is to be no contradiction at all?',
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

/** Guided steps in order, after the opening vote. Galileo states the premise himself. */
export const GUIDED_ORDER = ['faster', 'slower', 'contradiction', 'conclusion', 'method', 'done'];

/**
 * Guided-group versions of the step cards (what the student has seen differs:
 * Galileo sets up each question himself, "faster" comes first).
 * Fields here replace the same fields of STEPS[step].
 */
export const GUIDED_STEPS = {
  faster: {
    card: `CURRENT STEP: faster (first line of reasoning)
Setup the student can see: Galileo took Aristotle's rule as true for now (heavier falls faster). By the rule the heavy stone falls at speed 8 and the light stone at speed 4. Galileo tied them together and said: seen as ONE body, the pair is heavier than the heavy stone alone. He asked how fast the pair should fall by Aristotle's rule.

Goal: by Aristotle's rule the heavier pair falls FASTER than 8 (for example 12).

PASS (step_done = true) if the student says the pair falls faster than 8, more than 8, "12", or simply "faster" / "fast" / "快" / "更快" (because it is heavier).
NOT YET (step_done = false). Choose one student_move label:
- "partial": "slower" or "between 4 and 8" because the light stone holds it back (note: a very good idea, we will use it next; for now look only at the weight of the pair and Aristotle's rule); or only "heavier" without the speed.
- "wrong": "same speed" or "8"; "lighter" (note: put both stones on a scale together).
- "help": asks for help, or says they are stuck or do not know.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: { galileo: "say that this is exactly what Aristotle's rule gives: faster than 8", aristotle: '' },
    hints: [
      'Put both stones on a scale together. Do they weigh more or less than the heavy stone alone?',
      "The pair is heavier than the heavy stone. Aristotle's rule says a heavier body falls ___?",
      "By Aristotle's rule, the heavier pair must fall faster than 8, maybe 12. Can you say it?",
    ],
    reveal: "Together the stones weigh more than the heavy stone alone, so by Aristotle's rule the pair must fall faster than 8.",
  },
  slower: {
    card: `CURRENT STEP: slower (second line of reasoning)
The student already found: as one heavier body, the pair falls faster than 8. Galileo has now asked them to see it another way: the heavy stone (speed 8) pulls the light stone (speed 4) along as they fall. What is the speed of the pair?

Goal: the slow light stone holds back (drags, brakes) the heavy stone, so the pair falls SLOWER than 8, somewhere between 4 and 8.

PASS (step_done = true) if the student says any of: slower than 8; simply "slower" / "slow" / "慢" / "变慢"; between 4 and 8; about 6 or "the average"; the light stone slows, drags, pulls back or holds back the heavy stone.
NOT YET (step_done = false). Choose one student_move label:
- "partial": repeats "faster" or "12" (note: that was the first way of looking; now think about the slow light stone on the rope).
- "wrong": "same speed" or "8"; "4"; "the light stone speeds the heavy one up".
- "help": asks for help, or says they are stuck or do not know.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: { galileo: 'name what was good in the reasoning: the slow stone holds back the fast one, so slower than 8', aristotle: '' },
    hints: [
      'The heavy stone wants to go at 8. The light stone only wants 4. If a fast runner is tied to a slow runner, what happens to the fast runner?',
      'The rope gets tight, and the slow stone pulls back on the fast one. So is the pair faster or slower than 8?',
      'The light stone acts like a brake, so the pair falls slower than 8, somewhere between 4 and 8. Can you say it?',
    ],
    reveal: 'The light stone acts like a brake on the heavy one, so the tied pair falls slower than 8, somewhere between 4 and 8.',
  },
  contradiction: {
    card: `CURRENT STEP: contradiction
The student has derived from Aristotle's rule both: the tied pair falls faster than 8, AND it falls slower than 8. Galileo has just asked: then is Aristotle's rule right?

Goal: the student says no, the rule is wrong, because the two answers cannot both be true.

PASS (step_done = true) if the student says no / not right / wrong / it fails, or that the two answers contradict or cannot both be true.
NOT YET (step_done = false). Choose one student_move label:
- "concede": the student says yes, the rule is right, or both answers can be true. Note: can one pair fall faster than 8 and slower than 8 at the same time?
- "partial": picks one answer ("it is slower"; note: the other answer came from the same rule).
- "help": asks for help, or says they are stuck or do not know, or "not sure".
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: { galileo: 'agree: one pair cannot fall faster and slower than 8 at once, so the rule contradicts itself', aristotle: '' },
    hints: [
      'Can one tied pair fall faster than 8 and slower than 8 at the same time?',
      "Both answers came from Aristotle's own rule, and they cannot both be true. So what does that say about the rule?",
      "The rule gives two answers that cannot both be true, so Aristotle's rule must be wrong. Do you agree?",
    ],
    reveal: "One pair cannot fall faster and slower than 8 at the same time. The rule contradicts itself, so Aristotle's rule must be wrong.",
  },
  conclusion: {
    card: `CURRENT STEP: conclusion (Galileo guides in small steps)
Aristotle's rule has failed by a contradiction. Galileo asked "So?": what is true, starting with how fast the tied pair can fall without a contradiction.

Goal: the student states the new rule: heavy and light bodies fall at the same speed (if air does not get in the way); weight does not decide falling speed.

PASS (step_done = true) if the student says all bodies, or heavy and light bodies, fall at the same speed / same rate / together, or that falling speed does not depend on weight.
Read a short reply with Galileo's question just before it: after a question about how fast the light stone falls, or about heavy and light bodies, "same", "the same", "一样", "一样快" or "8 too" means they fall at the same speed: PASS.
NOT YET (step_done = false). Choose one student_move label:
- "partial": the pair falls at 8, or at the same speed as the heavy stone, or "neither faster nor slower" (note: good; then adding the light stone changes nothing, so how fast does the light stone fall?); or the light stone falls at 8 too (note: good; so what can you say about heavy and light bodies in general?); or talks only about air (note: without air, what is true?).
- "wrong": "between 4 and 8", or "the light one falls faster".
- "concede": heavier bodies fall faster after all. Note: remember the contradiction.
- "help": asks for help, or says they are stuck or do not know.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: { galileo: 'praise warmly and repeat the new rule in one sentence (without air, heavy and light bodies fall together)', aristotle: '' },
    hints: [
      'The pair cannot be faster than 8, and it cannot be slower than 8. So what speed is left for the pair?',
      'If the pair falls at 8, just like the heavy stone, then adding the light stone changed nothing. So how fast must the light stone fall on its own?',
      'So the heavy stone and the light stone fall at the same speed. Can you say the new rule about heavy and light bodies in your own words?',
    ],
    reveal: 'Without air in the way, heavy and light bodies fall at the same speed. Weight does not decide how fast a body falls.',
  },
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
  return `WHO IS IN THE CHAT: Galileo (the student's tutor), the student, and Aristotle, who stays silent now. Allowed speakers: galileo only.
- If step_done is true: Galileo praises in one or two sentences (${onPass.galileo}). Do NOT ask a new question: the next question is added automatically.
- If step_done is false: Galileo answers what the student said, kindly and positively, and ends with this hint as a question: ${hint}. If the student has already answered that hint's question, ask instead the next small question from the notes under the labels. Write it all in ONE message.`;
}

export const GUIDED_TO_GALILEO = `THE STUDENT IS TALKING TO GALILEO directly (the message contains "@Galileo"). If the student asks a question, Galileo answers it in one or two sentences, then ends with the hint. His answer must NOT state or imply the PASS answer of this step, even partly (for example, in the "slower" step he must not say the pair or the heavy stone becomes slower); explain words and set up the picture instead, and let the student draw the conclusion. If the message contains an answer that passes, judge it as usual.`;
