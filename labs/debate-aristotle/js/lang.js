/**
 * Page language: Chinese when the browser's first language is Chinese
 * (it follows the computer's system language), else English.
 * ?lang=zh or ?lang=en forces one, for testing.
 */
export const LANG = (() => {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'zh' || asked === 'en') return asked;
  const first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^zh/i.test(first) ? 'zh' : 'en';
})();

/** Pick the English or the Chinese text. */
export const L = (en, zh) => (LANG === 'zh' ? zh : en);
