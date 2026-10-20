// preview.phylab.uk
//   /          the desk: paper screening first, then site preview and settings
//   /site/     a live copy of phylab.uk read straight from GitHub (any branch)
//   /api/...   desk actions; every change is a commit in the repository
//   /api/ask, /api/fulltext   questions about one paper (DeepSeek, full text in KV; see paperchat.js)
import hubHTML from './hub.html';
import { TOPICS } from './literature.js';
import { fetchRaw, listBranches, recentCommits, validBranch } from './github.js';
import { DEFAULT_PROFILE, addNote, approve, expire, findPaper, loadDesk, publicDesk, reject, restore, saveProfile, setFeatured } from './store.js';
import { buildSystem, cleanMessages, describe, getFullText, saveUploadedPdf } from './paperchat.js';
import { REVIEW_DIR } from './reviewfile.js';

const BRANCH_COOKIE = 'pv_branch';
const YEAR = 60 * 60 * 24 * 400;
// The copy duplicates phylab.uk, so keep it out of search results.
const BASE_HEADERS = { 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'strict-origin-when-cross-origin' };

const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', ico: 'image/x-icon', pdf: 'application/pdf', csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8', webm: 'video/webm', mp4: 'video/mp4', woff: 'font/woff', woff2: 'font/woff2', glb: 'model/gltf-binary',
  wasm: 'application/wasm', xml: 'application/xml', usdz: 'model/vnd.usdz+zip',
};

function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function json(data, status = 200) {
  return Response.json(data, { status, headers: { ...BASE_HEADERS, 'Cache-Control': 'no-store' } });
}

/** Map a URL path to a repository file, or a redirect for directory URLs. */
export function resolvePath(pathname) {
  let path;
  try { path = decodeURIComponent(pathname); } catch { return { error: true }; }
  if (path.split('/').some(seg => seg === '..' || seg === '.git')) return { error: true };
  if (path === '/site' || path === '/site/') return path === '/site' ? { redirect: '/site/' } : { file: 'index.html' };
  path = path.replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) return { file: `${path}index.html` };
  const last = path.split('/').pop();
  if (!last.includes('.')) return { redirect: `/${path}/` };
  return { file: path };
}

function badge(branch) {
  const safe = branch.replace(/[^A-Za-z0-9._/-]/g, '');
  return `<div id="pv-badge" style="position:fixed;left:12px;bottom:12px;z-index:2147483000;font:500 12px/1 Inter,system-ui,sans-serif;display:flex;gap:2px;align-items:center;background:#2f5d4f;color:#fff;border-radius:999px;padding:4px 4px 4px 12px;box-shadow:0 4px 16px rgba(0,0,0,.25)">`
    + `<a href="/" style="color:#fff;text-decoration:none;padding:4px 0">预览 · ${safe}</a>`
    + `<button type="button" aria-label="隐藏" style="all:unset;cursor:pointer;padding:4px 8px;opacity:.75" onclick="this.parentNode.remove();try{sessionStorage.setItem('pv-badge-off','1')}catch(e){}">×</button></div>`
    + `<script>try{if(sessionStorage.getItem('pv-badge-off'))document.getElementById('pv-badge').remove()}catch(e){}document.addEventListener('fullscreenchange',function(){var b=document.getElementById('pv-badge');if(b)b.style.display=document.fullscreenElement?'none':'flex'})</script>`;
}

