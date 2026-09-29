# PANTHEON · 万神殿

神格谱系测试：**你的灵魂不是一种人格。它是一座万神殿。**

用户完成一次情境测试后得到一套神格谱系：主神格、副神格、阴影神格、隐藏神格、神格构成、多维人格图谱与内在神战。纯静态、纯本地计算、无后端、无登录、答案不上传。

设计文档见 [design/](design/)：[产品定义](design/PRODUCT.md)、[架构](design/ARCHITECTURE.md)、[评分算法](design/SCORING.md)、[可视化](design/VISUALIZATION.md)。

## 技术栈

Vue 3 + TypeScript + Vite 6 + Tailwind CSS v4 + Vitest。图表：ECharts（统计图）+ 手写 SVG（神格专属视觉）。

## 在 VS Code 里测试（推荐流程）

### 0. 准备（只做一次）

1. VS Code → File → Open Folder → 选这个目录（`.../Ideas/神格`，**不是** `Cell2Digit-AMG` 或 `Cell2Digit`）。
2. 终端里确认 Node：`node -v`，需要 **≥ 23.6**（推荐 24）。低版本会因为「用 Node 原生跑 `.ts`」而报语法错误。
3. `npm install`
4. 打开集成终端：`Ctrl +\``（macOS `Cmd +\``）。也可以走任务面板：`Ctrl+Shift+P` → **Tasks: Run Task** → 选下面带编号的任务（1 数据门禁 / 2 单测 / 3 启动网页版 / …）。断点调试用 F5，配置里已有「调试当前打开的脚本」。

建议装这两个扩展（打开项目时 VS Code 会提示）：**Vue - Official**（`.vue` 语法与类型）和 **Vitest**（左侧 Testing 面板直接点跑 `tests/` 里的用例，改完文件自动重跑）。

### 1. 一分钟自检（先跑这两条，红字先别往下测）

```bash
npm run validate-data
npm run test
```

期望输出：

```
74 deities · 16 dimensions · 52 questions · 0 errors · 0 warnings
Test Files  3 passed (3)      Tests  17 passed (17)
```

`validate-data` 是内容与数据的总门禁：结构、引用、维度覆盖、神格相似碰撞、每个神格「能否被选出来」，以及文案的「过短 / 跨神格重复 / 句法模板 / 假选项」四类检查。它慢是因为最后一项会在真实答案空间里搜索——约 15 秒属正常。

### 2. 网页版完整走一遍

```bash
npm run dev
```

打开 http://localhost:5173 → 「进入万神殿」→ 52 题（Ⅰ 秩序 … Ⅶ 神性，中途有幕间页）。

检查点：

- 进度条不显示「第 17/52 题」这种考试感文案；幕间页显示罗马数字与幕名；
- 选项按钮在手机上足够大，点选后立即进入下一题；
- 结果页：称号 → 核心命题 → 构成（主/副/阴影/隐藏四色）→ 图谱 → 每段可折叠 → 神格轨道 → 内在神战 → 觉醒 → 张力矩阵 → 星图 → 分享卡；
- 结果页底部「导出我的答案」是否下载到 JSON；首页「导入一份答案」能否用同一个文件还原结果（改两个选项再导入，结果应当变化）；
- 刷新页面进度是否还在（localStorage）；首页「清除本机记录」是否生效。

### 3. 手机视图

结果页是移动优先设计的。F12 → `Ctrl+Shift+M`（设备工具栏）→ iPhone 14 Pro：

- 吸顶导航（谱系/构成/图谱/主神格/内战/觉醒/分享）点一下能否滚到对应段落；
- 长段落折叠是否好点，展开后不跳位；
- 分享卡用 4:5 与 1:1 各保存一次，看构图是否都成立；
- 雷达图的「查看数值」表格在小屏上是否可读。

### 4. 文案审阅（不用答题，一次看完所有文字）

```bash
npm run review-sheet
```

生成 `review/deities.md`（74 个神格，按**曝光度**排序——鲁格 48%、伊西斯 30%、吉尔伽美什 20%…，只看前 20 个就覆盖大部分用户会读到的字）和 `review/questions.md`（52 题 + 208 选项，每个选项后面标着维度权重，便于核对「这句话真的对应这些维度吗」）。直接在文件里标 ❌ / ⚠️ 即可。

### 5. 读一份完整报告

```bash
npm run show-report -- --deity lugh      # 某个原型的典型答题
npm run show-report -- --deity odin --noise 0.6   # 答得更不一致的人
npm run show-report -- --answers samples/某人-2026-09-29-14-09.json
```

