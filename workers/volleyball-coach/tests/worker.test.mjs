import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';
import { getRecentConversationHistory } from '../src/conversations.js';

/** @type {Array<Record<string, unknown>>} */
const storedRows = [];
/** @type {WeakMap<D1PreparedStatement, {sql: string, bindings: unknown[]}>} */
const statementState = new WeakMap();

/** @param {string} sql */
function prepare(sql) {
  /** @type {D1PreparedStatement} */
  const statement = /** @type {D1PreparedStatement} */ (
    /** @type {unknown} */ ({
      /** @param {unknown[]} bindings */
      bind(...bindings) {
        statementState.set(statement, { sql, bindings });
        return statement;
      },
      run() {
        return execute(statement);
      },
      all() {
        return execute(statement);
      },
      first() {
        return execute(statement).then((result) => result.results[0] || null);
      },
      raw() {
        return Promise.resolve([]);
      },
    })
  );
  statementState.set(statement, { sql, bindings: [] });
  return statement;
}

/** @param {D1PreparedStatement} statement */
async function execute(statement) {
  const state = statementState.get(statement);
  if (!state) throw new Error('Unknown test statement.');
  const { sql, bindings } = state;

  if (sql.startsWith('INSERT INTO coach_conversations')) {
    const [
      id,
      sessionId,
      question,
      reply,
      mode,
      model,
      phase,
      verdict,
      speed,
      heightAtNet,
      netClearance,
      xLand,
      outBy,
      attemptCount,
      promptVersion,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
    ] = bindings;
    storedRows.unshift({
      id,
      createdAt: new Date().toISOString(),
      sessionId,
      question,
      reply,
      mode,
      model,
      phase,
      verdict,
      speed,
      heightAtNet,
      netClearance,
      xLand,
      outBy,
      attemptCount,
      promptVersion,
      inputTokens,
      outputTokens,
      totalTokens,
      latencyMs,
    });
    return d1Result([]);
  }

  if (sql.startsWith('DELETE FROM coach_conversations')) return d1Result([]);
  if (sql.startsWith('SELECT question, reply, phase, verdict, speed')) {
    const sessionId = String(bindings[0]);
    const limit = Number(bindings[1]);
    return d1Result(
      storedRows
        .filter((row) => row.sessionId === sessionId)
        .slice(0, limit)
        .map(({ question, reply, phase, verdict, speed }) => ({
          question,
          reply,
          phase,
          verdict,
          speed,
        })),
    );
  }
  if (sql.startsWith('SELECT COUNT(*) AS total')) {
    return d1Result([{ total: storedRows.length }]);
  }
  if (sql.startsWith('SELECT id, created_at AS createdAt')) {
    const limit = Number(bindings[0]);
    const offset = Number(bindings[1]);
    return d1Result(storedRows.slice(offset, offset + limit));
  }
  throw new Error('Unexpected test SQL.');
}

/** @param {Array<Record<string, unknown>>} results */
function d1Result(results) {
  return /** @type {D1Result} */ (
    /** @type {unknown} */ ({
      success: true,
      results,
      meta: {},
    })
  );
}

const database = /** @type {D1Database} */ (
  /** @type {unknown} */ ({
    prepare,
    /** @param {D1PreparedStatement[]} statements */
    batch(statements) {
      return Promise.all(statements.map((statement) => execute(statement)));
    },
  })
);

/** @type {Env} */
const env = {
  AI_BASE_URL: 'https://api.deepseek.com',
  AI_MODEL: 'deepseek-v4-flash',
  ALLOWED_ORIGINS: 'https://phylab.uk,https://www.phylab.uk',
  DEEPSEEK_API_KEY: '',
  COACH_TEST_TOKEN: '',
  COACH_ADMIN_PATH: 'records-private-path-for-worker-tests-123',
  COACH_DB: database,
};

/**
 * Run background writes before returning so assertions see the same state as
 * a completed Worker invocation.
 * @param {Request} request
 * @param {Env} [environment]
 */
async function dispatch(request, environment = env) {
  /** @type {Promise<unknown>[]} */
  const pending = [];
  const ctx = /** @type {ExecutionContext} */ (
    /** @type {unknown} */ ({
      /** @param {Promise<unknown>} promise */
      waitUntil(promise) {
        pending.push(promise);
      },
      passThroughOnException() {},
    })
  );
  const response = await worker.fetch(request, environment, ctx);
  await Promise.all(pending);
  return response;
}

