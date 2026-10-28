// DeepSeek access for the "ask this paper" box. This Worker holds its own key
// (DEEPSEEK_API_KEY, created for preview.phylab.uk only), so a leak or a revoked key
// here never touches the other phylab Workers.

const MAX_SYSTEM_CHARS = 600_000;
const MAX_MESSAGES = 24;

/**
 * Turn DeepSeek's server-sent events into a plain stream of answer text.
 * @param {ReadableStream<Uint8Array>} body
 */
export function deltaText(body) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const piece = JSON.parse(data).choices?.[0]?.delta?.content;
          if (piece) controller.enqueue(encoder.encode(piece));
        } catch { /* ignore keep-alive or partial lines */ }
      }
    },
  }));
}

/**
 * Stream an answer. Returns a ReadableStream of UTF-8 text.
 * @param {any} env
 * @param {{system: string, messages: {role: 'user'|'assistant', content: string}[], maxTokens?: number}} input
 */
export async function askDeepSeek(env, { system, messages, maxTokens = 1200 }) {
  if (!env.DEEPSEEK_API_KEY) throw Object.assign(new Error('提问功能还没有接上 DeepSeek'), { status: 503 });
  const history = (Array.isArray(messages) ? messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (!history.length || history.at(-1).role !== 'user') throw Object.assign(new Error('问题是空的'), { status: 400 });
  const response = await fetch(`${(env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.AI_MODEL || 'deepseek-flash',
      thinking: { type: 'disabled' },
      temperature: 0.2,
      max_tokens: Math.min(Math.max(Number(maxTokens) || 1200, 200), 2000),
      stream: true,
      messages: [{ role: 'system', content: String(system || '').slice(0, MAX_SYSTEM_CHARS) }, ...history],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok || !response.body) {
    console.error(JSON.stringify({ event: 'ask_deepseek_error', status: response.status }));
    throw Object.assign(new Error(`DeepSeek ${response.status}`), { status: 502 });
  }
  return deltaText(response.body);
}
