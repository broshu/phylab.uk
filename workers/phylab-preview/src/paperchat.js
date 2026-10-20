// "Ask this paper": questions about one candidate paper, answered by DeepSeek with the
// paper's full text in the prompt.
//
// Full text is kept privately in Workers KV (binding FULLTEXT), never in the public
// repository, because most papers are not open access. It comes from:
//   1. an open-access copy in a repository (OpenAlex, Semantic Scholar, arXiv), fetched
//      automatically. Publisher sites block automated downloads, so those are skipped;
//   2. a PDF a reviewer uploads on the card.
// Without either, answers are based on the abstract and say so.
//
// DeepSeek is reached through phylab-debate's PaperChat entrypoint (binding AI), which
// holds the API key.
import { extractText, getDocumentProxy } from 'unpdf';

const MAX_PDF_BYTES = 40 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;
const MISS_TTL = 60 * 60 * 12;
// Publisher hosts answer automated requests with a login page or 403.
const PUBLISHER = /(^|\.)(doi\.org|journals\.aps\.org|link\.aps\.org|iopscience\.iop\.org|link\.springer\.com|sciencedirect\.com|elsevier\.com|wiley\.com|tandfonline\.com|sagepub\.com|aip\.org|pubs\.aip\.org)$/i;
const UA = 'preview.phylab.uk paper desk (mailto:noreply@phylab.uk)';

const textKey = id => `ft:${id}`;
const missKey = id => `ft-miss:${id}`;

const words = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3);

/** Does the start of the extracted text look like this paper? (catches a wrong PDF) */
export function matchesTitle(text, title) {
  const want = [...new Set(words(title))];
  if (!want.length) return true;
  const head = new Set(words(String(text).slice(0, 6000)));
  return want.filter(w => head.has(w)).length / want.length >= 0.6;
}

