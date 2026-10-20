// Internal DeepSeek access for other phylab Workers (currently preview.phylab.uk's
// "ask this paper" box). It is a WorkerEntrypoint, so it is reachable only through
// a service binding from a Worker in this account, never from the internet. It
// reuses this Worker's DEEPSEEK_API_KEY so the key lives in one place.
import { WorkerEntrypoint } from 'cloudflare:workers';

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

export class PaperChat extends WorkerEntrypoint {
  /**
   * Stream an answer. Returns a ReadableStream of UTF-8 text.
   * @param {{system: string, messages: {role: 'user'|'assistant', content: string}[], maxTokens?: number}} input
   */
  async chat({ system, messages, maxTokens = 1200 }) {
    const env = /** @type {any} */ (this.env);
    if (!env.DEEPSEEK_API_KEY) throw new Error('DeepSeek key is not set on phylab-debate');
    const history = (Array.isArray(messages) ? messages : [])
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-MAX_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
    if (!history.length || history.at(-1).role !== 'user') throw new Error('No question');
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
      console.error(JSON.stringify({ event: 'paperchat_deepseek_error', status: response.status }));
      throw new Error(`DeepSeek ${response.status}`);
    }
    return deltaText(response.body);
  }
}