### 6. 数据与内容体检（改过数据后跑）

```bash
npm run simulate         # 10,000 人分布：主神格最高占比应 < 15%，不该有神格「从未当选」
npm run audit-content    # 内容通用度：>50% 的段落 = 谁都适用；关系句开头集中度 > 40% = 生成层模板化
```

### 7. 部署前检查

```bash
npm run build            # 类型检查 + 构建到 site/
npm run preview          # 打开 http://localhost:4173 看产物
```

产物用的是相对路径，`base: './'` 已适配 `https://<user>.github.io/<repo>/` 子路径。

### 常见问题

| 现象 | 处理 |
| --- | --- |
| `npm run validate-data` 报 `.ts` 语法错误 | Node 版本 < 23.6。脚本直接用 Node 原生类型剥离运行，不经过编译器 |
| `vite` 报找不到 esbuild 二进制 | npm 12 默认拦截依赖的 postinstall：`npm install-scripts approve esbuild` 后重装 |
| 5173 端口被占 | `npm run dev -- --port 5180` |
| 想清掉本机数据 | 首页「清除本机记录」，或 DevTools → Application → Local Storage 删 `pantheon.progress.v1`、`pantheon.history.v1` |
| 改了 `data/*.json` 后结果没变 | 浏览器缓存了旧模块：`npm run dev` 下刷新即可；`npm run build` 后要重新 build |
| 想确认自己改的文案没有变空/变雷同 | `npm run validate-data`（查过短/重复/模板） |

### 反馈什么给我最有用

1. 具体编号 + 一句原因：「`abyss-2` 的选项 c 不像『抽离』，更像逃避」；
2. 或直接把 `review/*.md` 里标过的文件发我；
3. 如果走的是网页版测试，把结果页导出的那份 JSON 丢进 `samples/` —— 我能读到你看到的原文，不用你复述。

## 命令

```bash
npm run dev             # 开发服务器
npm run test            # Vitest：校验器行为 + 引擎可复现性 + 结果页 SSR 冒烟
npm run validate-data   # schema / 引用 / 覆盖率 / 相似碰撞 / 每个神格的可达性与可当选性（失败退出码 1）
npm run simulate        # 10,000 人模拟：主/副/阴影/隐藏分布、pair 分布、调试阈值检查
npm run analyze-answers # 校准通道：读真实导出答案，或合成「真人式」样本人格
npm run audit-content   # 内容审计：同一句话出现在多少人的报告里（Barnum 检查）
npm run test-cli        # 命令行真人测试：交互答题 → 报告 + 导出 JSON
npm run show-report     # 读一份完整报告：--deity odin 或 --answers samples/x.json
npm run review-sheet    # 生成给人批注的文案清单：review/deities.md + review/questions.md
npm run build           # vue-tsc 类型检查 + 构建到 site/
npm run build:pages     # 同上，但输出到 docs/（GitHub Pages 分支部署要求 /docs）
npm run preview         # 预览构建产物
```

`SIM_USERS=2000 npm run simulate` 可以跑更快的抽样。

```bash
npm run analyze-answers -- samples/                 # 分析真实用户导出的答案文件
npm run analyze-answers -- --synthesize 12          # 合成 12 个「真人式」人格（含噪声与随手乱点）
npm run analyze-answers -- --synthesize 12 --noise 0.7 --repeat 10   # 噪声敏感性 + 重测稳定性
```

结果页底部有「导出我的答案」，首页有「导入一份答案」——同一份 JSON 既能被 `analyze-answers` 读取，也能还原一次完整的测试。

## GitHub Pages 部署

构建产物默认输出到 `site/`（`npm run build`）。仓库里带了一个 workflow：`.github/workflows/pages.yml`，推送到 `main` 时它会跑 `validate-data → test → build`，然后把 `site/` 的内容推到 **`gh-pages` 分支的根目录**。

> 为什么不用 `actions/configure-pages` 自动建站：用 GITHUB_TOKEN 创建 Pages 站点会被拒（`Resource not accessible by integration`）。推分支只需要 `contents: write`，权限干净、不会再撞这个限制。

**仓库里需要设置的唯一一件事**（只需一次）：

> Settings → **Pages** → Build and deployment → Source 选 **Deploy from a branch** → Branch 选 **`gh-pages`** → 目录选 **`/ (root)`** → Save

之后访问：`https://<user>.github.io/<repo>/`（本项目当前是 https://jiehua1995.github.io/PANTHEON/ ）。GitHub 的分支部署只允许「仓库根目录」或「/docs」，所以不要把 Source 指到 `main`——那样渲染的是源码树（页面会去请求 `/src/main.ts`，看起来是白屏）。

