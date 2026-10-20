/**
 * The lesson script. Each step is a "card" the model receives on every turn,
 * so the model only has to judge one small thing and write one or two short
 * chat lines. Everything that must always be the same (openers, Galileo's
 * entrance, reveals, the ending) is preset text added by the Worker.
 *
 * Edit wording here; keep the step ids unchanged — the lab page uses them.
 */

import { LEAN_RULE } from './counter.js';
import { ARGUMENT_LABELS, ARISTOTLE_IDEAS } from './replies.js';

export const PROMPT_VERSION = 'debate-aristotle-v18';

/** Steps after Galileo first joins, in order. */
export const STEP_ORDER = [
  'premise',
  'tie',
  'slower',
  'faster',
  'counter',
  'contradiction',
  'objection',
  'conclusion',
  'method',
  'done',
];

export const ALL_STEPS = ['debate', ...STEP_ORDER];

/**
 * Steps only the debate group takes. In "tie" Aristotle does not suggest the
 * tied stones himself: he holds his position and the student must come up with
 * joining the bodies (the textbook is allowed). The guided group goes straight
 * from premise to slower, where Galileo sets up the stones; a debate student who
 * already invented the idea in the open debate (spark) goes straight to slower.
 */
export const DEBATE_ONLY_STEPS = ['tie', 'counter'];

/**
 * Steps no longer used by either group (kept so chats saved mid-step still
 * work). "objection" (the "two bodies" excuse) was dropped in Oct 2026: the
 * student has already treated the pair as one body by then.
 */
export const RETIRED_STEPS = ['objection'];

/**
 * Steps only the guided group takes: Galileo walks through both lines of
 * reasoning. In the debate group Aristotle reasons one way and the student
 * must find the other ("counter", src/counter.js).
 */
export const GUIDED_ONLY_STEPS = ['slower', 'faster'];

/* ------------------------------------------------------------------ */
/* Step 0 — the open debate (Aristotle only)                           */
/* ------------------------------------------------------------------ */

export const DEBATE_CARD = `CURRENT STEP: debate (open debate, Galileo is NOT in the chat yet)
Allowed speakers: aristotle only.

Goal: let the student argue freely. Aristotle defends "heavier bodies fall faster" with everyday examples and excuses.

${ARGUMENT_LABELS}

step_done is always false in this step.

What to write in "messages":
- For "concede" and "help": write "messages": []. The lesson code adds the reply.
- For "same_time", "experiment", "air", "vacuum", "book", "formula", "pisa": exactly 1 Aristotle message, 1 to 3 short sentences, following the idea below for that label, ending with the CLOSING SENTENCE given below.
${ARISTOTLE_IDEAS}
- For "thought_experiment": write "messages": [] (the lesson code adds Aristotle's lines). ${LEAN_RULE}
- For "thought_partial": exactly 1 Aristotle message, short. He takes up what the student said and asks only which things they mean. He adds nothing the student has not said, and does not ask for more detail than that.
- For "other": exactly 1 Aristotle message. He answers the student's point directly (if it is a question, he answers it honestly) with one everyday example or one excuse, ending with the CLOSING SENTENCE given below.`;

/** Aristotle's lines when the AI is unavailable in the debate step. */
export const DEBATE_FALLBACKS = [
  'Look around you, my friend. An apple drops quickly, but a leaf drifts down slowly. Is the apple not heavier?',
  'Drop a hammer and a sheet of paper together. Which reaches the floor first? Your own hands will tell you.',
  'A raindrop falls fast, a snowflake floats down. The heavier one hurries home. You say otherwise? Prove it.',
  'You talk about the air, but the air is part of nature. In the real world, heavy things win. Why should I believe otherwise?',
  'An iron ball and a wooden ball of the same size: the iron one lands first. If it wins by a little, it still wins. What do you say?',
];

/* ------------------------------------------------------------------ */
/* Galileo's entrance                                                  */
/* ------------------------------------------------------------------ */

