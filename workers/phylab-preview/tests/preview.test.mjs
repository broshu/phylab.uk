import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { resolvePath, cleanProfile } from '../src/index.js';
import { parseApsFeed, fromCrossref, usable, invertedToText, collectionPlan, DEFAULT_PROFILE } from '../src/collect.js';
import { addToCatalog, removeFromCatalog, expiredEntries } from '../src/literature.js';
import { parseScreen, parseDraft, screenPrompt } from '../src/ai.js';
import { parseReview, serializeReview, paperFromDraft, catalogEntry, PENDING_DIR, DONE_DIR } from '../src/reviewfile.js';
import { approve, reject, restore, addNote, setFeatured, expire, loadDesk, publicDesk } from '../src/store.js';
import { validateCatalog } from '../../../literature/core.mjs';
import { validBranch } from '../src/github.js';
import { fakeGitHub } from './fake-github.mjs';

const root = new URL('../../../', import.meta.url);
const catalogText = await readFile(new URL('literature/data/papers.json', root), 'utf8');
const template = await readFile(new URL('literature/review/TEMPLATE.md', root), 'utf8');

const meta = {
  doi: '10.1103/physrevphyseducres.22.020999', title: 'AI feedback and independent transfer in high-school mechanics labs',
  authors: ['Ada Lovelace', 'Grace Hopper'], year: 2026, published_date: '2026-10-02',
  source: 'Physical Review Physics Education Research', url: 'https://doi.org/10.1103/physrevphyseducres.22.020999', abstract: 'We studied two classes.',
};
const draft = parseDraft({
  topics: ['ai', 'transfer', 'not-a-topic'], evidence_type: 'Quasi-experiment', reading_priority: 'core',
  findings: [{ en: 'Students given AI feedback scored higher on the lab task.', zh: '得到 AI 反馈的学生实验得分更高。' },
    { en: 'In a quasi-experiment with two classes, AI feedback improved lab scores but not later independent transfer.', zh: '两个班的准实验。' }],
  phd_relevance_en: 'Use this study to separate supported performance from independent transfer.', phd_relevance_zh: '区分支持下表现与独立迁移。',
  reading_recommendation_en: 'Read the design and the transfer test sections.',
  limitations_en: 'Two intact classes and a short follow-up limit the claims about transfer.',
  summary_zh: '一项准实验。',
});
const paper = paperFromDraft(meta, draft, { id: 'lovelace-2026-feedback-independent-transfer', added: '2026-10-16', proposed_by: 'DeepSeek (test)', score: 5, reason_zh: '紧扣 AI 与迁移。' });
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
  assert.ok(p.abstract);
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
  assert.equal(entry.key_finding_en, draft.findings[1].en);
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

    await addNote(env, { id: paper.id, by: '小王', text: '方法部分值得看' });
    gh.bump(); // someone else pushed meanwhile: the next write must retry on the new head
    await approve(env, { id: paper.id, by: 'Lango', reason: '紧扣研究', choice: { topics: ['ai'], priority: 'core', finding: 'B', featured: false,
      edits: { limitations: 'Edited limitation text for the catalogue.' } } });
    const last = gh.commits.at(-1);
    assert.deepEqual(last.additions.sort(), [`${DONE_DIR}/${paper.id}.md`, 'literature/data/papers.json'].sort());
    assert.deepEqual(last.deletions, [`${PENDING_DIR}/${paper.id}.md`]);
    assert.match(last.message.body, /Approved by Lango/);
    const catalog = JSON.parse(gh.files.get('literature/data/papers.json'));
    const entry = catalog.papers.find(p => p.id === paper.id);
    assert.equal(entry.reading_priority, 'core');
    assert.equal(entry.limitations_en, 'Edited limitation text for the catalogue.');
    assert.deepEqual(validateCatalog(catalog), []);
    const done = parseReview(gh.files.get(`${DONE_DIR}/${paper.id}.md`));
    assert.equal(done.status, 'approved');
    assert.equal(done.decision.by, 'Lango');
    assert.equal(done.notes[0].text, '方法部分值得看');

    await setFeatured(env, { id: paper.id, by: 'Lango', on: true });
    assert.equal(JSON.parse(gh.files.get('literature/data/papers.json')).papers.find(p => p.id === paper.id).featured, true);

    await restore(env, { id: paper.id, by: 'Lango' });
    assert.ok(gh.files.has(`${PENDING_DIR}/${paper.id}.md`));
    assert.ok(!JSON.parse(gh.files.get('literature/data/papers.json')).papers.some(p => p.id === paper.id));

    await reject(env, { id: 'other-2026-paper', by: '小王', reason: '离题' });
    desk = publicDesk(await loadDesk(env));
    assert.deepEqual(desk.pending.map(p => p.id), [paper.id]);
    assert.equal(desk.done[0].decision.reason, '离题');
    await assert.rejects(reject(env, { id: 'other-2026-paper', by: 'x' }), /找不到/);
  } finally { gh.restore(); }
});

