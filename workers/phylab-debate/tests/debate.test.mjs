import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';
import { advance, buildPayload, guessMove, helpTurn, normalizeInput, parseModelReply } from '../src/debate.js';
import { STEP_ORDER } from '../src/steps.js';

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

test('payload carries the shared rules, the step card and the hint', () => {
  const p = buildPayload(input('slower'), 'deepseek-flash');
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

test('debate: Galileo joins after the turn limit even if the student keeps arguing', () => {
  const parsed = { move: 'argue', stepDone: false, messages: [{ speaker: 'aristotle', text: 'No.' }] };
  assert.equal(advance(input('debate', { debateTurns: 2 }), parsed).state.step, 'debate');
  assert.equal(advance(input('debate', { debateTurns: 5 }), parsed).joined, 'stalemate');
});

test('passing a step appends the next opener', () => {
  const out = advance(input('slower'), { move: 'pass', stepDone: true, messages: [{ speaker: 'galileo', text: 'Yes!' }] });
  assert.deepEqual(out.passed, ['slower']);
  assert.equal(out.state.step, 'faster');
  assert.match(out.messages.at(-1).text, /heavier or lighter/);
});

test('after three failed tries Galileo reveals and moves on', () => {
  const fail = { move: 'stuck', stepDone: false, messages: [{ speaker: 'galileo', text: 'Nice try.' }] };
  assert.equal(advance(input('faster', { stepTurns: 1 }), fail).state.stepTurns, 2);
  const out = advance(input('faster', { stepTurns: 3 }), fail);
  assert.equal(out.state.step, 'contradiction');
  assert.ok(out.messages.some((m) => /put it together/.test(m.text)));
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

test('fallback keyword guess catches giving up', () => {
  assert.equal(guessMove("OK you're right"), 'concede');
  assert.equal(guessMove('idk'), 'stuck');
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
