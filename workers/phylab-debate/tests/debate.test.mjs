import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';
import { advance, buildPayload, guessMove, helpTurn, normalizeInput, parseModelReply } from '../src/debate.js';
import { DEBATE_ONLY_STEPS, STEP_ORDER } from '../src/steps.js';

const ORIGIN = 'https://phylab.uk';
const env = { DEEPSEEK_API_KEY: 'test-key', ALLOWED_ORIGINS: ORIGIN };

const input = (step, extra = {}) =>
  normalizeInput({ type: 'turn', message: 'hello', state: { step, stepTurns: 0, debateTurns: 0, ...extra }, transcript: [] });

const providerReply = (obj, finish = 'stop') => ({
  choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: finish }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});

test('normalizeInput rejects junk and clamps state', () => {
  assert.throws(() => normalizeInput(null));
  assert.throws(() => normalizeInput({ type: 'turn', message: '  ' }));
  const n = normalizeInput({ message: 'x', state: { step: 'hack', stepTurns: -3 }, transcript: [{ speaker: 'system', text: 'hi' }] });
  assert.equal(n.state.step, 'debate');
  assert.equal(n.state.stepTurns, 0);
  assert.equal(n.transcript.length, 0);
});

test('payload carries the shared rules, the step card, presence and the hint', () => {
  const p = buildPayload(input('slower', { galileo: false }), 'deepseek-flash');
  assert.match(p.messages[0].content, /Galileo is NOT here/);
  assert.equal(p.model, 'deepseek-flash');
  assert.deepEqual(p.thinking, { type: 'disabled' });
  assert.match(p.messages[0].content, /Aristotle/);
  assert.match(p.messages[0].content, /CURRENT STEP: slower/);
  assert.match(p.messages[0].content, /fast runner/);
});

test('debate: Aristotle only, and conceding brings Galileo in', () => {
  const parsed = parseModelReply(
    providerReply({ student_move: 'concede', step_done: true, messages: [{ speaker: 'aristotle', text: 'Settled!' }, { speaker: 'galileo', text: 'no' }] }),
    'debate',
  );
  assert.equal(parsed.messages.length, 1);
  assert.equal(parsed.stepDone, false);
  const out = advance(input('debate'), parsed);
  assert.equal(out.joined, 'concede');
  assert.equal(out.state.step, 'premise');
  assert.ok(out.messages.some((m) => m.speaker === 'system'));
  assert.equal(out.messages.at(-1).speaker, 'galileo');
});

test('debate: no turn limit, Aristotle keeps arguing without suggesting the method', () => {
  const parsed = { move: 'vacuum', stepDone: false, messages: [] };
  const out = advance(input('debate', { debateTurns: 12 }), parsed);
  assert.equal(out.state.step, 'debate');
  assert.ok(out.messages.every((m) => m.speaker === 'aristotle'));
  assert.ok(!/take my rule as true/i.test(out.messages.map((m) => m.text).join(' ')));
});

