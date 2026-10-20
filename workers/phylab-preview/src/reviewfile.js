// One Markdown file per paper under literature/review/. YAML front matter holds
// the facts and the decision; the body holds the notes as readable sections.
// The format is documented in literature/review/README.md so that any person or
// AI can add or edit candidates.
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { PRIORITIES, TOPICS, normalizeDOI } from '../../../literature/core.mjs';

export const REVIEW_DIR = 'literature/review';
export const PENDING_DIR = `${REVIEW_DIR}/pending`;
export const DONE_DIR = `${REVIEW_DIR}/done`;

// Body sections in file order: [key, heading, bilingual]
export const SECTIONS = [
  ['why', 'Why recommended', false],
  ['summary', 'Summary', false],
  ['finding_a', 'Key finding A', true],
  ['finding_b', 'Key finding B', true],
  ['phd_relevance', 'PhD relevance', true],
  ['reading_recommendation', 'Reading recommendation', true],
  ['limitations', 'Limitations', true],
  ['abstract', 'Abstract', true],
  ['questions', 'Suggested questions', false],
];
const BY_HEADING = new Map(SECTIONS.map(([key, heading]) => [heading.toLowerCase(), key]));

const FRONT_ORDER = ['id', 'status', 'title', 'authors', 'year', 'published_date', 'source', 'doi', 'url', 'added', 'proposed_by',
  'score', 'topics', 'reading_priority', 'evidence_type', 'featured', 'finding', 'decision', 'notes'];

const listItems = text => String(text || '').split('\n').map(l => l.match(/^\s*(?:[-*]|\d+[.)])\s+(.+)$/)?.[1]?.trim()).filter(Boolean);

function splitSection(text) {
  const en = [], zh = [];
  for (const line of text.split('\n')) {
    if (/^\s*>/.test(line)) zh.push(line.replace(/^\s*>\s?/, ''));
    else en.push(line);
  }
  return { en: en.join('\n').trim(), zh: zh.join('\n').trim() };
}

/** Parse a review file. Tolerant: missing fields become empty values. */
export function parseReview(text, path = '') {
  const match = text.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${path || 'file'}: missing YAML front matter`);
  const front = parseYAML(match[1]) || {};
  const sections = {};
  const parts = match[2].replace(/\r\n/g, '\n').split(/^##\s+(.+?)\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const key = BY_HEADING.get(parts[i].toLowerCase());
    if (key) sections[key] = splitSection(parts[i + 1] || '');
  }
  const pair = key => sections[key] || { en: '', zh: '' };
  const plain = key => [pair(key).en, pair(key).zh].filter(Boolean).join('\n');
  const file = path.split('/').pop() || '';
  const authors = Array.isArray(front.authors) ? front.authors.map(String) : String(front.authors || '').split(/\s*;\s*|\s*,\s*(?=[A-Z])/).filter(Boolean);
  return {
    path,
    id: String(front.id || file.replace(/\.md$/, '')),
    status: ['pending', 'approved', 'rejected'].includes(front.status) ? front.status : 'pending',
    title: String(front.title || ''),
    authors,
    year: Number(front.year) || null,
    published_date: front.published_date ? String(front.published_date).slice(0, 10) : null,
    source: String(front.source || ''),
    doi: normalizeDOI(String(front.doi || '')),
    url: String(front.url || (front.doi ? `https://doi.org/${normalizeDOI(String(front.doi))}` : '')),
    added: front.added ? String(front.added).slice(0, 10) : '',
    proposed_by: String(front.proposed_by || ''),
    score: Number(front.score) || null,
    topics: (Array.isArray(front.topics) ? front.topics : []).map(String).filter(t => Object.hasOwn(TOPICS, t)),
    reading_priority: Object.hasOwn(PRIORITIES, front.reading_priority) ? front.reading_priority : 'read',
    evidence_type: String(front.evidence_type || ''),
    featured: Boolean(front.featured),
    finding: String(front.finding || 'A').toUpperCase() === 'B' ? 'B' : 'A',
    decision: front.decision && typeof front.decision === 'object' ? {
      by: String(front.decision.by || ''), at: String(front.decision.at || ''), reason: String(front.decision.reason || ''),
    } : null,
    notes: (Array.isArray(front.notes) ? front.notes : []).filter(n => n && n.text).map(n => ({ by: String(n.by || ''), at: String(n.at || ''), text: String(n.text) })),
    why: plain('why'),
    summary: plain('summary'),
    findings: [pair('finding_a'), pair('finding_b')].filter(f => f.en || f.zh),
    phd_relevance: pair('phd_relevance'),
    reading_recommendation: pair('reading_recommendation'),
    limitations: pair('limitations'),
    abstract: pair('abstract'),
    // Up to three questions about this paper, offered as one-click prompts in the ask box.
    questions: listItems(pair('questions').en).slice(0, 3),
  };
}

