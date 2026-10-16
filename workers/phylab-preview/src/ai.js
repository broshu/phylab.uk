// DeepSeek does two jobs: score relevance (batches of up to 10) and draft the
// catalogue notes for one paper. It only ever sees real metadata and abstracts.
import { PRIORITIES, TOPICS } from '../../../literature/core.mjs';

const CJK = /[㐀-鿿]/u;

/** @param {any} env */
export function aiSettings(env) {
  return {
    apiKey: env.DEEPSEEK_API_KEY || '',
    model: env.AI_MODEL || 'deepseek-v4-flash',
    baseUrl: (env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  };
}

export async function callJSON(settings, system, user, maxTokens = 1500) {
  if (!settings.apiKey) throw new Error('DEEPSEEK_API_KEY is not set');
  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: settings.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  try { return JSON.parse(text); } catch { throw new Error('DeepSeek returned invalid JSON'); }
}

const topicList = Object.entries(TOPICS).map(([k, v]) => `${k} (${v})`).join(', ');

function profileText(profile) {
  const topics = (profile.topics || []).filter(t => TOPICS[t]).map(t => TOPICS[t]).join(', ');
  return `Reader's focus: ${profile.notes || ''}\nTopics the reader wants: ${topics || 'any physics education research'}.`;
}

/** Examples of past decisions teach the screener the owner's taste. */
function feedbackText(feedback = {}) {
  const lines = [];
  if (feedback.approved?.length) lines.push('Recently ACCEPTED by the reader:', ...feedback.approved.map(t => `+ ${t}`));
  if (feedback.rejected?.length) lines.push('Recently REJECTED by the reader (with reason):', ...feedback.rejected.map(r => `- ${r.title}${r.reason ? ` [reason: ${r.reason}]` : ''}`));
  return lines.join('\n');
}

export function screenPrompt(profile, feedback, papers) {
  const system = [
    'You screen newly published papers for a curated physics education research reading library kept by a secondary-school physics teacher who is preparing a PhD in physics education research.',
    profileText(profile),
    feedbackText(feedback),
    'Score each paper 1-5 for how worth adding it is: 5 = clearly on-focus empirical or review work the reader should read; 4 = relevant and useful; 3 = loosely related; 2 = physics or education but off-focus; 1 = not physics education research.',
    'Papers that are only physics content (no teaching or learning), conference notices, or opinion pieces without evidence score 2 or lower. Learn from the accepted and rejected examples.',
    'Reply with JSON: {"results":[{"i":<index>,"score":<1-5>,"reason_zh":"<one short Chinese sentence explaining the score>"}]} with one result per paper.',
  ].filter(Boolean).join('\n\n');
  const user = papers.map((p, i) => `#${i}\nTitle: ${p.title}\nJournal: ${p.source} (${p.published_date || p.year})\nAbstract: ${(p.abstract || '(no abstract available)').slice(0, 1200)}`).join('\n\n');
  return { system, user };
}

export function parseScreen(reply, count) {
  const out = new Map();
  for (const r of Array.isArray(reply?.results) ? reply.results : []) {
    const i = Number(r.i), score = Number(r.score);
    if (Number.isInteger(i) && i >= 0 && i < count && Number.isInteger(score) && score >= 1 && score <= 5) {
      out.set(i, { score, reason_zh: String(r.reason_zh || '').slice(0, 200) });
    }
  }
  return out;
}

export function draftPrompt(profile, paper) {
  const system = [
    'You write catalogue notes for one paper in a curated physics education research reading library. Public notes are in British English; the _zh fields are private Chinese notes for the curator.',
    profileText(profile),
    'Use ONLY what the title and abstract support. Do not invent sample sizes, effects, or methods. If the abstract does not report results, say so plainly. Do not copy sentences from the abstract; paraphrase. No Chinese characters in any _en field.',
    `Choose topics only from: ${topicList}.`,
    'reading_priority: "core" = essential for a PhD on AI-supported, hands-on and simulation-based physics learning; "read" = read in full; "skim" = background.',
    'Write TWO alternative key findings (each at most 55 words): version A is a short plain summary; version B adds the study design and the most specific result the abstract gives.',
    'phd_relevance is curatorial judgement (start with "Use this ..." or similar), separate from the findings. reading_recommendation says which sections to read and why. limitations distinguishes performance during support, experimental capability, and independent transfer where relevant.',
    'Reply with JSON: {"topics":[...],"evidence_type":"<e.g. Randomised experiment, Quasi-experiment, Systematic review, Case study, Instrument validation, Theoretical framework>","reading_priority":"core|read|skim","findings":[{"en":"...","zh":"..."},{"en":"...","zh":"..."}],"phd_relevance_en":"...","phd_relevance_zh":"...","reading_recommendation_en":"...","reading_recommendation_zh":"...","limitations_en":"...","limitations_zh":"...","summary_zh":"<two Chinese sentences telling the curator what the paper did and found>"}',
  ].join('\n\n');
  const user = `Title: ${paper.title}\nAuthors: ${paper.authors.join(', ')}\nJournal: ${paper.source} (${paper.published_date || paper.year})\nDOI: ${paper.doi}\nAbstract: ${paper.abstract || '(no abstract available; base notes on the title only and say the abstract was unavailable)'}`;
  return { system, user };
}

const english = v => typeof v === 'string' && /[A-Za-z]/.test(v) && !CJK.test(v) && v.trim().length > 10;

/** Returns a clean draft or throws with the reason. */
export function parseDraft(reply) {
  const topics = [...new Set((reply?.topics || []).filter(t => Object.hasOwn(TOPICS, t)))];
  const findings = (reply?.findings || []).slice(0, 2).map(f => ({ en: String(f?.en || '').trim(), zh: String(f?.zh || '').trim() }));
  const draft = {
    topics: topics.length ? topics : ['assessment'],
    evidence_type: String(reply?.evidence_type || '').trim().slice(0, 80) || 'Empirical study',
    priority: Object.hasOwn(PRIORITIES, reply?.reading_priority) ? reply.reading_priority : 'read',
    findings,
    summary_zh: String(reply?.summary_zh || '').trim(),
  };
  for (const key of ['phd_relevance', 'reading_recommendation', 'limitations']) {
    draft[`${key}_en`] = String(reply?.[`${key}_en`] || '').trim();
    draft[`${key}_zh`] = String(reply?.[`${key}_zh`] || '').trim();
  }
  const bad = ['phd_relevance_en', 'reading_recommendation_en', 'limitations_en'].filter(k => !english(draft[k]));
  if (findings.length < 2 || !findings.every(f => english(f.en))) bad.push('findings');
  if (bad.length) throw new Error(`AI draft incomplete: ${bad.join(', ')}`);
  return draft;
}