test('test console and admin console load KaTeX safely', async () => {
  const response = await dispatch(new Request('https://example.test/'));
  const html = await response.text();
  const csp = response.headers.get('Content-Security-Policy') || '';

  assert.equal(response.status, 200);
  assert.match(html, /katex@0\.18\.4\/dist\/katex\.min\.css/);
  assert.match(html, /katex@0\.18\.4\/dist\/contrib\/auto-render\.min\.js/);
  assert.match(html, /replyRoot\.textContent = reply/);
  assert.match(html, /sessionStorage\.getItem/);
  assert.match(html, /保存 30 天/);
  assert.doesNotMatch(html, /href="\/admin"/);
  assert.match(html, /trust: false/);
  assert.match(csp, /script-src 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net/);

  const publicAdminResponse = await dispatch(new Request('https://example.test/admin'));
  assert.equal(publicAdminResponse.status, 404);

  const adminResponse = await dispatch(
    new Request('https://example.test/records-private-path-for-worker-tests-123'),
  );
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(adminHtml, /Coach 对话记录/);
  assert.match(adminHtml, /element\.textContent =/);
  assert.match(adminHtml, /adminPath \+ '\/conversations/);
  assert.match(adminHtml, /loadPage\(1\);/);
  assert.doesNotMatch(adminHtml, /admin-token|X-Coach-Admin-Token|管理员口令/);
  assert.match(adminHtml, /trust: false/);
  assert.doesNotMatch(adminHtml, /localStorage/);
  assert.match(adminResponse.headers.get('X-Robots-Tag') || '', /noindex/);
});

test('health reports AI and anonymous-recording readiness separately', async () => {
  const response = await dispatch(new Request('https://example.test/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'preset-only');
  assert.equal(body.aiReady, false);
  assert.equal(body.publicStudentReady, false);
  assert.equal(body.testConsoleReady, false);
  assert.equal(body.recordsReady, true);
});

test('health reports public student AI readiness without a test token', async () => {
  /** @type {Env} */
  const publicEnv = { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' };
  const response = await dispatch(new Request('https://example.test/health'), publicEnv);
  const body = await response.json();

  assert.equal(body.mode, 'ai-ready');
  assert.equal(body.aiReady, true);
  assert.equal(body.publicStudentReady, true);
  assert.equal(body.testConsoleReady, false);
});

test('recent learning history is bounded and returned oldest first', async () => {
  storedRows.length = 0;
  for (const number of [5, 4, 3, 2, 1]) {
    storedRows.push({
      sessionId: 'history-session-123',
      question: `question-${number}`,
      reply: `reply-${number}`,
      phase: 'done',
      verdict: number % 2 ? 'net' : 'out',
      speed: 20 + number / 10,
    });
  }

  const history = await getRecentConversationHistory(database, 'history-session-123');
  assert.deepEqual(
    history.map((turn) => turn.question),
    ['question-2', 'question-3', 'question-4', 'question-5'],
  );
  storedRows.length = 0;
});

test('an allowed student origin can use AI without a test token', async () => {
  const originalFetch = globalThis.fetch;
  storedRows.unshift({
    sessionId: 'public-student-session',
    question: 'I already know that the lower boundary uses point A.',
    reply: 'Good. The next step on route A is to calculate the vertical fall.',
    phase: 'done',
    verdict: 'net',
    speed: 20,
  });
  let providerMessagesText = '';
  globalThis.fetch = async (_url, init) => {
    const providerPayload = JSON.parse(String(init?.body || '{}'));
    providerMessagesText = JSON.stringify(providerPayload.messages || []);
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: '用 \\(t_{\\mathrm{net}}=9/v\\) 计算到网时间。' },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
  };

  try {
    const response = await dispatch(
      new Request('https://example.test/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://phylab.uk' },
        body: JSON.stringify({
          question: '到球网的时间怎么算？',
          sessionId: 'public-student-session',
          context: { phase: 'done', verdict: 'in', speed: 21 },
        }),
      }),
      { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.mode, 'ai-assisted');
    assert.match(body.reply, /t_/);
    assert.match(
      providerMessagesText,
      /I already know that the lower boundary uses point A/,
    );
    assert.match(providerMessagesText, /Two Parallel Routes/);
  } finally {
    globalThis.fetch = originalFetch;
    storedRows.length = 0;
  }
});

test('a continuation bridge calls AI without recording a synthetic learner question', async () => {
  const originalFetch = globalThis.fetch;
  storedRows.length = 0;
  let providerPayloadText = '';
  globalThis.fetch = async (_url, init) => {
    providerPayloadText = String(init?.body || '');
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'That time calculation is the key idea. Now return to the paused boundary question and choose the next step.',
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
  };

  try {
    const response = await dispatch(
      new Request('https://example.test/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://phylab.uk' },
        body: JSON.stringify({
          requestType: 'resume',
          question: 'Why does a shorter time help?',
          sessionId: 'resume-bridge-session',
          context: {
            phase: 'done',
            verdict: 'net',
            speed: 20,
            resumeTarget: 'Which boundary point represents the slowest legal serve?',
            resumeOptions: ['A', 'B', 'C'],
            lastLearnerQuestion: 'Why does a shorter time help?',
            lastAiReply: 'A shorter time means less vertical fall.',
          },
        }),
      }),
      { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.mode, 'ai-assisted');
    assert.match(body.reply, /return to the paused boundary question/);
    assert.match(providerPayloadText, /resume-preset/);
    assert.match(providerPayloadText, /Which boundary point represents the slowest legal serve/);
    assert.equal(storedRows.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    storedRows.length = 0;
  }
});

test('an English question retries a non-English provider reply in English-only mode', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  let retryPayloadText = '';
  globalThis.fetch = async (_url, init) => {
    providerCalls += 1;
    if (providerCalls === 2) retryPayloadText = String(init?.body || '');
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content:
              providerCalls === 1
                ? '先计算球下落到 A 点所需的时间。'
                : 'First calculate the time needed to fall to point A.',
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
  };

  try {
    const response = await dispatch(
      new Request('https://example.test/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://phylab.uk' },
        body: JSON.stringify({
          question: 'How do I calculate the speed at point A?',
          sessionId: 'english-retry-session',
          context: { phase: 'done', verdict: 'net', speed: 20 },
        }),
      }),
      { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.mode, 'ai-assisted');
    assert.equal(providerCalls, 2);
    assert.doesNotMatch(body.reply, /[\u3400-\u9fff]/);
    assert.match(body.reply, /First calculate/);
    assert.match(retryPayloadText, /previous draft violated the English-only rule/);
  } finally {
    globalThis.fetch = originalFetch;
    storedRows.length = 0;
  }
});

