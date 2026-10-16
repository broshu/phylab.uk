// The review desk's data lives in the GitHub repository:
//   literature/review/pending/<id>.md   papers waiting for a decision
//   literature/review/done/<id>.md      approved or rejected papers (with who and why)
//   literature/review/profile.json      interest profile used by the weekly search
//   literature/review/kept-old.json     catalogue entries older than two years to keep
//   literature/data/papers.json         the published catalogue
import { DONE_DIR, PENDING_DIR, REVIEW_DIR, catalogEntry, parseReview, serializeReview } from './reviewfile.js';
import { CATALOG_PATH, addToCatalog, expiredEntries, removeFromCatalog, shanghaiDate } from './literature.js';
import { readRepo, transact } from './github.js';
import { PRIORITIES, TOPICS, normalizeDOI } from '../../../literature/core.mjs';

// Reviewing criteria. Whoever adds candidates (ChatGPT, another AI, a person) reads them from profile.json.
export const DEFAULT_PROFILE = {
  topics: ['hands-on', 'simulation', 'ai', 'transfer', 'assessment', 'icap', 'scaffolding', 'cognitive-load', 'visualization'],
  keywords: [
    'physics laboratory learning', 'physics simulation learning transfer', 'artificial intelligence physics teaching',
    'AI tutor physics', 'physics assessment instrument', 'scaffolding physics problem solving',
    'augmented reality physics', 'video analysis physics experiment', 'low-cost physics apparatus',
    'physics olympiad problem solving', 'secondary school physics teaching',
  ],
  journals: [
    { name: 'Physical Review Physics Education Research', issn: '2469-9896', on: true, physics: true },
    { name: 'American Journal of Physics', issn: '0002-9505', on: true, physics: true },
    { name: 'The Physics Teacher', issn: '0031-921X', on: true, physics: true },
    { name: 'European Journal of Physics', issn: '0143-0807', on: true, physics: true },
    { name: 'Physics Education', issn: '0031-9120', on: true, physics: true },
    { name: 'International Journal of Science Education', issn: '0950-0693', on: true, physics: false },
    { name: 'Journal of Research in Science Teaching', issn: '0022-4308', on: true, physics: false },
    { name: 'Science Education', issn: '0036-8326', on: true, physics: false },
    { name: 'Research in Science Education', issn: '0157-244X', on: true, physics: false },
    { name: 'Journal of Science Education and Technology', issn: '1059-0145', on: true, physics: false },
    { name: 'Computers & Education', issn: '0360-1315', on: true, physics: false },
  ],
  notes: 'Secondary-school (Grades 10-12) physics teaching. Most interested in AI-supported learning (AI tutors, AI feedback, AI solutions to physics problems), hands-on and low-cost experiments, video and frame-stacking visualisation, AR, simulations, and whether learning transfers to independent work.',
  threshold: 4,
  window_days: 45,
};

export const PROFILE_PATH = `${REVIEW_DIR}/profile.json`;
export const KEPT_PATH = `${REVIEW_DIR}/kept-old.json`;
export const WANTED = { folders: [PENDING_DIR, DONE_DIR], files: [CATALOG_PATH, PROFILE_PATH, KEPT_PATH] };

function parseJSON(text, fallback) {
  if (!text) return fallback;
  try { return JSON.parse(text); } catch { return fallback; }
}

/** Turn a repository snapshot into the desk's view of it. */
export function deskFrom(snapshot) {
  const read = (folder) => (snapshot.folders[folder] || []).filter(f => f.name.endsWith('.md') && !/^(readme|template|_)/i.test(f.name)).map(f => {
    try { return parseReview(f.text, f.path); }
    catch (error) { return { path: f.path, id: f.name.replace(/\.md$/, ''), broken: error.message }; }
  });
  const catalog = parseJSON(snapshot.files[CATALOG_PATH], { schema_version: 1, papers: [] });
  return {
    head: snapshot.head,
    pending: read(PENDING_DIR),
    done: read(DONE_DIR),
    catalog,
    catalogText: snapshot.files[CATALOG_PATH],
    profile: { ...DEFAULT_PROFILE, ...parseJSON(snapshot.files[PROFILE_PATH], {}) },
    kept: parseJSON(snapshot.files[KEPT_PATH], []),
  };
}