test('debate: a thought experiment from the student goes straight to the tied stones', () => {
  const out = advance(input('debate'), { move: 'thought_experiment', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Tie them?' }] });
  assert.equal(out.state.step, 'counter');
  assert.deepEqual(out.passed, ['premise', 'slower']);
  assert.equal(out.state.galileo, false);
  assert.ok(out.messages.every((m) => m.speaker === 'aristotle'));
});

test('debate: asking for help brings Galileo in; repeating a point does not', () => {
  const help = advance(input('debate'), { move: 'help', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Call for help, then.' }] });
  assert.equal(help.joined, 'help');
  assert.equal(help.state.galileo, true);
  const argue = advance(input('debate'), { move: 'argue', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Again?' }] });
  assert.equal(argue.state.step, 'debate');
  assert.ok(!argue.messages.some((m) => m.speaker === 'galileo'));
});

test('passing a step: Galileo says one line and leaves, Aristotle asks next', () => {
  const out = advance(input('counter', { galileo: true, view: 'faster' }), {
    move: 'pass', stepDone: true,
    messages: [{ speaker: 'galileo', text: 'Yes!' }, { speaker: 'galileo', text: 'Extra.' }, { speaker: 'aristotle', text: 'Of course.' }],
  });
  assert.deepEqual(out.passed, ['counter', 'faster']);
  assert.equal(out.state.step, 'contradiction');
  assert.equal(out.state.galileo, false);
  assert.equal(out.messages.filter((m) => m.speaker === 'galileo').length, 1);
  assert.ok(out.messages.some((m) => m.text === 'Galileo left the chat'));
  assert.equal(out.messages.at(-1).speaker, 'aristotle');
  assert.match(out.messages.at(-1).text, /I say the pair falls faster than 8, and you say it falls slower/);
});

test('passing while Galileo is away keeps him away and drops his lines', () => {
  const out = advance(input('faster', { galileo: false }), {
    move: 'pass', stepDone: true,
    messages: [{ speaker: 'aristotle', text: 'Naturally... wait.' }, { speaker: 'galileo', text: 'Great!' }],
  });
  assert.equal(out.state.galileo, false);
  assert.ok(!out.messages.some((m) => m.speaker === 'galileo' || m.speaker === 'system'));
});

test('a wrong answer, giving in, or asking for help brings Galileo with a hint', () => {
  for (const move of ['wrong', 'concede', 'help']) {
    const out = advance(input('faster', { galileo: false }), {
      move, stepDone: false,
      messages: [{ speaker: 'aristotle', text: 'Hmm?' }, { speaker: 'galileo', text: 'Scale?' }],
    });
    assert.equal(out.state.galileo, true, move);
    assert.equal(out.state.helpTurns, 1, move);
    assert.deepEqual(out.messages.map((m) => m.speaker), ['aristotle', 'system', 'galileo'], move);
    assert.equal(out.joined, move);
  }
  // The model forgot Galileo: the code adds his hint.
  const out = advance(input('faster', { galileo: false }), { move: 'wrong', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Lighter? No.' }] });
  assert.deepEqual(out.messages.map((m) => m.speaker), ['aristotle', 'system', 'galileo']);
});

test('any other answer that does not pass: Aristotle presses, Galileo stays away', () => {
  for (const move of ['argue', 'partial', 'off_topic']) {
    const out = advance(input('faster', { galileo: false }), {
      move, stepDone: false,
      messages: [{ speaker: 'aristotle', text: 'And so?' }, { speaker: 'galileo', text: 'Scale?' }],
    });
    assert.deepEqual(out.messages.map((m) => m.speaker), ['aristotle'], move);
    assert.equal(out.state.galileo, false);
    assert.equal(out.state.stepTurns, 1);
  }
  // Without the AI, Aristotle repeats his question from the script.
  const out = advance(input('faster', { galileo: false }), null);
  assert.deepEqual(out.messages.map((m) => m.speaker), ['aristotle']);
  assert.match(buildPayload(input('faster', { galileo: false }), 'm').messages[0].content, /Galileo comes ONLY/);
});

test('Aristotle leads the final reflection and the ending', () => {
  const out = advance(input('conclusion', { galileo: false }), { move: 'pass', stepDone: true, messages: [{ speaker: 'aristotle', text: 'I see.' }] });
  assert.equal(out.state.step, 'method');
  assert.equal(out.state.galileo, false);
  assert.ok(out.messages.every((m) => m.speaker === 'aristotle'));
  const end = advance(input('method', { galileo: false }), { move: 'pass', stepDone: true, messages: [{ speaker: 'aristotle', text: 'Thank you.' }] });
  assert.equal(end.state.step, 'done');
  assert.equal(end.state.galileo, false);
  assert.ok(end.messages.every((m) => m.speaker === 'aristotle'));
});

test('ending: Aristotle answers questions; Galileo only when asked', () => {
  const reply = providerReply({ student_move: 'question', step_done: false, messages: [{ speaker: 'galileo', text: 'G' }, { speaker: 'aristotle', text: 'A' }] });
  const parsed = parseModelReply(reply, 'done', false);
  assert.deepEqual(parsed.messages.map((m) => m.speaker), ['aristotle']);
  const plain = normalizeInput({ message: 'why is a feather slow?', state: { step: 'done', galileo: false } });
  assert.ok(advance(plain, parsed).messages.every((m) => m.speaker === 'aristotle'));
  const asked = normalizeInput({ message: '@Galileo what is a vacuum pump?', state: { step: 'done', galileo: false } });
  const out = advance(asked, { move: 'question', stepDone: false, messages: [{ speaker: 'galileo', text: 'A pump that removes air.' }] });
  assert.deepEqual(out.messages.map((m) => m.speaker), ['system', 'galileo']);
});

test('after three failed tries with Galileo he reveals and moves on; without him Aristotle keeps asking', () => {
  const fail = { move: 'wrong', stepDone: false, messages: [{ speaker: 'galileo', text: 'Nice try.' }] };
  assert.equal(advance(input('counter', { helpTurns: 1, galileo: true }), fail).state.helpTurns, 2);
  const out = advance(input('counter', { helpTurns: 3, galileo: true }), fail);
  assert.equal(out.state.step, 'contradiction');
  assert.ok(out.messages.some((m) => /put it together/.test(m.text)));
  const argue = { move: 'argue', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Well?' }] };
  const alone = advance(input('faster', { stepTurns: 9, galileo: false }), argue);
  assert.equal(alone.state.step, 'faster');
  assert.deepEqual(alone.messages.map((m) => m.speaker), ['aristotle']);
});

test('help while Galileo is away calls him back without the AI', () => {
  const out = helpTurn(input('objection', { galileo: false }));
  assert.equal(out.state.galileo, true);
  assert.equal(out.messages[0].text, 'Galileo joined the chat');
});

test('the whole lesson can be finished with the help button alone', () => {
  let state = helpTurn(input('debate')).state;
  let guard = 0;
  while (state.step !== 'done' && guard++ < 60) {
    state = helpTurn(normalizeInput({ type: 'help', state, transcript: [] })).state;
  }
  assert.equal(state.step, 'done');
  assert.ok(guard <= (STEP_ORDER.length - 1) * 4);
});

test('"@Galileo" alone is the help button; "@Galileo ..." is a message to him', () => {
  assert.equal(normalizeInput({ message: '@Galileo', state: { step: 'debate' } }).type, 'help');
  const n = normalizeInput({ message: '@Galileo why does a feather fall slowly?', state: { step: 'debate' } });
  assert.equal(n.type, 'turn');
  assert.equal(n.toGalileo, true);
  assert.match(buildPayload(n, 'm').messages[0].content, /called Galileo into the chat/);
});

test('@Galileo during the debate: he joins, answers, and asks for the rule', () => {
  const n = normalizeInput({ message: '@Galileo help me, he always has an excuse', state: { step: 'debate', debateTurns: 2 } });
  const out = advance(n, { move: 'asked', stepDone: false, messages: [{ speaker: 'galileo', text: "I'm Galileo. Use his own rule." }] });
  assert.deepEqual(out.messages.map((m) => m.speaker), ['system', 'galileo', 'galileo']);
  assert.equal(out.state.step, 'premise');
  assert.equal(out.state.galileo, true);
});

test('@Galileo while he is away brings him in to answer', () => {
  const n = normalizeInput({ message: '@Galileo what does he mean by one body?', state: { step: 'faster', galileo: false } });
  assert.match(buildPayload(n, 'm').messages[0].content, /Galileo IS here/);
  const out = advance(n, { move: 'stuck', stepDone: false, messages: [{ speaker: 'galileo', text: 'Think of a scale.' }] });
  assert.deepEqual(out.messages.map((m) => m.speaker), ['system', 'galileo']);
  assert.equal(out.state.galileo, true);
});

test('fallback keyword guess catches giving up', () => {
  assert.equal(guessMove("OK you're right"), 'concede');
  assert.equal(guessMove('idk'), 'help');
  assert.equal(guessMove('我不知道'), 'help');
  assert.equal(guessMove('no'), 'argue');
  assert.equal(guessMove('好吧，但是羽毛呢'), 'argue');
  assert.equal(guessMove('They land together in my experiment'), 'argue');
});

test('Worker rejects unknown origins', async () => {
  const res = await worker.fetch(
    new Request('https://w.dev/debate', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }),
    env,
  );
  assert.equal(res.status, 403);
});

test('Worker retries a Chinese reply and then answers', async () => {
  const replies = [
    providerReply({ student_move: 'argue', step_done: false, messages: [{ speaker: 'aristotle', text: '不对' }] }),
    providerReply({ student_move: 'argue', step_done: false, messages: [{ speaker: 'aristotle', text: 'No, my friend.' }] }),
  ];
  const bodies = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return Response.json(replies.shift());
  };
  try {
    const res = await worker.fetch(
      new Request('https://w.dev/debate', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'turn', message: '重的先落地', state: { step: 'debate' }, transcript: [] }),
      }),
      env,
    );
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.mode, 'ai');
    assert.equal(data.messages[0].text, 'No, my friend.');
    assert.match(bodies[1].messages[0].content, /English only/);
  } finally {
    globalThis.fetch = original;
  }
});

test('Worker falls back to the script when DeepSeek fails', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('down', { status: 503 });
  try {
    const res = await worker.fetch(
      new Request('https://w.dev/debate', {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'turn', message: 'no idea', state: { step: 'premise' }, transcript: [] }),
      }),
      env,
    );
    const data = await res.json();
    assert.equal(data.mode, 'preset');
    assert.equal(data.state.stepTurns, 1);
    assert.equal(data.messages[0].speaker, 'galileo');
  } finally {
    globalThis.fetch = original;
  }
});

