import { normalizeDOI, validDate } from '../core.mjs';
import { setTimeout as delay } from 'node:timers/promises';

export async function crossref(path, parameters = {}) {
  const url = new URL(`https://api.crossref.org/${path}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PhyLab-Literature/1.0 (https://phylab.uk/literature/)', Accept: 'application/json' },
      signal: AbortSignal.timeout(20000)
    });
    if (response.ok) return (await response.json()).message;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw new Error(`Crossref ${response.status}: ${url.pathname}`);
    const retryAfter = Number(response.headers.get('retry-after')) || 2 * (attempt + 1);
    await response.body?.cancel();
    await delay(Math.min(10000, Math.max(1000, retryAfter * 1000)));
  }
}
export function metadataDate(item) {
  const parts = (item['published-online'] || item['published-print'] || item.published || {})['date-parts']?.[0] || [];
  const date = parts.length >= 3 ? parts.slice(0, 3).map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0')).join('-') : null;
  return { year: parts[0] || null, date: validDate(date) ? date : null };
}
export function draftFromMetadata(item, today) {
  const doi = normalizeDOI(item.DOI);
  const { year, date } = metadataDate(item);
  return {
    id: doi.replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''), status: 'draft',
    title: item.title?.[0] || '',
    authors: (item.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ') || a.name || '').filter(Boolean),
    year, published_date: date, source: item['container-title']?.[0] || '',
    doi, url: `https://doi.org/${doi}`, topics: [], evidence_type: 'Needs review',
    reading_priority: '', key_finding_en: '', phd_relevance_en: '',
    reading_recommendation_en: '', limitations_en: '', featured: false,
    date_added: today, verified_at: today, verification_url: `https://doi.org/${doi}`
  };
}
