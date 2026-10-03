import { TOPICS, PRIORITIES, SORTS, filterPapers, latestPicks, latestAdditions, validateCatalog } from './core.mjs';

// Source content is always inserted as text, never interpreted as HTML.
function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
function link(text, href, external = false) {
  const node = el('a', '', text);
  node.href = href;
  if (external) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
  return node;
}
function note(list, title, value) {
  list.append(el('dt', '', title), el('dd', '', value));
}
function metadata(paper, article, title) {
  const top = el('div', 'lit-card-top');
  top.append(el('span', 'lit-priority', PRIORITIES[paper.reading_priority]), el('span', 'lit-year', String(paper.year)));
  article.append(top, title, el('p', 'lit-authors', paper.authors.join(', ')),
    el('p', 'lit-source', `${paper.source} · ${paper.published_date || paper.year} · ${paper.evidence_type}`));
}
function homeCard(paper) {
  const article = el('article', 'lit-card');
  const title = el('h3');
  title.append(link(paper.title, `/literature/library/#${paper.id}`));
  metadata(paper, article, title);
  const tags = el('div', 'lit-chips');
  for (const topic of paper.topics) {
    const tag = link(TOPICS[topic], `/literature/library/?topic=${encodeURIComponent(topic)}#library`);
    tag.className = 'lit-tag';
    tags.append(tag);
  }
  const notes = el('dl', 'lit-notes');
  notes.lang = 'en-GB';
  note(notes, 'Key finding', paper.key_finding_en);
  const links = el('div', 'lit-links');
  links.append(link('Reading notes →', `/literature/library/#${paper.id}`));
  links.append(link(paper.doi ? 'DOI ↗' : 'Original source ↗', paper.doi ? `https://doi.org/${paper.doi}` : paper.url, true));
  article.append(tags, notes, links, el('p', 'lit-meta', `Added ${paper.date_added}`));
  return article;
}
function paperCard(paper, detailed = false) {
  const entry = el('article', 'lit-entry');
  entry.id = detailed ? paper.id : `latest-${paper.id}`;
  const card = link('', paper.url, true);
  card.className = 'lit-card lit-paper-link';
  const title = el('h3', '', paper.title);
  title.id = `paper-title-${paper.id}`;
  card.setAttribute('aria-labelledby', title.id);
  metadata(paper, card, title);
  const tags = el('div', 'lit-chips');
  tags.setAttribute('aria-label', 'Topics');
  for (const topic of paper.topics) tags.append(el('span', 'lit-tag', TOPICS[topic]));
  const notes = el('dl', 'lit-notes');
  notes.lang = 'en-GB';
  note(notes, 'Key finding', paper.key_finding_en);
  if (detailed) {
    note(notes, 'Why I care · PhD relevance (curatorial judgement)', paper.phd_relevance_en);
    note(notes, 'Reading recommendation', paper.reading_recommendation_en);
  }
  card.append(tags, notes);
  if (detailed) {
    const evidence = el('div', 'lit-evidence');
    evidence.append(el('strong', '', 'Evidence limitations'), el('p', '', paper.limitations_en), el('p', 'lit-meta', `Source verified ${paper.verified_at}`));
    card.append(evidence);
  }
  card.append(el('p', 'lit-links', 'Read original article ↗'), el('p', 'lit-meta', `Added ${paper.date_added}`));
  entry.append(card);
  return entry;
}

