// @ts-check

export const ADMIN_PAGE = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PhyLab · Coach 对话记录</title>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css"
    integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ"
    crossorigin="anonymous"
  >
  <script
    defer
    src="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.js"
    integrity="sha384-ykMNcWQhhTUb0YV9SPpPUFURHZ+tWmubkakGBP+OgNK/UXdO2gtzglWx0Rj9hnO3"
    crossorigin="anonymous"
  ></script>
  <script
    defer
    src="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/contrib/auto-render.min.js"
    integrity="sha384-bjyGPfbij8/NDKJhSGZNP/khQVgtHUE5exjm4Ydllo42FwIgYsdLO2lXGmRBf5Mz"
    crossorigin="anonymous"
  ></script>
  <style>
    :root { color-scheme: light dark; font-family: Inter, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f5f1; color: #171817; }
    main { width: min(980px, calc(100% - 32px)); margin: 40px auto 72px; }
    header, .toolbar, .record { border: 1px solid #d8d9d2; border-radius: 14px; background: #fff; }
    header, .toolbar { padding: 20px; margin-bottom: 14px; }
    h1 { margin: 0 0 8px; font-size: 25px; }
    p { line-height: 1.6; }
    .muted, .metadata, #status { color: #666b67; font-size: 13px; }
    .controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    button { min-height: 42px; padding: 9px 12px; border: 1px solid #c8cbc5; border-radius: 8px; background: #fff; color: inherit; font: inherit; }
    button { cursor: pointer; font-weight: 700; }
    button.primary { border-color: #183d30; background: #183d30; color: #fff; }
    button:disabled { opacity: .5; cursor: default; }
    #status { min-height: 21px; margin: 0; }
    #records { display: grid; gap: 12px; }
    .record { padding: 18px; }
    .question, .reply { margin-top: 10px; padding: 12px; border-radius: 9px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
    .question { background: #f4f6f2; }
    .reply { background: #eef3ef; }
    .label { color: #315746; font-size: 12px; font-weight: 800; }
    .reply .katex-display { margin: .55em 0; overflow-x: auto; overflow-y: hidden; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 18px; }
    a { color: #245c45; }
    @media (max-width: 600px) { .controls { align-items: stretch; flex-direction: column; } }
    @media (prefers-color-scheme: dark) {
      body { background: #151816; color: #edf0ed; }
      header, .toolbar, .record { border-color: #353a36; background: #202421; }
      .muted, .metadata, #status { color: #a8afa9; }
      button { border-color: #434944; background: #282d29; }
      button.primary { background: #7bb397; color: #10271d; }
      .question { background: #282d29; }
      .reply { background: #25312b; }
      .label, a { color: #92c5aa; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Coach 对话记录</h1>
      <p class="muted">这里只保存匿名会话编号、学生问题、Coach 回答和当时的物理实验数据。不会保存姓名、邮箱、IP 地址或浏览器指纹；原文保留 30 天。</p>
      <p class="muted">完整网址就是访问凭证。请勿转发、公开或放入网页链接。</p>
    </header>

    <section class="toolbar">
      <div class="controls">
        <p id="status" aria-live="polite">正在读取…</p>
        <button class="primary" id="load" type="button">刷新记录</button>
      </div>
    </section>

    <section id="records" aria-live="polite"></section>
    <nav class="pager" aria-label="记录分页">
      <button id="previous" type="button" disabled>上一页</button>
      <span id="page">第 1 页</span>
      <button id="next" type="button" disabled>下一页</button>
    </nav>
  </main>
  <script>
    const load = document.querySelector('#load');
    const status = document.querySelector('#status');
    const records = document.querySelector('#records');
    const previous = document.querySelector('#previous');
    const next = document.querySelector('#next');
    const pageLabel = document.querySelector('#page');
    let currentPage = 1;
    let totalPages = 1;
    const adminPath = location.pathname.replace(/\/+$/, '');

    function renderMath(root) {
      if (typeof globalThis.renderMathInElement === 'function') {
        globalThis.renderMathInElement(root, {
          delimiters: [
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          strict: 'ignore',
          trust: false,
          maxExpand: 100
        });
      }
    }

    function textElement(className, value) {
      const element = document.createElement('div');
      element.className = className;
      element.textContent = value == null ? '' : String(value);
      return element;
    }

    function renderRecord(record) {
      const article = document.createElement('article');
      article.className = 'record';

      const created = new Date(record.createdAt);
      const tokenCount = record.totalTokens == null ? '—' : String(record.totalTokens);
      const metadata = [
        Number.isNaN(created.getTime()) ? record.createdAt : created.toLocaleString(),
        record.mode,
        '会话 ' + String(record.sessionId).slice(0, 8),
        '结果 ' + record.verdict,
        '速度 ' + (record.speed == null ? '—' : record.speed + ' m/s'),
        '落点 ' + (record.xLand == null ? '—' : record.xLand + ' m'),
        '耗时 ' + record.latencyMs + ' ms',
        'Token ' + tokenCount
      ].join(' · ');
      article.appendChild(textElement('metadata', metadata));
      article.appendChild(textElement('label', '学生问题'));
      article.appendChild(textElement('question', record.question));
      article.appendChild(textElement('label', 'Coach 回答'));
      const reply = textElement('reply', record.reply);
      article.appendChild(reply);
      renderMath(reply);
      return article;
    }

    async function loadPage(page) {
      load.disabled = true;
      previous.disabled = true;
      next.disabled = true;
      status.textContent = '正在读取…';
      try {
        const response = await fetch(adminPath + '/conversations?page=' + encodeURIComponent(page), {
          cache: 'no-store'
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '读取失败');

        records.replaceChildren();
        data.records.forEach((record) => records.appendChild(renderRecord(record)));
        if (data.records.length === 0) {
          records.appendChild(textElement('record muted', '还没有对话记录。'));
        }

        currentPage = data.pagination.page;
        totalPages = data.pagination.totalPages;
        pageLabel.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页';
        previous.disabled = currentPage <= 1;
        next.disabled = currentPage >= totalPages;
        status.textContent = '共 ' + data.pagination.total + ' 条记录；原文保留 ' + data.retentionDays + ' 天。';
      } catch (error) {
        records.replaceChildren();
        status.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        load.disabled = false;
      }
    }

    load.addEventListener('click', () => loadPage(1));
    previous.addEventListener('click', () => loadPage(currentPage - 1));
    next.addEventListener('click', () => loadPage(currentPage + 1));
    loadPage(1);
  </script>
</body>
</html>`;
