import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOPICS, filterPapers, latestAdditions, latestPicks, validateCatalog, validDate } from '../core.mjs';
import { draftFromMetadata } from '../scripts/crossref.mjs';

const catalog = JSON.parse(await readFile(new URL('../data/papers.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(catalog);
test('published catalogue validates and covers all requested themes', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  for (const topic of Object.keys(TOPICS)) assert.ok(catalog.papers.some(p => p.topics.includes(topic)), topic);
});
test('multiple tags use intersection and combine with priority', () => {
  const papers = filterPapers(catalog.papers, { topics: ['simulation', 'hands-on'], priority: 'core' });
  assert.deepEqual(new Set(papers.map(p => p.id)), new Set(['ben-zion-2026-ai-simulation', 'finkelstein-2005-simulation-transfer']));
  assert.equal(filterPapers(catalog.papers, { topics: ['icap', 'simulation'] }).length, 0);
});
test('Chinese notes, authors, DOI and case-insensitive English tags are searchable', () => {
  assert.ok(filterPapers(catalog.papers, { query: '独立迁移' }).length > 0);
  assert.equal(filterPapers(catalog.papers, { query: '10.1103/nvf1-zrq8' })[0].id, 'becker-2026-ai-scaffolding');
  assert.equal(filterPapers(catalog.papers, { query: 'CHI ICAP' })[0].id, 'chi-2014-icap');
});
test('drafts remain hidden, latest picks are date ordered, new recommendations can replace old ones', () => {
  const draft = { ...catalog.papers[0], id: 'draft', status: 'draft' };
  assert.equal(filterPapers([draft]).length, 0);
  const newer = { ...catalog.papers[0], id: 'new-paper', date_added: '2099-12-31' };
  assert.equal(latestPicks([...catalog.papers, newer])[0].id, 'new-paper');
  assert.equal(latestPicks(catalog.papers).length, 6);
});
test('latest additions order by addition date, publication date or year, then title', () => {
  const base = catalog.papers[0];
  const papers = [
    { ...base, id: 'old-featured', title: 'Old featured paper', date_added: '2026-10-01', published_date: '2026-10-01', featured: true },
    { ...base, id: 'beta', title: 'Beta', date_added: '2026-10-03', published_date: '2026-10-01', featured: true },
    { ...base, id: 'year-only', title: 'Year only', date_added: '2026-10-03', year: 2025, published_date: null },
    { ...base, id: 'skim', title: 'Background paper', date_added: '2026-10-03', published_date: '2026-09-30', reading_priority: 'skim' },
    { ...base, id: 'alpha', title: 'Alpha', date_added: '2026-10-03', published_date: '2026-10-01', featured: false },
    { ...base, id: 'newest-publication', title: 'Newest publication', date_added: '2026-10-03', published_date: '2026-10-02' },
    { ...base, id: 'draft', status: 'draft', date_added: '2026-10-04', published_date: '2026-10-04' }
  ];
  assert.deepEqual(latestAdditions(papers).map(p => p.id), [
    'newest-publication', 'alpha', 'beta', 'skim', 'year-only', 'old-featured'
  ]);
  assert.deepEqual(latestAdditions(papers, 2).map(p => p.id), ['newest-publication', 'alpha']);
});
test('latest additions cap at ten without deleting papers from the complete library', () => {
  const papers = Array.from({ length: 11 }, (_, index) => ({
    ...catalog.papers[0], id: `paper-${index}`, date_added: `2026-09-${String(index + 1).padStart(2, '0')}`,
    reading_priority: index === 10 ? 'skim' : 'core'
  }));
  const before = structuredClone(papers);
  assert.deepEqual(latestAdditions(papers).map(p => p.id), [
    'paper-10', 'paper-9', 'paper-8', 'paper-7', 'paper-6',
    'paper-5', 'paper-4', 'paper-3', 'paper-2', 'paper-1'
  ]);
  assert.equal(filterPapers(papers).length, 11);
  assert.ok(filterPapers(papers).some(p => p.id === 'paper-0'));
  assert.deepEqual(papers, before);
});
test('the full catalogue remains accessible after selecting latest additions', () => {
  const before = structuredClone(catalog);
  latestAdditions(catalog.papers);
  const published = catalog.papers.filter(p => p.status === 'published');
  assert.deepEqual(new Set(filterPapers(catalog.papers).map(p => p.id)), new Set(published.map(p => p.id)));
  assert.deepEqual(catalog, before);
});
test('validation rejects duplicates, broken links, missing English notes and impossible dates', () => {
  const duplicate = clone(); duplicate.papers.push(duplicate.papers[0]);
  assert.ok(validateCatalog(duplicate).some(e => e.includes('duplicate DOI')));
  const broken = clone(); broken.papers[0].url = 'javascript:alert(1)'; broken.papers[0].key_finding_en = '';
  assert.ok(validateCatalog(broken).some(e => e.includes('HTTPS')));
  assert.ok(validateCatalog(broken).some(e => e.includes('key_finding_en')));
  assert.equal(validDate('2026-02-30'), false);
});
test('partial Crossref dates are not fabricated and generated metadata stays draft', () => {
  const draft = draftFromMetadata({ DOI: '10.1234/TEST', title: ['Paper'], author: [{ given: 'A', family: 'Author' }], published: { 'date-parts': [[2026, 9]] } }, '2026-10-03');
  assert.equal(draft.published_date, null);
  assert.equal(draft.year, 2026);
  assert.equal(draft.status, 'draft');
  assert.equal(draft.key_finding_en, '');
});
