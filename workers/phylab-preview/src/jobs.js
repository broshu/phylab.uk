// The weekly pipeline, split into small resumable chunks so that one cron run
// or one button press never needs more than a few dozen outbound requests.
//   collect (APS + Crossref) -> abstracts -> screen (AI) -> draft (AI) -> commit to literature/review/pending/
// D1 only holds this work in progress; finished drafts live in the repository.
import { normalizeDOI } from '../../../literature/core.mjs';
import { collectionPlan, fillAbstracts, runStep } from './collect.js';
import { aiSettings, callJSON, draftPrompt, parseDraft, parseScreen, screenPrompt } from './ai.js';
import { makeId, shanghaiDate } from './literature.js';
import { PENDING_DIR, paperFromDraft, serializeReview } from './reviewfile.js';
import { WANTED, deskFrom, knownDOIs, loadDesk, takenIds } from './store.js';
import { readRepo, transact } from './github.js';

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
export async function log(db, kind, message) {
  await db.batch([
    db.prepare('INSERT INTO activity (at, kind, message) VALUES (?, ?, ?)').bind(new Date().toISOString(), kind, String(message).slice(0, 500)),
    db.prepare('DELETE FROM activity WHERE id NOT IN (SELECT id FROM activity ORDER BY id DESC LIMIT 200)'),
  ]);
}
export async function stageCounts(db) {
  const { results } = await db.prepare('SELECT stage, COUNT(*) AS n FROM candidates GROUP BY stage').all();
  return Object.fromEntries(results.map(r => [r.stage, r.n]));
}
export async function pipelineStatus(db) {
  const [counts, collecting, last] = await Promise.all([stageCounts(db), getSetting(db, 'collect_state'), getSetting(db, 'last_collect')]);
  return { counts, collecting: Boolean(collecting), last_collect: last, busy: Boolean(collecting || counts.new || counts.screened || counts.drafted) };
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/** Past decisions from the repository teach the screener what the reviewers want. */
function feedbackFrom(desk) {
  const decided = desk.done.filter(p => !p.broken && p.decision).sort((a, b) => (b.decision.at || '').localeCompare(a.decision.at || ''));
  return {
    rejected: decided.filter(p => p.status === 'rejected').slice(0, 15).map(p => ({ title: p.title, reason: p.decision.reason })),
    approved: decided.filter(p => p.status === 'approved').slice(0, 10).map(p => p.title),
  };
}

/**
 * Do up to `budget` outbound requests of pipeline work.
 * @param {any} env @param {{ force?: boolean, budget?: number, now?: Date }} options
 */
export async function work(env, { force = false, budget = 30, now = new Date() } = {}) {
  const db = env.PREVIEW_DB;
  const today = shanghaiDate(now);
  let state = await getSetting(db, 'collect_state', null);
  const last = await getSetting(db, 'last_collect', null);
  const due = !state && (force || !last || daysBetween(last, today) >= COLLECT_EVERY_DAYS);
  const before = await stageCounts(db);
  if (!state && !due && !before.new && !before.screened && !before.drafted) return { done: [], ...(await pipelineStatus(db)) };

  budget -= 1;
  let desk = await loadDesk(env);
  const profile = desk.profile;
  const done = [];

  if (due) {
    state = { step: 0, found: 0, warnings: [], started: today };
    await setSetting(db, 'collect_state', state);
    await log(db, 'collect', '开始抓取新论文');
  }

  // 1. Collection
  if (state && budget > 0) {
    const plan = collectionPlan(profile);
    const known = knownDOIs(desk);
    const taken = takenIds(desk);
    while (state.step < plan.length && budget > 0) {
      const step = plan[state.step];
      budget -= 1;
      try {
        const records = (await runStep(step, profile, today)).filter(r => !known.has(r.doi));
        const label = step.kind === 'aps' ? 'APS PRPER' : step.name || step.query;
        const stmts = records.map(r => {
          const id = makeId(r, taken);
          taken.add(id);
          return db.prepare(
            'INSERT OR IGNORE INTO candidates (doi, paper_id, meta, sources, stage, collected_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).bind(r.doi, id, JSON.stringify({ ...r, abstract_checked: !!r.abstract }), JSON.stringify([label]), 'new', today, today);
        });
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

  // Wait for collection to finish before spending AI calls, so each week's list is judged together.
  if (state) return { done, ...(await pipelineStatus(db)) };
  const ai = aiSettings(env);
  if (!ai.apiKey) return { done, ...(await pipelineStatus(db)), warning: 'DEEPSEEK_API_KEY missing' };
  const feedback = feedbackFrom(desk);

  // 3. Screening, 10 per AI call
  while (budget > 1) {
    const { results } = await db.prepare("SELECT doi, meta FROM candidates WHERE stage = 'new' ORDER BY collected_at LIMIT 10").all();
    if (!results.length) break;
    budget -= 1;
    const papers = results.map(r => JSON.parse(r.meta));
    const { system, user } = screenPrompt(profile, feedback, papers);
    let scores;
    try { scores = parseScreen(await callJSON(ai, system, user, 1500), papers.length); }
    catch (error) { await log(db, 'warn', `AI 筛选失败：${error.message}`); break; }
    if (!scores.size) { await log(db, 'warn', 'AI 筛选没有返回有效评分'); break; }
    const threshold = Number(profile.threshold) || 4;
    await db.batch(results.filter((r, i) => scores.has(i)).map(r => {
      const s = scores.get(results.indexOf(r));
      return db.prepare('UPDATE candidates SET stage = ?, score = ?, reason_zh = ?, updated_at = ? WHERE doi = ?')
        .bind(s.score >= threshold ? 'screened' : 'skipped', s.score, s.reason_zh, today, r.doi);
    }));
    done.push('screen');
  }

  // 4. Drafting, one paper per AI call, best first (keep one request for the commit)
  while (budget > 1) {
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

  // 5. Commit finished drafts to the repository as Markdown files
  const { results: ready } = await db.prepare("SELECT * FROM candidates WHERE stage = 'drafted' ORDER BY score DESC LIMIT 25").all();
  if (ready.length && budget > 0) {
    try {
      const { result } = await transact(env, WANTED, snapshot => {
        const current = deskFrom(snapshot);
        const known = knownDOIs(current), taken = takenIds(current);
        const files = [], skipped = [];
        for (const row of ready) {
          if (known.has(normalizeDOI(row.doi))) { skipped.push(row.doi); continue; }
          const meta = JSON.parse(row.meta);
          const id = taken.has(row.paper_id) ? makeId(meta, taken) : row.paper_id;
          taken.add(id);
          const paper = paperFromDraft(meta, JSON.parse(row.draft), { id, added: today, proposed_by: `DeepSeek (${ai.model})`, score: row.score, reason_zh: row.reason_zh });
          files.push({ path: `${PENDING_DIR}/${id}.md`, contents: serializeReview(paper) });
        }
        if (!files.length) return { result: { added: 0, skipped } };
        return {
          headline: `Literature review: ${files.length} new candidate${files.length > 1 ? 's' : ''}`,
          body: 'Found and drafted by the weekly search on preview.phylab.uk. Nothing is published until a reviewer approves it.',
          additions: files, result: { added: files.length, skipped },
        };
      });
      await db.batch(ready.map(r => db.prepare("UPDATE candidates SET stage = 'queued', updated_at = ? WHERE doi = ?").bind(today, r.doi)));
      if (result?.added) await log(db, 'ready', `${result.added} 篇新论文等待筛选`);
      done.push('commit');
    } catch (error) {
      await log(db, 'warn', `写入 GitHub 失败：${error.message}`);
    }
  }
  return { done, ...(await pipelineStatus(db)) };
}

export { readRepo };
