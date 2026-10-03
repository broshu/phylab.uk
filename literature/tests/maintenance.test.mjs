import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('reviewed additions are atomic; drafts, duplicates and incomplete notes cannot overwrite the catalogue', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'phylab-literature-test-'));
  try {
    const source = fileURLToPath(new URL('../', import.meta.url));
    const copy = join(temporary, 'literature');
    await cp(source, copy, { recursive: true });
    const path = join(copy, 'data/papers.json');
    const original = await readFile(path, 'utf8');
    const catalog = JSON.parse(original);
    const paper = { ...catalog.papers[0], id: 'test-reviewed-entry', doi: '10.1234/phylab-test' };
    const incoming = join(temporary, 'incoming.json');
    const run = (...args) => spawnSync(process.execPath, [join(copy, 'scripts/add.mjs'), incoming, ...args], { encoding: 'utf8' });
    await writeFile(incoming, JSON.stringify(paper));
    assert.equal(run('--dry-run').status, 0);
    assert.equal(await readFile(path, 'utf8'), original);
    for (const invalid of [{ ...paper, status: 'draft' }, catalog.papers[0], { ...paper, key_finding_zh: '' }]) {
      await writeFile(incoming, JSON.stringify(invalid));
      assert.notEqual(run().status, 0);
      assert.equal(await readFile(path, 'utf8'), original);
    }
    await writeFile(incoming, JSON.stringify([paper]));
    assert.equal(run().status, 0);
    const updated = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(updated.papers.length, catalog.papers.length + 1);
    assert.equal(updated.papers.at(-1).id, paper.id);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
test('APS namespace metadata, XML entities and complete authors survive parsing; invalid XML fails', () => {
  const parser = fileURLToPath(new URL('../scripts/parse-aps-feed.py', import.meta.url));
  const xml = `<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/"><item><title>Physics &amp; AI</title><dc:creator>A. Author, B. Author, and C. Author</dc:creator><prism:doi>10.1234/example</prism:doi><prism:publicationName>PRPER</prism:publicationName><prism:publicationDate>2026-10-01T10:00:00+00:00</prism:publicationDate></item></rdf:RDF>`;
  const parsed = spawnSync('python3', [parser], { input: xml, encoding: 'utf8' });
  assert.equal(parsed.status, 0);
  const [item] = JSON.parse(parsed.stdout);
  assert.equal(item.title[0], 'Physics & AI');
  assert.deepEqual(item.author.map(a => a.name), ['A. Author', 'B. Author', 'C. Author']);
  assert.deepEqual(item.published['date-parts'], [[2026, 10, 1]]);
  assert.notEqual(spawnSync('python3', [parser], { input: '<invalid>', encoding: 'utf8' }).status, 0);
});