/** Galileo's first message, chosen by why he joined. */
export const ENTRANCE = {
  concede:
    "Wait, don't give up yet! I'm Galileo, and I'm on your side. Aristotle argues well, but I think we can beat him with his own rule.",
  help:
    "Hard to win with examples, isn't it? Every time you find one, Aristotle finds an excuse. I'm Galileo, and I'm on your side. Let's try a different weapon: pure reasoning.",
  repeat:
    "You have pushed that point again and again, and Aristotle always finds an excuse. I'm Galileo, and I'm on your side. Examples will not move him. Let's use a weapon he cannot dodge: his own rule.",
  asked:
    "You called? I'm Galileo, and I'm on your side. Examples alone won't beat Aristotle. Let's beat him with pure reasoning instead.",
};


/** Aristotle's line when the student presses the help button before Galileo joins. */
export const ARISTOTLE_ON_HELP = 'Calling for help already? Very well, bring anyone you like. The stones will still obey me.';


/* ------------------------------------------------------------------ */
/* Steps of the method (premise ... done)                              */
/* ------------------------------------------------------------------ */
//
// Galileo is a helper, not a host. In the debate group he comes ONLY when the
// student asks for help (@Galileo or student_move "help"), sides with
// Aristotle ("concede"), or clearly states a wrong idea ("wrong").
// - Any other answer that does not pass (arguing, half answers, off topic):
//   Aristotle reacts and asks his question again, with no hint. There is no
//   automatic reveal while Galileo is away.
// - Once Galileo has come, he helps until the step is passed, then says one
//   line and leaves. After 3 failed tries with him, he explains and moves on.
// - Aristotle asks every next question, including the final reflection.
//
// The cards below are shared with the guided group, so they describe the
// answers only; who speaks is added by debate.js / guided.js. The notes after
// each label are for the helper (Galileo).

/**
 * @typedef {{speaker: 'aristotle' | 'galileo', text: string, image?: string}} ScriptMessage
 * @typedef {{
 *   card: string,
 *   onPass: {galileo: string, aristotle: string},
 *   leave: string,
 *   press: string,
 *   hints: [string, string, string],
 *   reveal: string,
 *   opener: ScriptMessage[],
 * }} Step
 */

