import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { resolvePath, cleanProfile } from '../src/index.js';
import { parseApsFeed, fromCrossref, usable, invertedToText, collectionPlan, DEFAULT_PROFILE } from '../src/collect.js';
import { buildEntry, addToCatalog, removeFromCatalog, expiredEntries, makeId } from '../src/literature.js';
import { parseScreen, parseDraft, screenPrompt } from '../src/ai.js';
import { validateCatalog } from '../../../literature/core.mjs';
import { validBranch } from '../src/github.js';

const catalogText = await readFile(new URL('../../../literature/data/papers.json', import.meta.url), 'utf8');

const meta = {
  doi: '10.1103/physrevphyseducres.22.020999', title: 'AI feedback and independent transfer in high-school mechanics labs',
  authors: ['Ada Lovelace', 'Grace Hopper'], year: 2026, published_date: '2026-10-02',
  source: 'Physical Review Physics Education Research', url: 'https://doi.org/10.1103/physrevphyseducres.22.020999', abstract: 'We studied...',
};
const draft = parseDraft({
  topics: ['ai', 'transfer', 'not-a-topic'], evidence_type: 'Quasi-experiment', reading_priority: 'core',
  findings: [{ en: 'Students given AI feedback scored higher on the lab task.', zh: '得到 AI 反馈的学生实验任务得分更高。' },
    { en: 'In a quasi-experiment with two classes, AI feedback improved lab scores but not later independent transfer.', zh: '两个班的准实验…' }],
  phd_relevance_en: 'Use this study to separate supported performance from independent transfer.',
  reading_recommendation_en: 'Read the design and the transfer test sections.',
  limitations_en: 'Two intact classes and a short follow-up limit the claims about transfer.',
  summary_zh: '一项准实验。',
});

test('directory URLs and unsafe paths', () => {
  assert.deepEqual(resolvePath('/'), { file: 'index.html' });
  assert.deepEqual(resolvePath('/literature/'), { file: 'literature/index.html' });
  assert.deepEqual(resolvePath('/literature'), { redirect: '/literature/' });
  assert.deepEqual(resolvePath('/assets/theme.css'), { file: 'assets/theme.css' });
  assert.deepEqual(resolvePath('/research/Click_or_Calculate.pdf'), { file: 'research/Click_or_Calculate.pdf' });
  assert.ok(resolvePath('/../secret').error);
  assert.ok(resolvePath('/%2e%2e/x').error);
  assert.ok(resolvePath('/.git/config').error);
});

test('branch names', () => {
  assert.ok(validBranch('main'));
  assert.ok(validBranch('pendulum-mark'));
  assert.ok(validBranch('feature/new-lab'));
  assert.ok(!validBranch('../main'));
  assert.ok(!validBranch('a b'));
  assert.ok(!validBranch(undefined));
});

test('APS RSS parsing', () => {
  const xml = `<rdf:RDF><item rdf:about="x"><title>Students&apos; reasoning in &lt;i&gt;labs&lt;/i&gt;</title>
    <description>&lt;p&gt;We report a study.&lt;/p&gt;</description><dc:creator>A. One, B. Two, and C. Three</dc:creator>
    <prism:publicationName>Physical Review Physics Education Research</prism:publicationName>
    <prism:doi>10.1103/abc.1</prism:doi><prism:publicationDate>2026-10-05</prism:publicationDate></item></rdf:RDF>`;
  const [r] = parseApsFeed(xml);
  assert.equal(r.title, "Students' reasoning in labs");
  assert.deepEqual(r.authors, ['A. One', 'B. Two', 'C. Three']);
  assert.equal(r.doi, '10.1103/abc.1');
  assert.equal(r.published_date, '2026-10-05');
  assert.equal(r.abstract, 'We report a study.');
  assert.throws(() => parseApsFeed('<rss></rss>'));
});

test('Crossref mapping and filters', () => {
  const r = fromCrossref({ DOI: '10.1088/1361-6552/AB12', title: ['Low-cost <i>pendulum</i>'], author: [{ given: 'Li', family: 'Wang' }],
    'container-title': ['Physics Education'], 'published-online': { 'date-parts': [[2026, 9, 20]] }, abstract: '<jats:p>Text</jats:p>' });
  assert.equal(r.doi, '10.1088/1361-6552/ab12');
  assert.equal(r.title, 'Low-cost pendulum');
  assert.equal(r.abstract, 'Text');
  assert.ok(usable(r, '2026-09-01', '2026-10-16'));
  assert.ok(!usable({ ...r, published_date: '2026-08-01' }, '2026-09-01', '2026-10-16'));
  assert.ok(!usable({ ...r, title: 'Erratum: something' }, '2026-09-01', '2026-10-16'));
  assert.equal(invertedToText({ world: [1], Hello: [0] }), 'Hello world');
  const plan = collectionPlan(DEFAULT_PROFILE);
  assert.equal(plan[0].kind, 'aps');
  assert.ok(plan.length < 30, 'one collection fits in a single 30-request cron run');
});

