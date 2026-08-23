// @ts-check

import {
  buildProviderPayload,
  hasChineseScript,
  hasNonEnglishScript,
  normalizeCoachInput,
  parseProviderReply,
  presetReply,
} from './coach.js';
import { ADMIN_PAGE } from './admin-page.js';
import {
  PROMPT_VERSION,
  getRecentConversationHistory,
  listConversations,
  recordConversation,
} from './conversations.js';
import { TEST_PAGE } from './test-page.js';

const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_PROVIDER_BYTES = 64 * 1024;
const INTERNAL_RESULTS_PATH = '/result';

const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
});
const ADMIN_RESPONSE_HEADERS = Object.freeze({
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
});

const HTML_CONTENT_SECURITY_POLICY =
  "default-src 'none'; connect-src 'self'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; script-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** @param {unknown} value */
function normalizeAdminPath(value) {
  if (typeof value !== 'string') return '';
  const slug = value.trim().replace(/^\/+|\/+$/g, '');
  return /^[A-Za-z0-9_-]{32,128}$/.test(slug) ? `/${slug}` : '';
}

/** @param {Env} env */
function config(env) {
  return {
    model: env.AI_MODEL || 'deepseek-v4-flash',
    baseUrl: (env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    allowedOrigins: new Set(
      (env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
    apiKey: env.DEEPSEEK_API_KEY || '',
    testToken: env.COACH_TEST_TOKEN || '',
    adminPath: normalizeAdminPath(env.COACH_ADMIN_PATH),
  };
}

/**
 * @param {unknown} data
 * @param {number} status
 * @param {HeadersInit} [extraHeaders]
 */
function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: { ...SECURITY_HEADERS, ...extraHeaders },
  });
}

/**
 * @param {Request} request
 * @param {Set<string>} allowed
 * @returns {Record<string, string> | null}
 */
function corsHeaders(request, allowed) {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const sameOrigin = origin === new URL(request.url).origin;
  if (!sameOrigin && !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-Coach-Test-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/**
 * Read a bounded UTF-8 request or provider body without buffering unbounded
 * input. The caller owns the response when the limit is exceeded.
 * @param {ReadableStream<Uint8Array> | null} body
 * @param {number} limit
 */
async function readLimitedText(body, limit) {
  if (!body) return '';
  const reader = body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new RangeError('Body is too large.');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

/** @param {string} provided @param {string} expected */
async function secureEqual(provided, expected) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const subtle = /** @type {SubtleCrypto & { timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean }} */ (
    crypto.subtle
  );
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(providedHash, expectedHash);
  }

  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = providedBytes.length ^ expectedBytes.length;
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

/**
 * @param {ReturnType<typeof config>} settings
 * @param {ReturnType<typeof normalizeCoachInput>} input
 * @param {boolean} thinking
 * @param {Awaited<ReturnType<typeof getRecentConversationHistory>>} history
 * @param {boolean} [strictEnglishRetry]
 */
async function requestAI(settings, input, thinking, history, strictEnglishRetry = false) {
  return fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      buildProviderPayload(input, settings.model, thinking, history, strictEnglishRetry),
    ),
    signal: AbortSignal.timeout(20_000),
  });
}

/** @param {Response} response */
async function readProviderReply(response) {
  const providerText = await readLimitedText(response.body, MAX_PROVIDER_BYTES);
  return parseProviderReply(JSON.parse(providerText));
}

/**
 * @param {ReturnType<typeof normalizeCoachInput>} input
 * @param {ReturnType<typeof parseProviderReply>} parsed
 */
function violatesLanguageRequirement(input, parsed) {
  if (!parsed) return false;
  return input.replyLanguage === 'English'
    ? hasNonEnglishScript(parsed.reply)
    : !hasChineseScript(parsed.reply);
}

/** @param {ReturnType<typeof normalizeCoachInput>} input @param {string} english @param {string} simplifiedChinese */
function languageNotice(input, english, simplifiedChinese) {
  return input.replyLanguage === 'Simplified Chinese' ? simplifiedChinese : english;
}

/**
 * Return the response immediately and finish the anonymous database write in
 * the background. Database failures never expose a learner's text in logs.
 * @param {ReturnType<typeof normalizeCoachInput>} input
 * @param {Env} env
 * @param {ExecutionContext} ctx
 * @param {Record<string, string>} cors
 * @param {number} startedAt
 * @param {string} reply
 * @param {string} mode
 * @param {string | null} model
 * @param {{inputTokens: number | null, outputTokens: number | null, totalTokens: number | null} | null} usage
 * @param {string | null} notice
 */
