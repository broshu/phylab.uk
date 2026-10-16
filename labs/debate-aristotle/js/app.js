import { AVATARS, PICTURES } from './art.js?v=20261016d';
import { animationCard, hasAnimation } from './anims.js?v=20261016d';

const API = 'https://phylab-debate.dgxwmk9dbm.workers.dev/debate';
const STORE = 'phylab-debate-aristotle-v1';
const TRANSCRIPT_LIMIT = 16;

const NAMES = { aristotle: 'Aristotle', galileo: 'Galileo', student: 'You' };

/** Aristotle's opening. Shown instantly; no AI call. */
const OPENING = [
  { speaker: 'aristotle', text: 'Greetings, young one! I am Aristotle. Let me tell you something that everyone can see.' },
  { speaker: 'aristotle', text: 'Drop a stone and a feather together: the stone lands first. An apple falls fast, but a leaf drifts down slowly. A hammer beats a sheet of paper every time.', image: 'falling' },
  { speaker: 'aristotle', text: 'So the rule is simple: the heavier a body, the faster it falls. A body twice as heavy falls twice as fast. Do you dare to disagree?' },
];

const STARTERS = [
  'Heavy and light things land at the same time!',
  'The feather is slow because of the air.',
  'Hmm, I think you are right.',
];

/** Notebook lines, revealed as each step is passed. Ids match the Worker. */
const NOTEBOOK = [
  ['premise', 'Take the other side’s rule as true'],
  ['slower', 'Imagine a simple case and reason one way'],
  ['faster', 'Reason the same case another way'],
  ['contradiction', 'Spot the contradiction'],
  ['objection', 'Close the loophole'],
  ['conclusion', 'Reject the rule and keep what has no contradiction'],
  ['method', 'Name it: a thought experiment'],
];

const $ = (id) => document.getElementById(id);
const els = {
  messages: $('messages'),
  members: $('members'),
  memberCount: $('memberCount'),
  starters: $('starters'),
  notice: $('notice'),
  form: $('composer'),
  input: $('input'),
  send: $('sendBtn'),
  help: $('helpBtn'),
  restart: $('restartBtn'),
  nbEmpty: $('nbEmpty'),
  nbSteps: $('nbSteps'),
  progress: $('progress'),
  details: $('notebookDetails'),
};

let state;
let busy = false;

function freshState() {
  return {
    lesson: { step: 'debate', stepTurns: 0, debateTurns: 0 },
    log: OPENING.map((m) => ({ ...m })),
    passed: [],
  };
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* storage is optional */ }
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && saved.lesson && Array.isArray(saved.log)) return saved;
  } catch { /* ignore */ }
  return freshState();
}

// Galileo comes and goes. Older saved chats have no flag: he stayed once joined.
const galileoIn = () => (typeof state.lesson.galileo === 'boolean' ? state.lesson.galileo : state.lesson.step !== 'debate');
const lessonStarted = () => state.lesson.step !== 'debate';

/* ---------------- rendering ---------------- */

function avatar(speaker) {
  const span = document.createElement('span');
  span.className = 'avatar';
  span.innerHTML = AVATARS[speaker];
  return span;
}

/** `present` overrides the saved state while a reply is still playing out. */
function renderMembers(animate = false, present = galileoIn()) {
  els.members.replaceChildren(avatar('aristotle'), avatar('student'));
  if (present) {
    const g = avatar('galileo');
    if (animate) g.classList.add('arrive');
    els.members.append(g);
  }
  els.memberCount.textContent = present ? '3 members' : '2 members';
}

function messageNode(m, prev) {
  const li = document.createElement('li');
  if (m.speaker === 'system') {
    li.className = m.win ? 'system win' : 'system';
    li.textContent = m.text;
    return li;
  }
  li.className = `msg ${m.speaker}${m.speaker === 'student' ? ' mine' : ''}${prev && prev.speaker === m.speaker ? ' cont' : ''}`;
  const body = document.createElement('div');
  body.className = 'msg-body';
  if (m.speaker !== 'student') {
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = NAMES[m.speaker];
    body.append(name);
  }
  if (m.text) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = m.text;
    body.append(bubble);
  }
  if (m.image && hasAnimation(m.image)) {
    body.append(animationCard(m.image));
  } else if (m.image && PICTURES[m.image]) {
    const pic = document.createElement('div');
    pic.className = 'picture';
    pic.innerHTML = PICTURES[m.image];
    body.append(pic);
  }
  li.append(avatar(m.speaker), body);
  return li;
}

function scrollDown() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function append(m) {
  els.messages.append(messageNode(m, state.log[state.log.length - 2]));
  scrollDown();
}

function renderNotebook(animateId = null) {
  const started = lessonStarted();
  els.nbEmpty.hidden = started;
  els.nbSteps.hidden = !started;
  const current = state.lesson.step;
  els.nbSteps.replaceChildren(
    ...NOTEBOOK.map(([id, label], i) => {
      const li = document.createElement('li');
      const done = state.passed.includes(id);
      li.className = done ? 'done' : id === current ? 'current' : '';
      if (id === animateId) li.classList.add('reveal');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      const text = document.createElement('span');
      text.textContent = done ? label : id === current ? 'In progress…' : '?';
      li.append(num, text);
      return li;
    }),
  );
  els.progress.textContent = `${NOTEBOOK.filter(([id]) => state.passed.includes(id)).length} / ${NOTEBOOK.length}`;
}