/** @type {Record<string, Step>} */
export const STEPS = {
  premise: {
    opener: [
      {
        speaker: 'galileo',
        text: "Here is a strange first move: let's agree that Aristotle's rule is TRUE, just for now. In one short sentence, what exactly is his rule about weight and falling?",
      },
    ],
    card: `CURRENT STEP: premise
The student says Aristotle's rule as a clear rule we can test.

Goal: heavier bodies fall faster (best: speed grows with weight, twice as heavy falls twice as fast).
The student has been asked to say the rule in one sentence, and to treat it as true for now.

PASS (step_done = true) if the student says, in any words, that by Aristotle's rule heavier things fall faster, or that falling speed depends on weight.
NOT YET (step_done = false). Choose one student_move label:
- "wrong": the student states Aristotle's rule wrongly (for example "by his rule lighter things fall faster"). Note: look back at what Aristotle said.
- "argue": the student argues that the rule is wrong, or gives their own view ("all things fall together"), without stating the rule. Note: we will test it, but first we must say exactly what the rule claims.
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: 'say the rule is now clear, and that pretending it is true is the first move of a thought experiment',
      aristotle: 'proudly agrees: twice as heavy, twice as fast',
    },
    leave: "Clear. Now let's see if his rule survives a test. I'll step back.",
    press: 'You want to fight my rule before you can even say it? Say it first, young one. In one sentence, what does my rule say about weight and falling?',
    hints: [
      'Look back at what Aristotle said. In one short sentence, what is his rule about weight and speed?',
      "Fill the gap: 'According to Aristotle, the ___ a body is, the ___ it falls.'",
      'His rule is: the heavier a body, the faster it falls. Can you say it in your own words, so we all agree on it?',
    ],
    reveal: "Aristotle's rule is: the heavier a body, the faster it falls. For now, we will pretend this is true.",
  },

  tie: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'My rule stands, young one. Read any book you like, it changes nothing: a heavier body falls faster. Break my rule with reasoning alone, if you can.',
      },
    ],
    card: `CURRENT STEP: tie (debate group only: the student must come up with the thought experiment)
Aristotle's rule has been stated and taken as true for now. Aristotle holds his position and has challenged the student to break the rule by reasoning alone. He does NOT suggest any idea himself. The student may read the textbook.

Goal: the student comes up with the idea of putting a heavy and a light body together (tied, glued, connected, in one bag, or any design with the same idea). The meaning is what counts, not exact words.

PASS (step_done = true, student_move = "thought_experiment") if the student's meaning is to put a heavy and a light body together, in any words, even roughly or as a question; how they are joined and what the rule predicts do NOT need to be said. Read the student's recent messages together. The idea may come from the textbook.
NOT YET (step_done = false):
${ARGUMENT_LABELS}

Notes for Galileo when he helps: Aristotle talks about one heavy and one light stone; what could you do with them in your mind? If the student has part of the idea, ask only which things they would put together.

When the step passes: ${LEAN_RULE}`,
    onPass: {
      galileo: 'praise the idea of joining the stones as the start of a thought experiment',
      aristotle: 'is surprised but confident ("Tie them together? A strange idea, but my rule fears nothing.")',
    },
    leave: "That is the idea. I'll step back; make him follow it.",
    press: 'Books and drops from towers do not move me, my friend. Every day the heavy body wins. Break my rule with reasoning alone, if you can.',
    hints: [
      'Aristotle talks about a heavy stone and a light stone. What could you do with the two stones, only in your mind, to test his rule?',
      'What if you joined the two stones together, for example with a short rope? Ask Aristotle what his rule says then.',
      "Try this: tell Aristotle you tie the heavy stone and the light stone together with a short rope, and ask how fast the pair falls by his rule.",
    ],
    reveal: "Here is the idea: tie a heavy stone and a light stone together with a short rope, and use Aristotle's own rule on the pair.",
  },

  slower: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'Very well, let us tie my heavy stone and a light stone together. By my rule, the heavy stone falls at speed 8 and the light stone at speed 4.',
        image: 'stones',
      },
      {
        speaker: 'aristotle',
        text: 'The short rope is tight between them. You tell me, young one: does the light stone speed up the heavy one, or hold it back?',
        image: 'tied',
      },
    ],
    card: `CURRENT STEP: slower (first line of reasoning)
Setup the student can see: heavy stone falls at speed 8, light stone at speed 4 (by Aristotle's rule). They are tied together with a short rope and dropped. The student has just been asked whether the light stone speeds up the heavy one or holds it back.

Goal: the student concludes that the tied pair falls SLOWER than 8 (somewhere between 4 and 8), because the slow light stone holds back (drags, brakes) the heavy stone, and the heavy stone pulls the light one along.

PASS (step_done = true) if the student says any of: the pair is slower than 8; between 4 and 8; about 6 or "the average"; the light stone slows, drags, pulls back or holds back the heavy stone.
NOT YET (step_done = false). Choose one student_move label:
- "wrong": "same speed" or "8" (note: which stone wants to go faster, and what happens to the rope between them?); "4" (note: would the heavy stone be slowed all the way down, or would it also pull the light one along?); "the light stone speeds the heavy one up".
- "partial": "faster, because together they are heavier" or "12". Note: a very good idea to keep for later, but first think only about the light stone pulling on the heavy stone.
- "argue": argues with Aristotle or talks about something else in the lesson without answering.
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: 'name what was good in the reasoning and ask the student to remember "slower than 8"',
      aristotle: 'agrees happily, because this is his own logic (the slow one holds back the fast one), and feels his rule is safe',
    },
    leave: "Remember that answer. I'll step back again; keep pushing him.",
    press: 'Words, my friend, but not an answer. The heavy stone and the light stone are tied together. Does the light one speed the heavy one up, or hold it back?',
    hints: [
      'The heavy stone wants to go at 8. The light stone only wants 4. If a fast runner is tied to a slow runner, what happens to the fast runner?',
      'The rope gets tight, and the slow stone pulls back on the fast one. So is the pair faster or slower than 8?',
      'The light stone acts like a brake, so the pair falls slower than 8, somewhere between 4 and 8. Do you agree?',
    ],
    reveal: 'The light stone acts like a brake on the heavy one, so the tied pair falls slower than 8, somewhere between 4 and 8.',
  },

  faster: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'Anything else, young one? Look at the tied pair as one body, if you like. Is it heavier or lighter than my heavy stone alone, and what does my rule say about that?',
      },
    ],
    card: `CURRENT STEP: faster (second line of reasoning)
The student already concluded: the tied pair is slower than 8. The student has just been invited to look at the pair as one body.

Goal: the student concludes that the tied pair, as one body, is HEAVIER than the heavy stone alone, so by Aristotle's own rule it must fall FASTER than 8 (for example 12).

PASS (step_done = true) only if the student says the pair falls faster than 8 (or "12", or "faster because it is heavier").
NOT YET (step_done = false). Choose one student_move label:
- "wrong": the pair is "lighter" than the heavy stone, or "it falls slower because it is heavier". Note: imagine putting both stones on a scale together.
- "partial": only "heavier" without speed (note: good, now what does Aristotle's rule say about a heavier body's speed?); or repeats "slower than 8" (note: that was one way of looking; now look at the pair as one heavy body and use Aristotle's rule).
- "argue": argues with Aristotle or talks about something else in the lesson without answering.
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: "praise the student for using Aristotle's own rule against him",
      aristotle: 'agrees at first ("Naturally, a heavier body falls faster.") and then starts to feel uneasy ("...wait.")',
    },
    leave: 'You turned his own rule on him. Keep going; I am watching.',
    press: 'Think again with my own rule. The tied pair, taken as one body: is it heavier or lighter than my heavy stone, and so how fast must it fall?',
    hints: [
      'Put both stones on a scale together. Do they weigh more or less than the heavy stone alone?',
      "The pair is heavier than the heavy stone. Now use Aristotle's own rule: a heavier body falls ___?",
      "By Aristotle's rule, the heavier pair must fall faster than 8, maybe 12. Do you see it?",
    ],
    reveal: "Together the stones weigh more than the heavy stone alone, so by Aristotle's own rule the pair must fall faster than 8.",
  },

  contradiction: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'Wait. You said this pair falls slower than 8, and now faster than 8, both from my own rule. What are you trying to show me?',
        image: 'contradiction',
      },
    ],
    card: `CURRENT STEP: contradiction
