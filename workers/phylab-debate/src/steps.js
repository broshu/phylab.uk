/**
 * The lesson script. Each step is a "card" the model receives on every turn,
 * so the model only has to judge one small thing and write one or two short
 * chat lines. Everything that must always be the same (openers, Galileo's
 * entrance, reveals, the ending) is preset text added by the Worker.
 *
 * Edit wording here; keep the step ids unchanged — the lab page uses them.
 */

export const PROMPT_VERSION = 'debate-aristotle-v3';

/** Steps after Galileo first joins, in order. */
export const STEP_ORDER = [
  'premise',
  'slower',
  'faster',
  'contradiction',
  'objection',
  'conclusion',
  'method',
  'done',
];

export const ALL_STEPS = ['debate', ...STEP_ORDER];

/* ------------------------------------------------------------------ */
/* Step 0 — the open debate (Aristotle only)                           */
/* ------------------------------------------------------------------ */

export const DEBATE_CARD = `CURRENT STEP: debate (open debate, Galileo is NOT in the chat yet)
Allowed speakers: aristotle only. Write exactly 1 message.

Goal: let the student argue freely. Aristotle defends "heavier bodies fall faster" with everyday examples.
Aristotle answers the student's point directly, gives one everyday example or one excuse, and ends with one short challenge question to the student.

Classify the student's message as student_move:
- "argue": the student gives any claim or reason against Aristotle (an experiment, "they land together", air resistance, a textbook, a story about a tower, a formula).
- "concede": the student agrees that heavier things fall faster, gives up, or says things like "you are right", "I lose", "ok fine".
- "stuck": the student says "I don't know", asks for help, sends a very short or empty reply ("hmm", "?", "no", "idk"), or repeats an earlier point with no new reason.
- "thought_experiment": the student reasons only from Aristotle's own rule by imagining bodies joined or split — for example tying a light and a heavy stone together, cutting a stone in half, or gluing two bodies.
- "off_topic": nothing to do with falling bodies.

step_done is always false in this step.

How Aristotle answers common points (use the idea, in your own words, do not copy):
- "They hit the ground at the same time": from such a short height your eyes cannot see the gap. Try a stone and a feather.
- Air resistance: so you agree the feather is slower! Air is part of nature. You talk about a world without air that nobody has ever seen.
- Two balls of the same size, different weight: the iron ball still wins. If it wins by a little, it still wins.
- A textbook, a teacher, or "g is the same for all": a book is not a reason. Show me with reasoning.
- A story about a tower or about Galileo: I do not know this man. A story is not a proof.
- A very heavy and a very light thing landing close together: your hands did not let go at the same moment.
- If student_move is "concede": Aristotle is pleased and kind, and says the matter is settled.
- If student_move is "thought_experiment": Aristotle is surprised and curious ("Tie them together? A strange question...") but does not answer it yet.
- If student_move is "stuck": Aristotle gently offers one more everyday example and asks what the student thinks.`;

/** Aristotle's lines when the AI is unavailable in the debate step. */
export const DEBATE_FALLBACKS = [
  'Look around you, my friend. An apple drops quickly, but a leaf drifts down slowly. Is the apple not heavier?',
  'Drop a hammer and a sheet of paper together. Which reaches the floor first? Your own hands will tell you.',
  'A raindrop falls fast, a snowflake floats down. The heavier one hurries home. Can you name one heavy thing that falls slowly?',
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
  stuck:
    "Hard to win with examples, isn't it? Every time you find one, Aristotle finds an excuse. I'm Galileo, and I'm on your side. Let's try a different weapon: pure reasoning.",
  stalemate:
    "You made strong points! But notice: whatever you show him, Aristotle can blame the air or your eyes. I'm Galileo, and I'm on your side. Let's use a weapon he cannot dodge: his own rule.",
  asked:
    "You called? I'm Galileo, and I'm on your side. Examples alone won't beat Aristotle. Let's beat him with pure reasoning instead.",
  spark:
    "Joining stones together? That is exactly my idea! I'm Galileo, and I'm on your side. Let's build it carefully, one step at a time.",
};

/** Aristotle's line when the student presses the help button before Galileo joins. */
export const ARISTOTLE_ON_HELP = 'Calling for help already? Very well, bring anyone you like. The stones will still obey me.';