**如果你更想用 `docs/` 而不是另开分支**：

```bash
npm run build:pages        # 输出到 docs/
git add docs && git commit -m "build: docs" && git push
```

再把 Pages source 设成 `main` / `/docs`，并删掉 `.github/workflows/pages.yml`（两者别同时用，否则会互相覆盖）。

本地验证构建产物：

```bash
npm run build && npm run preview     # http://localhost:4173
```

## 目录

```
data/         JSON 数据源：dimensions / metadata / relationships / deities / questions
design/       设计文档（不要放进构建输出目录，会被 emptyOutDir 清空）
site/         构建产物（npm run build）；CI 会把它推到 gh-pages 分支
docs/         可选：npm run build:pages 的产物，供「main + /docs」部署
public/       直出资源（.nojekyll）
scripts/      validate-data / simulate / analyze-answers / audit-content / show-report / review-sheet / test-cli
src/schema/   TS 类型（types.ts）+ 数据加载器（load-data.ts）
src/engine/   评分、匹配、关系、内在神战、称号、报告拼装
src/components/  首页 / 测试流程 / 结果页 / viz（ECharts + 手写 SVG）/ 分享卡
tests/        Vitest
.vscode/      VS Code 任务与调试配置（Tasks: Run Task 里就是测试流程）
samples/      真人测试导出的答案（本地，已 gitignore）
review/       生成的文案审查清单（本地，已 gitignore）
```

## 已实现

- 7 幕 52 题（秩序 / 意志 / 边界 / 欲望 / 冲突 / 深渊 / 神性），每题 4 个情境选项、每题多维度权重
- 74 个神格原型（希腊、北欧、凯尔特与欧洲传奇、中国、日本、埃及、美索不达米亚），区分 `deity` 与 `mythic_archetype`
- overall / shadow / hidden 三套向量 → 主神格、副神格（互补性而非第二名）、阴影神格、隐藏神格（hidden − overall 差距）
- 神格构成（Top 6 归一化）、内在神战（张力对 + 反向轴）、觉醒状态（未觉醒/觉醒/过度觉醒/堕化）、动态称号（确定性 hash）
- 可视化：雷达（核心 8 维 / 完整 16 维）、你 vs 主神格、神格轨道、神战对比、觉醒轴、张力矩阵、人格星图、构成条
- 分享卡（Canvas 本地生成 PNG，无第三方依赖）、localStorage 进度与历史、版本号写入结果
- 结果页吸顶导航 + 长段落折叠 + 雷达数值表；4 个角色（主/副/阴影/隐藏）全站统一配色
- 接近票提示：主神格与第二名的分差很小时如实说明，而不是假装精确

## 数据结构

- `data/dimensions.json` — 16 个连续维度（−1 ~ +1），`core: true` 的 8 个用于“核心维度”雷达图。**引擎不写死维度数量**，新增维度只需在此文件追加。
- `data/deities/*.json` — 神格。必填：`id / name{zh,en} / pantheon / category / archetype / symbols / vector / signature_dimensions / anti_dimensions / psychology / states / shadow / visual / titles / tags`。`category: deity` 与 `category: mythic_archetype` 必须区分，神话人物不得冒充神祇。
- `data/relationships.json` — 神格关系：`affinity / complement / tension / mirror / conflict / suppression`，`strength` 0~1。
- `data/questions/*.json` — 题目。每题有 `act`（秩序/意志/边界/欲望/冲突/深渊/神性）、`profile`（overall/shadow/hidden）、2~4 个选项；选项只带**维度权重**，绝不直接给神格加分。
- `data/metadata.json` — 名称、四个版本号、幕（acts）、关系类型与 signature 等级枚举。

## 添加一个神格

1. 在对应的 `data/deities/<pantheon>.json` 追加对象，`vector` 必须覆盖全部维度，取值 −1~1。
2. 写清 `psychology`（7 项）、`states`（4 项）、`shadow`（3 项）、`visual`、`titles`。
3. 在 `relationships.json` 为它建立关系（尤其是最容易混淆的邻近原型）。
4. `npm run validate-data` — 若与既有神格 `cosine > 0.94`，会被判为碰撞警告：重新定义、合并或强化 signature dimensions。

## 添加一道题

1. 写情境，不写“你喜欢自由还是秩序”式的明显题；选项之间必须是真实取舍，没有“好人答案”。
2. 每个选项给出多维度权重，例如 `{ "creation": 0.8, "world": 1.0, "authority": -0.4, "time": 0.6 }`。
3. 注意 A/B/C/D 位置不得固定对应某种倾向。
4. `npm run validate-data` 会检查权重是否指向已存在的维度，以及每个维度的正负权重是否都被使用。

