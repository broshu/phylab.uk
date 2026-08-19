import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/index.js';

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
  COACH_ADMIN_TOKEN: 'admin-test-token',
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
  assert.match(html, /trust: false/);
  assert.match(csp, /script-src 'unsafe-inline' https:\/\/cdn\.jsdelivr\.net/);

  const adminResponse = await dispatch(new Request('https://example.test/admin'));
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  assert.match(adminHtml, /Coach 对话记录/);
  assert.match(adminHtml, /element\.textContent =/);
  assert.match(adminHtml, /X-Coach-Admin-Token/);
  assert.match(adminHtml, /trust: false/);
  assert.doesNotMatch(adminHtml, /localStorage/);
});

test('health reports AI and anonymous-recording readiness separately', async () => {
  const response = await dispatch(new Request('https://example.test/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'preset-only');
  assert.equal(body.aiReady, false);
  assert.equal(body.recordsReady, true);
});

test('health reports a locked AI when only the provider key exists', async () => {
  /** @type {Env} */
  const lockedEnv = { ...env, DEEPSEEK_API_KEY: 'not-a-real-key' };
  const response = await dispatch(new Request('https://example.test/health'), lockedEnv);
  const body = await response.json();

  assert.equal(body.mode, 'ai-locked');
  assert.equal(body.aiReady, false);
});

test('successful coach replies are recorded and protected by an admin token', async () => {
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
  assert.match(body.reply, /下落更少/);
  assert.equal(storedRows.length, 1);
  assert.equal(storedRows[0].question, '为什么慢球更容易挂网？');
  assert.equal(storedRows[0].sessionId, 'student-session-123');
  assert.equal('ip' in storedRows[0], false);
  assert.equal('userAgent' in storedRows[0], false);

  const unauthenticated = await dispatch(
    new Request('https://example.test/admin/conversations'),
  );
  assert.equal(unauthenticated.status, 401);

  const authenticated = await dispatch(
    new Request('https://example.test/admin/conversations?page=1', {
      headers: { 'X-Coach-Admin-Token': 'admin-test-token' },
    }),
  );
  const recordsBody = await authenticated.json();
  assert.equal(authenticated.status, 200);
  assert.equal(recordsBody.pagination.total, 1);
  assert.equal(recordsBody.retentionDays, 30);
  assert.equal(recordsBody.records[0].question, '为什么慢球更容易挂网？');
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