test('expiry removes or keeps', async () => {
  const gh = fakeGitHub({ 'literature/data/papers.json': catalogText });
  gh.install();
  try {
    const first = JSON.parse(catalogText).papers[0].id;
    await expire(env, { remove: [first], keep: ['some-old-paper'], by: 'Lango' });
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

test('APS RSS parsing', () => {
  const xml = `<rdf:RDF><item rdf:about="x"><title>Students&apos; reasoning in &lt;i&gt;labs&lt;/i&gt;</title>
    <description>&lt;p&gt;We report a study.&lt;/p&gt;</description><dc:creator>A. One, B. Two, and C. Three</dc:creator>
    <prism:publicationName>Physical Review Physics Education Research</prism:publicationName>
    <prism:doi>10.1103/abc.1</prism:doi><prism:publicationDate>2026-10-05</prism:publicationDate></item></rdf:RDF>`;
  const [r] = parseApsFeed(xml);
  assert.equal(r.title, "Students' reasoning in labs");
  assert.deepEqual(r.authors, ['A. One', 'B. Two', 'C. Three']);
  assert.equal(r.abstract, 'We report a study.');
  assert.throws(() => parseApsFeed('<rss></rss>'));
});

test('Crossref mapping and filters', () => {
  const r = fromCrossref({ DOI: '10.1088/1361-6552/AB12', title: ['Low-cost <i>pendulum</i>'], author: [{ given: 'Li', family: 'Wang' }],
    'container-title': ['Physics Education'], 'published-online': { 'date-parts': [[2026, 9, 20]] }, abstract: '<jats:p>Text</jats:p>' });
  assert.equal(r.doi, '10.1088/1361-6552/ab12');
  assert.equal(r.title, 'Low-cost pendulum');
  assert.ok(usable(r, '2026-09-01', '2026-10-16'));
  assert.ok(!usable({ ...r, published_date: '2026-08-01' }, '2026-09-01', '2026-10-16'));
  assert.ok(!usable({ ...r, title: 'Erratum: something' }, '2026-09-01', '2026-10-16'));
  assert.equal(invertedToText({ world: [1], Hello: [0] }), 'Hello world');
  assert.ok(collectionPlan(DEFAULT_PROFILE).length < 28, 'one collection fits in a single cron run');
});

test('AI replies are checked', () => {
  const scores = parseScreen({ results: [{ i: 0, score: 5, reason_zh: '好' }, { i: 7, score: 4 }, { i: 1, score: 9 }] }, 2);
  assert.deepEqual([...scores.keys()], [0]);
  assert.deepEqual(draft.topics, ['ai', 'transfer']);
  assert.throws(() => parseDraft({ findings: [{ en: '中文' }, { en: 'x' }] }));
  const { system } = screenPrompt(DEFAULT_PROFILE, { rejected: [{ title: 'Off topic', reason: '离题' }], approved: ['Good one'] }, [meta]);
  assert.match(system, /REJECTED[\s\S]*Off topic/);
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
  const anon = await worker.fetch(new Request('https://preview.phylab.uk/api/reject', { method: 'POST', headers: { Origin: 'https://preview.phylab.uk' }, body: JSON.stringify({ id: 'x' }) }),
    { ...env, PREVIEW_DB: null }, ctx);
  assert.equal(anon.status, 400);
  assert.match((await anon.json()).error, /名字/);
  const limited = await worker.fetch(new Request('https://preview.phylab.uk/api/reject', { method: 'POST', headers: { Origin: 'https://preview.phylab.uk' }, body: '{}' }),
    { ...env, WRITE_LIMIT: { limit: async () => ({ success: false }) } }, ctx);
  assert.equal(limited.status, 429);
});
