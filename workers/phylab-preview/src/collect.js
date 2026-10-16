// Finds real papers. AI never invents candidates: everything here comes from
// the APS feed, Crossref or OpenAlex, keyed by DOI.
import { normalizeDOI, validDate } from '../../../literature/core.mjs';

const UA = 'PhyLab-Preview/1.0 (https://phylab.uk/literature/)';
const EDUCATION = /educat|teach|learn|student|pupil|classroom|curricul|instruct|pedagog|course|olympiad|undergraduate/i;

export const DEFAULT_PROFILE = {
  topics: ['hands-on', 'simulation', 'ai', 'transfer', 'assessment', 'icap', 'scaffolding', 'cognitive-load', 'visualization'],
  keywords: [
    'physics laboratory learning', 'physics simulation learning transfer', 'artificial intelligence physics teaching',
    'AI tutor physics', 'physics assessment instrument', 'scaffolding physics problem solving',
    'augmented reality physics', 'video analysis physics experiment', 'low-cost physics apparatus',
    'physics olympiad problem solving', 'secondary school physics teaching',
  ],
  journals: [
    { name: 'Physical Review Physics Education Research', issn: '2469-9896', on: true, physics: true },
    { name: 'American Journal of Physics', issn: '0002-9505', on: true, physics: true },
    { name: 'The Physics Teacher', issn: '0031-921X', on: true, physics: true },
    { name: 'European Journal of Physics', issn: '0143-0807', on: true, physics: true },
    { name: 'Physics Education', issn: '0031-9120', on: true, physics: true },
    { name: 'International Journal of Science Education', issn: '0950-0693', on: true, physics: false },
    { name: 'Journal of Research in Science Teaching', issn: '0022-4308', on: true, physics: false },
    { name: 'Science Education', issn: '0036-8326', on: true, physics: false },
    { name: 'Research in Science Education', issn: '0157-244X', on: true, physics: false },
    { name: 'Journal of Science Education and Technology', issn: '1059-0145', on: true, physics: false },
    { name: 'Computers & Education', issn: '0360-1315', on: true, physics: false },
  ],
  notes: 'Secondary-school (Grades 10-12) physics teaching. Most interested in AI-supported learning (AI tutors, AI feedback, AI solutions to physics problems), hands-on and low-cost experiments, video and frame-stacking visualisation, AR, simulations, and whether learning transfers to independent work.',
  threshold: 4,
  window_days: 45,
};

/** One unit of collection work = one HTTP request. The job runner walks this list across invocations. */
export function collectionPlan(profile) {
  const plan = [{ kind: 'aps' }];
  for (const j of profile.journals || []) if (j.on && /^\d{4}-\d{3}[\dX]$/.test(j.issn)) plan.push({ kind: 'journal', issn: j.issn, physics: !!j.physics, name: j.name });
  for (const q of profile.keywords || []) if (q.trim()) plan.push({ kind: 'keyword', query: q.trim() });
  return plan;
}

function decodeEntities(text = '') {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').trim();
}
export function stripTags(text = '') {
  return decodeEntities(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** APS RSS 1.0 -> metadata records. Mirrors literature/scripts/parse-aps-feed.py. */
export function parseApsFeed(xml) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map(m => m[1]);
  if (!items.length) throw new Error('APS feed contained no RSS items');
  const field = (item, tag) => decodeEntities(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || '');
  return items.map(item => {
    const date = field(item, 'prism:publicationDate').slice(0, 10);
    const authors = field(item, 'dc:creator').split(/,\s*(?:and\s+)?|\s+and\s+/).map(a => a.trim()).filter(Boolean);
    const doi = normalizeDOI(field(item, 'prism:doi'));
    return {
      doi,
      title: stripTags(field(item, 'title')),
      authors,
      year: date ? Number(date.slice(0, 4)) : null,
      published_date: validDate(date) ? date : null,
      source: field(item, 'prism:publicationName') || 'Physical Review Physics Education Research',
      url: doi ? `https://doi.org/${doi}` : '',
      abstract: stripTags(field(item, 'description')),
    };
  });
}

export function fromCrossref(item) {
  const parts = (item['published-online'] || item['published-print'] || item.published || {})['date-parts']?.[0] || [];
  const date = parts.length >= 3 ? parts.slice(0, 3).map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0')).join('-') : null;
  const doi = normalizeDOI(item.DOI || '');
  return {
    doi,
    title: stripTags(item.title?.[0] || ''),
    authors: (item.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ') || a.name || '').filter(Boolean),
    year: parts[0] || null,
    published_date: validDate(date) ? date : null,
    source: stripTags(item['container-title']?.[0] || ''),
    url: doi ? `https://doi.org/${doi}` : '',
    abstract: stripTags(item.abstract || ''),
    type: item.type,
  };
}

/** Keep only usable, recent records. */
export function usable(meta, from, today) {
  if (!meta.doi || !/^10\.\d{4,9}\/\S+$/.test(meta.doi)) return false;
  if (!meta.title || !meta.authors?.length || !meta.source || !meta.year) return false;
  if (/^(erratum|corrigendum|correction|retraction|editorial|front matter|back matter|issue information|book review)/i.test(meta.title)) return false;
  const date = meta.published_date || `${meta.year}-12-31`;
  if (meta.published_date && (date > today || date < from)) return false;
  if (!meta.published_date && meta.year < Number(from.slice(0, 4))) return false;
  return true;
}

async function getJSON(url) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (response.ok) return response.json();
    // Crossref and OpenAlex rate-limit bursts; wait once and try again.
    if (attempt === 0 && [429, 500, 502, 503, 504].includes(response.status)) {
      const wait = Math.min(8, Math.max(2, Number(response.headers.get('retry-after')) || 3));
      await response.body?.cancel();
      await new Promise(resolve => setTimeout(resolve, wait * 1000));
      continue;
    }
    throw new Error(`${new URL(url).hostname} ${response.status}`);
  }
}