function bilingual(value) {
  const en = (value?.en || '').trim();
  const zh = (value?.zh || '').trim();
  return [en, zh ? zh.split('\n').map(l => `> ${l}`).join('\n') : ''].filter(Boolean).join('\n\n');
}

// Abstract: English original, then the Chinese translation, then the Source/credit lines.
function abstractText(value) {
  const [en, ...credit] = (value?.en || '').trim().split(/\n+(?=Source:)/);
  const zh = (value?.zh || '').trim();
  return [en.trim(), zh ? zh.split('\n').map(l => (l ? `> ${l}` : '>')).join('\n') : '', credit.join('\n').trim()].filter(Boolean).join('\n\n');
}

// Reviewers are no longer named; drop empty fields such as `by: ""`.
const withoutEmpty = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v != null));

/** Serialise a paper object back to Markdown. Round-trips with parseReview. */
export function serializeReview(paper) {
  const front = {};
  const values = {
    ...paper,
    decision: paper.decision && (paper.decision.by || paper.decision.at || paper.decision.reason) ? withoutEmpty(paper.decision) : undefined,
    notes: paper.notes?.length ? paper.notes.map(withoutEmpty) : undefined,
    score: paper.score || undefined,
    featured: paper.featured || undefined,
    finding: paper.finding === 'B' ? 'B' : undefined,
    proposed_by: paper.proposed_by || undefined,
    published_date: paper.published_date || undefined,
    evidence_type: paper.evidence_type || undefined,
  };
  for (const key of FRONT_ORDER) if (values[key] !== undefined && values[key] !== null && values[key] !== '') front[key] = values[key];
  const sections = {
    why: { en: paper.why }, summary: { en: paper.summary },
    finding_a: paper.findings?.[0], finding_b: paper.findings?.[1],
    phd_relevance: paper.phd_relevance, reading_recommendation: paper.reading_recommendation,
    limitations: paper.limitations,
    abstract: typeof paper.abstract === 'string' ? { en: paper.abstract } : paper.abstract,
    questions: { en: (paper.questions || []).slice(0, 3).map(q => `- ${q}`).join('\n') },
  };
  const body = SECTIONS.map(([key, heading, two]) => {
    const text = key === 'abstract' ? abstractText(sections.abstract) : two ? bilingual(sections[key]) : (sections[key]?.en || '').trim();
    return text ? `## ${heading}\n\n${text}\n` : '';
  }).filter(Boolean).join('\n');
  return `---\n${stringifyYAML(front, { lineWidth: 0 }).trim()}\n---\n\n${body}`;
}

/** Catalogue entry for literature/data/papers.json. */
export function catalogEntry(paper, today) {
  const finding = paper.findings[paper.finding === 'B' ? 1 : 0] || paper.findings[0] || { en: '', zh: '' };
  const doi = normalizeDOI(paper.doi || '');
  const url = paper.url || (doi ? `https://doi.org/${doi}` : '');
  return {
    id: paper.id,
    status: 'published',
    title: paper.title,
    authors: paper.authors,
    year: paper.year,
    published_date: paper.published_date || null,
    source: paper.source,
    doi,
    url,
    topics: [...new Set(paper.topics)],
    evidence_type: paper.evidence_type || 'Empirical study',
    reading_priority: paper.reading_priority,
    key_finding_zh: finding.zh || '',
    phd_relevance_zh: paper.phd_relevance?.zh || '',
    reading_recommendation_zh: paper.reading_recommendation?.zh || '',
    limitations_zh: paper.limitations?.zh || '',
    featured: Boolean(paper.featured),
    date_added: today,
    verified_at: today,
    verification_url: url,
    key_finding_en: finding.en || '',
    phd_relevance_en: paper.phd_relevance?.en || '',
    reading_recommendation_en: paper.reading_recommendation?.en || '',
    limitations_en: paper.limitations?.en || '',
  };
}