/* ---------------- guided (control) group ---------------- */

import { GUIDED_OPENERS } from '../src/guided.js';
import { STEPS } from '../src/steps.js';

const guided = (step, extra = {}) =>
  normalizeInput({ type: 'turn', message: 'hello', state: { condition: 'guided', step, stepTurns: 0, debateTurns: 0, ...extra }, transcript: [] });

test('guided: prompt has no debate opponent and only Galileo may speak', () => {
  const p = buildPayload(guided('slower'), 'm').messages[0].content;
  assert.match(p, /Guided group/);
  assert.doesNotMatch(p, /Debate group/);
  assert.match(p, /Allowed speakers: galileo only/);
  const parsed = parseModelReply(
    { choices: [{ message: { content: JSON.stringify({ student_move: 'pass', step_done: true, messages: [{ speaker: 'aristotle', text: 'No!' }, { speaker: 'galileo', text: 'Yes!' }] }) } }] },
    'slower', false, 'guided',
  );
  assert.deepEqual(parsed.messages.map((m) => m.speaker), ['galileo']);
});

test('guided: two exploration turns, then the method starts', () => {
  const r = { move: 'idea', stepDone: false, messages: [{ speaker: 'galileo', text: 'Interesting.' }] };
  const one = advance(guided('debate'), r);
  assert.equal(one.state.step, 'debate');
  const two = advance(guided('debate', { debateTurns: 1 }), r);
  assert.equal(two.state.step, 'premise');
  assert.equal(two.state.condition, 'guided');
  assert.ok(two.messages.every((m) => m.speaker === 'galileo'));
});

