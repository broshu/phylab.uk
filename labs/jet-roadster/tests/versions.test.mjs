// Browsers cache each module by its full URL. If one file is fetched fresh and another comes
// from cache, the page mixes versions and breaks. Every local reference carries the same tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pageFiles = ['index.html', ...readdirSync(root).filter(f => f.endsWith('.js'))];
const read = f => readFileSync(join(root, f), 'utf8');

test('every local script, module and stylesheet reference carries a ?v= tag', () => {
  const untagged = [];
  for (const f of pageFiles) {
    const text = read(f);
    for (const [, ref] of text.matchAll(/(?:from\s+|import\(\s*|src=|href=)['"](\.\/[^'"]+?\.(?:js|css)(?:\?[^'"]*)?)['"]/g))
      if (!ref.startsWith('./vendor/') && !/\?v=\d{8}-\d+$/.test(ref)) untagged.push(`${f}: ${ref}`);
  }
  assert.deepEqual(untagged, []);
});
test('all tags are the same version (run `npm run bump` after editing)', () => {
  const tags = new Set();
  for (const f of [...pageFiles, ...readdirSync(join(root, 'tests')).map(t => join('tests', t))])
    for (const [tag] of read(f).matchAll(/\?v=\d{8}-\d+/g)) tags.add(tag);
  assert.equal(tags.size, 1, [...tags].join(', '));
});
