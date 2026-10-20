/**
 * Aristotle's preset replies (debate group), from the table "亚里士多德的预设回应"
 * in the Debate Aristotle logic doc. They are used in the open debate and in
 * the "tie" step while Galileo is away: the model only labels the student's
 * argument, and the lesson code picks the fixed reply, so every student who
 * makes the same kind of argument hears the same answer.
 *
 * Edit the wording here. Keep the keys: they are the student_move labels and
 * they are saved with every turn for analysis.
 */

/**
 * Argument labels that get a fixed Aristotle reply. Each label has several
 * wordings with the same meaning; a student who repeats the same argument
 * hears the next one, so Aristotle never says the same line twice in a row.
 * The first wording is the one in the logic doc's table.
 */
export const ARGUMENT_REPLIES = {
  same_time: [
    { text: 'No, the heavy one lands first. Watch!', image: 'falling' },
    { text: 'Look again, young one. The heavy body touches the ground first, every time.' },
    { text: 'The same time? Only to careless eyes. The heavier body always lands first.' },
  ],
  experiment: [
    { text: 'Your experiment is not precise enough. There is a small difference, and the heavy body still wins.' },
    { text: 'Did you measure it closely? There is always a small gap, and the heavy body is ahead.' },
    { text: 'Hands and eyes are not perfect, my friend. A tiny difference is still a difference, and it favours the heavy body.' },
  ],
  air: [
    { text: 'Even with no air at all, the heavier body would still fall faster.' },
    { text: 'Take the air away if you like. The heavy body still has the stronger desire to fall, so it still falls faster.' },
    { text: 'Air is not the reason. Without it, the heavier body would still win the race.' },
  ],
  vacuum: [
    { text: 'A place with no air? I have never seen one, and neither have you. In the real world, the heavy body wins.' },
    { text: 'You speak again of a place without air. Neither of us has stood in one. Here, where we live, the heavy body falls first.' },
    { text: 'Far-away places with no air are only stories to me. On this Earth, which we can both see, the heavier body wins.' },
  ],
  book: [
    { text: 'Whoever wrote that never watched an apple and a leaf fall together. Every day my own eyes see the heavy body win.' },
    { text: 'A book can say anything, my friend. The stones in my garden say otherwise.' },
    { text: 'Your teacher has read books; I have watched things fall. The heavy body wins.' },
  ],
  formula: [
    { text: 'Letters on paper, and the laws of this Newton, do not make a stone fall. Show me one heavy body that loses.' },
    { text: 'Symbols again! Symbols do not fall; stones do, and the heavy stone falls faster.' },
    { text: 'Your Newton and his letters cannot change what my eyes see: the heavier body is quicker.' },
  ],
};

/** The Pisa easter egg: Galileo steps in once, then Aristotle answers. */
export const PISA = {
  galileo: {
    text: 'I once dropped a heavy iron ball and a light one from the Leaning Tower of Pisa, and they landed almost together.',
    image: 'pisa',
  },
  aristotle: 'Almost! There was a small difference, and you did not look closely.',
};

/** Aristotle's line before Galileo joins, when the student gives in or asks for help. */
export const BEFORE_GALILEO = {
  concede: 'Good, you see it at last. The matter is settled.',
  help: 'Call for help if you like. The stones will still obey me.',
};

/**
 * Open debate: each preset reply ends with one of these, in turn. Aristotle
 * demands a proof; that is the only nudge towards reasoning he ever gives.
 */
export const DEBATE_TAILS = [
  'If you think otherwise, prove it.',
  'Prove me wrong, then.',
  'Words are easy, young one. Show me a proof.',
  'Can you prove that I am wrong?',
];

/** "tie" step: each preset reply ends with this challenge. */
export const TIE_TAIL = 'Break my rule with reasoning alone, if you can.';

/** How many times one kind of argument may come back before Galileo steps in. */
export const REPEAT_LIMIT = 6;

/**
 * What Aristotle says to each kind of argument (the logic doc's table). The
 * model writes his reply in its own words around this idea, reacting to what
 * the student actually wrote; the fixed wordings above are the fallback.
 */
export const ARISTOTLE_IDEAS = `Aristotle's answer to each kind of argument (keep this idea, in your own words, reacting to the student's exact words; never repeat a sentence already in the chat, and change your wording when the student repeats an argument):
- "same_time": no, the heavy one lands first; he offers to show them (a picture is added by the lesson code the first time).
- "experiment": the experiment was not precise enough; there is a small difference, and the heavy body still wins.
- "air": even with no air at all, the heavier body would still fall faster.
- "vacuum": he has never seen a place with no air, and neither has the student; in the real world the heavy body wins.
- "book": a book or a teacher is not a reason; his own eyes see the heavy body win every day.
- "formula": letters on paper, or the laws of this Newton, do not make a stone fall; let the student show him one heavy body that loses.
- "pisa" (only if the chat already shows Galileo's tower story): treat it as "experiment".
He never says or suggests how to beat his rule, and never puts his own claim in the student's mouth.`;

/** Every label that the code answers without the model's own words. */
export const PRESET_MOVES = new Set([...Object.keys(ARGUMENT_REPLIES), 'pisa', 'concede', 'help']);

/** The labels the model chooses from in the open debate and the "tie" step. */
export const ARGUMENT_LABELS = `Classify the student's message as student_move (choose the FIRST that fits):
- "help": asks for help or a hint, or says they are stuck or do not know what to say.
- "concede": agrees that heavier things fall faster, or gives up ("you are right", "I lose", "you win").
- "thought_experiment": the student's MEANING is to put a heavy body and a light body together (connect, link, tie, glue, put in one bag, make one thing, in any words, even as a question, even in poor English) and see what happens. Judge the meaning, not the precision: the student does NOT need to say how they are joined or what Aristotle's rule predicts. Read the student's recent messages together: if an earlier message named the heavy and light bodies and this one says they are joined (or the reverse), that is enough. Examples that count: "if a heavy thing connect a light, what will happen?", "they are connected, it's a heavier thing", "put the two stones together".
- "thought_partial": the student talks about joining or combining, but there is still no sign at all of which bodies (for example only "what if we put things together?" with nothing before it about a heavy and a light body). Use it rarely; when in doubt, choose "thought_experiment".
- "pisa": mentions Galileo's experiment at the Leaning Tower of Pisa (or Galileo dropping balls from a tower).
- "same_time": says the bodies hit the ground at the same time, with no experiment of their own.
- "experiment": describes an experiment they did or imagine doing with real bodies (for example an iron ball and a lead ball dropped together).
- "air": says the feather (or a light body) is slower only because of air resistance.
- "vacuum": talks about a vacuum, a tube with no air, or the Moon (a hammer and a feather).
- "book": cites a textbook, a teacher, or "g is the same for all bodies".
- "formula": uses a formula or Newton's laws (h = ½gt², F = ma, mass cancels).
- "other": anything else, including off-topic messages and very short replies.`;