test('guided: passing a step — no joining or leaving, Galileo asks next', () => {
  const out = advance(guided('slower'), { move: 'pass', stepDone: true, messages: [{ speaker: 'galileo', text: 'Yes!' }] });
  assert.equal(out.state.step, 'faster');
  assert.ok(out.messages.every((m) => m.speaker === 'galileo'));
});

test('guided: same reveal rule as the debate group', () => {
  const out = advance(guided('faster', { stepTurns: 3 }), { move: 'stuck', stepDone: false, messages: [{ speaker: 'galileo', text: 'Nice try.' }] });
  assert.equal(out.state.step, 'contradiction');
  assert.ok(out.messages.some((m) => /put it together/.test(m.text)));
});

test('guided: the lesson can be finished with help alone', () => {
  let state = { condition: 'guided', step: 'premise', stepTurns: 0, debateTurns: 2 };
  let guard = 0;
  while (state.step !== 'done' && guard++ < 60) state = helpTurn(normalizeInput({ type: 'help', state, transcript: [] })).state;
  assert.equal(state.step, 'done');
  assert.equal(state.condition, 'guided');
});

test('both groups show the same pictures at the same steps', () => {
  for (const step of Object.keys(STEPS).filter((s) => !DEBATE_ONLY_STEPS.includes(s))) {
    const a = STEPS[step].opener.map((m) => m.image).filter(Boolean);
    const b = GUIDED_OPENERS[step].map((m) => m.image).filter(Boolean);
    assert.deepEqual(b, a, step);
  }
});

test('Worker saves each turn with its chat session', async () => {
  const rows = [];
  const DB = { prepare: () => ({ bind: (...v) => ({ run: async () => rows.push(v) }) }) };
  const waits = [];
  const ctx = { waitUntil: (p) => waits.push(p) };
  const req = new Request('https://w.dev/debate', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'help', session: 'abc12345-test', state: { step: 'faster', galileo: false }, transcript: [] }),
  });
  const res = await worker.fetch(req, { ...env, DB }, ctx);
  assert.equal(res.status, 200);
  await Promise.all(waits);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][1], 'abc12345-test');
  assert.equal(rows[0][10], '@Galileo');
});

