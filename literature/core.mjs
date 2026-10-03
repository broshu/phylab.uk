export const TOPICS = {
  'hands-on': 'Hands-on Lab', simulation: 'Simulation', ai: 'AI Teaching',
  transfer: 'Transfer', assessment: 'Assessment', icap: 'ICAP',
  scaffolding: 'Scaffolding', 'cognitive-load': 'Cognitive Load'
};
export const PRIORITIES = { core: 'PhD Core · Essential', read: 'Read · Full text', skim: 'Skim · Background' };
export const SORTS = ['added', 'published', 'priority'];
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function safeURL(value) {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
export function normalizeDOI(value = '') {
  return value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase();
}
export function validateCatalog(data) {
  const errors = [];
  if (!data || data.schema_version !== 1 || !Array.isArray(data.papers)) return ['Expected schema_version: 1 and papers array'];
  if (!validDate(data.updated_at)) errors.push('updated_at must be YYYY-MM-DD');
  const ids = new Set(), dois = new Set();
  for (const paper of data.papers) {
    if (!paper || typeof paper !== 'object') { errors.push('Entry must be an object'); continue; }
    const name = paper.id || '(missing id)';
    const fail = message => errors.push(`${name}: ${message}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(paper.id || '')) fail('invalid id');
    if (ids.has(paper.id)) fail('duplicate id');
    ids.add(paper.id);
    if (!['published', 'draft'].includes(paper.status)) fail('invalid status');
    for (const field of ['title', 'source', 'evidence_type']) {
      if (typeof paper[field] !== 'string' || !paper[field].trim()) fail(`missing ${field}`);
    }
    if (!Array.isArray(paper.authors) || !paper.authors.length || paper.authors.some(a => typeof a !== 'string' || !a.trim())) fail('authors must be a nonempty string array');
    if (!Number.isInteger(paper.year) || paper.year < 1900 || paper.year > 2100) fail('invalid year');
    for (const field of ['date_added', 'verified_at']) if (!validDate(paper[field])) fail(`invalid ${field}`);
    if (paper.published_date && (!validDate(paper.published_date) || Number(paper.published_date.slice(0, 4)) !== paper.year)) fail('published_date must match year');
    if (paper.date_added > data.updated_at) fail('date_added is later than updated_at');
    if (paper.verified_at > data.updated_at) fail('verified_at is later than updated_at');
    if (!safeURL(paper.url)) fail('url must be HTTPS');
    if (paper.doi) {
      const doi = normalizeDOI(paper.doi);
      if (!/^10\.\d{4,9}\/\S+$/.test(doi)) fail('invalid DOI');
      if (dois.has(doi)) fail('duplicate DOI');
      dois.add(doi);
    }
    if (!Array.isArray(paper.topics) || paper.topics.some(t => !Object.hasOwn(TOPICS, t)) || new Set(paper.topics).size !== paper.topics.length) fail('invalid topics');
    if (typeof paper.featured !== 'boolean') fail('featured must be boolean');
    if (paper.status === 'published') {
      if (!paper.topics?.length) fail('published entry needs topics');
      if (!Object.hasOwn(PRIORITIES, paper.reading_priority)) fail('invalid reading_priority');
      for (const field of ['key_finding_en', 'phd_relevance_en', 'reading_recommendation_en', 'limitations_en']) {
        if (typeof paper[field] !== 'string' || !/[A-Za-z]/.test(paper[field]) || /[\u3400-\u9fff]/u.test(paper[field])) fail(`missing English ${field}`);
      }
      if (!safeURL(paper.verification_url)) fail('verification_url must be HTTPS');
    }
  }
  return errors;
}
export function filterPapers(papers, { topics = [], priority = '', query = '', sort = 'added' } = {}) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  const rank = { core: 0, read: 1, skim: 2 };
  return papers.filter(p => p.status === 'published' && topics.every(t => p.topics.includes(t)) &&
    (!priority || p.reading_priority === priority) && words.every(word =>
      [p.title, ...p.authors, p.source, p.year, p.doi, p.key_finding_en, p.phd_relevance_en, p.key_finding_zh, p.phd_relevance_zh,
        ...p.topics.flatMap(t => [t, TOPICS[t]])].join(' ').toLocaleLowerCase().includes(word)))
    .sort((a, b) => {
      if (sort === 'priority' && rank[a.reading_priority] !== rank[b.reading_priority]) return rank[a.reading_priority] - rank[b.reading_priority];
      if (sort === 'added' && a.date_added !== b.date_added) return b.date_added.localeCompare(a.date_added);
      return (b.published_date || `${b.year}-01-01`).localeCompare(a.published_date || `${a.year}-01-01`) || a.title.localeCompare(b.title);
    });
}
export function latestAdditions(papers, limit = 10) {
  return filterPapers(papers, { sort: 'added' }).slice(0, limit);
}
export function latestPicks(papers, limit = 6) {
  // All published entries are curated; highlights break ties within an added date.
  return filterPapers(papers.filter(p => p.reading_priority !== 'skim'), { sort: 'added' })
    .sort((a, b) => b.date_added.localeCompare(a.date_added) || Number(b.featured) - Number(a.featured) ||
      (b.published_date || `${b.year}-01-01`).localeCompare(a.published_date || `${a.year}-01-01`) || a.title.localeCompare(b.title))
    .slice(0, limit);
}