export async function loadDesk(env) {
  return deskFrom(await readRepo(env, WANTED));
}

/** Everything already known, so the weekly search never proposes a paper twice. */
export function knownDOIs(desk) {
  return new Set([...desk.catalog.papers, ...desk.pending, ...desk.done].map(p => normalizeDOI(p.doi || '')).filter(Boolean));
}
export function takenIds(desk) {
  return new Set([...desk.catalog.papers, ...desk.pending, ...desk.done].map(p => p.id));
}

function find(desk, id, where = ['pending', 'done']) {
  for (const place of where) {
    const paper = desk[place].find(p => p.id === id && !p.broken);
    if (paper) return { paper, place };
  }
  throw new Error('找不到这篇论文，可能刚被别人处理了，请刷新');
}

const json = value => JSON.stringify(value, null, 2) + '\n';
// Decision times are written in Beijing time, like the rest of the site's dates.
const now = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date());

/** Apply the reviewer's choices from the card to the paper. */
export function applyChoice(paper, choice = {}) {
  const next = structuredClone(paper);
  if (Array.isArray(choice.topics)) next.topics = choice.topics.filter(t => Object.hasOwn(TOPICS, t));
  if (Object.hasOwn(PRIORITIES, choice.priority)) next.reading_priority = choice.priority;
  if (choice.finding === 'A' || choice.finding === 'B') next.finding = choice.finding;
  if (typeof choice.featured === 'boolean') next.featured = choice.featured;
  const edits = choice.edits || {};
  if (typeof edits.evidence_type === 'string' && edits.evidence_type.trim()) next.evidence_type = edits.evidence_type.trim().slice(0, 80);
  for (const key of ['phd_relevance', 'reading_recommendation', 'limitations']) {
    if (typeof edits[key] === 'string' && edits[key].trim()) next[key] = { ...next[key], en: edits[key].trim().slice(0, 1200) };
  }
  for (const [i, key] of [[0, 'finding_a'], [1, 'finding_b']]) {
    if (typeof edits[key] === 'string' && edits[key].trim() && next.findings[i]) next.findings[i] = { ...next.findings[i], en: edits[key].trim().slice(0, 800) };
  }
  return next;
}

function move(paper, from, to) {
  return { additions: [{ path: `${to}/${paper.id}.md`, contents: serializeReview(paper) }], deletions: from === to ? [] : [`${from}/${paper.id}.md`] };
}

export async function approve(env, { id, choice, by, reason }) {
  const today = shanghaiDate();
  return transact(env, WANTED, snapshot => {
    const desk = deskFrom(snapshot);
    const { paper } = find(desk, id, ['pending']);
    const next = { ...applyChoice(paper, choice), status: 'approved', decision: { by, at: now(), reason: reason || '' } };
    if (!next.topics.length) throw new Error('至少选一个主题');
    const catalogText = addToCatalog(desk.catalogText, catalogEntry(next, today), today);
    const moved = move(next, PENDING_DIR, DONE_DIR);
    return {
      headline: `Literature: add ${next.id}`,
      body: `Approved by ${by} on preview.phylab.uk.${reason ? `\nReason: ${reason}` : ''}`,
      additions: [...moved.additions, ...(catalogText ? [{ path: CATALOG_PATH, contents: catalogText }] : [])],
      deletions: moved.deletions,
      result: { id: next.id },
    };
  });
}

export async function reject(env, { id, by, reason }) {
  return transact(env, WANTED, snapshot => {
    const desk = deskFrom(snapshot);
    const { paper } = find(desk, id, ['pending']);
    const next = { ...paper, status: 'rejected', decision: { by, at: now(), reason: reason || '' } };
    return { headline: `Literature review: reject ${id}`, body: `Rejected by ${by}${reason ? `: ${reason}` : ''}.`, ...move(next, PENDING_DIR, DONE_DIR), result: { id } };
  });
}