test('AI replies are checked', () => {
  const scores = parseScreen({ results: [{ i: 0, score: 5, reason_zh: '好' }, { i: 7, score: 4 }, { i: 1, score: 9 }] }, 2);
  assert.deepEqual([...scores.keys()], [0]);
  assert.deepEqual(draft.topics, ['ai', 'transfer']);
  assert.throws(() => parseDraft({ findings: [{ en: '中文' }, { en: 'x' }] }));
  const { system } = screenPrompt(DEFAULT_PROFILE, { rejected: [{ title: 'Off topic', reason: '离题' }], approved: ['Good one'] }, [meta]);
  assert.match(system, /REJECTED[\s\S]*Off topic/);
});

test('approved entry passes the site catalogue check', () => {
  const entry = buildEntry(meta, draft, { topics: ['ai', 'transfer'], priority: 'read', finding: 'b', featured: true }, makeId(meta), '2026-10-16');
  assert.equal(entry.key_finding_en, draft.findings[1].en);
  assert.equal(entry.reading_priority, 'read');
  assert.equal(entry.featured, true);
  const next = addToCatalog(catalogText, entry, '2026-10-16');
  const catalog = JSON.parse(next);
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.updated_at, '2026-10-16');
  assert.equal(catalog.papers.at(-1).id, entry.id);
  assert.ok(next.endsWith('}\n'));
  assert.equal(addToCatalog(next, entry, '2026-10-16'), null, 'same DOI is not added twice');
  const back = JSON.parse(removeFromCatalog(next, [entry.id], '2026-10-16'));
  assert.equal(back.papers.length, JSON.parse(catalogText).papers.length);
  assert.equal(removeFromCatalog(catalogText, ['no-such-id'], '2026-10-16'), null);
});

test('an invalid entry is never written', () => {
  const entry = buildEntry({ ...meta, url: 'http://insecure.example' }, draft, {}, 'x-1', '2026-10-16');
  assert.throws(() => addToCatalog(catalogText, entry, '2026-10-16'), /url must be HTTPS/);
});

test('papers older than two years', () => {
  const catalog = { papers: [
    { id: 'old', title: 'Old', source: 'J', published_date: '2024-10-01', year: 2024, reading_priority: 'core' },
    { id: 'new', title: 'New', source: 'J', published_date: '2025-01-01', year: 2025 },
    { id: 'year-only', title: 'Y', source: 'J', published_date: null, year: 2023 },
  ] };
  assert.deepEqual(expiredEntries(catalog, '2026-10-16').map(p => p.id), ['old', 'year-only']);
  assert.deepEqual(expiredEntries(catalog, '2026-10-16', new Set(['old'])).map(p => p.id), ['year-only']);
});

test('profile is sanitised', () => {
  const p = cleanProfile({ topics: ['ai', 'bogus'], keywords: [' a ', 'a', ''], journals: [{ issn: '0031-9120', on: 1 }, { issn: 'nope' }], threshold: 9 });
  assert.deepEqual(p.topics, ['ai']);
  assert.deepEqual(p.keywords, ['a']);
  assert.equal(p.journals.length, 1);
  assert.equal(p.journals[0].name, 'Physics Education');
  assert.equal(p.threshold, 4);
});

test('the site is invisible without the secret link', async () => {
  const env = { PREVIEW_KEY: 'k3y-for-tests' };
  const ctx = { waitUntil() {} };
  const miss = await worker.fetch(new Request('https://preview.phylab.uk/review'), env, ctx);
  assert.equal(miss.status, 404);
  const wrong = await worker.fetch(new Request('https://preview.phylab.uk/k/guess'), env, ctx);
  assert.equal(wrong.status, 404);
  const enter = await worker.fetch(new Request('https://preview.phylab.uk/k/k3y-for-tests'), env, ctx);
  assert.equal(enter.status, 302);
  const cookie = enter.headers.get('Set-Cookie');
  assert.match(cookie, /HttpOnly/);
  const page = await worker.fetch(new Request('https://preview.phylab.uk/review', { headers: { Cookie: cookie.split(';')[0] } }), env, ctx);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /审核台/);
  const robots = await worker.fetch(new Request('https://preview.phylab.uk/robots.txt'), env, ctx);
  assert.match(await robots.text(), /Disallow: \//);
  const crossSite = await worker.fetch(new Request('https://preview.phylab.uk/api/work', { method: 'POST', headers: { Cookie: cookie.split(';')[0], Origin: 'https://evil.example' } }), env, ctx);
  assert.equal(crossSite.status, 403);
});
