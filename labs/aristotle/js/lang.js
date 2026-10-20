/**
 * Page language: English or Chinese only.
 * Order: ?lang=zh|en (testing) > the reader's own choice from the language
 * switch (remembered) > the browser's first language, which follows the
 * computer's system language.
 */
export const LANG_STORE = 'phylab-debate-aristotle-lang';

export const LANG = (() => {
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'zh' || asked === 'en') return asked;
  try {
    const chosen = localStorage.getItem(LANG_STORE);
    if (chosen === 'zh' || chosen === 'en') return chosen;
  } catch { /* storage is optional */ }
  const first = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  return /^zh/i.test(first) ? 'zh' : 'en';
})();

/** Pick the English or the Chinese text. */
export const L = (en, zh) => (LANG === 'zh' ? zh : en);
