/* Shared site navigation — the single source for the home + back buttons.
   Include on any page with:  <script defer src="/assets/nav.js"></script>
   It injects its own styles and a fixed vertical button stack at the top-left:
   Home is always shown; one extra "back" button is added for each ancestor
   level the current page sits under. To add a new multi-level section later,
   just add an entry to SECTIONS. */
(function () {
  var CSS = '' +
    '.site-nav{position:fixed;top:20px;left:20px;z-index:1000;display:flex;' +
    'flex-direction:column;gap:10px}' +
    '.site-nav a{display:inline-flex;align-items:center;justify-content:center;' +
    'width:44px;height:44px;border:1px solid #d8d2c0;border-radius:50%;' +
    'color:#2f5d4f;background:#faf8f1;text-decoration:none;' +
    'box-shadow:0 1px 2px rgba(28,43,37,.05),0 12px 32px -16px rgba(28,43,37,.28);' +
    'transition:transform .2s ease,border-color .2s ease}' +
    '.site-nav a:hover,.site-nav a:focus-visible{border-color:#8a9a5b;' +
    'color:#3f7060;transform:translateY(-2px);outline:none}' +
    '.site-nav svg{display:block}';

  var ICONS = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>'
  };

  // Ordered from highest level down. A "back" button to `href` is shown
  // whenever the current path is strictly below it (matches `under`).
  var SECTIONS = [
    { under: /^\/labs\/.+/i, href: '/labs/', label: 'Labs' }
    // future sub-levels go here, e.g.
    // { under: /^\/labs\/[^/]+\/.+/i, href: '/labs/<x>/', label: '...' }
  ];

  var path = location.pathname.replace(/index\.html$/i, '');
  if (path.charAt(path.length - 1) !== '/') path += '/';

  // No nav on the home page itself.
  if (path === '/') return;

  var items = [{ href: '/', label: 'Home', icon: 'home' }];
  SECTIONS.forEach(function (s) {
    if (s.under.test(path)) items.push({ href: s.href, label: s.label, icon: 'back' });
  });

  function render() {
    if (document.querySelector('.site-nav')) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', 'Site navigation');
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = it.href;
      a.title = it.label;
      a.setAttribute('aria-label', it.label);
      a.innerHTML = ICONS[it.icon];
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