function coachResponse(
  input,
  env,
  ctx,
  cors,
  startedAt,
  reply,
  mode,
  model = null,
  usage = null,
  notice = null,
) {
  const body = {
    reply,
    mode,
    ...(model ? { model } : {}),
    ...(usage ? { usage } : {}),
    ...(notice ? { notice } : {}),
  };

  if (input.requestType !== 'resume') {
    const { context } = input;
    const write = recordConversation(env.COACH_DB, {
      id: crypto.randomUUID(),
      sessionId: input.sessionId || crypto.randomUUID(),
      question: input.question,
      reply,
      mode,
      model,
      phase: context.phase,
      verdict: context.verdict,
      speed: context.speed,
      heightAtNet: context.heightAtNet,
      netClearance: context.netClearance,
      xLand: context.xLand,
      outBy: context.outBy,
      attemptCount: context.attemptCount,
      promptVersion: PROMPT_VERSION,
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      latencyMs: Math.max(0, Date.now() - startedAt),
    }).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'coach_conversation_write_error',
          error: error instanceof Error ? error.name : 'Unknown database error',
        }),
      );
    });
    ctx.waitUntil(write);
  }

  return json(body, 200, cors);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
async function handleCoach(request, env, ctx) {
  const startedAt = Date.now();
  const settings = config(env);
  const cors = corsHeaders(request, settings.allowedOrigins);
  if (!cors) return json({ error: 'Origin is not allowed.' }, 403);

  const type = request.headers.get('Content-Type') || '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return json({ error: 'Content-Type must be application/json.' }, 415, cors);
  }

  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_REQUEST_BYTES) {
    return json({ error: 'Request is too large.' }, 413, cors);
  }

  let input;
  try {
    const body = await readLimitedText(request.body, MAX_REQUEST_BYTES);
    input = normalizeCoachInput(JSON.parse(body));
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    const message = error instanceof Error ? error.message : 'Invalid request.';
    return json({ error: message }, status, cors);
  }

  const fallback = presetReply(input);
  if (!settings.apiKey) {
    return coachResponse(
      input,
      env,
      ctx,
      cors,
      startedAt,
      fallback,
      'preset-only',
      null,
      null,
      languageNotice(input, 'DEEPSEEK_API_KEY is not configured.', 'AI 教练尚未配置。'),
    );
  }

  const origin = request.headers.get('Origin');
  const isPublicStudentOrigin = Boolean(origin && settings.allowedOrigins.has(origin));
  if (!isPublicStudentOrigin) {
    if (!settings.testToken) {
      return json({ error: 'AI is locked until COACH_TEST_TOKEN is configured.' }, 503, cors);
    }

    const providedToken = request.headers.get('X-Coach-Test-Token') || '';
    if (!(await secureEqual(providedToken, settings.testToken))) {
      return json({ error: 'Invalid test token.' }, 401, cors);
    }
  }

  /** @type {Awaited<ReturnType<typeof getRecentConversationHistory>>} */
  let history = [];
  try {
    history = await getRecentConversationHistory(env.COACH_DB, input.sessionId);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'coach_history_read_error',
        error: error instanceof Error ? error.name : 'Unknown database error',
      }),
    );
  }

  let upstream;
  try {
    upstream = await requestAI(settings, input, true, history);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'deepseek_fetch_error',
        error: error instanceof Error ? error.name : 'Unknown fetch error',
      }),
    );
    return coachResponse(
      input,
      env,
      ctx,
      cors,
      startedAt,
      fallback,
      'preset-fallback',
      null,
      null,
      languageNotice(input, 'AI provider is temporarily unavailable.', 'AI 服务暂时不可用。'),
    );
  }

  if (!upstream.ok) {
    console.error(
      JSON.stringify({
        event: 'deepseek_error',
        status: upstream.status,
        requestId: upstream.headers.get('request-id') || upstream.headers.get('x-request-id'),
      }),
    );
    return coachResponse(
      input,
      env,
      ctx,
      cors,
      startedAt,
      fallback,
      'preset-fallback',
      null,
      null,
      languageNotice(input, 'AI provider is temporarily unavailable.', 'AI 服务暂时不可用。'),
    );
  }

  let parsed = null;
  try {
    parsed = await readProviderReply(upstream);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'deepseek_parse_error',
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      }),
    );
  }

  const firstLanguageViolation = violatesLanguageRequirement(input, parsed);
  if (!parsed || parsed.finishReason === 'length' || firstLanguageViolation) {
    const retryReason = firstLanguageViolation
      ? 'wrong-language'
      : parsed?.finishReason === 'length'
        ? 'truncated'
        : 'empty';
    console.warn(
      JSON.stringify({ event: 'deepseek_answer_retry', reason: retryReason, mode: 'non-thinking' }),
    );
    parsed = null;
    try {
      const retry = await requestAI(settings, input, false, history, firstLanguageViolation);
      if (retry.ok) {
        parsed = await readProviderReply(retry);
      } else {
        console.error(
          JSON.stringify({
            event: 'deepseek_retry_error',
            status: retry.status,
            requestId: retry.headers.get('request-id') || retry.headers.get('x-request-id'),
          }),
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'deepseek_retry_failed',
          error: error instanceof Error ? error.name : 'Unknown retry error',
        }),
      );
    }
  }

  const finalLanguageViolation = violatesLanguageRequirement(input, parsed);
  if (!parsed || parsed.finishReason === 'length' || finalLanguageViolation) {
    return coachResponse(
      input,
      env,
      ctx,
      cors,
      startedAt,
      fallback,
      'preset-fallback',
      null,
      null,
      finalLanguageViolation
        ? input.replyLanguage === 'Simplified Chinese'
          ? 'AI 未返回有效的简体中文回复。'
          : 'AI did not return a valid English response.'
        : input.replyLanguage === 'Simplified Chinese'
          ? 'AI 未返回完整回复。'
          : 'AI did not return a complete response.',
    );
  }

  return coachResponse(
    input,
    env,
    ctx,
    cors,
    startedAt,
    parsed.reply,
    'ai-assisted',
    settings.model,
    parsed.usage,
  );
}

