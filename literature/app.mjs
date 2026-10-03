import { TOPICS, PRIORITIES, SORTS, filterPapers, latestPicks, validateCatalog } from './core.mjs';

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
function card(paper, compact = false) {
  const article = el('article', 'lit-card');
  if (!compact) article.id = paper.id;
  const top = el('div', 'lit-card-top');
  top.append(el('span', 'lit-priority', PRIORITIES[paper.reading_priority]), el('span', 'lit-year', String(paper.year)));
  const title = el('h3');
  title.append(link(paper.title, compact ? `/literature/#${paper.id}` : paper.url, !compact));
  article.append(top, title, el('p', 'lit-authors', paper.authors.join(', ')),
    el('p', 'lit-source', `${paper.source} · ${paper.published_date || paper.year} · ${paper.evidence_type}`));
  const tags = el('div', 'lit-chips');
  for (const topic of paper.topics) {
    const tag = link(TOPICS[topic], `/literature/?topic=${encodeURIComponent(topic)}#library`);
    tag.className = 'lit-tag';
    tags.append(tag);
  }
  const notes = el('dl', 'lit-notes');
  notes.lang = 'en-GB';
  note(notes, 'Key finding', paper.key_finding_en);
  if (!compact) {
    note(notes, 'Why I care · PhD relevance (curatorial judgement)', paper.phd_relevance_en);
    note(notes, 'Reading recommendation', paper.reading_recommendation_en);
  }
  article.append(tags, notes);
  if (!compact) {
    const details = el('details');
    details.lang = 'en-GB';
    details.append(el('summary', '', 'Evidence limitations and verification'), el('p', '', paper.limitations_en),
      link('Verified source ↗', paper.verification_url, true), el('p', 'lit-meta', `Verified ${paper.verified_at}`));
    article.append(details);
  }
  const links = el('div', 'lit-links');
  links.append(link(compact ? 'Reading notes →' : 'Permalink', `/literature/#${paper.id}`));
  if (paper.doi) links.append(link('DOI ↗', `https://doi.org/${paper.doi}`, true));
  else links.append(link('Original source ↗', paper.url, true));
  article.append(links, el('p', 'lit-meta', `Added ${paper.date_added}`));
  return article;
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
  const previous = document.querySelector(`[data-lit-prev][aria-controls="${picks.id}"]`);
  const next = document.querySelector(`[data-lit-next][aria-controls="${picks.id}"]`);
  if (!previous || !next) return () => {};
  const update = () => {
    previous.disabled = picks.scrollLeft < 4;
    next.disabled = picks.scrollLeft + picks.clientWidth >= picks.scrollWidth - 4;
  };
  const scroll = direction => {
    const first = picks.querySelector('.lit-card');
    const distance = first ? first.getBoundingClientRect().width + parseFloat(getComputedStyle(picks).columnGap) : picks.clientWidth;
    picks.scrollBy({ left: direction * distance, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  previous.addEventListener('click', () => scroll(-1));
  next.addEventListener('click', () => scroll(1));
  picks.addEventListener('scroll', update, { passive: true });
  picks.addEventListener('keydown', event => {
    if (event.target !== picks || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home' || event.key === 'End') picks.scrollTo({ left: event.key === 'Home' ? 0 : picks.scrollWidth });
    else scroll(event.key === 'ArrowLeft' ? -1 : 1);
  });
  new ResizeObserver(update).observe(picks);
  update();
  return update;
}
const updateShelf = picks ? initializeShelf() : () => {};
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
  results.replaceChildren(...matches.map(p => card(p)));
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
  // A paper permalink is only retained when that paper remains visible.
  const hash = currentHash();
  if (hash && hash !== 'library' && !filterPapers(papers, state).some(p => p.id === hash)) next.hash = 'library';
  history.replaceState(null, '', next);
}
function formState() {
  return { topics: [...form.querySelectorAll('input[name="topic"]:checked')].map(i => i.value),
    priority: document.getElementById('lit-priority').value,
    query: document.getElementById('lit-search').value, sort: document.getElementById('lit-sort').value };
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
  window.addEventListener('popstate', () => { const state = readState(); syncForm(state); render(state); });
}
async function load() {
  picks.replaceChildren(el('p', 'lit-status', 'Loading recommendations…'));
  updateShelf();
  if (results) results.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/literature/data/papers.json', { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Catalogue request: ${response.status}`);
    const data = await response.json();
    const errors = validateCatalog(data);
    if (errors.length) throw new Error(errors.join('; '));
    papers = data.papers;
    picks.replaceChildren(...latestPicks(papers).map(p => card(p, true)));
    if (!picks.children.length) picks.append(el('p', 'lit-status', 'New recommendations will appear here when selected.'));
    picks.scrollLeft = 0;
    updateShelf();
    const updated = document.getElementById(home ? 'literature-home-updated' : 'lit-updated');
    updated.textContent = `Library updated ${data.updated_at} · ${filterPapers(papers).length} curated papers`;
    if (home) return;
    form.hidden = false;
    const state = readState(); syncForm(state); render(state);
    const hash = currentHash();
    if (hash) document.getElementById(hash)?.scrollIntoView();
  } catch (error) {
    console.error('Literature:', error);
    const notice = el('p', 'lit-status', 'The literature library could not load. ');
    const retry = el('button', '', 'Try again');
    retry.type = 'button'; retry.addEventListener('click', load);
    notice.append(link('Browse the catalogue', '/literature/data/papers.json'), retry);
    picks.replaceChildren(notice);
    updateShelf();
    if (results) { results.replaceChildren(); results.setAttribute('aria-busy', 'false'); form.hidden = true; message.hidden = true; }
  }
}
if (picks) {
  if (form) initializeFilters();
  load();
}
