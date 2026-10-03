import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TOPICS, filterPapers, latestPicks, validateCatalog, validDate } from '../core.mjs';
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
  const newer = { ...catalog.papers[0], id: 'new-paper', date_added: '2026-10-04' };
  assert.equal(latestPicks([...catalog.papers, newer])[0].id, 'new-paper');
  assert.equal(latestPicks(catalog.papers).length, 6);
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