async function mirror(request, env, ctx, branch) {
  const url = new URL(request.url);
  const target = resolvePath(url.pathname);
  if (target.error) return new Response('Not found', { status: 404, headers: BASE_HEADERS });
  if (target.redirect) return Response.redirect(`${url.origin}${target.redirect}${url.search}`, 301);
  const ext = (target.file.split('.').pop() || '').toLowerCase();
  const isHTML = ext === 'html' || ext === 'htm';
  const cacheKey = new Request(`https://preview-cache.invalid/${encodeURIComponent(branch)}/${target.file}`);
  const cache = caches.default;
  // Pages and data are always fresh; other files are cached for 15 seconds.
  if (!isHTML && ext !== 'json') {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  const upstream = await fetchRaw(env, target.file, branch);
  if (!upstream) {
    const esc = s => s.replace(/[<>&"]/g, '');
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Not found</title><body style="font:16px system-ui;padding:40px">分支 <b>${esc(branch)}</b> 里没有 /${esc(target.file)}<p><a href="/site/">网站首页</a> · <a href="/">预览台</a></p>`,
      { status: 404, headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const headers = { ...BASE_HEADERS, 'Content-Type': TYPES[ext] || 'application/octet-stream' };
  if (isHTML) {
    const page = new Response(upstream.body, { headers: { ...headers, 'Cache-Control': 'no-store' } });
    return new HTMLRewriter()
      .on('head', { element(el) { el.append('<meta name="robots" content="noindex">', { html: true }); } })
      .on('body', { element(el) { el.append(badge(branch), { html: true }); } })
      .transform(page);
  }
  const response = new Response(upstream.body, { headers: { ...headers, 'Cache-Control': ext === 'json' ? 'no-store' : 'public, max-age=15' } });
  if (ext !== 'json') ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export function cleanProfile(input) {
  const p = input && typeof input === 'object' ? input : {};
  const strings = (list, max, len) => (Array.isArray(list) ? list : []).map(s => String(s).trim()).filter(Boolean).map(s => s.slice(0, len)).slice(0, max);
  const known = new Map(DEFAULT_PROFILE.journals.map(j => [j.issn, j]));
  return {
    topics: strings(p.topics, 20, 40).filter(t => Object.hasOwn(TOPICS, t)),
    keywords: [...new Set(strings(p.keywords, 25, 80))],
    journals: (Array.isArray(p.journals) ? p.journals : []).filter(j => /^\d{4}-\d{3}[\dX]$/.test(j?.issn)).slice(0, 25)
      .map(j => ({ name: String(j.name || known.get(j.issn)?.name || j.issn).slice(0, 100), issn: j.issn, on: Boolean(j.on), physics: Boolean(j.physics ?? known.get(j.issn)?.physics) })),
    notes: String(p.notes || '').slice(0, 1500),
    threshold: [3, 4, 5].includes(Number(p.threshold)) ? Number(p.threshold) : 4,
    window_days: Math.min(90, Math.max(14, Number(p.window_days) || 45)),
  };
}

const text = (value, max) => String(value || '').replace(/\r/g, '').trim().slice(0, max);
const id = value => {
  const s = String(value || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) throw Object.assign(new Error('bad id'), { status: 400 });
  return s;
};
const ids = list => (Array.isArray(list) ? list : []).slice(0, 50).map(id);

async function api(request, env, ctx, url, branch) {
  if (request.method === 'GET' && url.pathname === '/api/desk') {
    const [desk, activity] = await Promise.all([loadDesk(env), recentCommits(env, REVIEW_DIR).catch(() => [])]);
    return json({ ...publicDesk(desk), activity, repo: env.GITHUB_REPO || 'broshu/phylab.uk' });
  }
  if (request.method === 'GET' && url.pathname === '/api/branches') return json({ branches: await listBranches(env), current: branch });
  if (request.method === 'GET' && url.pathname === '/api/fulltext') {
    const paper = findPaper(await loadDesk(env), id(url.searchParams.get('id')));
    return json(describe(await getFullText(env, paper)));
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden' }, 403);
  if (env.WRITE_LIMIT) {
    const { success } = await env.WRITE_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'anon' });
    if (!success) return json({ error: '操作太频繁，请稍等一分钟' }, 429);
  }
  if (url.pathname === '/api/fulltext') {
    // A PDF uploaded from a card: raw bytes, not JSON.
    const paper = findPaper(await loadDesk(env), id(url.searchParams.get('id')));
    try {
      const record = await saveUploadedPdf(env, paper, new Uint8Array(await request.arrayBuffer()), { force: url.searchParams.get('force') === '1' });
      return json({ ok: true, ...describe(record) });
    } catch (error) {
      return json({ error: error.message, code: error.code }, error.status || 500);
    }
  }
  const raw = await request.text();
  if (raw.length > 64 * 1024) return json({ error: 'Too large' }, 413);
  let body;
  try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ error: 'Bad JSON' }, 400); }
  switch (url.pathname) {
    case '/api/approve': {
      const out = await approve(env, { id: id(body.id), choice: body.choice, reason: text(body.reason, 300) });
      return json({ ok: true, ...out });
    }
    case '/api/reject': {
      const out = await reject(env, { id: id(body.id), reason: text(body.reason, 300) });
      return json({ ok: true, ...out });
    }
    case '/api/restore': {
      const out = await restore(env, { id: id(body.id) });
      return json({ ok: true, ...out });
    }
    case '/api/note': {
      const note = text(body.text, 500);
      if (!note) return json({ error: '留言是空的' }, 400);
      return json({ ok: true, ...(await addNote(env, { id: id(body.id), text: note })) });
    }
    case '/api/feature':
      return json({ ok: true, ...(await setFeatured(env, { id: id(body.id), on: Boolean(body.on) })) });
    case '/api/expire': {
      return json({ ok: true, ...(await expire(env, { remove: ids(body.remove), keep: ids(body.keep) })) });
    }
    case '/api/ask': {
      if (!env.AI) return json({ error: '提问功能还没有接上 DeepSeek' }, 503);
      if (env.ASK_LIMIT) {
        const { success } = await env.ASK_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'anon' });
        if (!success) return json({ error: '提问太频繁，请稍等一分钟' }, 429);
      }
      const messages = cleanMessages(body.messages);
      const paper = findPaper(await loadDesk(env), id(body.id));
      const record = await getFullText(env, paper);
      const stream = await env.AI.chat({ system: buildSystem(paper, record), messages, maxTokens: 1500 });
      return new Response(stream, { headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Paper-Basis': encodeURIComponent(record ? record.source : '只有摘要') } });
    }
    case '/api/profile':
      return json({ ok: true, ...(await saveProfile(env, { profile: cleanProfile(body.profile) })) });
    default:
      return json({ error: 'Not found' }, 404);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    const jar = cookies(request);
    const branch = validBranch(jar[BRANCH_COOKIE]) ? jar[BRANCH_COOKIE] : (env.PREVIEW_DEFAULT_BRANCH || 'main');
    try {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return new Response(hubHTML, { headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      if (url.pathname === '/__branch') {
        const b = url.searchParams.get('b') || 'main';
        if (!validBranch(b)) return json({ error: 'bad branch' }, 400);
        return new Response(null, { status: 302, headers: { ...BASE_HEADERS, Location: '/site/',
          'Set-Cookie': `${BRANCH_COOKIE}=${encodeURIComponent(b)}; Max-Age=${YEAR}; Path=/; Secure; SameSite=Lax` } });
      }
      if (url.pathname.startsWith('/api/')) return await api(request, env, ctx, url, branch);
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'Method not allowed' }, 405);
      return await mirror(request, env, ctx, branch);
    } catch (error) {
      console.error(error);
      if (url.pathname.startsWith('/api/')) return json({ error: error.message }, error.status || 500);
      return new Response(`出错了：${error.message}`, { status: 500, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  },
};
