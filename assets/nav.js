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
    'width:44px;height:44px;border:1px solid #d8d2c0;border-radius:50%;' +
    'color:#2f5d4f;background:#faf8f1;text-decoration:none;' +
    'box-shadow:0 1px 2px rgba(28,43,37,.05),0 12px 32px -16px rgba(28,43,37,.28);' +
    'transition:transform .2s ease,border-color .2s ease}' +
    '.site-nav a:hover,.site-nav a:focus-visible{border-color:#8a9a5b;' +
    'color:#3f7060;transform:translateY(-2px);outline:none}' +
    '.site-nav svg{display:block}' +
    /* keep page headers clear of the Home button */
    '.top-bar,.topbar{padding-right:64px}' +
    /* dark mode · follows system colour scheme */
    '@media (prefers-color-scheme:dark){' +
    '.site-nav a{border-color:#363a41;color:#8fb8a8;background:#1d2024;' +
    'box-shadow:0 1px 2px rgba(0,0,0,.4),0 12px 32px -16px rgba(0,0,0,.7)}' +
    '.site-nav a:hover,.site-nav a:focus-visible{border-color:#a3b06e;color:#a6c8ba}}';

  var ICONS = {
    home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>'
  };

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
