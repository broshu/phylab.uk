# Debate Aristotle Worker

Backend for the **Debate Aristotle** lab (`/labs/debate-aristotle/`). The student
argues with Aristotle in a group chat. When the student gets stuck, gives in, or
argues for six turns, Galileo joins and leads them, one small step at a time,
through his tied-stones thought experiment.

## Two research groups

The page puts each browser in one of two groups, chosen at random once and
kept (a link with `?group=debate` or `?group=guided` sets it). Both groups use
the same steps, pass rules, hints, reveals, animations, notebook, model and
settings; only the social setting differs.

- **debate** — the student argues with Aristotle. Galileo helps only when the
  student is stuck and leaves again after each step the student passes.
- **guided** (control) — Galileo leads from the start and asks the same
  questions himself; nobody argues. Aristotle is only mentioned from history.

## How the work is split

DeepSeek is used for only two small jobs per turn: write one or two short chat
lines in character, and judge whether the student's message passes the current
step. Everything else is fixed code and preset text:

- `prompts/shared-rules.md` — language level, length, Galileo's voice and the
  JSON reply format, used by both groups.
- `prompts/debate-intro.md`, `prompts/guided-intro.md` — who is in the chat for each group.
- `src/steps.js` — the lesson script: one card per step with the pass rule,
  common wrong answers, three hints, a reveal line, and the debate group's lines.
- `src/guided.js` — the guided group's lines, mirroring the debate lines one by one.
- `src/debate.js` — the step machine for both groups.

Steps: `debate` → `premise` → `slower` → `faster` → `contradiction` →
`objection` → `conclusion` → `method` → `done`.

- Galileo joins when the model labels the student `concede`, `stuck` or
  `thought_experiment`, after 6 debate turns, or when the student presses
  **@Galileo**.
- After 3 failed tries in one step, Galileo explains the idea and moves on.
- Galileo leaves as soon as the student passes a step; Aristotle asks the next question. A wrong or stuck answer brings Galileo back with a hint, and he returns for the final reflection.
- The **@Galileo** button puts a mention in the message box. A message with "@Galileo" and a question is answered by Galileo (he joins if needed); "@Galileo" on its own works as a help button and never calls the model.
- If DeepSeek fails, replies in Chinese twice, or returns broken JSON, the
  Worker answers from the script, so a lesson can always be finished.

## API

`POST /debate` from an allowed origin (`ALLOWED_ORIGINS`), JSON body:

```json
{ "type": "turn", "message": "...", "state": { "step": "debate", "stepTurns": 0, "debateTurns": 0 },
  "transcript": [{ "speaker": "aristotle", "text": "..." }] }
```

`type: "help"` is the help/hint button. The response holds `messages`, the new
`state`, the steps just `passed`, and `mode` (`ai` or `preset`). The page keeps
the state; the Worker stores nothing.

`GET /health` reports whether the key is set.

## Settings

- `DEEPSEEK_API_KEY` is kept as a **build** secret (Worker → Settings → Builds → Variables and secrets). The deploy command `npm run deploy` (`scripts/deploy.sh`) copies it to the runtime secret on every deploy.
- `AI_MODEL` is `deepseek-flash` with thinking turned off and JSON output on.

## Check locally

```bash
npm install
npm run check
```