function renderStarters() {
  const show = state.lesson.step === 'debate' && !state.log.some((m) => m.speaker === 'student');
  els.starters.replaceChildren(
    ...(show
      ? STARTERS.map((text) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = text;
          b.addEventListener('click', () => send(text));
          return b;
        })
      : []),
  );
}

function renderControls() {
  const done = state.lesson.step === 'done';
  els.send.disabled = busy;
  els.input.disabled = busy;
  els.help.disabled = busy || done;
  els.help.hidden = done;
  els.help.textContent = '@Galileo';
  els.help.title = galileoIn() ? 'Ask Galileo for a hint' : 'Call Galileo into the chat for help';
  els.input.placeholder = done
    ? 'Ask Galileo or Aristotle anything…'
    : galileoIn()
      ? 'Answer Galileo, or argue with Aristotle…'
      : lessonStarted()
        ? 'Answer Aristotle…'
        : 'Argue with Aristotle…';
}

function renderAll() {
  els.messages.replaceChildren(...state.log.map((m, i) => messageNode(m, state.log[i - 1])));
  renderMembers();
  renderNotebook();
  renderStarters();
  renderControls();
  requestAnimationFrame(scrollDown);
}

/* ---------------- typing animation ---------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let typingNode = null;
function showTyping(speaker) {
  hideTyping();
  typingNode = document.createElement('li');
  typingNode.className = `msg ${speaker} typing`;
  const body = document.createElement('div');
  body.className = 'msg-body';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = `${NAMES[speaker]} is typing…`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<i></i><i></i><i></i>';
  body.append(name, bubble);
  typingNode.append(avatar(speaker), body);
  els.messages.append(typingNode);
  scrollDown();
}
function hideTyping() {
  typingNode?.remove();
  typingNode = null;
}

async function play(messages) {
  for (const m of messages) {
    if (m.speaker === 'system') {
      await sleep(reduceMotion ? 0 : 500);
      state.log.push(m);
      append(m);
      if (/joined/.test(m.text)) renderMembers(true, true);
      if (/left/.test(m.text)) renderMembers(false, false);
      continue;
    }
    if (!reduceMotion) {
      showTyping(m.speaker);
      await sleep(Math.min(1800, 500 + (m.text || '').length * 14));
      hideTyping();
    }
    state.log.push(m);
    append(m);
  }
}

/* ---------------- talking to the Worker ---------------- */

function transcript() {
  return state.log
    .filter((m) => m.speaker !== 'system' && m.text)
    .slice(-TRANSCRIPT_LIMIT)
    .map(({ speaker, text }) => ({ speaker, text }));
}

function setNotice(text) {
  els.notice.hidden = !text;
  els.notice.textContent = text || '';
}

async function turn(type, message) {
  if (busy) return;
  busy = true;
  renderControls();
  setNotice('');

  const typer = type === 'help' && lessonStarted() ? 'galileo' : galileoIn() ? 'galileo' : 'aristotle';
  // The transcript sent to the Worker must not include the new message twice.
  const history = transcript();
  // The help button shows up in the chat as the student mentioning Galileo.
  const mine = { speaker: 'student', text: type === 'turn' ? message : '@Galileo' };
  state.log.push(mine);
  append(mine);
  renderStarters();
  showTyping(typer);

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, state: state.lesson, transcript: history }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    hideTyping();

    const before = state.lesson.step;
    state.lesson = data.state;
    const newlyPassed = (data.passed || []).filter((id) => !state.passed.includes(id));
    state.passed.push(...newlyPassed);

    let messages = data.messages || [];
    if (before !== 'done' && state.lesson.step === 'done') {
      messages = [...messages.slice(0, -2), { speaker: 'system', text: 'You won the debate!', win: true }, ...messages.slice(-2)];
    }
    // Show the notebook change right after the reply that earned it.
    const joinedNow = before === 'debate' && state.lesson.step !== 'debate';
    await play(messages);
    if (joinedNow || newlyPassed.length) renderNotebook(newlyPassed.at(-1));
    if (data.notice) setNotice(data.notice);
  } catch {
    hideTyping();
    // Take the unanswered message back so the student can resend it.
    state.log.pop();
    els.messages.lastElementChild?.remove();
    if (type === 'turn') els.input.value = message;
    setNotice('Could not reach the chat server. Check the connection and try again.');
  } finally {
    busy = false;
    save();
    renderMembers();
    renderNotebook();
    renderControls();
    els.input.focus({ preventScroll: true });
  }
}

function send(text) {
  const message = text.trim();
  if (!message || busy) return;
  els.input.value = '';
  autosize();
  turn('turn', message.slice(0, 500));
}

/* ---------------- events ---------------- */

// Grow with each new line instead of scrolling. scrollHeight leaves out the
// border, so add it back or a scrollbar appears.
function autosize() {
  const box = getComputedStyle(els.input);
  const border = parseFloat(box.borderTopWidth) + parseFloat(box.borderBottomWidth);
  els.input.style.height = 'auto';
  els.input.style.height = `${els.input.scrollHeight + border}px`;
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  send(els.input.value);
});
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send(els.input.value);
  }
});
els.input.addEventListener('input', autosize);
els.help.addEventListener('click', () => turn('help', ''));
els.restart.addEventListener('click', () => {
  if (busy) return;
  if (state.log.some((m) => m.speaker === 'student') && !confirm('Start a new debate? This chat will be cleared.')) return;
  state = freshState();
  save();
  setNotice('');
  renderAll();
});

if (matchMedia('(max-width: 900px)').matches) els.details.open = false;
addEventListener('resize', autosize);

state = load();
renderAll();
