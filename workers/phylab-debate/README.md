# Debate Aristotle Worker

Backend for the **Debate Aristotle** lab (`/labs/debate-aristotle/`). The student
argues with Aristotle in a group chat. When the student gets stuck, gives in, or
argues for six turns, Galileo joins and leads them, one small step at a time,
through his tied-stones thought experiment.

## How the work is split

DeepSeek is used for only two small jobs per turn: write one or two short chat
lines in character, and judge whether the student's message passes the current
step. Everything else is fixed code and preset text:

- `prompts/characters.md` — shared rules: who Aristotle and Galileo are, language
  level, length, and the JSON reply format.
- `src/steps.js` — the lesson script. One card per step with the pass rule,
  common wrong answers and what to say to them, three hints, a reveal line, and
  the next step's opening question. Edit wording here.
- `src/debate.js` — the step machine. Galileo's entrance, step openers, hints,
  reveals and the ending are added by code, not written by the model.

Steps: `debate` → `premise` → `slower` → `faster` → `contradiction` →
`objection` → `conclusion` → `method` → `done`.

- Galileo joins when the model labels the student `concede`, `stuck` or
  `thought_experiment`, after 6 debate turns, or when the student presses
  **@Galileo**.
- After 3 failed tries in one step, Galileo explains the idea and moves on.
- After Galileo joins, the same **@Galileo** button asks him for a hint. It never calls the model.
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