/* ------------------------------------------------------------------ */
/* Steps after Galileo first joins                                     */
/* ------------------------------------------------------------------ */
//
// Galileo is a helper, not a host. He stays only while the student needs him:
// - he joins when the student is stuck, gives a wrong answer, or presses @Galileo;
// - as soon as the student passes a step he says one line and leaves;
// - the next question comes from Aristotle, who walks into the trap himself;
// - he comes back for the final reflection (method) and stays to the end.

/**
 * @typedef {{speaker: 'aristotle' | 'galileo', text: string, image?: string}} ScriptMessage
 * @typedef {{
 *   card: string,
 *   onPass: {galileo: string, aristotle: string},
 *   leave: string,
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
NOT YET (step_done = false):
- The student argues that the rule is wrong, without stating it: we will test it, but first we must take the rule seriously and say exactly what it claims.
- The student states the opposite ("all things fall together"): that may be your view, but what is ARISTOTLE's rule?
- Unsure or silent: use the hint.

student_move labels: "pass", "argue", "stuck", "off_topic".`,
    onPass: {
      galileo: 'say the rule is now clear, and that pretending it is true is the first move of a thought experiment',
      aristotle: 'proudly agrees: twice as heavy, twice as fast',
    },
    leave: "Now ask him this: what happens if you tie a heavy stone and a light stone together? I'll step back. You can do this.",
    hints: [
      'Look back at what Aristotle said. In one short sentence, what is his rule about weight and speed?',
      "Fill the gap: 'According to Aristotle, the ___ a body is, the ___ it falls.'",
      'His rule is: the heavier a body, the faster it falls. Can you say it in your own words, so we all agree on it?',
    ],
    reveal: "Aristotle's rule is: the heavier a body, the faster it falls. For now, we will pretend this is true.",
  },

  slower: {
    opener: [
      {
        speaker: 'aristotle',
        text: 'Tie my stones together? A strange idea, but very well. By my rule, the heavy stone falls at speed 8 and the light stone at speed 4.',
        image: 'stones',
      },
      {
        speaker: 'aristotle',
        text: 'Now they are tied with a short rope. You tell me, young one: does the light stone speed up the heavy one, or hold it back?',
        image: 'tied',
      },
    ],
    card: `CURRENT STEP: slower (first line of reasoning)
Setup the student can see: heavy stone falls at speed 8, light stone at speed 4 (by Aristotle's rule). They are tied together with a short rope and dropped. The student has just been asked whether the light stone speeds up the heavy one or holds it back.

Goal: the student concludes that the tied pair falls SLOWER than 8 (somewhere between 4 and 8), because the slow light stone holds back (drags, brakes) the heavy stone, and the heavy stone pulls the light one along.

PASS (step_done = true) if the student says any of: the pair is slower than 8; between 4 and 8; about 6 or "the average"; the light stone slows, drags, pulls back or holds back the heavy stone.
NOT YET (step_done = false):
- "Faster, because together they are heavier" or "12": a very good idea to keep for later, but first think only about the light stone pulling on the heavy stone.
- "Same speed" or "8": which stone wants to go faster, and what happens to the rope between them?
- "4": would the heavy stone really be slowed all the way down to the light one's speed, or would it also pull the light one along?
- Unsure or silent: use the hint.

student_move labels: "pass", "faster_idea", "argue", "stuck", "off_topic".`,
    onPass: {
      galileo: 'name what was good in the reasoning and ask the student to remember "slower than 8"',
      aristotle: 'agrees happily, because this is his own logic (the slow one holds back the fast one), and feels his rule is safe',
    },
    leave: "Remember that answer. I'll step back again; keep pushing him.",
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
NOT YET (step_done = false):
- The student says only "heavier" without speed: good, now what does Aristotle's rule say about a heavier body's speed?
- The student repeats "slower than 8": that was one way of looking; now look at the pair as one heavy body and use Aristotle's rule.
- The student says "lighter": imagine putting both stones on a scale together.
- Unsure or silent: use the hint.

student_move labels: "pass", "heavier_only", "argue", "stuck", "off_topic".`,
    onPass: {
      galileo: "praise the student for using Aristotle's own rule against him",
      aristotle: 'agrees at first ("Naturally, a heavier body falls faster.") and then starts to feel uneasy ("...wait.")',
    },
    leave: 'You turned his own rule on him. Keep going; I am watching.',
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
NOT YET (step_done = false):
- The student picks one answer ("it is slower"): was the other answer also reasoned from the same rule?
- The student says "maybe it is exactly 8": clever, but does 8 fit Aristotle's rule for a body heavier than the heavy stone?
- Unsure or silent: use the hint.

student_move labels: "pass", "picks_one", "argue", "stuck", "off_topic".`,
    onPass: {
      galileo: 'praise the student for finding the contradiction, the heart of a thought experiment',
      aristotle: 'is shaken ("Both from my own rule? This troubles me.")',
    },
    leave: 'That is the heart of it. Watch out, he will try to escape. I will let you answer him.',
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
NOT YET (step_done = false):
- The student accepts the objection: what would happen if we glued the stones so they became one stone?
- The student only says "no" with no reason: ask for a reason.
- Unsure or silent: use the hint.

student_move labels: "pass", "agrees_aristotle", "argue", "stuck", "off_topic".`,
    onPass: {
      galileo: "praise the student's answer to the escape",
      aristotle: 'has no reply left and admits, graciously, that the escape is closed',
    },
    leave: 'He is out of escapes. Finish it yourself!',
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
NOT YET (step_done = false):
- The student says "8" or "between 4 and 8": which starting speeds for the two stones would make tying them change nothing at all?
- The student says "the light one falls faster": would that also give a contradiction if we tie them?
- The student talks about air: good, we will come back to air, but first: without air, what must be true about heavy and light stones?
- Unsure or silent: use the hint.

student_move labels: "pass", "partial", "argue", "stuck", "off_topic".`,
    onPass: {
      galileo: 'praise warmly and repeat the new rule in one sentence (without air, heavy and light bodies fall together)',
      aristotle: 'accepts it, thoughtfully, but still wonders about his feather',
    },
    leave: '',
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
        speaker: 'galileo',
        text: "Bravo! I watched the whole thing. And Aristotle's feather? Air pushes hard on a light, wide feather. Pump the air out of a glass tube, and a feather and a coin fall side by side.",
        image: 'tube',
      },
      {
        speaker: 'aristotle',
        text: 'So the air fooled me all these years. Young one, you have beaten me fairly, and with my own rule. I am not angry. I am impressed.',
      },
      {
        speaker: 'galileo',
        text: 'You won with no lab and no tools, only your mind. That is called a thought experiment. In your own words: what steps did you follow to win?',
      },
    ],
    card: `CURRENT STEP: method (reflection)
Goal: the student describes the method of the thought experiment in their own words. The five key ideas are:
(a) assume the opponent's rule is true;
(b) imagine a simple, ideal situation (two stones tied together);
(c) reason in two different ways and get two results;
(d) find that the results contradict each other;
(e) conclude that the starting rule must be false (and find the rule that has no contradiction).

PASS (step_done = true) if the student mentions at least 3 of the 5 ideas, in any words or order. Very short words count (for example "assume, imagine, contradiction" is 3 ideas).
NOT YET (step_done = false): name what the student already got right, then ask about ONE missing idea using the hint. If they have 2 ideas, ask about the most important missing one (usually (a) or (d)).

student_move labels: "pass", "partial", "stuck", "off_topic".`,
    onPass: {
      galileo: 'praise the summary in one or two sentences',
      aristotle: 'adds one gracious line accepting defeat; he has lost, so no new objections or doubts',
    },
    leave: '',
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
        speaker: 'galileo',
        text: "Here is your method, the same one I used: take the rule as true, just for now, imagine a simple case, reason it two ways, find the contradiction, close the loopholes, and reject the rule. You can use it on any claim.",
        image: 'method',
      },
      {
        speaker: 'aristotle',
        text: 'A good debate. Come back and argue with me again some day. You may ask us anything now.',
      },
    ],
    card: `CURRENT STEP: done (the debate is won; free questions)
The student has won. Answer any short follow-up question about falling bodies or thought experiments in 1 or 2 short messages. Galileo answers physics questions simply and correctly (air resistance, why a feather is slow, falling in a tube with no air). Aristotle may joke kindly about losing. If the student wants another challenge, Galileo suggests trying the same method on another claim, for example "a heavier ball rolls down a slope faster".

student_move labels: "question", "chat", "off_topic".
step_done is always false.
Allowed speakers: galileo, aristotle.`,
    onPass: { galileo: '', aristotle: '' },
    leave: '',
    hints: [
      'Ask us anything about falling bodies or thought experiments.',
      'Ask us anything about falling bodies or thought experiments.',
      'Ask us anything about falling bodies or thought experiments.',
    ],
    reveal: 'Ask us anything about falling bodies or thought experiments.',
  },
};

/** Galileo's first words when he comes back mid-lesson to help. */
export const RETURN_LINE = "I'm back. Let me help a little.";