/** Run one plan step. Returns metadata records (unfiltered by catalogue). */
export async function runStep(step, profile, today) {
  const days = Number(profile.window_days) || 45;
  const from = new Date(Date.parse(today) - days * 86400000).toISOString().slice(0, 10);
  let records = [];
  if (step.kind === 'aps') {
    const response = await fetch('https://feeds.aps.org/rss/recent/prstper.xml', { headers: { 'User-Agent': UA } });
    if (!response.ok) throw new Error(`APS RSS ${response.status}`);
    records = parseApsFeed(await response.text());
  } else {
    const url = new URL(step.kind === 'journal' ? `https://api.crossref.org/journals/${step.issn}/works` : 'https://api.crossref.org/works');
    url.searchParams.set('filter', `from-pub-date:${from},until-pub-date:${today},type:journal-article`);
    url.searchParams.set('rows', step.kind === 'journal' ? '60' : '20');
    url.searchParams.set('sort', 'published');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('select', 'DOI,title,author,container-title,published,published-online,published-print,abstract,type');
    if (step.kind === 'keyword') url.searchParams.set('query.bibliographic', step.query);
    const data = await getJSON(url);
    records = (data.message?.items || []).map(fromCrossref);
    // General science-education journals and keyword hits must actually be about physics,
    // and keyword hits (any journal) must also be about teaching or learning.
    if (step.kind === 'keyword' || !step.physics) {
      records = records.filter(r => /\bphysics\b/i.test(`${r.title} ${r.source} ${r.abstract}`));
    }
    if (step.kind === 'keyword') {
      records = records.filter(r => EDUCATION.test(`${r.title} ${r.source} ${r.abstract}`));
    }
  }
  return records.filter(r => usable(r, from, today));
}

/** OpenAlex stores abstracts as an inverted index. */
export function invertedToText(index) {
  if (!index) return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(' ');
}

/** Fill missing abstracts for up to 40 DOIs in one request. Returns Map doi -> abstract. */
export async function openAlexAbstracts(dois, apiKey = '') {
  const found = new Map();
  if (!dois.length) return found;
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', `doi:${dois.map(d => `https://doi.org/${d}`).join('|')}`);
  url.searchParams.set('per-page', '50');
  url.searchParams.set('select', 'doi,abstract_inverted_index');
  if (apiKey) url.searchParams.set('api_key', apiKey);
  const data = await getJSON(url);
  for (const work of data.results || []) {
    const doi = normalizeDOI(work.doi || '');
    const text = invertedToText(work.abstract_inverted_index);
    if (doi && text) found.set(doi, text);
  }
  return found;
}

/** Fallback abstract source: Semantic Scholar's batch endpoint (no key needed at low volume). */
export async function semanticScholarAbstracts(dois) {
  const found = new Map();
  if (!dois.length) return found;
  const response = await fetch('https://api.semanticscholar.org/graph/v1/paper/batch?fields=abstract,externalIds', {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: dois.map(d => `DOI:${d}`) }),
  });
  if (!response.ok) throw new Error(`api.semanticscholar.org ${response.status}`);
  const data = await response.json();
  data.forEach((paper, i) => { if (paper?.abstract) found.set(dois[i], stripTags(paper.abstract)); });
  return found;
}

/** Abstracts from whichever source answers. Never throws; returns [map, warnings]. */
export async function fillAbstracts(dois, env = {}) {
  const warnings = [];
  let found = new Map();
  try { found = await openAlexAbstracts(dois, env.OPENALEX_API_KEY || ''); } catch (error) { warnings.push(`OpenAlex: ${error.message}`); }
  const missing = dois.filter(d => !found.has(d));
  if (missing.length) {
    try { for (const [k, v] of await semanticScholarAbstracts(missing)) found.set(k, v); }
    catch (error) { warnings.push(`Semantic Scholar: ${error.message}`); }
  }
  return [found, warnings];
}