/** @param {Request} request @param {Env} env */
async function handleAdminConversations(request, env) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ error: 'Origin is not allowed.' }, 403);
  }
  const pageValue = Number.parseInt(new URL(request.url).searchParams.get('page') || '1', 10);
  return json(await listConversations(env.COACH_DB, pageValue), 200, ADMIN_RESPONSE_HEADERS);
}

/** @satisfies {ExportedHandler<Env>} */
export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const settings = config(env);
    const requestPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

    try {
      if (request.method === 'GET' && url.pathname === '/') {
        return new Response(TEST_PAGE, {
          headers: {
            ...SECURITY_HEADERS,
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': HTML_CONTENT_SECURITY_POLICY,
          },
        });
      }

      if (request.method === 'GET' && url.pathname === '/health') {
        const publicStudentReady = Boolean(
          settings.apiKey && settings.allowedOrigins.size > 0,
        );
        const testConsoleReady = Boolean(settings.apiKey && settings.testToken);
        const aiReady = publicStudentReady || testConsoleReady;
        return json({
          ok: true,
          service: 'phylab-coach',
          mode: aiReady ? 'ai-ready' : settings.apiKey ? 'ai-locked' : 'preset-only',
          aiReady,
          publicStudentReady,
          testConsoleReady,
          model: settings.model,
          recordsReady: Boolean(settings.adminPath && env.COACH_DB),
        });
      }

      if (request.method === 'GET' && settings.adminPath) {
        const [isAdminPage, isAdminData] = await Promise.all([
          secureEqual(requestPath, settings.adminPath),
          secureEqual(requestPath, `${settings.adminPath}/conversations`),
        ]);
        const isInternalResultsPage = requestPath === INTERNAL_RESULTS_PATH;
        const isInternalResultsData = requestPath === `${INTERNAL_RESULTS_PATH}/conversations`;

        if (isAdminPage || isInternalResultsPage) {
          return new Response(ADMIN_PAGE, {
            headers: {
              ...SECURITY_HEADERS,
              ...ADMIN_RESPONSE_HEADERS,
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Security-Policy': HTML_CONTENT_SECURITY_POLICY,
            },
          });
        }

        if (isAdminData || isInternalResultsData) {
          return await handleAdminConversations(request, env);
        }
      }

      if (url.pathname === '/coach' && request.method === 'OPTIONS') {
        const cors = corsHeaders(request, settings.allowedOrigins);
        return cors ? new Response(null, { status: 204, headers: cors }) : json({ error: 'Origin is not allowed.' }, 403);
      }

      if (url.pathname === '/coach' && request.method === 'POST') {
        return await handleCoach(request, env, ctx);
      }

      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'unhandled_error',
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
      return json({ error: 'Internal server error.' }, 500);
    }
  },
};