## 修改权重与阈值

评分公式与权重都在 [design/SCORING.md](design/SCORING.md) 中定义，参数放数据文件而非代码。禁止在引擎里写针对具体神格的分支；差异只能来自数据。

改完参数后跑 `npm run simulate`：单神格主神格出现率超过 15%，或低于 0.2%，都会在输出末尾被点名。

## 内容是怎么拼出来的

报告不是固定模板，而是四层内容叠出来的，越靠后越个人化：

1. **原型文本**（74 个神格各自的 psychology / states / shadow）提供骨架；
2. **维度组合注**（`data/dimension_notes.json`，30 条）按你自己的数字命中，例如「高权力 + 低权威」→「你要的不是遵守规则，而是自己决定规则」；
3. **配对文案**（`data/pair_interpretations.json`，20 组高频组合）写主神格与副神格/内战双方之间到底怎么互动；
4. **现场合成的句子**：没被人工写过的组合，用两条向量现算——先找共同高维，再找分歧最大的一维，说出「都站在『牺牲』这一侧，分开它们的是『秩序』」。

质量门禁：`npm run audit-content` 用 400 份合成报告统计每句话的「通用度」。出现在一半以上报告里的句子就不是在描述任何人，会直接列出来。当前基线：**0 段 >50%**，4891/4962 段落只在 5% 以内的人身上出现。

## 添加一条维度组合注

```json
{ "id": "power-high-authority-low", "when": { "power": { "min": 0.45 }, "authority": { "max": -0.4 } }, "text": "…" }
```

`when` 里没有任何条件（谁都命中）会被 `validate-data` 判为 Barnum 文案而报错。条件命中越多、超出阈值越深，优先级越高，所以最多两条、且优先输出两个维度的组合。

## 文案重写流程

1. 先量曝光度：统计每个神格出现在**任一角色**的频率——先改 lugh（47%）、isis（31%）这种被最多人看到的神格，而不是按神格库顺序改。
2. `npm run validate-data` 会列出文案问题：神格侧 `deity.text.thin`（prose 字段 < 10 字）、`deity.text.duplicate`（两个神格共用同一句）、`deity.text.template`（同字段里超过 30% 的行同一种句法开头、或超过 20% 同一种结尾）；题目侧 `question.text.thin`（情境 < 18 字）、`answer.text.thin`（选项 < 6 字）与同样规则的 `*.text.template`。「他/她」算同一种开头。
3. 每条文案的写法：一句说具体行为（不是抽象名词堆叠），一句说代价或自我欺骗；不要用「他不是 X，而是 Y」这一种句式打天下。
4. 改完用 `npm run show-report -- --deity <id>` 逐份读，再跑 `npm run audit-content`：它既看报告段落的通用度（>50% 就是 Barnum），也看**生成的关系句开头集中度**（>40% 说明生成层又模板化了）。

## 命令行真人测试

不想开浏览器、或者要给真人做测试时，直接在终端里跑完整流程：

```bash
npm run test-cli                    # 交互答题（52 题，按幕分组）
npm run test-cli -- --name 张三     # 把受访者标记写进文件名
npm run test-cli -- --resume        # 中途按 q 退出后，从这里继续
npm run test-cli -- --no-shuffle    # 保持与网页版完全一致的选项顺序
```

- 输入 `1`-`4` 选择（也接受 `a`-`d`）；`b` 回上一题；`q` 保存进度并退出。
- 选项默认**按「受访者 + 题号」哈希打乱显示顺序**，用来抵消「总是选第一项」的位置偏差；导出的是选项原始 id，所以结果与网页版等价。
- 答完立刻打印完整报告，并写入 `samples/<名字>-<时间>.json`（与网页版「导出我的答案」同一格式）。
- `samples/` 已在 `.gitignore` 里：答案只留在本机，不会被提交或上传。

多人测完后汇总：

```bash
npm run analyze-answers -- samples/                         # 逐人结果 + 分布 + 预期命中
npm run show-report -- --answers samples/张三-2026-09-29-14-09.json
```

## 当前状态

见 [design/STATUS.md](design/STATUS.md)：神格数、题数、测试结果、10,000 人模拟分布与已知问题。

## 隐私

测试答案只在浏览器本地处理，不上传任何服务器；进度与历史结果存 `localStorage`。V1 核心测试不调用任何 LLM API。
