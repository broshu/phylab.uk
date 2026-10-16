// The weekly pipeline, split into small resumable chunks so that one cron run
// or one button press never needs more than a few dozen outbound requests.
//   collect (APS + Crossref)  ->  fill abstracts (OpenAlex)  ->  screen (AI)  ->  draft notes (AI)
import { normalizeDOI } from '../../../literature/core.mjs';
import { DEFAULT_PROFILE, collectionPlan, fillAbstracts, runStep } from './collect.js';
import { aiSettings, callJSON, draftPrompt, parseDraft, parseScreen, screenPrompt } from './ai.js';
import { CATALOG_PATH, makeId, shanghaiDate } from './literature.js';
import { readFile } from './github.js';

const COLLECT_EVERY_DAYS = 7;

export async function getSetting(db, key, fallback = null) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}
export async function setSetting(db, key, value) {
  if (value === null || value === undefined) return db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
  return db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, JSON.stringify(value)).run();
}
export async function getProfile(db) {
  const saved = await getSetting(db, 'profile', null);
  return { ...DEFAULT_PROFILE, ...(saved || {}) };
}
export async function log(db, kind, message) {
  await db.batch([
    db.prepare('INSERT INTO activity (at, kind, message) VALUES (?, ?, ?)').bind(new Date().toISOString(), kind, String(message).slice(0, 500)),
    db.prepare('DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 200)'),
  ]);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export async function stageCounts(db) {
  const { results } = await db.prepare('SELECT stage, COUNT(*) AS n FROM candidates GROUP BY stage').all();
  return Object.fromEntries(results.map(r => [r.stage, r.n]));
}

async function feedback(db) {
  const rejected = await db.prepare("SELECT meta, reject_reason FROM candidates WHERE stage = 'rejected' ORDER BY decided_at DESC LIMIT 15").all();
  const approved = await db.prepare("SELECT meta FROM candidates WHERE stage = 'approved' ORDER BY decided_at DESC LIMIT 10").all();
  return {
    rejected: rejected.results.map(r => ({ title: JSON.parse(r.meta).title, reason: r.reject_reason })),
    approved: approved.results.map(r => JSON.parse(r.meta).title),
  };
}

/**
 * Do up to `budget` outbound requests of pipeline work.
 * @param {any} env @param {{ force?: boolean, budget?: number, now?: Date }} options
 */
export async function work(env, { force = false, budget = 30, now = new Date() } = {}) {
  const db = env.PREVIEW_DB;
  const today = shanghaiDate(now);
  const profile = await getProfile(db);
  let state = await getSetting(db, 'collect_state', null);
  const last = await getSetting(db, 'last_collect', null);
  const done = [];

  if (!state && (force || !last || daysBetween(last, today) >= COLLECT_EVERY_DAYS)) {
    state = { step: 0, found: 0, warnings: [], started: today };
    await setSetting(db, 'collect_state', state);
    await log(db, 'collect', '开始抓取新论文');
  }

  // 1. Collection
  if (state && budget > 0) {
    const plan = collectionPlan(profile);
    budget -= 1;
    const catalog = JSON.parse((await readFile(env, CATALOG_PATH)).text);
    const known = new Set(catalog.papers.map(p => normalizeDOI(p.doi || '')).filter(Boolean));
    const taken = new Set(catalog.papers.map(p => p.id));
    while (state.step < plan.length && budget > 0) {
      const step = plan[state.step];
      budget -= 1;
      try {
        const records = (await runStep(step, profile, today)).filter(r => !known.has(r.doi));
        const label = step.kind === 'aps' ? 'APS PRPER' : step.name || step.query;
        const stmts = records.map(r => db.prepare(
          'INSERT OR IGNORE INTO candidates (doi, paper_id, meta, sources, stage, collected_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ).bind(r.doi, makeId(r, taken), JSON.stringify({ ...r, abstract_checked: !!r.abstract }), JSON.stringify([label]), 'new', today, today));
        if (stmts.length) {
          const results = await db.batch(stmts);
          state.found += results.reduce((n, x) => n + (x.meta?.changes || 0), 0);
        }
      } catch (error) {
        state.warnings.push(`${step.kind} ${step.issn || step.query || ''}: ${error.message}`);
      }
      state.step += 1;
      done.push('collect');
    }
    if (state.step >= plan.length) {
      await setSetting(db, 'collect_state', null);
      await setSetting(db, 'last_collect', today);
      await log(db, 'collect', `抓取完成：新增 ${state.found} 篇候选${state.warnings.length ? `；${state.warnings.length} 个来源失败（${state.warnings.slice(0, 3).join('; ')}）` : ''}`);
      state = null;
    } else {
      await setSetting(db, 'collect_state', state);
    }
  }

  // 2. Missing abstracts, 40 per batch (OpenAlex, then Semantic Scholar)
  let abstractWarned = false;
  while (budget > 1) {
    const { results } = await db.prepare("SELECT doi, meta FROM candidates WHERE stage = 'new' AND json_extract(meta, '$.abstract_checked') = 0 LIMIT 40").all();
    if (!results.length) break;
    budget -= 2;
    const [found, warnings] = await fillAbstracts(results.map(r => r.doi), env);
    if (warnings.length && !found.size && !abstractWarned) { abstractWarned = true; await log(db, 'warn', `补摘要失败：${warnings.join('; ')}`); }
    await db.batch(results.map(r => {
      const meta = JSON.parse(r.meta);
      meta.abstract = meta.abstract || found.get(r.doi) || '';
      meta.abstract_checked = true;
      return db.prepare('UPDATE candidates SET meta = ?, updated_at = ? WHERE doi = ?').bind(JSON.stringify(meta), today, r.doi);
    }));
    done.push('abstracts');
  }

  // Wait for collection to finish before spending AI calls, so every week's list is judged together.
  if (state) return { done, collecting: true, counts: await stageCounts(db) };
  const ai = aiSettings(env);
  if (!ai.apiKey) return { done, collecting: false, counts: await stageCounts(db), warning: 'DEEPSEEK_API_KEY missing' };
  const fb = await feedback(db);

  // 3. Screening, 10 per AI call
  while (budget > 0) {
    const { results } = await db.prepare("SELECT doi, meta FROM candidates WHERE stage = 'new' ORDER BY collected_at LIMIT 10").all();
    if (!results.length) break;
    budget -= 1;
    const papers = results.map(r => JSON.parse(r.meta));
    const { system, user } = screenPrompt(profile, fb, papers);
    let scores;
    try { scores = parseScreen(await callJSON(ai, system, user, 1500), papers.length); }
    catch (error) { await log(db, 'warn', `AI 筛选失败：${error.message}`); break; }
    const threshold = Number(profile.threshold) || 4;
    await db.batch(results.map((r, i) => {
      const s = scores.get(i);
      if (!s) return db.prepare("UPDATE candidates SET updated_at = ? WHERE doi = ?").bind(today, r.doi);
      return db.prepare('UPDATE candidates SET stage = ?, score = ?, reason_zh = ?, updated_at = ? WHERE doi = ?')
        .bind(s.score >= threshold ? 'screened' : 'skipped', s.score, s.reason_zh, today, r.doi);
    }));
    if (!scores.size) { await log(db, 'warn', 'AI 筛选没有返回有效评分'); break; }
    done.push('screen');
  }

  // 4. Drafting, one paper per AI call, best first
  while (budget > 0) {
    const row = await db.prepare("SELECT doi, meta, error FROM candidates WHERE stage = 'screened' ORDER BY score DESC, collected_at LIMIT 1").first();
    if (!row) break;
    budget -= 1;
    const meta = JSON.parse(row.meta);
    const { system, user } = draftPrompt(profile, meta);
    try {
      const draft = parseDraft(await callJSON(ai, system, user, 2200));
      await db.prepare("UPDATE candidates SET stage = 'drafted', draft = ?, error = NULL, updated_at = ? WHERE doi = ?")
        .bind(JSON.stringify(draft), today, row.doi).run();
      done.push('draft');
    } catch (error) {
      const failed = Boolean(row.error);
      await db.prepare('UPDATE candidates SET stage = ?, error = ?, updated_at = ? WHERE doi = ?')
        .bind(failed ? 'error' : 'screened', error.message.slice(0, 300), today, row.doi).run();
      if (failed) await log(db, 'warn', `笔记生成失败：${meta.title.slice(0, 60)}（${error.message}）`);
    }
  }
  const counts = await stageCounts(db);
  if (done.includes('draft') && !counts.screened && !counts.new) await log(db, 'ready', `有 ${counts.drafted || 0} 篇论文等你审核`);
  return { done, collecting: false, counts };
}
