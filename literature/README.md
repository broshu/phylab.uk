# PhyLab Literature 维护说明

Literature 收录外部研究；作者自己的成果继续放在 `research/`。本板块沿用主站配色、字体、卡片和深色模式，复用 `assets/nav.js` 返回首页。主站首页和 `/literature/` 共享同一数据与渲染组件。

## 文件与部署

- `data/papers.json`：唯一正式文献源，每篇独立条目；`schema_version: 1`。
- `core.mjs`：字段校验、主题、搜索、排序和首页推荐规则。
- `app.mjs`：主页推荐、文献页筛选、中文阅读笔记和链接。
- `literature.css`：与现有站点一致、限定作用范围的样式。
- `scripts/`：静态构建检查、候选检索、审核后追加。
- `.github/workflows/literature-candidates.yml`：每周五北京时间 08:00 收集候选，也支持在 Actions 手动运行。GitHub 定时任务可能延迟，长期无活动时可能停用。

现有部署为 GitHub Pages，`main` 分支根目录直接发布，仓库有 `.nojekyll` 和 `CNAME`。无打包框架、服务器、数据库或新增第三方依赖。维护脚本需要 Node.js 22+，候选源的 XML 解析使用 Python 3 标准库（Actions 自动准备环境）。`/literature` 由目录页重定向到 `/literature/`。修改源文件后，按仓库原有方式提交并推送才会更新线上；本次本地实现不等同于已经上线。

## 每周推荐怎么追加

1. 在 GitHub Actions 的 **Weekly literature candidates** 下载 `literature-candidates` 文件，或在仓库根目录运行：

   ```sh
   node literature/scripts/collect.mjs work/literature-candidates-2026-10-09.json
   ```

   自动检索 PRPER 官方 RSS 和 Crossref 最近 45 天的主题候选，按 DOI 排除已收录文献。Crossref 限流会有界重试并保留 RSS 结果；来源不足会写入候选文件的 `warnings`，两个来源均失败则明确报错，不会伪装成“本周没有文献”。候选只是元数据线索，Crossref 有索引延迟；另检查 [PRPER 最新论文](https://journals.aps.org/prper/recent) 和出版商页面。自动流程不会修改正式文献源或生成未经核对的中文结论。

2. 筛选真正高价值的 0–3 篇，阅读原始来源，核对作者、日期、DOI、研究对象、干预、评价指标和局限。将候选的 `paper` 对象复制到单独的 JSON 对象或对象数组文件。也可直接按现有条目填写，完全不依赖自动检索。

3. 完成下列字段并设置 `status: "published"`：

   | 字段 | 要求 |
   | --- | --- |
   | `id` | 稳定唯一的小写连字符 ID；已有条目不要改 ID，否则永久链接会失效 |
   | `title`, `authors` | 原文标题、完整作者数组 |
   | `year`, `published_date` | 卷期/出版年份；精确日期用 `YYYY-MM-DD`，不确定时用 `null`，不能编造月日 |
   | `source`, `doi`, `url` | 期刊/来源；DOI 填裸 DOI，非 DOI 文献允许为空，HTTPS 原文 URL 必填 |
   | `topics` | `hands-on`, `simulation`, `ai`, `transfer`, `assessment`, `icap`, `scaffolding`, `cognitive-load` 的数组 |
   | `evidence_type` | 试验、比较研究、系统综述、理论框架、量表验证等；跨学科证据明确标记 |
   | `key_finding_zh` | 中文核心发现，仅陈述原文支持的结果，不复制摘要 |
   | `phd_relevance_zh` | 中文 PhD 关联；这是策展推论，不作为论文发现陈述 |
   | `reading_priority` | `core`（PhD 必读）、`read`（全文读）、`skim`（略读） |
   | `reading_recommendation_zh` | 中文建议：读哪些部分及为何值得读 |
   | `limitations_zh` | 中文证据边界；区分即时表现、实验能力与独立迁移 |
   | `featured` | `true` 进入首页推荐候选；首页展示最近添加的 3 篇，日期相同时按出版日期降序 |
   | `date_added` | 实际加入日期，`YYYY-MM-DD` |
   | `verified_at`, `verification_url` | 人工核对日期与支持解读的原始来源 HTTPS 链接；候选抓取日期不能替代人工核对 |

4. 在仓库根目录先检查，再追加：

   ```sh
   node literature/scripts/add.mjs work/reviewed-papers.json --dry-run
   node literature/scripts/add.mjs work/reviewed-papers.json
   npm run build --prefix literature
   npm test --prefix literature
   ```

   追加脚本检测重复 ID/DOI、缺失字段、中文笔记、日期和安全链接；全部通过才原子写入 `papers.json`。它不会提交或推送。修订已收录条目时直接修改该条目并更新 `updated_at`，不新增重复条目。手工追加也只需编辑 `papers.json` 并执行上述检查。

5. 审阅差异并按原站点流程发布。新条目会自动出现在文献页；`featured: true` 的条目会参与首页推荐，不需要改 HTML。候选文件和已审核工作文件保存在 `work/`，不要当作正式公开文献源。

## 浏览与验证

页面支持多个主题同时匹配（AND）、中文与英文关键词、DOI/作者搜索、优先级和出版日期排序。筛选保存在 URL，可以分享；每篇使用 `/literature/#稳定ID` 永久链接。草稿不会显示。数据每次加载请求重新验证缓存；部署后刷新即可看到更新。

本地预览从仓库根目录启动普通静态服务器：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765/literature/`，不要直接双击 HTML（浏览器会限制本地文件的数据读取）。断网或数据加载失败时可重试；JavaScript 关闭时保留完整数据文件入口。

`npm run build --prefix literature` 是静态发布完整性检查，不生成新的目录。CI 在文献相关 push/PR 时验证字段、资源路径与核心行为；GitHub Pages 原有部署机制保持不变，CI 不自动成为 Pages 部署的前置门槛。

首批 11 篇条目的来源已于 2026-10-03 核对，含 2026 年 10 月近期文献与经典框架。该库是有选择的阅读推荐，不是声称覆盖全部 PER 文献的系统综述。
