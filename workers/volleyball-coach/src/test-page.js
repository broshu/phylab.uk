// @ts-check

export const TEST_PAGE = String.raw`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PhyLab · AI Coach Test</title>
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
    body { margin: 0; background: #f5f5f1; color: #171817; }
    main { width: min(760px, calc(100% - 32px)); margin: 48px auto; }
    .card { padding: 24px; border: 1px solid #d8d8d1; border-radius: 14px; background: #fff; box-shadow: 0 18px 60px rgba(30,40,35,.08); }
    h1 { margin: 0 0 8px; font-size: 25px; }
    .lede, .meta { color: #676a67; line-height: 1.6; }
    .meta { font-size: 13px; }
    .scenarios { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; }
    button, textarea, input { font: inherit; }
    button { padding: 9px 13px; border: 1px solid #c9cbc5; border-radius: 8px; background: #fafaf7; color: inherit; cursor: pointer; }
    button[aria-pressed="true"] { border-color: #2f6652; background: #e5f1eb; color: #204f3e; }
    label { display: grid; gap: 7px; margin-top: 14px; font-size: 13px; font-weight: 700; }
    textarea, input { width: 100%; padding: 11px 12px; border: 1px solid #c9cbc5; border-radius: 8px; background: #fff; color: inherit; }
    textarea { min-height: 96px; resize: vertical; line-height: 1.5; }
    .send { width: 100%; margin-top: 16px; border-color: #183d30; background: #183d30; color: white; font-weight: 700; }
    .send:disabled { opacity: .55; cursor: wait; }
    .answer { min-height: 90px; margin-top: 18px; padding: 16px; border-radius: 10px; background: #f1f3ef; line-height: 1.7; white-space: pre-wrap; }
    .reply { overflow-wrap: anywhere; }
    .reply .katex-display { margin: .55em 0; overflow-x: auto; overflow-y: hidden; }
    .badge { display: inline-block; margin-bottom: 8px; padding: 3px 8px; border-radius: 999px; background: #dde7e0; color: #28523f; font-size: 12px; font-weight: 700; }
    a { color: #245c45; }
    @media (prefers-color-scheme: dark) {
      body { background: #151816; color: #edf0ed; }
      .card { border-color: #353a36; background: #202421; box-shadow: none; }
      .lede, .meta { color: #a8afa9; }
      button, textarea, input { border-color: #434944; background: #282d29; color: inherit; }
      button[aria-pressed="true"] { background: #244235; color: #d8eee3; }
      .send { background: #7bb397; color: #10271d; }
      .answer { background: #292e2a; }
      a { color: #92c5aa; }
    }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Volleyball AI Coach · Test</h1>
      <p class="lede">预设脚本负责物理结论，AI 根据当前发球和你的问题补充解释。尚未配置密钥时，这里会明确显示“预设模式”。</p>
      <p class="meta" id="math-preview">公式显示：\(t_{\mathrm{net}} = 9/v\)</p>
      <p class="meta" id="health">正在检查 Worker…</p>
      <p class="meta">为改进教学，成功的匿名提问、回答和当时的实验数据会保存 30 天；不会保存姓名、邮箱、IP 地址或浏览器指纹。<a href="/admin">查看管理员记录页</a></p>

      <div class="scenarios" id="scenarios"></div>

      <label>向 Coach 提问
        <textarea id="question" maxlength="600">为什么速度更慢反而更容易碰网？</textarea>
      </label>

      <label>测试口令（只在配置 AI 后需要）
        <input id="token" type="password" autocomplete="off" placeholder="COACH_TEST_TOKEN">
      </label>

      <button class="send" id="send" type="button">Ask Coach</button>
      <div class="answer" id="answer" aria-live="polite">选择一种发球结果，然后提问。</div>
    </section>
  </main>
  <script>
    const scenarios = {
      net: { label: '15 m/s · 挂网', question: '为什么速度更慢反而更容易碰网？', context: { phase: 'done', verdict: 'net', speed: 15, heightAtNet: 1.4, netClearance: -0.8, xLand: 12, outBy: -6, attemptCount: 1 } },
      in:  { label: '21 m/s · 界内', question: '这次成功了，为什么还不能直接说所有合法速度？', context: { phase: 'done', verdict: 'in', speed: 21, heightAtNet: 2.2816, netClearance: 0.0816, xLand: 16.8, outBy: -1.2, attemptCount: 2 } },
      out: { label: '25 m/s · 出界', question: '为什么要减小速度，落地时间会变化吗？', context: { phase: 'done', verdict: 'out', speed: 25, heightAtNet: 2.552, netClearance: 0.352, xLand: 20, outBy: 2, attemptCount: 3 } },
      time: { label: '时间怎么算', question: '到球网的时间和从击球到落地的总时间分别怎么计算？为什么一个随速度变化，另一个不变？', context: { phase: 'done', verdict: 'in', speed: 21, heightAtNet: 2.2816, netClearance: 0.0816, xLand: 16.8, outBy: -1.2, attemptCount: 4 } }
    };
    let selected = 'net';
    const scenarioRoot = document.querySelector('#scenarios');
    const question = document.querySelector('#question');
    const answer = document.querySelector('#answer');
    const send = document.querySelector('#send');
    const token = document.querySelector('#token');
    const sessionStorageKey = 'phylab-coach-session';
    let sessionId = sessionStorage.getItem(sessionStorageKey);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(sessionStorageKey, sessionId);
    }

    function renderScenarios() {
      scenarioRoot.innerHTML = '';
      Object.entries(scenarios).forEach(([id, scenario]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = scenario.label;
        button.setAttribute('aria-pressed', String(id === selected));
        button.addEventListener('click', () => {
          selected = id;
          question.value = scenario.question;
          renderScenarios();
        });
        scenarioRoot.appendChild(button);
      });
    }

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

    function renderCoachReply(reply, mode) {
      answer.innerHTML = '<span class="badge"></span><div class="reply"></div>';
      answer.querySelector('.badge').textContent = mode;
      const replyRoot = answer.querySelector('.reply');

      // Treat the model response as text first. KaTeX only transforms the
      // explicitly delimited math nodes; model-provided HTML is never run.
      replyRoot.textContent = reply;
      renderMath(replyRoot);
    }

    async function checkHealth() {
      const response = await fetch('/health', { cache: 'no-store' });
      const data = await response.json();
      document.querySelector('#health').textContent = data.testConsoleReady
        ? 'Worker 正常 · AI 已配置 · 需要测试口令'
        : data.publicStudentReady
          ? 'Worker 正常 · 学生端 AI 已开放 · 此测试页仍需测试口令'
        : data.mode === 'ai-locked'
          ? 'Worker 正常 · AI 密钥已配置 · 等待配置测试口令'
          : 'Worker 正常 · 当前为预设模式 · 尚未配置 AI 密钥';
    }

    send.addEventListener('click', async () => {
      send.disabled = true;
      answer.textContent = 'Coach 正在思考…';
      try {
        const response = await fetch('/coach', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Coach-Test-Token': token.value
          },
          body: JSON.stringify({
            question: question.value,
            sessionId,
            context: scenarios[selected].context
          })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '请求失败');
        const mode = data.mode === 'ai-assisted' ? 'AI + 预设' : '仅预设';
        renderCoachReply(data.reply, mode);
      } catch (error) {
        answer.textContent = error instanceof Error ? error.message : String(error);
      } finally {
        send.disabled = false;
      }
    });

    renderScenarios();
    document.addEventListener('DOMContentLoaded', () => {
      renderMath(document.querySelector('#math-preview'));
    });
    checkHealth().catch(() => {
      document.querySelector('#health').textContent = '无法读取 Worker 状态';
    });
  </script>
</body>
</html>`;
