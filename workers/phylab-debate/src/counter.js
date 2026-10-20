/**
 * Debate group: the "counter" step, which replaces "slower" + "faster".
 *
 * Once the student has proposed tying a heavy and a light stone together,
 * Aristotle himself reasons ONE way, the way the student's own words point to
 * (lean), with an animation, and claims his rule is safe. He gives no hint.
 * The student must find the OTHER line of reasoning from the same rule:
 * - view "faster": Aristotle says the pair is one heavier body, so faster than 8;
 *   the student must answer that the slow light stone holds the heavy one back.
 * - view "slower": Aristotle says the slow stone holds the fast one back, so
 *   between 4 and 8; the student must answer that the pair is heavier, so faster.
 * Either way the next step (contradiction) has both answers on the table.
 */

const SETUP = {
  speaker: 'aristotle',
  text: 'Very well, let us tie my heavy stone and a light stone together. By my rule, the heavy stone falls at speed 8 and the light stone at speed 4.',
  image: 'stones',
};

/** @typedef {'faster' | 'slower'} View */

/** @type {Record<View, any>} */
export const COUNTER = {
  faster: {
    opener: [
      SETUP,
      {
        speaker: 'aristotle',
        text: 'Tied together, the two stones make one body, heavier than my heavy stone. So by my rule the pair falls faster than 8, perhaps 12. My rule wins again, young one.',
        image: 'tied-faster',
      },
    ],
    card: `CURRENT STEP: counter (debate group). Aristotle has just reasoned ONE way about the tied pair: together the stones are one heavier body, so by his rule the pair falls FASTER than 8 (perhaps 12). He thinks his rule is safe.
The student must find the OTHER reasoning from the same rule: the light stone is slow (speed 4), so it holds back, drags or brakes the heavy stone (speed 8), and the pair falls SLOWER than 8, between 4 and 8.

PASS (step_done = true) if the student says, in any words, that the light stone holds back / drags / slows the heavy one, or that the pair is slower than 8 / between 4 and 8.
ALSO PASS (step_done = true, student_move = "asked") if the student ASKS Aristotle a question that leads him there (for example "what does the light stone do to the heavy one?", "is the light one slower?", "faster or middle speed?"). Then Aristotle answers honestly with his own rule, so that he himself says the other reasoning: the light stone alone is slow, so on the rope it holds the fast heavy one back, and the pair should fall slower than 8. His answer is the one Aristotle message for this turn; he sounds a little unsure as he says it, and does not ask a new question.
NOT YET (step_done = false). Choose one student_move label:
- "concede": the student agrees with Aristotle (yes, faster, 12) and raises no objection.
- "wrong": "same speed" or "8"; "4"; "the light stone speeds the heavy one up".
- "partial": something is wrong with Aristotle's answer, but no reason yet.
- "argue": argues about something else (air, experiments, books) without answering.
- "help": asks for help, or says they are stuck or do not know.
- "other": anything else.

Notes for Galileo when he helps: the light stone alone wants speed 4, the heavy one 8; what does the slow one do to the fast one when the rope is tight?
Aristotle, when he answers alone and the student has not asked him such a question, keeps his own reasoning (one heavier body, faster) and adds nothing new. He must NOT mention what the light stone does to the heavy one, its speed of 4 on the rope, or ask any question that points there; he only restates his own reasoning and challenges the student to break it.`,
    onPass: {
      galileo: 'praise the student for reasoning the other way from the same rule',
      aristotle: 'is puzzled in a few words: the light stone holding back the heavy one is also his own logic (do not start with "Wait"; the next line does)',
    },
    leave: "That is the other side of his own rule. I'll step back.",
    press: 'My reasoning is simple: two stones tied together are one heavier body, and by my rule a heavier body falls faster. So the pair falls faster than 8.',
    hints: [
      'Alone, the light stone wants to fall at 4 and the heavy one at 8. When the rope is tight, what does the slow stone do to the fast one?',
      'Think of a fast runner tied to a slow runner. Does the slow one help the fast one, or hold him back? So is the pair faster or slower than 8?',
      "The light stone acts like a brake, so by Aristotle's own rule the pair should fall slower than 8, between 4 and 8. Can you tell him that?",
    ],
    reveal: "But look at it another way: the slow light stone holds back the fast heavy one, so by the same rule the pair should fall slower than 8, between 4 and 8.",
  },

  slower: {
    opener: [
      SETUP,
      {
        speaker: 'aristotle',
        text: 'Tied together, the slow light stone holds back the fast heavy one, and the heavy one pulls the light one along. So the pair falls between 4 and 8, perhaps 6. My rule wins again, young one.',
        image: 'tied-slower',
      },
    ],
    card: `CURRENT STEP: counter (debate group). Aristotle has just reasoned ONE way about the tied pair: the slow light stone holds back the fast heavy one, so the pair falls SLOWER than 8, between 4 and 8 (perhaps 6). He thinks his rule is safe.
The student must find the OTHER reasoning from the same rule: tied together, the two stones are one body, HEAVIER than the heavy stone alone, so by his rule the pair must fall FASTER than 8 (for example 12).

PASS (step_done = true) if the student says, in any words, that the pair is heavier than the heavy stone and so (by his rule) faster than 8, or "12", or "faster because it is heavier".
ALSO PASS (step_done = true, student_move = "asked") if the student ASKS Aristotle a question that leads him there (for example "is the pair heavier or lighter than the heavy stone?", "what does your rule say about a heavier body?", "faster or middle speed?"). Then Aristotle answers honestly with his own rule, so that he himself says the other reasoning: tied together the stones are one body, heavier than the heavy stone, and by his rule a heavier body falls faster, so the pair should fall faster than 8. His answer is the one Aristotle message for this turn; he sounds a little unsure as he says it, and does not ask a new question.
NOT YET (step_done = false). Choose one student_move label:
- "concede": the student agrees with Aristotle (yes, slower, 6) and raises no objection.
- "wrong": "lighter"; "same speed" or "8"; "it falls slower because it is heavier".
- "partial": only "heavier" without the speed, or something is wrong with Aristotle's answer but no reason yet.
- "argue": argues about something else (air, experiments, books) without answering.
- "help": asks for help, or says they are stuck or do not know.
- "other": anything else.

Notes for Galileo when he helps: put both stones on a scale together; is the pair heavier or lighter than the heavy stone alone, and what does Aristotle's rule say about a heavier body?
Aristotle, when he answers alone and the student has not asked him such a question, keeps his own reasoning (the slow one holds back the fast one) and adds nothing new. He must NOT mention the weight of the pair, weighing them together, or ask any question that points there; he only restates his own reasoning and challenges the student to break it.`,
    onPass: {
      galileo: "praise the student for using Aristotle's own rule on the pair as one heavier body",
      aristotle: 'agrees at first ("Naturally, a heavier body falls faster.") and starts to feel uneasy (do not use the word "Wait"; the next line does)',
    },
    leave: "You turned his own rule on him. I'll step back.",
    press: 'My reasoning is simple: the slow stone holds back the fast one, so the pair falls between 4 and 8.',
    hints: [
      'Put both stones on a scale together. Do they weigh more or less than the heavy stone alone?',
      "The pair is heavier than the heavy stone. Now use Aristotle's own rule: a heavier body falls ___?",
      "By Aristotle's own rule, the heavier pair must fall faster than 8, maybe 12. Can you tell him that?",
    ],
    reveal: "But look at it another way: together the stones weigh more than the heavy stone alone, so by the same rule the pair must fall faster than 8.",
  },
};

/** Debate group: the contradiction opener names who said what. */
export const CONTRADICTION_OPENER = {
  faster: 'Wait. By my own rule the pair falls faster than 8, and by my own rule it also falls slower than 8. What are you trying to show me?',
  slower: 'Wait. By my own rule the pair falls slower than 8, and by my own rule it also falls faster than 8. What are you trying to show me?',
};

/** What the model adds when the student proposes the thought experiment. */
export const LEAN_RULE = `Also add "lean" to the JSON object: "faster" if the student's own words point to the pair being one heavier body (heavier together, adding the weights); "slower" if they point to the light one holding back, dragging or slowing the heavy one; if neither, "faster".`;
