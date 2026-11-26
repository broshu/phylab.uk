// 生成要发布的网站目录 _site（Cloudflare 构建时运行，见 workers/phylab-uk）。
// 复制整个仓库，但不发布这些：后台代码、脚本、测试、说明文档、测试照片、开发用的配置。
import { cpSync, rmSync, statSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

const SKIP_DIRS = new Set([".git", ".github", "workers", "scripts", "node_modules", "tests", "test", "test photo", "review", "_home-drafts", "work"]);
const SKIP_FILES = new Set(["CNAME", ".nojekyll", ".gitignore", ".gitattributes", ".DS_Store", "package.json", "package-lock.json"]);
const SKIP_EXT = [".md", ".mjs.map"];
// literature/scripts 是收集论文用的脚本，不发布
const SKIP_PATHS = new Set(["literature/scripts"]);

function keep(path, isDir) {
  const rel = relative(".", path).split(sep).join("/");
  const name = basename(path);
  if (SKIP_PATHS.has(rel)) return false;
  if (isDir) return !SKIP_DIRS.has(name);
  return !SKIP_FILES.has(name) && !SKIP_EXT.some((ext) => name.endsWith(ext));
}

rmSync("_site", { recursive: true, force: true });
cpSync(".", "_site", {
  recursive: true,
  filter: (src) => src === "." || (!src.startsWith("_site") && keep(src, statSync(src).isDirectory())),
});

// Cloudflare 单个文件上限 25 MiB
const LIMIT = 25 * 1024 * 1024;
const tooBig = [];
let files = 0;
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else {
      files += 1;
      if (statSync(path).size > LIMIT) tooBig.push(path);
    }
  }
})("_site");
if (tooBig.length) {
  console.error(`这些文件超过 25 MB，Cloudflare 不能发布：\n${tooBig.join("\n")}`);
  process.exit(1);
}
console.log(`_site: ${files} files`);
