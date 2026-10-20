# Debate Aristotle Worker

Backend for the **Debate Aristotle** lab (`/labs/debate-aristotle/`). The student
argues with Aristotle in a group chat, then works through the tied-stones
thought experiment. Galileo joins only when the student asks for help, sides
with Aristotle, or clearly states a wrong idea.

## Two research groups

The page puts each browser in one of two groups, chosen at random once and
kept (a link with `?group=debate` or `?group=guided` sets it). A **Debate | Guided** switch next to the page title lets readers of the paper try either group; switching clears the chat. Both groups use
the same steps, pass rules, hints, reveals, animations, notebook, model and
settings; only the social setting differs.

- **debate** — the student argues with Aristotle, who also asks every question of
  the method. Galileo comes only when the student asks for help, sides with
  Aristotle, or states a wrong idea, and leaves again once the step is passed.
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

Debate group: `slower` + `faster` are replaced by `counter` (`src/counter.js`): after the student proposes the tied stones, Aristotle reasons ONE way (the way the student's words lean: `faster` = one heavier body, `slower` = the slow stone holds back the fast one, with an animation) and the student must find the other way. Guided group keeps `slower` and `faster`.

Steps: `debate` → `premise` → `tie` (debate group only: Aristotle holds his position and the student must propose joining the stones; skipped after a spark) → `slower` → `faster` → `contradiction` →
`objection` → `conclusion` → `method` → `done`.

- Debate group, who speaks:
  - Galileo comes only when the model labels the student `help`, `concede` or
    `wrong`, or the student writes **@Galileo** / presses the button. The code
    enforces this whatever the model writes.
  - Any other answer that does not pass (`argue`, `partial`, `off_topic`):
    Aristotle reacts and asks his question again, with no hint.
  - The open debate has no turn limit: Aristotle holds his position until the
    student asks for help, gives in, or invents the thought experiment; then the
    lesson goes straight to the tied stones (`slower`), with `premise` counted as passed.
  - Galileo helps until the step is passed, then says one line and leaves.
    After 3 failed tries with him (`helpTurns`), he explains the idea and moves
    on. Without him there is no automatic reveal.
  - Aristotle leads the final reflection (`method`) and the free questions
    (`done`); @Galileo still works there.
- Aristotle's replies (`src/replies.js`): in the open debate and the `tie` step the model labels the student's argument (`same_time`, `experiment`, `air`, `vacuum`, `book`, `formula`, `pisa`, …) and writes Aristotle's reply in its own words around that label's fixed idea, reacting to what the student wrote; the fixed wordings are the fallback. When one kind of argument comes back 6 times (`REPEAT_LIMIT`), Galileo steps in to guide. `pisa` is an easter egg: once per chat Galileo steps in with the tower drop (animation), then Aristotle answers.
- Both groups: the model judges generously (the rough meaning passes a step) and may return `reached` = a later step the student has already reached (never past `conclusion`); the code then skips every step up to it.
- Guided group: after 3 failed tries in one step (`stepTurns`), Galileo explains the idea and moves on.
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
the state.

## Saved turns

Every turn is saved to the D1 database `phylab-debate-records` (binding `DB`,
table `turns`) for later analysis: time, chat `session` (a random id the page
makes for each new chat), prompt version, group, step and Galileo presence
before and after, the student's message, the model's `move` and `step_done`,
the steps passed, every reply line, and token use. Saving runs after the reply
and never blocks or breaks it. One chat in order:

```sql
SELECT * FROM turns WHERE session = ? ORDER BY id;
```

`GET /health` reports whether the key is set.

## Settings

- `DEEPSEEK_API_KEY` is kept as a **build** secret (Worker → Settings → Builds → Variables and secrets). The deploy command `npm run deploy` (`scripts/deploy.sh`) copies it to the runtime secret on every deploy.
- `AI_MODEL` is `deepseek-flash` with thinking turned off and JSON output on.

## Check locally

```bash
npm install
npm run check
```
