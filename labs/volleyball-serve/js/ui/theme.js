/**
 * Canvas palette, read from the CSS custom properties on :root so that the
 * drawing follows the site theme (including the dark-mode media query).
 * Falls back to literals when there is no DOM (node tests, offscreen render).
 */
const FALLBACK = {
  sky: '#ffffff',
  ground: '#eceae4',
  groundLine: '#b9b7b0',
  court: '#dbe7dd',
  net: '#5b6b7c',
  ink: '#111111',
  muted: '#646464',
  ball: '#e69d28',
  ok: '#2f7d55',
  bad: '#d64f62',
  info: '#2468a6',
};

const VARS = {
  sky: '--canvas-sky',
  ground: '--canvas-ground',
  groundLine: '--canvas-ground-line',
  court: '--canvas-court',
  net: '--canvas-net',
  ink: '--ink',
  muted: '--muted',
  ball: '--amber',
  ok: '--green-ok',
  bad: '--red',
  info: '--blue',
};

export function readPalette() {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') {
    return { ...FALLBACK };
  }
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const [key, varName] of Object.entries(VARS)) {
    const v = cs.getPropertyValue(varName).trim();
    out[key] = v || FALLBACK[key];
  }
  return out;
}

/** Call `fn` whenever the system colour scheme flips. */
export function onSchemeChange(fn) {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const handler = () => fn();
  mq.addEventListener?.('change', handler);
  return () => mq.removeEventListener?.('change', handler);
}
