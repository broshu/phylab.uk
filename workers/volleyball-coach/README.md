# Volleyball AI Coach Worker

A deliberately small Cloudflare Worker for testing a hybrid teaching model:

- the existing deterministic Coach remains the source of truth;
- the model receives the same canonical physics and preset teaching intent;
- the model receives the complete problem, equations, worked solution, time
  distinctions, boundary derivations, and current serve context;
- AI adds a short explanation or answers a learner's follow-up;
- the learner can keep asking follow-ups, and “Got it — continue” asks AI for a
  brief contextual bridge before restoring the preset choices;
- if AI is unavailable, the endpoint falls back to the preset response.
- successful questions and answers are stored anonymously in Cloudflare D1
  and can be reviewed from an unlinked secret admin URL.

The Worker also serves a test console at `/`. It does not host or modify the
current `phylab.uk` site.

## Maintain the Coach prompt

Edit `prompts/volleyball-coach.md` to change the AI's reply rules, canonical
problem and solution, or deterministic preset answers. The five headings under
`Preset Answers` (`time`, `net`, `out`, `in`, and `unknown`) are parsed by the
Worker, so keep those heading keys unchanged. Wrangler imports the Markdown as
a text module; there is no duplicate long prompt string to update in JavaScript.
Keep the prompt itself in English; it tells the model to answer in the learner's
language. The Worker also supplies up to four recent turns from the same
anonymous session so the model can track route A and route C independently.
Questions written in English are marked `English only`; a reply containing a
non-English script is retried once and then replaced by the English preset
fallback if the provider still violates the language requirement.

## Safety defaults

- A model call always requires `DEEPSEEK_API_KEY` inside the Worker. Browsers
  from the configured PhyLab origins can ask without entering a student key;
  direct callers and the Worker test console still require `COACH_TEST_TOKEN`.
- The origin allowlist is a modest cross-site misuse barrier, not strong user
  authentication. With provider auto-recharge disabled, the prepaid DeepSeek
  balance remains the practical spending ceiling.
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
- The admin page and its data endpoint are available only below the secret path
  stored in `COACH_ADMIN_PATH`. There is no token form or public admin link;
  possession of the complete URL grants access.
- Mathematical expressions use KaTeX-compatible `\\(...\\)` and `\\[...\\]`
  delimiters. The test console inserts every reply as text first, then renders
  only those delimited expressions with pinned KaTeX assets and `trust: false`.

## Configure secrets

Set the following in the Cloudflare dashboard for the `phylab-coach` Worker:

- `DEEPSEEK_API_KEY`: the DeepSeek API key.
- `COACH_TEST_TOKEN`: a disposable password for direct API tests and the
  private Worker test console. Students on the PhyLab page do not enter it.
- `COACH_ADMIN_PATH`: a long random path used as the private admin URL. Store
  only the path slug, without the domain or surrounding slashes.

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
