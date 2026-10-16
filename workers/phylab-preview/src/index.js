// preview.phylab.uk — a private, always-current copy of phylab.uk plus the
// literature review desk. No account: a secret link sets a long-lived cookie.
import reviewHTML from './review.html';
import { TOPICS, PRIORITIES, CATALOG_PATH, addToCatalog, buildEntry, expiredEntries, removeFromCatalog, shanghaiDate } from './literature.js';
import { fetchRaw, listBranches, readFile, updateFile, validBranch } from './github.js';
import { getProfile, getSetting, log, setSetting, stageCounts, work } from './jobs.js';
import { DEFAULT_PROFILE } from './collect.js';

const KEY_COOKIE = 'pv_key';
const BRANCH_COOKIE = 'pv_branch';
const YEAR = 60 * 60 * 24 * 400;
const BASE_HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };

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
function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function json(data, status = 200) {
  return Response.json(data, { status, headers: { ...BASE_HEADERS, 'Cache-Control': 'no-store' } });
}
function notFound() {
  return new Response('Not found', { status: 404, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain' } });
}

/** The access key: a secret if one is set, otherwise generated once and kept in D1. */
export async function accessKey(env) {
  if (env.PREVIEW_KEY) return env.PREVIEW_KEY;
  let key = await getSetting(env.PREVIEW_DB, 'access_key', null);
  if (!key) {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    key = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
    await setSetting(env.PREVIEW_DB, 'access_key', key);
  }
  return key;
}

/** Map a URL path to a repository file path, or a redirect for directory URLs. */
export function resolvePath(pathname) {
  let path;
  try { path = decodeURIComponent(pathname); } catch { return { error: true }; }
  if (path.split('/').some(seg => seg === '..' || seg === '.git')) return { error: true };
  path = path.replace(/^\/+/, '');
  if (path === '' || path.endsWith('/')) return { file: `${path}index.html` };
  const last = path.split('/').pop();
  if (!last.includes('.')) return { redirect: `/${path}/` };
  return { file: path };
}

function badge(branch, pending) {
  const label = `预览 · ${branch}${pending ? ` · 待审 ${pending}` : ''}`;
  return `<div id="pv-badge" style="position:fixed;left:12px;bottom:12px;z-index:2147483000;font:500 12px/1 Inter,system-ui,sans-serif;display:flex;gap:6px;align-items:center;background:rgba(28,43,37,.88);color:#fff;border-radius:999px;padding:7px 8px 7px 12px;box-shadow:0 4px 16px rgba(0,0,0,.25)">`
    + `<a href="/review" style="color:#fff;text-decoration:none">${label.replace(/[<>&"]/g, '')} →</a>`
    + `<button type="button" aria-label="隐藏" style="all:unset;cursor:pointer;padding:0 4px;opacity:.7" onclick="this.parentNode.remove();try{sessionStorage.setItem('pv-badge-off','1')}catch(e){}">×</button></div>`
    + `<script>try{if(sessionStorage.getItem('pv-badge-off'))document.getElementById('pv-badge').remove()}catch(e){}document.addEventListener('fullscreenchange',function(){var b=document.getElementById('pv-badge');if(b)b.style.display=document.fullscreenElement?'none':'flex'})</script>`;
}

async function mirror(request, env, ctx, branch) {
  const url = new URL(request.url);
  const target = resolvePath(url.pathname);
  if (target.error) return notFound();
  if (target.redirect) return Response.redirect(`${url.origin}${target.redirect}${url.search}`, 301);
  const ext = (target.file.split('.').pop() || '').toLowerCase();
  const isHTML = ext === 'html' || ext === 'htm';
  // Short cache for static assets only; pages and data are always fresh.
  const cacheKey = new Request(`https://preview-cache.invalid/${encodeURIComponent(branch)}/${target.file}`);
  const cache = caches.default;
  if (!isHTML && ext !== 'json') {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }
  const upstream = await fetchRaw(env, target.file, branch);
  if (!upstream) {
    return new Response(`<!doctype html><meta charset="utf-8"><title>Not found</title><body style="font:16px system-ui;padding:40px">在分支 <b>${branch.replace(/[<>&]/g, '')}</b> 中找不到 /${target.file.replace(/[<>&]/g, '')}<p><a href="/">首页</a> · <a href="/review">审核台</a></p>`,
      { status: 404, headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const headers = { ...BASE_HEADERS, 'Content-Type': TYPES[ext] || 'application/octet-stream' };
  if (isHTML) {
    const pending = (await stageCounts(env.PREVIEW_DB)).drafted || 0;
    const page = new Response(upstream.body, { headers: { ...headers, 'Cache-Control': 'no-store' } });
    return new HTMLRewriter()
      .on('head', { element(el) { el.append('<meta name="robots" content="noindex, nofollow">', { html: true }); } })
      .on('body', { element(el) { el.append(badge(branch, pending), { html: true }); } })
      .transform(page);
  }
  const response = new Response(upstream.body, { headers: { ...headers, 'Cache-Control': ext === 'json' ? 'no-store' : 'private, max-age=15' } });
  if (ext !== 'json') ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

function catalogRow(row) {
  return { doi: row.doi, paper_id: row.paper_id, meta: JSON.parse(row.meta), draft: row.draft ? JSON.parse(row.draft) : null, score: row.score, reason_zh: row.reason_zh, stage: row.stage };
}

async function apiState(env) {
  const db = env.PREVIEW_DB;
  const today = shanghaiDate();
  const [pendingRows, historyRows, activity, counts, profile, collecting, last, keptRows] = await Promise.all([
    db.prepare("SELECT * FROM candidates WHERE stage = 'drafted' ORDER BY score DESC, collected_at DESC").all(),
    db.prepare("SELECT doi, paper_id, meta, stage, reject_reason, decided_at FROM candidates WHERE stage IN ('approved','rejected') ORDER BY decided_at DESC LIMIT 40").all(),
    db.prepare('SELECT at, kind, message FROM activity ORDER BY id DESC LIMIT 15').all(),
    stageCounts(db), getProfile(db), getSetting(db, 'collect_state', null), getSetting(db, 'last_collect', null),
    db.prepare('SELECT paper_id FROM kept_old').all(),
  ]);
  let catalog = { papers: [] };
  try { catalog = JSON.parse((await readFile(env, CATALOG_PATH)).text); } catch (error) { await log(db, 'warn', `读取 papers.json 失败：${error.message}`); }
  const live = new Set(catalog.papers.map(p => p.id));
  return {
    today, counts, profile, topics: TOPICS, priorities: PRIORITIES,
    collecting: Boolean(collecting), last_collect: last,
    pending: pendingRows.results.map(catalogRow),
    history: historyRows.results.map(r => ({ doi: r.doi, paper_id: r.paper_id, title: JSON.parse(r.meta).title, stage: r.stage, reason: r.reject_reason, decided_at: r.decided_at, live: live.has(r.paper_id) })),
    expired: expiredEntries(catalog, today, new Set(keptRows.results.map(r => r.paper_id))),
    activity: activity.results,
  };
}

async function apiDecide(env, body) {
  const db = env.PREVIEW_DB;
  const row = await db.prepare('SELECT * FROM candidates WHERE doi = ?').bind(String(body.doi || '')).first();
  if (!row) return json({ error: '找不到这篇论文' }, 404);
  const now = new Date().toISOString();
  if (body.action === 'reject') {
    await db.prepare("UPDATE candidates SET stage = 'rejected', reject_reason = ?, decided_at = ?, updated_at = ? WHERE doi = ?")
      .bind(String(body.reason || '').slice(0, 40), now, now, row.doi).run();
    return json({ ok: true });
  }
  if (body.action === 'restore') {
    if (row.stage !== 'rejected') return json({ error: '这篇不是放弃状态' }, 409);
    await db.prepare("UPDATE candidates SET stage = ?, reject_reason = NULL, decided_at = NULL, updated_at = ? WHERE doi = ?")
      .bind(row.draft ? 'drafted' : 'screened', now, row.doi).run();
    return json({ ok: true });
  }
  if (body.action !== 'approve') return json({ error: 'unknown action' }, 400);
  if (!['drafted', 'approved'].includes(row.stage) || !row.draft) return json({ error: '这篇还没有生成笔记' }, 409);
  const today = shanghaiDate();
  const entry = buildEntry(JSON.parse(row.meta), JSON.parse(row.draft), body.choice || {}, row.paper_id, today);
  let paperId = entry.id;
  const result = await updateFile(env, CATALOG_PATH, `Literature: add ${entry.id} (approved in preview.phylab.uk)`, text => {
    const next = addToCatalog(text, entry, today);
    if (next) paperId = JSON.parse(next).papers.at(-1).id;
    return next;
  });
  await db.prepare("UPDATE candidates SET stage = 'approved', paper_id = ?, reject_reason = NULL, decided_at = ?, updated_at = ? WHERE doi = ?")
    .bind(paperId, now, now, row.doi).run();
  await log(db, 'publish', `收录：${entry.title.slice(0, 70)}`);
  return json({ ok: true, paper_id: paperId, commit: result.commit || null, already: !result.changed });
}

async function apiUnpublish(env, body) {
  const id = String(body.paper_id || '');
  if (!/^[a-z0-9-]+$/.test(id)) return json({ error: 'bad id' }, 400);
  const today = shanghaiDate();
  await updateFile(env, CATALOG_PATH, `Literature: remove ${id} (withdrawn in preview.phylab.uk)`, text => removeFromCatalog(text, [id], today));
  const now = new Date().toISOString();
  await env.PREVIEW_DB.prepare("UPDATE candidates SET stage = 'drafted', decided_at = NULL, updated_at = ? WHERE paper_id = ? AND stage = 'approved'").bind(now, id).run();
  await log(env.PREVIEW_DB, 'publish', `撤下：${id}`);
  return json({ ok: true });
}

async function apiExpire(env, body) {
  const db = env.PREVIEW_DB;
  const valid = list => (Array.isArray(list) ? list : []).map(String).filter(id => /^[a-z0-9-]+$/.test(id)).slice(0, 50);
  const remove = valid(body.remove), keep = valid(body.keep);
  const now = new Date().toISOString();
  if (keep.length) {
    await db.batch(keep.map(id => db.prepare('INSERT OR REPLACE INTO kept_old (paper_id, kept_at) VALUES (?, ?)').bind(id, now)));
    await log(db, 'expire', `保留到期论文：${keep.join(', ')}`);
  }
  if (remove.length) {
    const today = shanghaiDate();
    await updateFile(env, CATALOG_PATH, `Literature: remove ${remove.length} paper(s) older than two years`, text => removeFromCatalog(text, remove, today));
    await log(db, 'expire', `删除到期论文：${remove.join(', ')}`);
  }
  return json({ ok: true });
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

async function api(request, env, url, branch) {
  if (request.method === 'GET' && url.pathname === '/api/state') return json(await apiState(env));
  if (request.method === 'GET' && url.pathname === '/api/branches') return json({ branches: await listBranches(env), current: branch });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  // Same-origin only.
  if (request.headers.get('Origin') !== url.origin) return json({ error: 'Forbidden' }, 403);
  const text = await request.text();
  if (text.length > 64 * 1024) return json({ error: 'Too large' }, 413);
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { return json({ error: 'Bad JSON' }, 400); }
  switch (url.pathname) {
    case '/api/decide': return apiDecide(env, body);
    case '/api/unpublish': return apiUnpublish(env, body);
    case '/api/expire': return apiExpire(env, body);
    case '/api/profile': await setSetting(env.PREVIEW_DB, 'profile', cleanProfile(body.profile)); return json({ ok: true });
    case '/api/work': return json(await work(env, { force: Boolean(body.force), budget: 6 }));
    default: return json({ error: 'Not found' }, 404);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } });
    const key = await accessKey(env);
    const jar = cookies(request);

    if (url.pathname.startsWith('/k/')) {
      if (!same(url.pathname.slice(3), key)) return notFound();
      return new Response(null, { status: 302, headers: { ...BASE_HEADERS, Location: '/review',
        'Set-Cookie': `${KEY_COOKIE}=${encodeURIComponent(key)}; Max-Age=${YEAR}; Path=/; Secure; HttpOnly; SameSite=Lax` } });
    }
    if (!same(jar[KEY_COOKIE], key)) return notFound();

    const branch = validBranch(jar[BRANCH_COOKIE]) ? jar[BRANCH_COOKIE] : (env.PREVIEW_DEFAULT_BRANCH || 'main');
    try {
      if (url.pathname === '/__branch') {
        const b = url.searchParams.get('b') || 'main';
        if (!validBranch(b)) return notFound();
        return new Response(null, { status: 302, headers: { ...BASE_HEADERS, Location: '/',
          'Set-Cookie': `${BRANCH_COOKIE}=${encodeURIComponent(b)}; Max-Age=${YEAR}; Path=/; Secure; HttpOnly; SameSite=Lax` } });
      }
      if (url.pathname === '/review' || url.pathname === '/review/') {
        return new Response(reviewHTML, { headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      }
      if (url.pathname.startsWith('/api/')) return await api(request, env, url, branch);
      if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();
      return await mirror(request, env, ctx, branch);
    } catch (error) {
      console.error(error);
      if (url.pathname.startsWith('/api/')) return json({ error: error.message }, 500);
      return new Response(`出错了：${error.message}`, { status: 500, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(work(env, { budget: 30 }).catch(error => console.error('scheduled work failed', error)));
  },
};