test('debate: after the premise Aristotle holds his position and the student must propose the tied stones', () => {
  const out = advance(input('premise', { galileo: false }), { move: 'pass', stepDone: true, messages: [{ speaker: 'aristotle', text: 'Twice as heavy, twice as fast.' }] });
  assert.equal(out.state.step, 'tie');
  assert.ok(!/tie my heavy stone/i.test(out.messages.at(-1).text));
  const argue = advance(input('tie', { galileo: false }), { move: 'argue', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Books do not move me.' }] });
  assert.deepEqual(argue.messages.map((m) => m.speaker), ['aristotle']);
  const pass = advance(input('tie', { galileo: false }), { move: 'pass', stepDone: true, lean: 'slower', messages: [{ speaker: 'aristotle', text: 'A strange idea.' }] });
  assert.equal(pass.state.step, 'counter');
  assert.equal(pass.state.view, 'slower');
  assert.match(pass.messages.at(-1).text, /holds back the fast heavy one/);
  assert.equal(pass.messages.at(-1).image, 'tied-slower');
});

test('guided group and a debate spark skip the tie step', () => {
  const guided = advance(normalizeInput({ message: 'x', state: { condition: 'guided', step: 'premise' } }), { move: 'pass', stepDone: true, messages: [{ speaker: 'galileo', text: 'Yes.' }] });
  assert.equal(guided.state.step, 'slower');
  const spark = advance(input('premise', { spark: true }), { move: 'pass', stepDone: true, messages: [{ speaker: 'aristotle', text: 'Yes.' }] });
  assert.equal(spark.state.step, 'counter');
});

test('open debate: a preset label gets Aristotle\'s fixed reply plus a challenge, even with no model words', () => {
  const parsed = parseModelReply(providerReply({ student_move: 'air', step_done: false, messages: [] }), 'debate');
  assert.equal(parsed.move, 'air');
  const out = advance(input('debate'), parsed);
  assert.equal(out.messages.length, 1);
  assert.match(out.messages[0].text, /^Even with no air at all/);
  assert.match(out.messages[0].text, /prove it\.$/);
  const same = advance(input('debate'), { move: 'same_time', stepDone: false, messages: [] });
  assert.equal(same.messages[0].image, 'falling');
});

test('Pisa easter egg: Galileo steps in once, then Aristotle; the second time it is an experiment', () => {
  const first = advance(input('debate'), { move: 'pisa', stepDone: false, messages: [] });
  assert.deepEqual(first.messages.map((m) => m.speaker), ['system', 'galileo', 'system', 'aristotle']);
  assert.equal(first.messages[1].image, 'pisa');
  assert.equal(first.state.pisaSeen, true);
  assert.equal(first.state.galileo, false);
  const again = advance(normalizeInput({ message: 'x', state: first.state }), { move: 'pisa', stepDone: false, messages: [] });
  assert.deepEqual(again.messages.map((m) => m.speaker), ['aristotle']);
  assert.match(again.messages[0].text, /not precise enough/);
});

test('tie step: presets end with the reasoning challenge; the whole idea passes; part of it is discussed', () => {
  const air = advance(input('tie', { galileo: false }), { move: 'air', stepDone: false, messages: [] });
  assert.match(air.messages[0].text, /reasoning alone, if you can\.$/);
  const part = advance(input('tie', { galileo: false }), { move: 'thought_partial', stepDone: false, messages: [{ speaker: 'aristotle', text: 'Together? Which stones?' }] });
  assert.deepEqual(part.messages.map((m) => m.text), ['Together? Which stones?']);
  const whole = advance(input('tie', { galileo: false }), { move: 'thought_experiment', stepDone: false, messages: [{ speaker: 'aristotle', text: 'A strange idea.' }] });
  assert.equal(whole.state.step, 'counter');
  assert.equal(whole.state.view, 'faster');
});

test('open debate: giving in gets Aristotle\'s fixed line, then Galileo', () => {
  const out = advance(input('debate'), { move: 'concede', stepDone: false, messages: [] });
  assert.equal(out.messages[0].text, 'Good, you see it at last. The matter is settled.');
  assert.equal(out.joined, 'concede');
});

test('counter: Aristotle keeps his own view; the other reasoning passes; the guided group never sees it', () => {
  const argue = advance(input('counter', { galileo: false, view: 'slower' }), { move: 'other', stepDone: false, messages: [] });
  assert.deepEqual(argue.messages.map((m) => m.speaker), ['aristotle']);
  assert.match(argue.messages[0].text, /holds back the fast one/);
  const p = buildPayload(input('counter', { view: 'slower' }), 'm').messages[0].content;
  assert.match(p, /HEAVIER than the heavy stone alone/);
  const g = advance(normalizeInput({ message: 'x', state: { condition: 'guided', step: 'faster' } }), { move: 'pass', stepDone: true, messages: [{ speaker: 'galileo', text: 'Yes.' }] });
  assert.equal(g.state.step, 'contradiction');
});

test('a repeated argument gets a different wording each time', () => {
  let state = input('debate').state;
  const seen = [];
  for (let i = 0; i < 3; i++) {
    const out = advance(normalizeInput({ message: 'moon', state }), { move: 'vacuum', stepDone: false, messages: [] });
    seen.push(out.messages[0].text.split('.')[0]);
    state = out.state;
  }
  assert.equal(new Set(seen).size, 3);
  assert.equal(state.used.vacuum, 3);
});
