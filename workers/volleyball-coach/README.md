# Volleyball AI Coach Worker

A deliberately small Cloudflare Worker for testing a hybrid teaching model:

- the existing deterministic Coach remains the source of truth;
- the model receives the same canonical physics and preset teaching intent;
- the model receives the complete problem, equations, worked solution, time
  distinctions, boundary derivations, and current serve context;
- AI adds a short explanation or answers a learner's follow-up;
- if AI is unavailable, the endpoint falls back to the preset response.
- successful questions and answers are stored anonymously in Cloudflare D1
  and can be reviewed from the protected admin page at `/admin`.

The Worker also serves a test console at `/`. It does not host or modify the
current `phylab.uk` site.

## Safety defaults

- No model call is possible until both `DEEPSEEK_API_KEY` and
  `COACH_TEST_TOKEN` are configured as Worker secrets.
- Request bodies are capped at 8 KiB and questions at 600 characters.
- The model cannot change the canonical result or scoring.
- Replies are short, non-streaming, and non-searching. DeepSeek uses low-effort
  thinking with a 2,000-token total reasoning-and-answer ceiling.
- If thinking mode returns no final answer, the Worker makes one bounded
  non-thinking recovery request before using the deterministic fallback. It
  also retries when DeepSeek marks the first answer as truncated by length.
- Prompts and responses are not written to logs.
- The conversation table stores an anonymous per-tab session ID, the question,
  reply, answer mode, token counts, latency, and physics context. It does not
  store a name, email address, IP address, User-Agent, or browser fingerprint.
- Conversation text is retained for 30 days. Each successful write performs a
  best-effort cleanup of older rows.
- The admin data endpoint requires a separate `COACH_ADMIN_TOKEN` header.
  The admin page never places that token in the URL or browser storage.
- Mathematical expressions use KaTeX-compatible `\\(...\\)` and `\\[...\\]`
  delimiters. The test console inserts every reply as text first, then renders
  only those delimited expressions with pinned KaTeX assets and `trust: false`.

## Configure secrets

Set the following in the Cloudflare dashboard for the `phylab-coach` Worker:

- `DEEPSEEK_API_KEY`: the DeepSeek API key.
- `COACH_TEST_TOKEN`: a disposable password for the private test console.
- `COACH_ADMIN_TOKEN`: a separate password for reading conversation records.

The Worker also needs the `COACH_DB` D1 binding defined in
`wrangler.jsonc`. Apply database migrations before the first deployment:

```bash
npx wrangler d1 migrations apply phylab-coach-conversations --remote
```

For local development, copy `.dev.vars.example` to `.dev.vars` and fill it in.
The real `.dev.vars` file is ignored by Git.

The default provider is `deepseek-v4-flash` at `https://api.deepseek.com`.
Change `AI_MODEL` only after checking the current DeepSeek API documentation.

## Verify locally

```bash
npm install
npm run check
```