test('an English question falls back to an English preset after two language violations', async () => {
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => {
    providerCalls += 1;
    return Response.json({
      choices: [
        {
          finish_reason: 'stop',
          message: { content: '先计算时间，再计算速度。' },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
  };

  try {
    const response = await dispatch(
      new Request('https://example.test/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://phylab.uk' },
        body: JSON.stringify({
          question: 'Why did this serve hit the net?',
          sessionId: 'english-fallback-session',
          context: { phase: 'done', verdict: 'net', speed: 20 },
        }),
      }),
      { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' },
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.mode, 'preset-fallback');
    assert.equal(providerCalls, 2);
    assert.doesNotMatch(body.reply, /[\u3400-\u9fff]/);
    assert.match(body.reply, /route A/);
    assert.match(body.notice, /valid English response/);
  } finally {
    globalThis.fetch = originalFetch;
    storedRows.length = 0;
  }
});

test('direct callers still need the private test token', async () => {
  const response = await dispatch(
    new Request('https://example.test/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '测试', context: {} }),
    }),
    { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' },
  );

  assert.equal(response.status, 503);
});

test('successful coach replies are recorded and protected by a secret admin URL', async () => {
  storedRows.length = 0;
  const response = await dispatch(
    new Request('https://example.test/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.test' },
      body: JSON.stringify({
        question: '为什么慢球更容易挂网？',
        sessionId: 'student-session-123',
        context: { phase: 'done', verdict: 'net', speed: 15 },
      }),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.mode, 'preset-only');
  assert.match(body.reply, /route A/);
  assert.equal(storedRows.length, 1);
  assert.equal(storedRows[0].question, '为什么慢球更容易挂网？');
  assert.equal(storedRows[0].sessionId, 'student-session-123');
  assert.equal('ip' in storedRows[0], false);
  assert.equal('userAgent' in storedRows[0], false);

  const oldPublicRoute = await dispatch(
    new Request('https://example.test/admin/conversations'),
  );
  assert.equal(oldPublicRoute.status, 404);

  const wrongPrivateRoute = await dispatch(
    new Request('https://example.test/records-private-path-for-worker-tests-124/conversations'),
  );
  assert.equal(wrongPrivateRoute.status, 404);

  const crossOrigin = await dispatch(
    new Request('https://example.test/records-private-path-for-worker-tests-123/conversations', {
      headers: { Origin: 'https://attacker.example' },
    }),
  );
  assert.equal(crossOrigin.status, 403);

  const privateResponse = await dispatch(
    new Request('https://example.test/records-private-path-for-worker-tests-123/conversations?page=1'),
  );
  const recordsBody = await privateResponse.json();
  assert.equal(privateResponse.status, 200);
  assert.equal(recordsBody.pagination.total, 1);
  assert.equal(recordsBody.retentionDays, 30);
  assert.equal(recordsBody.records[0].question, '为什么慢球更容易挂网？');
  assert.match(privateResponse.headers.get('X-Robots-Tag') || '', /noindex/);
});

test('rejects oversized and non-JSON requests without recording them', async () => {
  const originalCount = storedRows.length;
  const wrongType = await dispatch(
    new Request('https://example.test/coach', { method: 'POST', body: 'hello' }),
  );
  assert.equal(wrongType.status, 415);

  const tooLarge = await dispatch(
    new Request('https://example.test/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '9000' },
      body: '{}',
    }),
  );
  assert.equal(tooLarge.status, 413);
  assert.equal(storedRows.length, originalCount);
});
