/**
 * Browser client for the private Volleyball AI Coach Worker.
 *
 * The provider key never reaches the browser. The Worker accepts this public
 * student client only from the configured PhyLab website origins.
 */

export const AI_COACH_ENDPOINT =
  'https://phylab-coach.dgxwmk9dbm.workers.dev/coach';

const SESSION_KEY = 'phylab-volleyball-ai-session';
const VALID_SESSION_ID = /^[A-Za-z0-9_-]{8,80}$/;

function fallbackSessionId() {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function safeRead(storage, key) {
  try {
    return storage?.getItem?.(key) || '';
  } catch {
    return '';
  }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
}

/**
 * @param {{
 *   endpoint?: string,
 *   fetchImpl?: typeof fetch,
 *   storage?: Storage,
 *   idFactory?: () => string
 * }} [options]
 */
export function createAiCoachClient({
  endpoint = AI_COACH_ENDPOINT,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  storage = globalThis.sessionStorage,
  idFactory = () => globalThis.crypto?.randomUUID?.() || fallbackSessionId(),
} = {}) {
  const savedSessionId = safeRead(storage, SESSION_KEY);
  let sessionId = savedSessionId;
  if (!VALID_SESSION_ID.test(sessionId)) {
    const generatedSessionId = idFactory();
    sessionId = VALID_SESSION_ID.test(generatedSessionId)
      ? generatedSessionId
      : fallbackSessionId();
  }
  safeWrite(storage, SESSION_KEY, sessionId);

  return {
    /**
     * @param {{
     *   question: string,
     *   context: Record<string, unknown>
     * }} request
     */
    async ask({ question, context }) {
      const cleanQuestion = String(question || '').trim();
      if (!cleanQuestion) throw new Error('Enter a question for Coach.');
      if (typeof fetchImpl !== 'function') {
        throw new Error('AI Coach is unavailable in this browser.');
      }

      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: cleanQuestion,
          sessionId,
          context,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('AI Coach returned an unreadable response.');
      }
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'AI Coach request failed.',
        );
      }
      if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        throw new Error('AI Coach returned an empty response.');
      }

      return {
        reply: data.reply.trim(),
        mode: typeof data.mode === 'string' ? data.mode : 'preset-fallback',
        notice: typeof data.notice === 'string' ? data.notice : '',
      };
    },
  };
}
