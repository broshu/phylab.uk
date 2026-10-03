import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../core.mjs';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('../data/papers.json', import.meta.url), 'utf8'));
const errors = validateCatalog(catalog);
// These are the assets that GitHub Pages will publish directly; there is no bundler.
for (const path of ['index.html', 'literature/index.html', 'literature/library/index.html']) {
  const html = await readFile(new URL(path, root), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="(\/literature\/[^"?#]+|\/assets\/[^\"?#]+)"/g)) {
    if (match[1].endsWith('/')) continue;
    try { await readFile(new URL(match[1].slice(1), root)); }
    catch { errors.push(`${path}: missing asset ${match[1]}`); }
  }
  if (!html.includes('href="/literature/"')) errors.push(`${path}: Literature navigation missing`);
}
for (const path of ['literature/app.mjs', 'literature/core.mjs']) {
  const source = await readFile(new URL(path, root), 'utf8');
  for (const match of source.matchAll(/from ['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('.')) {
      try { await readFile(new URL(match[1], new URL(path, root))); }
      catch { errors.push(`${path}: missing module ${match[1]}`); }
    }
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Static build check passed: ${catalog.papers.length} valid entries; home, /literature/, /literature/library/ and all literature assets ready for GitHub Pages (${fileURLToPath(root)}).`);
