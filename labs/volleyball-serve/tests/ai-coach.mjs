import assert from 'node:assert/strict';

import { createAiCoachClient } from '../js/services/ai-coach.js';
import { renderDelimitedMath } from '../js/ui/math.js';
import { makeEl } from './fake-dom.mjs';

const values = new Map();
const storage = {
  getItem(key) {
    return values.get(key) || null;
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
};

let request = null;
const client = createAiCoachClient({
  endpoint: 'https://coach.example/coach',
  storage,
  idFactory: () => 'student-session-123',
  async fetchImpl(url, options) {
    request = { url, options };
    return Response.json({
      reply: String.raw`Use \(t = 9/v\).`,
      mode: 'ai-assisted',
    });
  },
});

const result = await client.ask({
  question: 'How is time calculated?',
  token: 'private-test-code',
  context: { phase: 'done', verdict: 'in', speed: 21 },
});
const body = JSON.parse(request.options.body);

assert.equal(request.url, 'https://coach.example/coach');
assert.equal(request.options.headers['X-Coach-Test-Token'], 'private-test-code');
assert.equal(body.sessionId, 'student-session-123');
assert.equal(body.context.speed, 21);
assert.equal(result.mode, 'ai-assisted');
assert.equal(client.getSavedToken(), 'private-test-code');

const reused = createAiCoachClient({
  storage,
  idFactory: () => {
    throw new Error('A saved session should be reused.');
  },
  fetchImpl: async () => Response.json({ reply: 'ok', mode: 'ai-assisted' }),
});
assert.equal(reused.getSavedToken(), 'private-test-code');

global.document = { createElement: (tag) => makeEl(tag) };
const rendered = [];
global.katex = {
  render(tex, element, options) {
    rendered.push({ tex, options });
    element.textContent = tex;
  },
};
const target = makeEl('p');
renderDelimitedMath(
  target,
  String.raw`Time is \(t = 9/v\). <img src=x onerror=alert(1)>`,
);

assert.equal(rendered.length, 1);
assert.equal(rendered[0].tex, 't = 9/v');
assert.equal(rendered[0].options.trust, false);
assert.ok(
  target.children.some((child) =>
    child.textContent.includes('<img src=x onerror=alert(1)>'),
  ),
);
assert.equal(target.innerHTML, '');

console.log('AI Coach client and safe math rendering passed');