const home = document.getElementById('literature-home-picks');
const picks = home || document.getElementById('lit-picks');
const results = document.getElementById('lit-results');
const form = document.getElementById('lit-filters');
const message = document.getElementById('lit-message');
let papers = [];
function currentHash() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
}
function initializeShelf() {
  const previous = document.querySelector(`[data-lit-prev][aria-controls="${home.id}"]`);
  const next = document.querySelector(`[data-lit-next][aria-controls="${home.id}"]`);
  if (!previous || !next) return () => {};
  const update = () => {
    previous.disabled = home.scrollLeft < 4;
    next.disabled = home.scrollLeft + home.clientWidth >= home.scrollWidth - 4;
  };
  const scroll = direction => {
    const first = home.querySelector('.lit-card');
    const distance = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(home).columnGap) : home.clientWidth;
    home.scrollBy({ left: direction * distance, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => scroll(-1));
  next.addEventListener('click', () => scroll(1));
  home.addEventListener('scroll', update, { passive: true });
  home.addEventListener('keydown', event => {
    if (event.target !== home || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'End') home.scrollTo({ left: event.key === 'Home' ? 0 : home.scrollWidth });
    else scroll(event.key === 'ArrowLeft' ? -1 : 1);
  });
  new ResizeObserver(update).observe(home);
  update();
  return update;
}
const updateShelf = home ? initializeShelf() : () => {};
function readState() {
  const params = new URLSearchParams(location.search);
  return { topics: [...new Set(params.getAll('topic').filter(t => Object.hasOwn(TOPICS, t)))],
    priority: Object.hasOwn(PRIORITIES, params.get('priority')) ? params.get('priority') : '',
    query: params.get('q') || '', sort: SORTS.includes(params.get('sort')) ? params.get('sort') : 'added' };
}
function syncForm(state) {
  document.getElementById('lit-search').value = state.query;
  document.getElementById('lit-priority').value = state.priority;
  document.getElementById('lit-sort').value = state.sort;
  form.querySelectorAll('input[name="topic"]').forEach(input => { input.checked = state.topics.includes(input.value); });
}
function render(state) {
  const matches = filterPapers(papers, state);
  results.replaceChildren(...matches.map(p => paperCard(p, true)));
  document.getElementById('lit-count').textContent = `${matches.length} of ${filterPapers(papers).length} papers`;
  message.hidden = matches.length > 0;
  message.textContent = 'No papers match these filters. Try fewer topics or clear the search.';
  results.setAttribute('aria-busy', 'false');
}
function updateURL(state) {
  const params = new URLSearchParams();
  for (const topic of state.topics) params.append('topic', topic);
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.priority) params.set('priority', state.priority);
  if (state.sort !== 'added') params.set('sort', state.sort);
  const next = new URL(location.href);
  next.search = params.toString();
  const hash = currentHash();
  if (hash && hash !== 'library' && !filterPapers(papers, state).some(p => p.id === hash)) next.hash = 'library';
  history.replaceState(null, '', next);
}
function formState() {
  return { topics: [...form.querySelectorAll('input[name="topic"]:checked')].map(i => i.value),
    priority: document.getElementById('lit-priority').value,
    query: document.getElementById('lit-search').value, sort: document.getElementById('lit-sort').value };
}
function renderLibrary() {
  let state = readState();
  const hash = currentHash();
  // A valid paper permalink wins over incompatible saved filters.
  if (papers.some(p => p.status === 'published' && p.id === hash) && !filterPapers(papers, state).some(p => p.id === hash)) {
    state = { topics: [], priority: '', query: '', sort: state.sort };
    updateURL(state);
  }
  syncForm(state);
  render(state);
  if (hash) document.getElementById(hash)?.scrollIntoView();
}
function initializeFilters() {
  const topics = document.getElementById('lit-topics');
  for (const [value, label] of Object.entries(TOPICS)) {
    const wrapper = el('label', 'lit-topic');
    const input = el('input');
    input.type = 'checkbox'; input.name = 'topic'; input.value = value;
    wrapper.append(input, document.createTextNode(label));
    topics.append(wrapper);
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { const state = formState(); updateURL(state); render(state); });
  document.getElementById('lit-reset').addEventListener('click', () => {
    const state = { topics: [], priority: '', query: '', sort: 'added' };
    syncForm(state); updateURL(state); render(state);
  });
  window.addEventListener('popstate', renderLibrary);
  window.addEventListener('hashchange', renderLibrary);
}
function forwardLegacyLink() {
  if (home || results) return false;
  const params = new URLSearchParams(location.search);
  const hash = currentHash();
  const hasFilters = ['topic', 'priority', 'q', 'sort'].some(key => params.has(key));
  if (!hasFilters && hash !== 'library' && !papers.some(p => p.status === 'published' && p.id === hash)) return false;
  const archive = new URL('/literature/library/', location.origin);
  archive.search = location.search;
  archive.hash = location.hash;
  location.replace(archive);
  return true;
}
async function load() {
  const host = picks || results;
  host.replaceChildren(el('p', 'lit-status', home ? 'Loading recommendations…' : 'Loading papers…'));
  host.setAttribute('aria-busy', 'true');
  updateShelf();
  if (form) form.hidden = true;
  if (message) message.hidden = true;
  try {
    const response = await fetch('/literature/data/papers.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Catalogue request: ${response.status}`);
    const data = await response.json();
    const errors = validateCatalog(data);
    if (errors.length) throw new Error(errors.join('; '));
    papers = data.papers;
    if (forwardLegacyLink()) return;
    const updated = document.getElementById(home ? 'literature-home-updated' : 'lit-updated');
    updated.textContent = `Library updated ${data.updated_at} · ${filterPapers(papers).length} curated papers`;
    if (picks) {
      const selected = home ? latestPicks(papers) : latestAdditions(papers);
      picks.replaceChildren(...selected.map(p => home ? homeCard(p) : paperCard(p)));
      if (!selected.length) picks.append(el('p', 'lit-status', 'New recommendations will appear here when selected.'));
      picks.setAttribute('aria-busy', 'false');
      if (home) { home.scrollLeft = 0; updateShelf(); }
    }
    if (form) { form.hidden = false; renderLibrary(); }
  } catch (error) {
    console.error('Literature:', error);
    const notice = el('p', 'lit-status', 'The literature library could not load. ');
    const retry = el('button', '', 'Try again');
    retry.type = 'button'; retry.addEventListener('click', load);
    notice.append(link('Browse the catalogue', '/literature/data/papers.json'), retry);
    host.replaceChildren(notice);
    host.setAttribute('aria-busy', 'false');
    updateShelf();
  }
}
if (picks || results) {
  if (form) initializeFilters();
  else if (!home) window.addEventListener('hashchange', forwardLegacyLink);
  load();
}
