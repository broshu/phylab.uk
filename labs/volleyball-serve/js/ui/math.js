/**
 * Small DOM helpers for formula-rich copy.
 *
 * The lab is deliberately a static page, so KaTeX is loaded as a browser
 * global from index.html.  These helpers keep every formula accessible when
 * that asset is unavailable (for example, while working offline): the plain
 * fallback is left in the element instead of exposing TeX source.
 */

function hasKaTeX() {
  return typeof globalThis.katex?.render === 'function';
}

function appendText(parent, value) {
  if (!value) return;
  const span = document.createElement('span');
  span.textContent = value;
  parent.appendChild(span);
}

const DELIMITED_MATH = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;

/**
 * @typedef {{type?: 'text'|'math', text?: string, tex?: string, fallback?: string, display?: boolean}} RichPart
 */

/**
 * Render a list of prose and formula parts into an element.
 *
 * @param {HTMLElement} target
 * @param {RichPart[]} parts
 * @returns {boolean} whether at least one formula was rendered by KaTeX
 */
export function renderRichText(target, parts = []) {
  const normalized = parts.map((part) =>
    typeof part === 'string' ? { type: 'text', text: part } : part,
  );
  const fallback = normalized
    .map((part) => (part.type === 'math' ? part.fallback ?? part.text ?? part.tex ?? '' : part.text ?? ''))
    .join('');

  target.textContent = fallback;
  if (!hasKaTeX()) return false;

  target.textContent = '';
  target.setAttribute?.('aria-label', fallback);
  let rendered = false;

  for (const part of normalized) {
    if (part.type !== 'math' || !part.tex) {
      appendText(target, part.text ?? '');
      continue;
    }

    const math = document.createElement('span');
    const display = part.display === true;
    math.className = display ? 'coach-math' : 'coach-math-inline';
    math.setAttribute?.('aria-label', part.fallback ?? part.text ?? part.tex);
    try {
      globalThis.katex.render(part.tex, math, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
      });
      target.appendChild(math);
      rendered = true;
    } catch {
      // A malformed formula should degrade to its readable text, not remove
      // the whole coach message.
      appendText(target, part.fallback ?? part.text ?? part.tex);
    }
  }

  return rendered;
}

/**
 * Render a single formula as an inline or display element.
 *
 * @param {HTMLElement} target
 * @param {string} tex
 * @param {string} fallback
 * @param {boolean} [display]
 */
export function renderFormula(target, tex, fallback, display = false) {
  return renderRichText(target, [{ type: 'math', tex, fallback, display }]);
}

/**
 * Safely render model output that uses only \(...\) and \[...\] delimiters.
 * Prose is always inserted as text; model-provided HTML is never interpreted.
 *
 * @param {HTMLElement} target
 * @param {string} source
 */
export function renderDelimitedMath(target, source) {
  const value = String(source ?? '');
  target.textContent = value;
  if (!hasKaTeX()) return false;

  const pattern = new RegExp(DELIMITED_MATH.source, 'g');
  target.textContent = '';
  let cursor = 0;
  let rendered = false;
  let match;

  while ((match = pattern.exec(value))) {
    appendText(target, value.slice(cursor, match.index));
    const display = match[1] !== undefined;
    const tex = display ? match[1] : match[2];
    const math = document.createElement('span');
    math.className = display ? 'coach-math' : 'coach-math-inline';
    math.setAttribute?.('aria-label', match[0]);
    try {
      globalThis.katex.render(tex, math, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        maxExpand: 100,
      });
      target.appendChild(math);
      rendered = true;
    } catch {
      appendText(target, match[0]);
    }
    cursor = pattern.lastIndex;
  }

  appendText(target, value.slice(cursor));
  return rendered;
}
