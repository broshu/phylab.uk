// Turns a reviewed candidate into a catalogue entry and edits papers.json.
// Validation is the site's own validateCatalog, so the Worker can never
// publish something the literature build check would reject.
import { PRIORITIES, TOPICS, normalizeDOI, validateCatalog } from '../../../literature/core.mjs';

export const CATALOG_PATH = 'literature/data/papers.json';
export { TOPICS, PRIORITIES };

export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function serialize(catalog) {
  return JSON.stringify(catalog, null, 2) + '\n';
}
function check(catalog) {
  const errors = validateCatalog(catalog);
  if (errors.length) throw new Error(`Catalogue check failed: ${errors.join('; ')}`);
}

/** Returns new papers.json text with the entry added (or null if its DOI is already there). */
export function addToCatalog(text, entry, today) {
  const catalog = JSON.parse(text);
  if (entry.doi && catalog.papers.some(p => normalizeDOI(p.doi || '') === entry.doi)) return null;
  const ids = new Set(catalog.papers.map(p => p.id));
  if (ids.has(entry.id)) throw new Error(`网站上已经有 id 为 ${entry.id} 的论文，请换一个 id（文件名也要改）`);
  const next = { ...catalog, updated_at: today, papers: [...catalog.papers, entry] };
  check(next);
  return serialize(next);
}

/** Returns new papers.json text without the given ids (or null if none were present). */
export function removeFromCatalog(text, ids, today) {
  const catalog = JSON.parse(text);
  const drop = new Set(ids);
  const papers = catalog.papers.filter(p => !drop.has(p.id));
  if (papers.length === catalog.papers.length) return null;
  const next = { ...catalog, updated_at: today, papers };
  check(next);
  return serialize(next);
}

/** Published entries whose publication date is more than two years before today. */
export function expiredEntries(catalog, today, kept = new Set()) {
  const cutoff = `${Number(today.slice(0, 4)) - 2}${today.slice(4)}`;
  return catalog.papers
    .filter(p => !kept.has(p.id))
    .filter(p => (p.published_date || `${p.year}-12-31`) < cutoff)
    .map(p => ({ id: p.id, title: p.title, source: p.source, published: p.published_date || String(p.year), priority: p.reading_priority }));
}
