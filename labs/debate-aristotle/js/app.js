import { AVATARS, PICTURES } from './art.js?v=20261020d';
import { animationCard, hasAnimation } from './anims.js?v=20261020d';
import { L, LANG, LANG_STORE } from './lang.js?v=20261020f';

// The chat server on the phylab.uk domain (reachable from mainland China),
// with the workers.dev address as a fallback.
const APIS = ['https://debate-api.phylab.uk/debate', 'https://phylab-debate.dgxwmk9dbm.workers.dev/debate'];

/** POST to the first chat server that answers; remember which one worked. */
let apiIndex = 0;
async function postChat(body) {
  let lastError;
  for (let k = 0; k < APIS.length; k++) {
    const i = (apiIndex + k) % APIS.length;
    try {
      const res = await fetch(APIS[i], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      apiIndex = i;
      return res;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
const STORE = 'phylab-debate-aristotle-v1';
// v2: from Oct 2026 the page opens in debate mode unless a link or the switch chose guided.
const GROUP_STORE = 'phylab-debate-aristotle-group-v2';
const TRANSCRIPT_LIMIT = 16;

/** How the student calls Galileo in the chat. */
const MENTION = L('@Galileo', '@伽利略');

const NAMES = L({ aristotle: 'Aristotle', galileo: 'Galileo', student: 'You' }, { aristotle: '亚里士多德', galileo: '伽利略', student: '你' });

/**
 * The two research groups. Same steps, hints, pictures and notebook; only the
 * social setting differs. "debate": the student argues with Aristotle and
 * Galileo comes only when the student asks for help, sides with Aristotle, or states a wrong idea. "guided": Galileo leads, nobody argues.
 * The opening lines carry the same examples and the same rule in both.
 */
const GROUPS_EN = {
  debate: {
    title: 'Debate Aristotle',
    pinned: 'Aristotle says heavier things fall faster. Your task: convince him he is wrong.',
    opening: [
      { speaker: 'aristotle', text: 'Greetings, young one! I am Aristotle. Let me tell you something that everyone can see.' },
      { speaker: 'aristotle', text: 'Drop a stone and a feather together: the stone lands first. An apple falls fast, but a leaf drifts down slowly. A hammer beats a sheet of paper every time.', image: 'falling' },
      { speaker: 'aristotle', text: 'So the rule is simple: the heavier a body, the faster it falls. A body twice as heavy falls twice as fast. Do you dare to disagree?' },
    ],
    starters: ['Heavy and light things land at the same time!', 'The feather is slow because of the air.', 'Hmm, I think you are right.'],
    nbEmpty: 'Debate first. The steps of the method will appear here as you discover them.',
    firstPlaceholder: 'Argue with Aristotle…',
  },
  guided: {
    title: 'Explore with Galileo',
    pinned: 'Do heavier things fall faster? Your task: work it out step by step with Galileo.',
    opening: [
      { speaker: 'aristotle', text: 'Greetings, young one! I am Aristotle. Watch: I drop a stone and a feather together. The stone lands first, every time.', image: 'falling' },
      { speaker: 'aristotle', text: 'So the rule is simple: the heavier a body, the faster it falls.' },
      { speaker: 'galileo', text: 'Hello, I am Galileo. I once dropped a heavy iron ball and a light one from the Leaning Tower of Pisa, and they landed almost together.', image: 'pisa' },
      { speaker: 'galileo', text: 'So which idea do you agree with: Aristotle\'s (heavier falls faster), or mine (they fall together)?' },
    ],
    starters: ['I agree with Aristotle: heavier falls faster.', 'I agree with Galileo: they fall together.', 'I am not sure.'],
    nbEmpty: 'Talk with Galileo first. The steps of the method will appear here as you discover them.',
    firstPlaceholder: 'Answer Galileo…',
  },
};

const GROUPS_ZH = {
  debate: {
    title: '与亚里士多德辩论',
    pinned: '亚里士多德说重的物体落得更快。你的任务：说服他，让他承认自己错了。',
    opening: [
      { speaker: 'aristotle', text: '你好，年轻人！我是亚里士多德。让我告诉你一件人人都看得见的事。' },
      { speaker: 'aristotle', text: '把石头和羽毛同时放手：石头先落地。苹果落得很快，树叶却慢慢飘下来。锤子每次都比纸先落地。', image: 'falling' },
      { speaker: 'aristotle', text: '所以规则很简单：物体越重，下落越快。重一倍的物体，下落也快一倍。你敢反对吗？' },
    ],
    starters: ['重的和轻的东西同时落地！', '羽毛慢是因为空气。', '嗯，我觉得你说得对。'],
    nbEmpty: '先辩论吧。你发现方法的每一步，都会出现在这里。',
    firstPlaceholder: '和亚里士多德辩论…',
  },
  guided: {
    title: '和伽利略一起探索',
    pinned: '重的物体落得更快吗？你的任务：和伽利略一起一步步把它弄清楚。',
    opening: [
      { speaker: 'aristotle', text: '你好，年轻人！我是亚里士多德。看：我把石头和羽毛同时放手，每次都是石头先落地。', image: 'falling' },
      { speaker: 'aristotle', text: '所以规则很简单：物体越重，下落越快。' },
      { speaker: 'galileo', text: '你好，我是伽利略。我曾从比萨斜塔上同时放下一个重铁球和一个轻铁球，它们几乎同时落地。', image: 'pisa' },
      { speaker: 'galileo', text: '你同意哪个观点：亚里士多德的（重的落得快），还是我的（它们一起落地）？' },
    ],
    starters: ['我同意亚里士多德：重的落得快。', '我同意伽利略：它们一起落地。', '我不确定。'],
    nbEmpty: '先和伽利略聊聊吧。你发现方法的每一步，都会出现在这里。',
    firstPlaceholder: '回答伽利略…',
  },
};

const GROUPS = L(GROUPS_EN, GROUPS_ZH);

/**
 * Which group this browser is in: ?group=debate|guided sets it (for a teacher
 * handing out two links) or the switch; otherwise debate mode.
 */
function chooseGroup() {
  const asked = new URLSearchParams(location.search).get('group');
  let group = asked in GROUPS ? asked : null;
  try {
    if (!group) group = localStorage.getItem(GROUP_STORE);
    if (!(group in GROUPS)) group = 'debate';
    localStorage.setItem(GROUP_STORE, group);
  } catch {
    if (!(group in GROUPS)) group = 'debate';
  }
  return group;
}

const GROUP = chooseGroup();
const G = GROUPS[GROUP];
const OPENING = G.opening;
const STARTERS = G.starters;

/** Notebook lines, revealed as each step is passed. Ids match the Worker. */
const NOTEBOOK = [
  ['premise', L('Take the rule as true, just for now', '暂且承认规则成立')],
  ['slower', L('Imagine a simple case and reason one way', '设想一个简单情境，用一种方式推理')],
  ['faster', L('Reason the same case another way', '对同一情境换一种方式推理')],
  ['contradiction', L('Spot the contradiction', '找出矛盾')],
  ['conclusion', L('Reject the rule and keep what has no contradiction', '否定这条规则，留下没有矛盾的结论')],
  ['method', L('Name it: a thought experiment', '给它命名：思想实验')],
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

function newSession() {
  try { return crypto.randomUUID(); } catch { return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; }
}

function freshState() {
  return {
    // Random id of this chat; the server uses it to keep the turns of one chat together.
    session: newSession(),
    lesson: { condition: GROUP, lang: LANG, step: 'debate', stepTurns: 0, debateTurns: 0, galileo: GROUP === 'guided' },
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
    // A saved chat from the other group (the link changed) is not reused.
    // A saved chat from the other group or in the other language is not reused.
    if (saved && saved.lesson && Array.isArray(saved.log) && (saved.lesson.condition || 'debate') === GROUP && (saved.lesson.lang || 'en') === LANG) {
      // Chats saved before an update keep their text; give the opening its current pictures.
      OPENING.forEach((m, i) => {
        const old = saved.log[i];
        if (old && old.speaker === m.speaker && old.text === m.text) old.image = m.image;
      });
      if (!saved.session) saved.session = newSession();
      return saved;
    }
  } catch { /* ignore */ }
  return freshState();
}

// Galileo comes and goes. Older saved chats have no flag: he stayed once joined.
const galileoIn = () =>
  GROUP === 'guided' || (typeof state.lesson.galileo === 'boolean' ? state.lesson.galileo : state.lesson.step !== 'debate');
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
  if (GROUP === 'guided') {
    els.members.replaceChildren(avatar('aristotle'), avatar('galileo'), avatar('student'));
    els.memberCount.textContent = L('3 members', '3 位成员');
    return;
  }
  els.members.replaceChildren(avatar('aristotle'), avatar('student'));
  if (present) {
    const g = avatar('galileo');
    if (animate) g.classList.add('arrive');
    els.members.append(g);
  }
  els.memberCount.textContent = present ? L('3 members', '3 位成员') : L('2 members', '2 位成员');
}

/*
 * Completion code. In class each student's code is their 9-digit student
 * number × 3 + 6: they hand it in as homework, and the teacher works back
 * ((code − 6) ÷ 3) to the student number. This public demo has no student
 * numbers, so it shows the code for a made-up student number.
 */
const DEMO_STUDENT_NUMBER = 202612345;
const completionCode = (studentNumber) => String(studentNumber * 3 + 6);

function rewardNode() {
  const li = document.createElement('li');
  li.className = 'reward';
  const title = document.createElement('div');
  title.className = 'reward-title';
  title.textContent = L('Your completion code', '你的完成密码');
  const code = document.createElement('div');
  code.className = 'reward-code';
  code.textContent = completionCode(DEMO_STUDENT_NUMBER);
  const note = document.createElement('p');
  note.className = 'reward-note';
  note.textContent = L(
    'Hand this code to your teacher as proof that you finished. In class, each student gets their own code, made from their 9-digit student number × 3 + 6, so the teacher can work back to who finished. This is the demo version: the code above is for the example student number 202612345.',
    '把这串密码交给老师，证明你完成了任务。正式使用时，每位同学的密码由自己的 9 位学号 × 3 + 6 得出，老师可以据此反推出是谁完成的。这是展示版：上面的密码对应示例学号 202612345。',
  );
  li.append(title, code, note);
  return li;
}

/** System lines are stored in English; show them in the page language. */
const SYSTEM_ZH = {
  'Galileo joined the chat': '伽利略加入了群聊',
  'Galileo left the chat': '伽利略离开了群聊',
  'You won the debate!': '你赢得了这场辩论！',
  'Lesson complete!': '课程完成！',
};
const systemText = (text) => (LANG === 'zh' && SYSTEM_ZH[text]) || text;

function messageNode(m, prev) {
  if (m.speaker === 'system' && m.reward) return rewardNode();
  const li = document.createElement('li');
  if (m.speaker === 'system') {
    li.className = m.win ? 'system win' : 'system';
    li.textContent = systemText(m.text);
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
    // Show "@Galileo" / "@伽利略" as a mention, like in a group chat.
    for (const part of m.text.split(/(@galileo\b|@伽利略)/i)) {
      if (/^(@galileo|@伽利略)$/i.test(part)) {
        const at = document.createElement('span');
        at.className = 'mention';
        at.textContent = MENTION;
        bubble.append(at);
      } else if (part) {
        bubble.append(part);
      }
    }
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
  // "tie" (debate only: the student proposes the tied stones) belongs to notebook line 2.
  const current = state.lesson.step === 'tie' ? 'slower' : state.lesson.step === 'counter' ? 'faster' : state.lesson.step;
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
      text.textContent = done ? label : id === current ? L('In progress…', '进行中…') : '?';
      li.append(num, text);
      return li;
    }),
  );
  els.progress.textContent = `${NOTEBOOK.filter(([id]) => state.passed.includes(id)).length} / ${NOTEBOOK.length}`;
}

/** Answer buttons for a question later in the lesson; the student may still type. */
const STEP_CHOICES = {
  guided: {
    contradiction: L(["No, it can't be right.", 'Yes, it is right.', 'I am not sure.'], ['不正确。', '正确。', '我不确定。']),
  },
};

function renderStarters() {
  const first = state.lesson.step === 'debate' && !state.log.some((m) => m.speaker === 'student');
  const later = (STEP_CHOICES[GROUP] || {})[state.lesson.step];
  const choices = first ? STARTERS : later && !state.lesson.stepTurns && state.log.at(-1)?.speaker !== 'student' ? later : [];
  const show = choices.length > 0;
  els.starters.replaceChildren(
    ...(show
      ? choices.map((text) => {
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
  // Guided group: Galileo is already teaching, so there is no @Galileo button.
  // Debate group: it stays after the win, so the student can still call Galileo.
  const helpHidden = GROUP === 'guided';
  els.help.disabled = busy || helpHidden;
  els.help.hidden = helpHidden;
  els.help.textContent = MENTION;
  els.help.title = L('Mention Galileo to ask him something', '@伽利略，向他提问');
  els.input.placeholder =
    GROUP === 'guided'
      ? done ? L('Ask Galileo anything…', '问伽利略任何问题…') : L('Answer Galileo…', '回答伽利略…')
      : done
        ? L('Ask Aristotle anything, or @Galileo…', '问亚里士多德任何问题，或 @伽利略…')
        : galileoIn()
          ? L('Answer Galileo, or argue with Aristotle…', '回答伽利略，或和亚里士多德辩论…')
          : lessonStarted()
            ? L('Answer Aristotle…', '回答亚里士多德…')
            : G.firstPlaceholder;
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
  name.textContent = L(`${NAMES[speaker]} is typing…`, `${NAMES[speaker]}正在输入…`);
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

const NOTICE_ZH = {
  'AI is busy right now. Using the lesson script.': 'AI 暂时繁忙，正在使用预设的课程台词。',
  'AI is not configured yet.': 'AI 尚未配置。',
};

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

  const typer = /@(galileo\b|伽利略)/i.test(message) || galileoIn() ? 'galileo' : 'aristotle';
  // The transcript sent to the Worker must not include the new message twice.
  const history = transcript();
  // The help button shows up in the chat as the student mentioning Galileo.
  const mine = { speaker: 'student', text: type === 'turn' ? message : MENTION };
  state.log.push(mine);
  append(mine);
  renderStarters();
  showTyping(typer);

  try {
    const res = await postChat(JSON.stringify({ type, message, session: state.session, state: state.lesson, transcript: history }));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    hideTyping();

    const before = state.lesson.step;
    state.lesson = data.state;
    const newlyPassed = (data.passed || []).filter((id) => !state.passed.includes(id));
    state.passed.push(...newlyPassed);

    let messages = data.messages || [];
    if (before !== 'done' && state.lesson.step === 'done') {
      const win = GROUP === 'guided' ? 'Lesson complete!' : 'You won the debate!'; // shown in the page language
      messages = [
        ...messages.slice(0, -2),
        { speaker: 'system', text: win, win: true },
        ...messages.slice(-2),
        { speaker: 'system', text: 'Completion code', reward: true },
      ];
    }
    // Show the notebook change right after the reply that earned it.
    const joinedNow = before === 'debate' && state.lesson.step !== 'debate';
    await play(messages);
    if (joinedNow || newlyPassed.length) renderNotebook(newlyPassed.at(-1));
    if (data.notice) setNotice(L(data.notice, NOTICE_ZH[data.notice] || data.notice));
  } catch {
    hideTyping();
    // Take the unanswered message back so the student can resend it.
    state.log.pop();
    els.messages.lastElementChild?.remove();
    if (type === 'turn') els.input.value = message;
    setNotice(L('Could not reach the chat server. Check the connection and try again.', '连不上聊天服务器。请检查网络后再试一次。'));
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
// Insert a mention; the student keeps typing and sends it themselves.
els.help.addEventListener('click', () => {
  const text = els.input.value.replace(/^\s*(@galileo\b|@伽利略)\s*/i, '');
  els.input.value = `${MENTION} ${text}`;
  autosize();
  els.input.focus();
  els.input.setSelectionRange(els.input.value.length, els.input.value.length);
});
els.restart.addEventListener('click', () => {
  if (busy) return;
  if (state.log.some((m) => m.speaker === 'student') && !confirm(L('Start a new debate? This chat will be cleared.', '重新开始？当前对话会被清空。'))) return;
  state = freshState();
  save();
  setNotice('');
  renderAll();
});

// Switch teaching mode (for readers of the paper): remember it, then reload so
// the whole page is built for that mode. A mid-lesson chat asks first.
document.querySelectorAll('.mode-option[data-group]').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(btn.dataset.group === GROUP));
  btn.addEventListener('click', () => {
    const next = btn.dataset.group;
    if (next === GROUP || busy) return;
    if (state.log.some((m) => m.speaker === 'student') && !confirm(L('Switch teaching mode? This chat will be cleared.', '切换教学模式？当前对话会被清空。'))) return;
    try {
      localStorage.setItem(GROUP_STORE, next);
      localStorage.removeItem(STORE);
    } catch { /* storage is optional */ }
    const url = new URL(location.href);
    url.searchParams.set('group', next);
    location.href = url.toString();
  });
});

// Switch language (English / Chinese): remember the choice, then reload so the
// whole page and the chat are in that language. A mid-lesson chat asks first.
document.querySelectorAll('.lang-option').forEach((btn) => {
  btn.setAttribute('aria-pressed', String(btn.dataset.lang === LANG));
  btn.addEventListener('click', () => {
    const next = btn.dataset.lang;
    if (next === LANG || busy) return;
    if (state.log.some((m) => m.speaker === 'student') && !confirm(next === 'zh' ? 'Switch to Chinese? This chat will be cleared. / 切换到中文？当前对话会被清空。' : '切换到英文？当前对话会被清空。 / Switch to English? This chat will be cleared.')) return;
    try {
      localStorage.setItem(LANG_STORE, next);
      localStorage.removeItem(STORE);
    } catch { /* storage is optional */ }
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    location.href = url.toString();
  });
});

if (matchMedia('(max-width: 900px)').matches) els.details.open = false;
addEventListener('resize', autosize);

document.documentElement.lang = L('en', 'zh-CN');
if (LANG === 'zh') {
  const set = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
  set('.chat-title h2', '重的物体落得更快吗？');
  set('#restartBtn', '重新开始');
  set('.pin-label', '置顶');
  set('.notebook summary span', '思想实验笔记本');
  set('.mode-option[data-group="debate"]', '辩论');
  set('.mode-option[data-group="guided"]', '引导');
  els.restart.title = '开始新的对话';
  els.input.setAttribute('aria-label', '你的消息');
  els.send.setAttribute('aria-label', '发送');
}
document.title = G.title;
document.querySelector('.top-bar h1').textContent = G.title;
document.querySelector('.pinned p').textContent = G.pinned;
els.nbEmpty.textContent = G.nbEmpty;
document.documentElement.dataset.group = GROUP;

state = load();
renderAll();