The student has derived from Aristotle's rule both: the tied pair is slower than 8, AND the tied pair is faster than 8. The student has just been asked what these two answers show.

Goal: the student says these two answers cannot both be true (a contradiction), so the starting rule must be wrong.

PASS (step_done = true) if the student says the two answers contradict, cannot both be true, are impossible together, or "the rule is wrong / Aristotle's rule fails".
NOT YET (step_done = false). Choose one student_move label:
- "concede": the student sides with Aristotle: both answers can be true, there is no problem, or the rule is still fine. Note: can one pair fall slower and faster than 8 at the same time?
- "partial": picks one answer ("it is slower"; note: was the other answer also reasoned from the same rule?); or "maybe it is exactly 8" (note: clever, but does 8 fit Aristotle's rule for a body heavier than the heavy stone?).
- "argue": argues with Aristotle or talks about something else in the lesson without answering.
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: 'praise the student for finding the contradiction, the heart of a thought experiment',
      aristotle: 'is shaken ("Both from my own rule? This troubles me.")',
    },
    leave: "That is the heart of it. I'll step back; finish it yourself.",
    press: 'You gave me two answers for the same pair: slower than 8, and faster than 8. Tell me plainly: what do these two answers show?',
    hints: [
      'Can one pair of stones fall slower than 8 and faster than 8 at the same time?',
      'Both answers came from the same rule. If a rule gives two answers that fight each other, what does that tell you about the rule?',
      'The pair cannot be both slower and faster than 8. That is a contradiction, so the rule we started with must be wrong. Do you agree?',
    ],
    reveal: 'One pair cannot be both slower and faster than 8. That is a contradiction, so the rule we started with must be wrong.',
  },

  objection: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'Ha! I have an answer. Two stones on a rope are not ONE body. They are two bodies. So my rule is safe! Can you answer that?',
      },
    ],
    card: `CURRENT STEP: objection (a possible escape for the rule)
The objection just raised: two stones tied by a rope are two bodies, not one body, so the rule is safe.

Goal: the student closes this loophole. Good answers include: glue them, melt them, or tie them very tightly into one body; any single stone could be seen as two halves joined together; the rope does not change the weight; a body does not know if it is "one" or "two".

PASS (step_done = true) if the student gives any reason why the "two bodies" excuse fails, or turns the pair into one body (glue, weld, melt, tight rope, one stone made of two halves).
NOT YET (step_done = false). Choose one student_move label:
- "concede": the student accepts the objection (they are two bodies, so the rule is safe). Note: what would happen if we glued the stones so they became one stone?
- "partial": only "no" or "you are wrong" with no reason. Note: ask for a reason.
- "argue": argues with Aristotle about something else without answering the objection.
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: "praise the student's answer to the escape",
      aristotle: 'has no reply left and admits, graciously, that the escape is closed',
    },
    leave: 'He is out of escapes. Finish it yourself!',
    press: 'You have not answered me. Two stones on a rope are two bodies, not one, so my rule is safe. Why should that not save me?',
    hints: [
      'What if we glue the two stones together, so they really become one stone?',
      'Think about any ordinary stone. Could you see it as two halves stuck together? Would it suddenly fall at a different speed?',
      'A rope or glue does not change the stones. If we glue them, they are one body, and the same contradiction comes back. So the excuse fails. Do you agree?',
    ],
    reveal: 'If we glue the stones, they become one body and the same contradiction comes back. A body does not fall differently because we call it one or two.',
  },

  conclusion: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'Then my rule leads to nonsense. So what IS true, clever one? How fast does the tied pair fall, if there is to be no contradiction at all?',
      },
    ],
    card: `CURRENT STEP: conclusion
