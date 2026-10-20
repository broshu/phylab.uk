import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { resolvePath, cleanProfile } from '../src/index.js';
import { addToCatalog, removeFromCatalog, expiredEntries } from '../src/literature.js';
import { parseReview, serializeReview, catalogEntry, PENDING_DIR, DONE_DIR } from '../src/reviewfile.js';
import { approve, reject, restore, addNote, setFeatured, expire, loadDesk, publicDesk } from '../src/store.js';
import { recentCommits } from '../src/github.js';
import { validateCatalog } from '../../../literature/core.mjs';
import { validBranch } from '../src/github.js';
import { fakeGitHub } from './fake-github.mjs';

const root = new URL('../../../', import.meta.url);
const catalogText = await readFile(new URL('literature/data/papers.json', root), 'utf8');
const template = await readFile(new URL('literature/review/TEMPLATE.md', root), 'utf8');

const paper = {
  id: 'lovelace-2026-feedback-independent-transfer', status: 'pending',
  title: 'AI feedback and independent transfer in high-school mechanics labs', authors: ['Ada Lovelace', 'Grace Hopper'],
  year: 2026, published_date: '2026-10-02', source: 'Physical Review Physics Education Research',
  doi: '10.1103/physrevphyseducres.22.020999', url: 'https://doi.org/10.1103/physrevphyseducres.22.020999',
  added: '2026-10-16', proposed_by: 'ChatGPT', score: 5, topics: ['ai', 'transfer'], reading_priority: 'core',
  evidence_type: 'Quasi-experiment', featured: false, finding: 'A', decision: null, notes: [],
  why: '紧扣 AI 与迁移。', summary: '一项准实验。',
  findings: [{ en: 'Students given AI feedback scored higher on the lab task.', zh: '得到 AI 反馈的学生实验得分更高。' },
    { en: 'In a quasi-experiment with two classes, AI feedback improved lab scores but not later independent transfer.', zh: '两个班的准实验。' }],
  phd_relevance: { en: 'Use this study to separate supported performance from independent transfer.', zh: '区分支持下表现与独立迁移。' },
  reading_recommendation: { en: 'Read the design and the transfer test sections.', zh: '' },
  limitations: { en: 'Two intact classes and a short follow-up limit the claims about transfer.', zh: '' },
  abstract: { en: 'We studied two classes.', zh: '我们研究了两个班级。' },
};
const env = { GITHUB_TOKEN: 't', GITHUB_REPO: 'broshu/phylab.uk', GITHUB_BRANCH: 'main' };

