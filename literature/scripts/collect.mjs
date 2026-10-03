import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crossref, draftFromMetadata, metadataDate } from './crossref.mjs';
import { normalizeDOI } from '../core.mjs';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const from = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
// Candidates only: Crossref may lag publisher sites and relevance requires manual screening.
const searches = [
  'physics education hands-on laboratory learning', 'physics education simulation transfer',
  'physics teaching artificial intelligence scaffolding', 'physics measurement assessment',
  'physics education ICAP scaffolding'
];
const catalog = JSON.parse(await readFile(new URL('../data/papers.json', import.meta.url), 'utf8'));
const known = new Set(catalog.papers.map(p => normalizeDOI(p.doi)).filter(Boolean));
const candidates = new Map();
const warnings = [], successfulSources = new Set();
function addCandidate(item, query) {
  const doi = normalizeDOI(item.DOI);
  if (!doi || known.has(doi)) return;
  const publication = metadataDate(item);
  if (!publication.year || publication.year > Number(today.slice(0, 4)) || (publication.date && (publication.date > today || publication.date < from))) return;
  if (!candidates.has(doi)) candidates.set(doi, { paper: draftFromMetadata(item, today), matched_queries: [] });
  candidates.get(doi).matched_queries.push(query);
}
// APS still uses its historical journal slug prstper for the official RSS feed.
try {
  const response = await fetch('https://feeds.aps.org/rss/recent/prstper.xml', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`APS RSS ${response.status}`);
  const parsed = spawnSync('python3', [fileURLToPath(new URL('./parse-aps-feed.py', import.meta.url))], {
    input: await response.text(), encoding: 'utf8', timeout: 5000, maxBuffer: 4 * 1024 * 1024
  });
  if (parsed.status !== 0) throw new Error(parsed.error?.message || parsed.stderr || 'Could not parse APS feed');
  for (const item of JSON.parse(parsed.stdout)) {
    if (/laborator|\blabs?\b|simulat|artificial intelligence|\bAI\b|chatbot|scaffold|transfer|assessment|measurement|reasoning|cognitive/i.test(item.title?.[0] || '')) addCandidate(item, 'PRPER official RSS');
  }
  successfulSources.add('PRPER official RSS');
} catch (error) { warnings.push(error.message); }
for (const query of searches) {
  try {
    const data = await crossref('works', { 'query.bibliographic': query, rows: '15',
      filter: `from-pub-date:${from},until-pub-date:${today},type:journal-article`, sort: 'published', order: 'desc' });
    successfulSources.add('Crossref');
    for (const item of data.items || []) {
      const searchable = `${item.title?.[0] || ''} ${(item['container-title'] || []).join(' ')} ${item.abstract || ''}`;
      if (/physics|physical science/i.test(searchable)) addCandidate(item, query);
    }
  } catch (error) {
    warnings.push(`${query}: ${error.message}`);
    // After bounded retries, leave this service alone; retain working RSS results.
    break;
  }
}
if (!successfulSources.size) throw new Error(`All candidate sources failed: ${warnings.join('; ')}`);
const output = resolve(process.argv[2] || `work/literature-candidates-${today}.json`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ collected_at: today, from_date: from, sources: [...successfulSources], warnings,
  note: 'Unreviewed candidates. Check publisher metadata, methods and findings before adding. This file does not publish anything.',
  candidates: [...candidates.values()] }, null, 2) + '\n', { flag: 'wx' });
console.log(`Saved ${candidates.size} unreviewed candidates to ${output}. Published catalogue unchanged.`);
for (const warning of warnings) console.warn(`Partial source warning: ${warning}`);
