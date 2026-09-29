# 架构

## 1. 硬约束

纯静态站点，部署到 GitHub Pages：无后端、无数据库、无登录、无上传、无 API server。全部评分在浏览器本地完成；进度与历史结果存 `localStorage`。

V1 核心测试**不调用任何 LLM**。未来的“AI 深度解读”必须是可选、分离、不影响核心结果的附加层。

## 2. 栈

Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Vitest。ECharts（`echarts/core` 按需引入 Radar/Bar + SVGRenderer）用于雷达与构成图，其余视觉（轨道图、神战图、觉醒轴、张力矩阵、星图）是手写 SVG。状态用 `reactive()` 单例 + localStorage，没有引入 Pinia 与 vue-router（hash 路由是 30 行的 `src/router.ts`）。

结果页通过 `defineAsyncComponent` 分包：测试流程的关键路径约 87 KB gzip，含 ECharts 的结果页（173 KB gzip）只在需要时加载。

## 3. 目录

```
/
├─ data/                 数据源（JSON，见 §4）
│  ├─ dimensions.json
│  ├─ metadata.json
│  ├─ relationships.json
│  ├─ deities/*.json
│  └─ questions/*.json
├─ design/               设计文档（本目录）
├─ site/                 构建产物（npm run build）；docs/ 供分支部署用
├─ public/               静态直出资源（含 .nojekyll）
├─ scripts/validate-data.ts
├─ src/
│  ├─ App.vue, main.ts, style.css
│  ├─ schema/            TS 类型 + 数据加载器
│  └─ engine/            Phase 1 起：评分与报告生成
└─ tests/
```

**设计文档放在 `design/`，不要放进构建输出目录**：`site/`（或 `docs/`）是 Vite 的输出目录且 `emptyOutDir: true`，每次 build 都会清空它，混放会被静默删除。

**构建产物要不要提交，取决于部署方式**：当前流程由 CI 把 `site/` 推到 `gh-pages` 分支，`main` 里保留一份 `site/` 只是方便本地/离线打开；若改用「Deploy from a branch → main → /docs」，则需要提交 `docs/`（`npm run build:pages`）。GitHub 的分支部署只允许仓库根目录或 `/docs`。

## 4. 数据格式：JSON 而非 YAML

原始规划是 YAML 源 + 构建期转 JSON。当前直接使用 JSON 源，理由：

- Vite 原生 `import` JSON，Node 脚本 `JSON.parse` 即可读，两端共用同一份文件；
- 少一个 `js-yaml` 依赖、少一条 YAML→JSON 构建管线、少一处格式漂移与缓存失效；
- 校验器直接读源文件，不存在“校验的是 YAML、跑的是旧 JSON”的风险。

代价：JSON 不能写注释。等出现非开发者的内容协作者时再加 YAML→JSON 转换步骤（放在 `scripts/`，输出到 `data/` 并保留 schema 校验）。

## 5. 数据流

```
data/*.json ──► validate-data（构建前门禁）
      │
      └──► 浏览器：import 或 fetch ──► engine ──► result ──► Vue 视图
```

层级纪律：

- UI 组件不算 deity。组件只调用 `generatePantheonResult(answers)`。
- 引擎不 import 任何 Vue。
- 引擎不写死 16 维；维度一律从 `dimensions.json` 动态读取，`Vector` 是 `Record<DimensionId, number>`。
- 禁止 `if (primary === 'athena')` 这类分支。差异只能来自数据（signature / anti dimensions / relationships）。

## 6. 路由与资源路径

GitHub Pages 无 SPA fallback，因此使用 **hash 路由**（`/#/`、`/#/test`、`/#/result`），无需 404 hack。Phase 1 出现第二个页面时再引入 `vue-router`（`createWebHashHistory`）。

`vite.config.ts` 设 `base: './'`，所有资源使用相对路径，天然兼容 `https://<user>.github.io/<repo>/`，无需把仓库名写进配置。`public/.nojekyll` 随构建进入产物目录，避免 Pages 的 Jekyll 处理。

## 7. 版本与可复现

`data/metadata.json` 维护四个版本号。结果对象内嵌这四个版本；称号与所有文案选择由 `result_hash = hash(answers + versions)` 决定，同一输入永远得到同一输出。

## 8. 构建与部署

```bash
npm run validate-data   # 数据门禁
npm run test            # 单测
npm run build           # vue-tsc + vite build → site/
npm run build:pages     # 同上，输出到 docs/（main + /docs 部署用）
```

Pages 设置：`Deploy from a branch` → `gh-pages` + `/ (root)`（CI 会把 `site/` 推到该分支）；若改用 `main` + `/docs`，则用 `npm run build:pages` 并停用 workflow。

## 9. 运行环境

`npm run validate-data` / `npm run simulate` 用 Node 原生 TypeScript 类型剥离直接跑 `.ts`（无 `tsx` 依赖）。要求 Node >= 23.6（推荐 24）。代码只使用可擦除语法：无 `enum`、无参数属性、类型导入一律 `import type`。

## 10. 性能与 i18n

目标规模 80–100 神格、60 题、几十万字：神格详情与文案按需加载（动态 `import()`）、结果内容分块，不提前优化。数据文件按 pantheon 分片，天然支持增量加载。

所有可见文案走 `zh` / `en` 双语结构。V1 只保证中文质量，但内容不得散落在组件里。

## 11. 可访问性

对比度足够、按钮够大、键盘可达；图表必须有文本替代（雷达图旁列出维度数值，神战图给出文字版矛盾陈述）；重要信息不得只用颜色编码。手机优先（微信内置浏览器 / iOS Safari / Chrome Android）。