export async function pdfToText(bytes) {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const clean = String(text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { pages: totalPages, text: clean.slice(0, MAX_TEXT_CHARS) };
}

async function candidateUrls(doi, title) {
  const urls = [];
  const add = (url, source) => {
    try {
      const u = new URL(url);
      if (u.protocol === 'https:' && !PUBLISHER.test(u.hostname) && !urls.some(x => x.url === u.href)) urls.push({ url: u.href, source });
    } catch { /* not a URL */ }
  };
  const get = (url) => fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const [openalex, s2, arxiv] = await Promise.all([
    get(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=locations&mailto=noreply@phylab.uk`),
    get(`https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=openAccessPdf,externalIds`),
    title ? fetch(`https://export.arxiv.org/api/query?max_results=3&search_query=${encodeURIComponent(`ti:"${title.slice(0, 200)}"`)}`, { signal: AbortSignal.timeout(10_000) }).then(r => (r.ok ? r.text() : '')).catch(() => '') : '',
  ]);
  for (const loc of openalex?.locations || []) if (loc.pdf_url) add(loc.pdf_url, `OpenAlex: ${loc.source?.display_name || new URL(loc.pdf_url).hostname}`);
  if (s2?.openAccessPdf?.url) add(s2.openAccessPdf.url, 'Semantic Scholar');
  if (s2?.externalIds?.ArXiv) add(`https://arxiv.org/pdf/${s2.externalIds.ArXiv}`, 'arXiv');
  for (const m of String(arxiv).matchAll(/<link[^>]+title="pdf"[^>]+href="([^"]+)"/g)) add(m[1].replace(/^http:/, 'https:'), 'arXiv');
  return urls;
}

async function fetchPdf(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/pdf' }, redirect: 'follow', signal: AbortSignal.timeout(25_000) });
  if (!res.ok || !res.body) return null;
  if (Number(res.headers.get('Content-Length') || 0) > MAX_PDF_BYTES) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES || String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return null;
  return bytes;
}

/** Stored full text for a paper, trying open-access copies once if none is stored. */
export async function getFullText(env, paper, { tryOpenAccess = true } = {}) {
  if (!env.FULLTEXT) return null;
  const stored = await env.FULLTEXT.get(textKey(paper.id), 'json');
  if (stored?.text) return stored;
  if (!tryOpenAccess || !paper.doi || await env.FULLTEXT.get(missKey(paper.id))) return null;
  for (const { url, source } of (await candidateUrls(paper.doi, paper.title)).slice(0, 6)) {
    try {
      const bytes = await fetchPdf(url);
      if (!bytes) continue;
      const { pages, text } = await pdfToText(bytes);
      if (text.length < 2000 || !matchesTitle(text, paper.title)) continue;
      const record = { source: `开放获取全文（${source}）`, url, pages, chars: text.length, at: new Date().toISOString(), text };
      await env.FULLTEXT.put(textKey(paper.id), JSON.stringify(record));
      return record;
    } catch (error) {
      console.warn(JSON.stringify({ event: 'fulltext_fetch_failed', id: paper.id, url, error: error.message }));
    }
  }
  await env.FULLTEXT.put(missKey(paper.id), '1', { expirationTtl: MISS_TTL });
  return null;
}

/** Save the text of a PDF uploaded on the card. */
export async function saveUploadedPdf(env, paper, bytes, { force = false } = {}) {
  if (!env.FULLTEXT) throw Object.assign(new Error('全文存储还没有配置'), { status: 500 });
  if (bytes.byteLength > MAX_PDF_BYTES) throw Object.assign(new Error('PDF 太大（上限 40 MB）'), { status: 413 });
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw Object.assign(new Error('这不是 PDF 文件'), { status: 400 });
  const { pages, text } = await pdfToText(bytes);
  if (text.length < 1000) throw Object.assign(new Error('没能从这个 PDF 里读出文字（可能是扫描图片）'), { status: 422 });
  if (!force && !matchesTitle(text, paper.title)) {
    throw Object.assign(new Error('这个 PDF 的开头里找不到这篇论文的标题，可能传错了文件。'), { status: 409, code: 'title_mismatch' });
  }
  const record = { source: '上传的 PDF', pages, chars: text.length, at: new Date().toISOString(), text };
  await env.FULLTEXT.put(textKey(paper.id), JSON.stringify(record));
  await env.FULLTEXT.delete(missKey(paper.id));
  return record;
}

export const describe = record => (record ? { status: 'full', source: record.source, pages: record.pages || null, chars: record.chars || record.text?.length || 0 } : { status: 'abstract' });

/** System prompt: instructions, the paper's details, and the full text or abstract. */
export function buildSystem(paper, record) {
  const abstract = [paper.abstract?.en, paper.abstract?.zh].filter(Boolean).join('\n\n');
  const basis = record
    ? `下面是这篇论文的全文（${record.source}，由 PDF 自动提取，表格和公式可能有错位）。`
    : '没有拿到这篇论文的全文，下面只有摘要。回答时先说明“只依据摘要”，摘要里没有的内容不要猜。';
  return [
    '你是帮助物理教育研究者阅读论文的助手。用户是高中物理教师，正在决定是否把这篇论文收进阅读清单。',
    '规则：',
    '- 只依据下面提供的论文内容回答，不要用论文以外的知识补充研究细节。文中没写的，就直接说“文中没有提到”。',
    '- 用户用什么语言提问就用什么语言回答，默认简体中文。先给结论，再给依据。',
    '- 提到具体结果时给出数字、样本、研究设计，并说明出自哪一部分（如 Method、Results、表 2），可以引用不超过 25 个英文单词的原文短句作证据。',
    '- 不要整段复述或翻译全文；用户要求时也只做摘要式说明。',
    '- 回答简洁，一般不超过 300 字，除非用户要求详细。',
    '',
    `论文：${paper.title}`,
    `作者：${(paper.authors || []).join(', ')}`,
    `期刊：${paper.source}，${paper.published_date || paper.year || ''}`,
    `DOI：${paper.doi}`,
    '',
    basis,
    '<<<PAPER',
    record?.text || abstract || '（没有摘要）',
    'PAPER>>>',
  ].join('\n');
}

/** Clean the browser's chat history: alternating turns, ending with the new question. */
export function cleanMessages(list) {
  const out = (Array.isArray(list) ? list : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, m.role === 'user' ? 1000 : 6000) }));
  if (!out.length || out.at(-1).role !== 'user') throw Object.assign(new Error('问题是空的'), { status: 400 });
  return out;
}