The rule "heavier falls faster" has been destroyed by a contradiction. The student has just been asked what is true instead.

Goal: the student states the new rule: weight does not decide how fast a body falls. Heavy and light bodies fall at the same rate (if air does not get in the way). Then the tied pair also falls at that same speed, and there is no contradiction.

PASS (step_done = true) if the student says all bodies fall at the same speed / same rate / together, or that falling speed does not depend on weight, or that the pair falls at the same speed as each stone.
NOT YET (step_done = false). Choose one student_move label:
- "wrong": "8" or "between 4 and 8" (note: which starting speeds for the two stones would make tying them change nothing at all?); "the light one falls faster" (note: would that also give a contradiction if we tie them?).
- "concede": the student says heavier bodies fall faster after all. Note: remember the contradiction we just found.
- "partial": talks only about air. Note: good, we will come back to air, but first: without air, what must be true about heavy and light stones?
- "argue": argues with Aristotle or talks about something else in the lesson without answering.
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: 'praise warmly and repeat the new rule in one sentence (without air, heavy and light bodies fall together)',
      aristotle: 'accepts it, thoughtfully, but still wonders about his feather',
    },
    leave: "Well said. I'll step back now.",
    press: 'Then tell me what IS true, clever one. How fast must the tied pair fall, if there is to be no contradiction at all?',
    hints: [
      'If tying the stones together changes nothing, then the pair falls at the same speed as each stone. What does that say about the heavy stone and the light stone?',
      'There is only one way the pair is neither slower nor faster than the heavy stone: both stones already fall at the same speed. So does weight decide falling speed?',
      'Without air in the way, heavy and light bodies fall at the same rate. Weight does not decide falling speed. Can you say this in your own words?',
    ],
    reveal: 'Without air in the way, heavy and light bodies fall at the same rate. Weight does not decide how fast a body falls.',
  },

  method: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'And my feather? Now I see it: the air pushes hard on a light, wide feather. Take the air away, and a feather and a coin would fall side by side. So the air fooled me all these years.',
        image: 'tube',
      },
      {
        speaker: 'aristotle',
        text: 'Young one, you have beaten me fairly, and with my own rule. I am not angry. I am impressed.',
      },
      {
        speaker: 'aristotle',
        text: 'You used no lab and no tools, only your mind. Call it a thought experiment. Teach me your trick: in your own words, what steps did you follow to beat me?',
      },
    ],
    card: `CURRENT STEP: method (reflection)
Goal: the student describes the method of the thought experiment in their own words. The five key ideas are:
(a) assume the opponent's rule is true;
(b) imagine a simple, ideal situation (two stones tied together);
(c) reason in two different ways and get two results;
(d) find that the results contradict each other;
(e) conclude that the starting rule must be false (and find the rule that has no contradiction).

PASS (step_done = true) if the student has mentioned at least 3 of the 5 ideas, in any words or order, counting ALL of the student's messages in this step together (not only the last one). Very short words count (for example "assume, imagine, contradiction" is 3 ideas).
NOT YET (step_done = false). Choose one student_move label:
- "wrong": the student describes the method wrongly (for example "we did a real experiment" or "we measured the stones"). Note: we used no tools; what did we do with the rule in our minds?
- "partial": 1 or 2 of the ideas. Note: name what the student already got right, then ask about ONE missing idea using the hint (usually (a) or (d)).
- "help": asks for help, or says they are stuck or do not know. Note: use the hint.
- "off_topic".
If it passes, student_move is "pass".`,
    onPass: {
      galileo: 'praise the summary in one or two sentences',
      aristotle: 'thanks the student for the lesson in one gracious line; he has lost, so no new objections or doubts',
    },
    leave: "Well said. I'll step back now.",
    press: 'Go on, young one. How did you beat me? Tell me the steps of your trick, one by one.',
    hints: [
      "Start at the very beginning. What did we do with Aristotle's rule before we tested it?",
      'Look at the notebook beside the chat. After you imagined the tied stones, what did you find when you reasoned in two ways?',
      'You assumed his rule was true, imagined tied stones, reasoned two ways, found a contradiction, and so rejected the rule. Can you say these steps in your own short words?',
    ],
    reveal: 'You assumed his rule was true, imagined a simple case, reasoned two ways, found a contradiction, and so rejected the rule.',
  },

  done: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'So this is your trick: take the rule as true, just for now, imagine a simple case, reason it two ways, find the contradiction, and reject the rule. It works on any claim, even mine.',
        image: 'method',
      },
      {
        speaker: 'aristotle',
        text: 'A good debate. Come back and argue with me again some day. You may ask me anything now.',
      },
    ],
    card: `CURRENT STEP: done (the debate is won; free questions)
The student has won. Answer any short follow-up question about falling bodies or thought experiments.
Aristotle answers. He now accepts the new rule and answers simply and correctly, with everyday reasoning (air pushes hard on light, wide things; without air, heavy and light bodies fall together). He may joke kindly about losing. He does not know modern tools or numbers; for those he says the student can ask Galileo by writing "@Galileo". If the student wants another challenge, he suggests trying the same method on another claim, for example "a heavier ball rolls down a slope faster".
When the student writes "@Galileo", Galileo answers instead (simply and correctly, also about modern experiments), and Aristotle may add one short line.

student_move labels: "question", "chat", "off_topic".
step_done is always false.`,
    onPass: { galileo: '', aristotle: '' },
    leave: '',
    press: 'Forgive me, I lost my thread. Could you ask that again?',
    hints: [
      'Ask us anything about falling bodies or thought experiments.',
      'Ask us anything about falling bodies or thought experiments.',
      'Ask us anything about falling bodies or thought experiments.',
    ],
    reveal: 'Ask us anything about falling bodies or thought experiments.',
  },
};

/** Galileo's first words when he comes mid-lesson to help (script fallback). */
export const RETURN_LINE = "Galileo here, on your side. Let me help a little.";
