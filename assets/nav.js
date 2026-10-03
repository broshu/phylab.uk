/* Shared site navigation — the single source for the Home button.
   Include on any page with:  <script defer src="/assets/nav.js"></script>
   It injects its own styles and a single fixed Home button in the
   top-RIGHT corner. Page headers (.top-bar / .topbar) get a little
   right padding so their own corner controls never sit under it. */
(function () {
  var CSS = '' +
    /* single Home button, pinned top-right */
    '.site-nav{position:fixed;top:20px;right:20px;z-index:1000}' +
    '.site-nav a{display:inline-flex;align-items:center;justify-content:center;' +
    'width:44px;height:44px;border:1px solid var(--site-border);border-radius:50%;' +
    'color:var(--site-green);background:var(--site-surface);text-decoration:none;' +
    'box-shadow:var(--site-shadow);' +
    'transition:transform .2s ease,border-color .2s ease}' +
    '.site-nav a:hover,.site-nav a:focus-visible{border-color:var(--site-accent);' +
    'color:var(--site-green-hover);transform:translateY(-2px)}' +
    '.site-nav a:focus-visible{outline:2px solid var(--site-focus);outline-offset:3px}' +
    '.site-nav svg{display:block}' +
    /* keep page headers clear of the Home button */
    '.top-bar,.topbar{padding-right:64px}';

  var ICONS = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>'
  };

  if (!document.querySelector('link[href="/assets/theme.css"]')) {
    var theme = document.createElement('link');
    theme.rel = 'stylesheet';
    theme.href = '/assets/theme.css';
    document.head.prepend(theme);
  }

  var path = location.pathname.replace(/index\.html$/i, '');
  if (path.charAt(path.length - 1) !== '/') path += '/';

  // No nav on the home page itself.
  if (path === '/') return;

  function render() {
    if (document.querySelector('.site-nav')) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', 'Site navigation');
    var a = document.createElement('a');
    a.href = '/';
    a.title = 'Home';
    a.setAttribute('aria-label', 'Home');
    a.innerHTML = ICONS.home;
    nav.appendChild(a);
    document.body.appendChild(nav);
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
