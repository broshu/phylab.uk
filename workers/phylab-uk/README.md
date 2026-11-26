# phylab-uk

phylab.uk 本站的 Worker。网页来自本仓库，由 Cloudflare 直接发布（不再用 GitHub Pages）。

- 推到 `main` 后由 Cloudflare Workers Builds 自动部署：根目录 `workers/phylab-uk`，
  构建 `npm run build`，部署 `npx wrangler deploy`。
- `scripts/prepare-site.mjs` 生成 `_site/`：复制整个仓库，但不发布后台代码（workers/）、脚本、测试、
  说明文档（*.md）、测试照片和开发配置。
- `www.phylab.uk` 跳到 `phylab.uk`；找不到的页面显示 `404.html`。
- 单个文件不能超过 25 MB（构建时会检查）。

preview.phylab.uk、debate-api.phylab.uk 等是各自的 Worker，与这里无关。
