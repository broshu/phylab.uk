// Sets one cache-busting tag (?v=YYYYMMDD-N) on every local import and asset in this lab.
// Run after editing any file: `npm run bump`. tests/versions.test.mjs checks the result.
import {readFileSync, writeFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['index.html', ...readdirSync(root).filter(f => f.endsWith('.js')), ...readdirSync(join(root, 'tests')).map(f => join('tests', f))];
const TAG = /\?v=(\d{8})-(\d+)/g;
const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
let highest = 0;
for (const f of files) for (const [, day, n] of readFileSync(join(root, f), 'utf8').matchAll(TAG)) if (day === today) highest = Math.max(highest, Number(n));
const next = `?v=${today}-${highest + 1}`;
for (const f of files) {
  const path = join(root, f), text = readFileSync(path, 'utf8'), out = text.replace(TAG, next);
  if (out !== text) writeFileSync(path, out);
}
console.log(`version ${next.slice(3)}`);