test('review files round-trip', () => {
  const text = serializeReview(paper);
  assert.match(text, /^---\nid: lovelace-2026-feedback-independent-transfer\nstatus: pending\n/);
  assert.match(text, /## Key finding B\n\nIn a quasi-experiment[^\n]+\n\n> 两个班的准实验。/);
  const back = parseReview(text, `${PENDING_DIR}/x.md`);
  for (const key of ['id', 'status', 'title', 'authors', 'year', 'published_date', 'doi', 'topics', 'reading_priority', 'score', 'why', 'summary', 'findings', 'phd_relevance', 'limitations', 'abstract']) {
    assert.deepEqual(back[key], paper[key], key);
  }
  assert.equal(serializeReview(back), text, 'stable when saved again');
});

test('the template is a valid review file', () => {
  const p = parseReview(template, 'TEMPLATE.md');
  assert.equal(p.findings.length, 2);
  assert.equal(p.findings[0].zh, '中文翻译。');
  assert.deepEqual(p.topics, ['ai', 'hands-on']);
  assert.ok(p.abstract.en);
  assert.ok(p.abstract.zh, 'template shows the Chinese abstract translation');
});

test('hand-written files are read tolerantly', () => {
  const p = parseReview('---\ntitle: A paper\nauthors: Ann Lee, Bo Chen\ndoi: https://doi.org/10.1/ABC\ntopics: [ai, nonsense]\n---\n## key finding a\nOnly English here.\n', `${PENDING_DIR}/some-paper.md`);
  assert.equal(p.id, 'some-paper');
  assert.deepEqual(p.authors, ['Ann Lee', 'Bo Chen']);
  assert.equal(p.doi, '10.1/abc');
  assert.deepEqual(p.topics, ['ai']);
  assert.equal(p.findings[0].en, 'Only English here.');
  assert.throws(() => parseReview('no front matter'));
});

test('catalogue entry passes the site check', () => {
  const entry = catalogEntry({ ...paper, finding: 'B', featured: true }, '2026-10-16');
  assert.equal(entry.key_finding_en, paper.findings[1].en);
  const next = JSON.parse(addToCatalog(catalogText, entry, '2026-10-16'));
  assert.deepEqual(validateCatalog(next), []);
  assert.throws(() => addToCatalog(catalogText, { ...entry, url: 'http://x' }, '2026-10-16'), /HTTPS/);
});

test('approve, note, feature, undo and reject are single commits', async () => {
  const gh = fakeGitHub({
    'literature/data/papers.json': catalogText,
    [`${PENDING_DIR}/${paper.id}.md`]: serializeReview(paper),
    [`${PENDING_DIR}/other-2026-paper.md`]: serializeReview({ ...paper, id: 'other-2026-paper', doi: '10.1/other' }),
  });
  gh.install();
  try {
    let desk = publicDesk(await loadDesk(env));
    assert.equal(desk.pending.length, 2);

    await addNote(env, { id: paper.id, text: '方法部分值得看' });
    gh.bump(); // someone else pushed meanwhile: the next write must retry on the new head
    await approve(env, { id: paper.id, reason: '紧扣研究', choice: { topics: ['ai'], priority: 'core', finding: 'B', featured: false,
      edits: { limitations: 'Edited limitation text for the catalogue.' } } });
    const last = gh.commits.at(-1);
    assert.deepEqual(last.additions.sort(), [`${DONE_DIR}/${paper.id}.md`, 'literature/data/papers.json'].sort());
    assert.deepEqual(last.deletions, [`${PENDING_DIR}/${paper.id}.md`]);
    assert.match(last.message.body, /Approved on preview\.phylab\.uk/);
    const catalog = JSON.parse(gh.files.get('literature/data/papers.json'));
    const entry = catalog.papers.find(p => p.id === paper.id);
    assert.equal(entry.reading_priority, 'core');
    assert.equal(entry.limitations_en, 'Edited limitation text for the catalogue.');
    assert.deepEqual(validateCatalog(catalog), []);
    const done = parseReview(gh.files.get(`${DONE_DIR}/${paper.id}.md`));
    assert.equal(done.status, 'approved');
    assert.equal(done.decision.by, '', 'reviewers are not named');
    assert.doesNotMatch(gh.files.get(`${DONE_DIR}/${paper.id}.md`), /^\s*-?\s*by:/m, 'no reviewer names in the file');
    assert.equal(done.notes[0].text, '方法部分值得看');

    await setFeatured(env, { id: paper.id, on: true });
    assert.equal(JSON.parse(gh.files.get('literature/data/papers.json')).papers.find(p => p.id === paper.id).featured, true);

    await restore(env, { id: paper.id });
    assert.ok(gh.files.has(`${PENDING_DIR}/${paper.id}.md`));
    assert.ok(!JSON.parse(gh.files.get('literature/data/papers.json')).papers.some(p => p.id === paper.id));

    await reject(env, { id: 'other-2026-paper', reason: '离题' });
    desk = publicDesk(await loadDesk(env));
    assert.deepEqual(desk.pending.map(p => p.id), [paper.id]);
    assert.equal(desk.done[0].decision.reason, '离题');
    await assert.rejects(reject(env, { id: 'other-2026-paper' }), /找不到/);
  } finally { gh.restore(); }
});

test('expiry removes or keeps', async () => {
  const gh = fakeGitHub({ 'literature/data/papers.json': catalogText });
  gh.install();
  try {
    const first = JSON.parse(catalogText).papers[0].id;
    await expire(env, { remove: [first], keep: ['some-old-paper'] });
    assert.ok(!JSON.parse(gh.files.get('literature/data/papers.json')).papers.some(p => p.id === first));
    assert.deepEqual(JSON.parse(gh.files.get('literature/review/kept-old.json')), ['some-old-paper']);
  } finally { gh.restore(); }
});

test('directory URLs and unsafe paths', () => {
  assert.deepEqual(resolvePath('/site/'), { file: 'index.html' });
  assert.deepEqual(resolvePath('/site'), { redirect: '/site/' });
  assert.deepEqual(resolvePath('/literature/'), { file: 'literature/index.html' });
  assert.deepEqual(resolvePath('/literature'), { redirect: '/literature/' });
  assert.deepEqual(resolvePath('/assets/theme.css'), { file: 'assets/theme.css' });
  assert.ok(resolvePath('/../secret').error);
  assert.ok(resolvePath('/%2e%2e/x').error);
  assert.ok(resolvePath('/.git/config').error);
  assert.ok(validBranch('pendulum-mark') && validBranch('feature/x') && !validBranch('../main') && !validBranch(undefined));
});

test('papers older than two years', () => {
  const catalog = { papers: [
    { id: 'old', title: 'Old', source: 'J', published_date: '2024-10-01', year: 2024, reading_priority: 'core' },
    { id: 'new', title: 'New', source: 'J', published_date: '2025-01-01', year: 2025 },
    { id: 'year-only', title: 'Y', source: 'J', published_date: null, year: 2023 },
  ] };
  assert.deepEqual(expiredEntries(catalog, '2026-10-16').map(p => p.id), ['old', 'year-only']);
  assert.deepEqual(expiredEntries(catalog, '2026-10-16', new Set(['old'])).map(p => p.id), ['year-only']);
  assert.equal(removeFromCatalog(catalogText, ['no-such-id'], '2026-10-16'), null);
});

test('profile is sanitised', () => {
  const p = cleanProfile({ topics: ['ai', 'bogus'], keywords: [' a ', 'a', ''], journals: [{ issn: '0031-9120', on: 1 }, { issn: 'nope' }], threshold: 9 });
  assert.deepEqual(p.topics, ['ai']);
  assert.deepEqual(p.keywords, ['a']);
  assert.equal(p.journals[0].name, 'Physics Education');
  assert.equal(p.threshold, 4);
});

test('public desk, guarded writes', async () => {
  const ctx = { waitUntil() {} };
  const home = await worker.fetch(new Request('https://preview.phylab.uk/'), env, ctx);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /论文筛选/);
  const cross = await worker.fetch(new Request('https://preview.phylab.uk/api/reject', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' }), env, ctx);
  assert.equal(cross.status, 403);
  const bad = await worker.fetch(new Request('https://preview.phylab.uk/api/reject', { method: 'POST', headers: { Origin: 'https://preview.phylab.uk' }, body: JSON.stringify({ id: 'Not An Id' }) }), env, ctx);
  assert.equal(bad.status, 400, 'no name needed, but ids are still checked');
  const limited = await worker.fetch(new Request('https://preview.phylab.uk/api/reject', { method: 'POST', headers: { Origin: 'https://preview.phylab.uk' }, body: '{}' }),
    { ...env, WRITE_LIMIT: { limit: async () => ({ success: false }) } }, ctx);
  assert.equal(limited.status, 429);
});

test('a duplicate id is refused with a clear message', () => {
  const existing = JSON.parse(catalogText).papers[0].id;
  assert.throws(() => addToCatalog(catalogText, catalogEntry({ ...paper, id: existing, doi: '10.1/new' }, '2026-10-16'), '2026-10-16'), /换一个 id/);
});

test('activity comes from commits', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /commits\?sha=main&path=literature%2Freview&per_page=12/);
    return Response.json([{ html_url: 'https://github.com/x', author: { login: 'chatgpt-bot' }, commit: { message: 'Literature review: 3 new candidates\n\nFrom ChatGPT', author: { name: 'ChatGPT', date: '2026-10-16T08:00:00Z' }, committer: { date: '2026-10-16T08:00:01Z' } } }]);
  };
  try {
    const [c] = await recentCommits(env, 'literature/review');
    assert.equal(c.author, 'ChatGPT');
    assert.equal(c.message, 'Literature review: 3 new candidates');
    assert.equal(c.body, 'From ChatGPT');
  } finally { globalThis.fetch = realFetch; }
});
