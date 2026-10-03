import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../core.mjs';

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
if (!input) throw new Error('Usage: node literature/scripts/add.mjs reviewed-papers.json [--dry-run]');
const incoming = JSON.parse(await readFile(resolve(input), 'utf8'));
const entries = Array.isArray(incoming) ? incoming : [incoming];
if (entries.some(p => p.status !== 'published')) throw new Error('Only reviewed entries with status published may be added. Fill all Chinese notes and verify the original source first.');
const path = fileURLToPath(new URL('../data/papers.json', import.meta.url));
const catalog = JSON.parse(await readFile(path, 'utf8'));
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const next = { ...catalog, updated_at: today, papers: [...catalog.papers, ...entries] };
const errors = validateCatalog(next);
if (errors.length) throw new Error(errors.join('\n'));
if (args.includes('--dry-run')) console.log(`Validated ${entries.length} new entries. No files changed.`);
else {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, path);
  console.log(`Added ${entries.length} entries to ${path}. Run the build check and review the diff before publishing.`);
}
