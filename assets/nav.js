/* Shared site mark — the single source for "back up one level".
   Include on any page with:  <script defer src="/assets/nav.js"></script>
   Injects its own styles and one small pendulum mark in the top-RIGHT
   corner. It has no button chrome, so it leaves full-screen content alone.
   The pendulum rests at its left position with a ghost of the right one,
   and swings once on load, hover, focus and touch. The link goes up one
   level (…/labs/x/ -> /labs/, /labs/ -> /). Page headers (.top-bar /
   .topbar) get a little right padding so their own corner controls never
   sit under the mark. Colours come from theme.css, so dark mode follows
   the system scheme. */
(function () {
  var CSS = '' +
    '.site-nav{position:fixed;top:8px;right:8px;z-index:1000}' +
    '.site-nav a{display:flex;align-items:center;justify-content:center;' +
    'width:44px;height:44px;color:var(--site-green);text-decoration:none;' +
    'opacity:.75;transition:opacity .25s ease;-webkit-tap-highlight-color:transparent}' +
    '.site-nav a:hover,.site-nav a:focus-visible{opacity:1}' +
    '.site-nav a:focus-visible{outline:2px solid var(--site-focus);outline-offset:-4px;border-radius:12px}' +
    '.site-nav svg{display:block;width:36px;height:36px;overflow:visible;' +
    'filter:drop-shadow(0 0 3px var(--site-bg))}' +
    '.site-nav .pm-rod{transform-origin:70px 30px;transform:rotate(21.5deg)}' +
    '.site-nav.swing .pm-rod{animation:pm-swing 1.5s ease-in-out 1}' +
    '@keyframes pm-swing{0%,100%{transform:rotate(21.5deg)}50%{transform:rotate(-21.5deg)}}' +
    '@media (prefers-reduced-motion:reduce){.site-nav.swing .pm-rod{animation:none}}' +
    '@media print{.site-nav{display:none}}' +
    /* keep page headers clear of the mark */
    '.top-bar,.topbar{padding-right:56px}';

  /* Pendulum at rest: bob on the left, ghost of the right extreme, faint arc. */
  var MARK = '' +
    '<svg viewBox="0 0 140 140" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M40 30 L100 30" stroke-width="10"/>' +
    '<path d="M40 106 A81.7 81.7 0 0 0 100 106" stroke-width="7" opacity=".45"/>' +
    '<circle cx="100" cy="106" r="19" fill="currentColor" stroke="none" opacity=".4"/>' +
    '<g class="pm-rod"><path d="M70 30 L70 111.7" stroke-width="9"/>' +
    '<circle cx="70" cy="111.7" r="19" fill="currentColor" stroke="none"/></g>' +
    '</svg>';

  var LABELS = {
    labs: 'Labs', lessons: 'Lessons', research: 'Research',
    literature: 'Literature', 'ar-electric-field': 'AR Electric Field'
  };

  if (!document.querySelector('link[href="/assets/theme.css"]')) {
    var theme = document.createElement('link');
    theme.rel = 'stylesheet';
    theme.href = '/assets/theme.css';
    document.head.prepend(theme);
  }

  /* Same pendulum as the mark, for browser tabs (light/dark aware). */
  if (!document.querySelector('link[rel~="icon"]')) {
    var icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = '/assets/favicon.svg';
    document.head.appendChild(icon);
  }

  var p = location.pathname.replace(/index\.html$/i, '');
  var isFolder = p.charAt(p.length - 1) === '/';
  var parts = p.split('/').filter(Boolean);
  if (!isFolder) parts.pop(); // a page file belongs to its folder

  // No mark on the home page itself.
  if (!parts.length) return;

  // A folder index goes up to its parent folder; a page file (…/cube.html)
  // goes up to the folder it sits in.
  var upTo = isFolder ? parts.slice(0, -1) : parts;
  var href = upTo.length ? '/' + upTo.join('/') + '/' : '/';
  var label = upTo.length ? (LABELS[upTo[upTo.length - 1]] || 'Up') : 'Home';

  function render() {
    if (document.querySelector('.site-nav')) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('aria-label', 'Site navigation');
    var a = document.createElement('a');
    a.href = href;
    a.title = label;
    a.setAttribute('aria-label', label === 'Home' ? 'Home' : 'Back to ' + label);
    a.innerHTML = MARK;
    nav.appendChild(a);
    document.body.appendChild(nav);

    var rod = a.querySelector('.pm-rod');
    function swing() {
      if (nav.classList.contains('swing')) return;
      nav.classList.add('swing');
    }
    rod.addEventListener('animationend', function () { nav.classList.remove('swing'); });
    a.addEventListener('pointerenter', swing);
    a.addEventListener('focus', swing);
    a.addEventListener('touchstart', swing, { passive: true });
    setTimeout(swing, 600);
  }

  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render);
})();
