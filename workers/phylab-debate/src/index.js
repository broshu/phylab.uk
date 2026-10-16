import { advance, buildPayload, hasChinese, helpTurn, normalizeInput, parseModelReply } from './debate.js';
import { PROMPT_VERSION } from './steps.js';

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_PROVIDER_BYTES = 64 * 1024;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

/** @param {any} env */
function config(env) {
  return {
    apiKey: env.DEEPSEEK_API_KEY || '',
    model: env.AI_MODEL || 'deepseek-flash',
    baseUrl: (env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    allowedOrigins: new Set(
      String(env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  };
}

/** @param {unknown} data @param {number} [status] @param {Record<string,string>} [extra] */
function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { ...SECURITY_HEADERS, ...extra } });
}

/** Browsers on an allowed origin only. Returns null for anyone else. */
/** @param {Request} request @param {Set<string>} allowed */
function corsHeaders(request, allowed) {
  const origin = request.headers.get('Origin');
  if (!origin || !allowed.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

/** @param {ReadableStream<Uint8Array> | null} body @param {number} limit */
async function readLimitedText(body, limit) {
  if (!body) return '';
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new RangeError('Request is too large.');
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

/**
 * One model call. Returns the checked result or null.
 * @param {ReturnType<typeof config>} settings
 * @param {import('./debate.js').DebateInput} input
 * @param {boolean} strictEnglish
 */
async function askModel(settings, input, strictEnglish) {
  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPayload(input, settings.model, strictEnglish)),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'deepseek_error', status: response.status }));
    return null;
  }
  const text = await readLimitedText(response.body, MAX_PROVIDER_BYTES);
  return parseModelReply(JSON.parse(text), input.state.step, input.toGalileo);
}

/** @param {Request} request @param {any} env */
async function handleDebate(request, env) {
  const settings = config(env);
  const cors = corsHeaders(request, settings.allowedOrigins);
  if (!cors) return json({ error: 'Origin is not allowed.' }, 403);

  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    return json({ error: 'Content-Type must be application/json.' }, 415, cors);
  }

  let input;
  try {
    input = normalizeInput(JSON.parse(await readLimitedText(request.body, MAX_REQUEST_BYTES)));
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return json({ error: error instanceof Error ? error.message : 'Invalid request.' }, status, cors);
  }

  if (input.type === 'help') {
    return json({ ...helpTurn(input), mode: 'preset', version: PROMPT_VERSION }, 200, cors);
  }

  /** @type {Awaited<ReturnType<typeof askModel>>} */
  let result = null;
  let notice = null;
  if (!settings.apiKey) {
    notice = 'AI is not configured yet.';
  } else {
    try {
      result = await askModel(settings, input, false);
      if (!result || result.truncated || hasChinese(result.messages)) {
        const strict = Boolean(result && hasChinese(result.messages));
        result = await askModel(settings, input, strict);
        if (result && (result.truncated || hasChinese(result.messages))) result = null;
      }
    } catch (error) {
      console.error(JSON.stringify({ event: 'deepseek_failed', error: error instanceof Error ? error.name : 'unknown' }));
      result = null;
    }
    if (!result) notice = 'AI is busy right now. Using the lesson script.';
  }

  const outcome = advance(input, result);
  return json(
    {
      ...outcome,
      mode: result ? 'ai' : 'preset',
      version: PROMPT_VERSION,
      ...(notice ? { notice } : {}),
      ...(result?.usage ? { usage: result.usage } : {}),
    },
    200,
    cors,
  );
}

export default {
  /** @param {Request} request @param {any} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        const settings = config(env);
        return json({
          ok: true,
          service: 'phylab-debate',
          aiReady: Boolean(settings.apiKey),
          model: settings.model,
          version: PROMPT_VERSION,
        });
      }
      if (url.pathname === '/debate' && request.method === 'OPTIONS') {
        const cors = corsHeaders(request, config(env).allowedOrigins);
        return cors ? new Response(null, { status: 204, headers: cors }) : json({ error: 'Origin is not allowed.' }, 403);
      }
      if (url.pathname === '/debate' && request.method === 'POST') {
        return await handleDebate(request, env);
      }
      return json({ error: 'Not found.' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ event: 'unhandled_error', error: error instanceof Error ? error.message : 'unknown' }));
      return json({ error: 'Internal server error.' }, 500);
    }
  },
};