/** Undo a decision: the paper goes back to pending (and leaves the catalogue if it was published). */
export async function restore(env, { id, by }) {
  const today = shanghaiDate();
  return transact(env, WANTED, snapshot => {
    const desk = deskFrom(snapshot);
    const { paper } = find(desk, id, ['done']);
    const next = { ...paper, status: 'pending', decision: null };
    const catalogText = paper.status === 'approved' ? removeFromCatalog(desk.catalogText, [id], today) : null;
    const moved = move(next, DONE_DIR, PENDING_DIR);
    return {
      headline: paper.status === 'approved' ? `Literature: withdraw ${id}` : `Literature review: reopen ${id}`,
      body: `Reopened by ${by} on preview.phylab.uk.`,
      additions: [...moved.additions, ...(catalogText ? [{ path: CATALOG_PATH, contents: catalogText }] : [])],
      deletions: moved.deletions,
      result: { id },
    };
  });
}

export async function addNote(env, { id, by, text }) {
  return transact(env, WANTED, snapshot => {
    const desk = deskFrom(snapshot);
    const { paper, place } = find(desk, id);
    const dir = place === 'pending' ? PENDING_DIR : DONE_DIR;
    const next = { ...paper, notes: [...paper.notes, { by, at: now(), text }] };
    return { headline: `Literature review: note on ${id}`, body: `Note by ${by}.`, ...move(next, dir, dir), result: { id } };
  });
}

export async function setFeatured(env, { id, by, on }) {
  const today = shanghaiDate();
  return transact(env, WANTED, snapshot => {
    const desk = deskFrom(snapshot);
    const { paper } = find(desk, id, ['done']);
    if (paper.status !== 'approved') throw new Error('只有已收录的论文可以置顶');
    const catalog = JSON.parse(desk.catalogText);
    const entry = catalog.papers.find(p => p.id === id);
    if (!entry) throw new Error('这篇论文已经不在公开站上');
    entry.featured = Boolean(on);
    catalog.updated_at = today > catalog.updated_at ? today : catalog.updated_at;
    const next = { ...paper, featured: Boolean(on) };
    return {
      headline: `Literature: ${on ? 'feature' : 'unfeature'} ${id}`, body: `Changed by ${by} on preview.phylab.uk.`,
      additions: [{ path: CATALOG_PATH, contents: json(catalog) }, ...move(next, DONE_DIR, DONE_DIR).additions],
      result: { id },
    };
  });
}

export async function expire(env, { remove = [], keep = [], by }) {
  const today = shanghaiDate();
  return transact(env, WANTED, snapshot => {
    const desk = deskFrom(snapshot);
    const additions = [];
    if (keep.length) additions.push({ path: KEPT_PATH, contents: json([...new Set([...desk.kept, ...keep])].sort()) });
    if (remove.length) {
      const text = removeFromCatalog(desk.catalogText, remove, today);
      if (text) additions.push({ path: CATALOG_PATH, contents: text });
    }
    return {
      headline: remove.length ? `Literature: remove ${remove.length} paper(s) older than two years` : 'Literature review: keep older papers',
      body: `By ${by} on preview.phylab.uk.${remove.length ? `\nRemoved: ${remove.join(', ')}` : ''}${keep.length ? `\nKept: ${keep.join(', ')}` : ''}`,
      additions,
    };
  });
}

export async function saveProfile(env, { profile, by }) {
  return transact(env, { folders: [], files: [PROFILE_PATH] }, snapshot => {
    const text = json(profile);
    if (snapshot.files[PROFILE_PATH] === text) return null;
    return { headline: 'Literature review: update interest profile', body: `By ${by} on preview.phylab.uk.`, additions: [{ path: PROFILE_PATH, contents: text }] };
  });
}

/** Desk as sent to the browser. */
export function publicDesk(desk, today = shanghaiDate()) {
  const live = new Set(desk.catalog.papers.map(p => p.id));
  const byNewest = (a, b) => (b.decision?.at || b.added || '').localeCompare(a.decision?.at || a.added || '');
  return {
    pending: desk.pending.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.added || '').localeCompare(a.added || '')),
    done: desk.done.sort(byNewest).slice(0, 80).map(p => ({ ...p, live: live.has(p.id) })),
    expired: expiredEntries(desk.catalog, today, new Set(desk.kept)),
    profile: desk.profile,
    topics: TOPICS,
    priorities: PRIORITIES,
    published: desk.catalog.papers.length,
  };
}
