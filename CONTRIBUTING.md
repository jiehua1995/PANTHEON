# 参与贡献

欢迎加神格、加题目、改文案、改算法。这个文档是给**动手改代码/数据的人**看的；产品定位和算法细节分别在 [design/PRODUCT.md](design/PRODUCT.md) 与 [design/SCORING.md](design/SCORING.md)。

## 环境

- Node ≥ 23.6（推荐 24）。脚本用 Node 原生类型剥离直接跑 `.ts`，所以不需要 `tsx`/`ts-node`，但语法必须可擦除（无 `enum`、无参数属性、类型导入一律 `import type`）。
- VS Code 打开这个仓库后：`Ctrl+Shift+P` → **Tasks: Run Task**，里面有按顺序编号的任务（数据门禁 / 单测 / 启动网页版 / 文案清单 / 读报告 / 分布模拟 / 内容审计 / 构建预览）。断点调试用 F5（配置已就绪）。推荐装 **Vue - Official** 与 **Vitest** 扩展。

## 一分钟自检

```bash
npm run validate-data   # 86 deities · 0 errors · 0 warnings
npm run test            # 17 passed
```

`validate-data` 约 15 秒，因为它最后会为每个神格在真实答案空间里搜索「是否存在一份答案表能选出它」。红字先别往下做。

## 加一个神格

1. 在 `data/deities/<体系>.json` 里追加一条，字段见 README 的示例。必须写全：`name / pantheon / category / archetype / symbols / vector(16 维) / signature_dimensions / anti_dimensions / psychology(7) / states(4) / shadow(3) / visual / titles / tags`。
2. `category` 只有 `deity` 与 `mythic_archetype`；史诗人物、怪物、传奇人物用后者，不要冒充神祇。
3. 若属于新体系，在 `data/metadata.json` 的 `pantheons` 里登记分组（一个 `pantheon` 值只能属于一个分组）。
4. 跑 `npm run validate-data`：
   - `deity.collision`（cosine > 0.94）：与既有神格太像 → 重新定义、合并或强化 signature；
   - `deity.unreachable` / `deity.crowded`：没有任何答案表能选出它 → 向量超出题目可达范围，或近邻太强；
   - `pantheon.size`：某个神系少于 8 个神格，范围模式下会显得单调。
5. `npm run simulate` 看分布：单神格主神格占比 < 15%，不该出现「从未当选」。

## 加一道题

1. 题目写在 `data/questions/<幕>.json`，每题 4 个选项；选项**只给维度权重**，绝不直接给神格加分。
2. 必须是真实处境与真实取舍（禁止「你喜欢自由还是秩序」这类明显题，也禁止「好人答案」）。
3. 写清 `act`（七幕之一）与 `profile`（`overall` / `shadow` / `hidden`）。
4. 门禁会检查：情境 < 18 字（`question.text.thin`）、选项 < 6 字（`answer.text.thin`）、选项无权重、权重指向未知维度、句法模板化、以及**假选项**（没有任何人格向量会选中它）。
5. 注意别让 A/B/C/D 固定对应某种倾向；网页版按固定顺序展示，终端版会按「受访者 + 题号」哈希打乱。

## 改文案

文案分四层，越靠后越个人化：原型文本 → 维度组合注（`dimension_notes.json`）→ 配对文案（`pair_interpretations.json`）→ 现场合成的关系句。

三条硬规矩（都有门禁）：

- prose 字段 ≥ 10 字，且**同一字段里超过 30% 的行不能用同一种句法开头**（`deity.text.template`）——74 个神格都写「他要…」读起来就是一个神格换了 74 个名字；
- 两个神格不能共用同一句话（`deity.text.duplicate`）；
- 用户可见文本里**不出现算法语言**：分数、相似度、分差、画像、权重、hash 都不许进报告（结果页只说明「两股力量几乎同高」这类人话）。`npm run audit-content` 会扫描报告段落里的裸小数与术语，并统计通用句（出现在 >50% 报告里的句子 = 谁都适用 = Barnum）。

改完这样验收：

```bash
npm run validate-data
npm run show-report -- --deity lugh      # 逐份读；--noise 0.7 看答案不一致的人
npm run audit-content                    # 通用度 + 生成层模板度
npm run review-sheet                     # 生成 review/*.md，适合一次性批注全部文案
```

## 改算法与阈值

参数都在 `data/scoring.json`（权重、阈值、特异性惩罚、觉醒判定），代码在 `src/engine/`。**不要**在引擎里写针对具体神格的分支：差异只能来自数据。

校准工具：

```bash
npm run analyze-answers -- --synthesize 12 --noise 0.35 --repeat 10   # 合成真人式样本 + 重测稳定性
npm run analyze-answers -- samples/                                   # 真实导出答案汇总
```

参考值（当前口径）：同一人重测一致率 ~58%、首位命中 52%、前三 76%（σ=0.35 的合成样本）。真实数据一直是缺的那一块。

## 命令行真人测试

```bash
npm run test-cli -- --name 张三 --pantheon chinese   # 交互答题，按幕分组
npm run test-cli -- --resume                        # 续答（q 退出时自动存盘）
```

`1-4` 选择、`b` 返回上一题、`q` 保存退出；结束时打印完整报告并写入 `samples/<名字>-<时间>.json`（与网页版「导出我的答案」同格式）。`samples/` 与 `review/` 都已 gitignore。

## 部署

推送到 `main` 后，`.github/workflows/pages.yml` 会跑 `validate-data → test → build`，并把 `site/` 推到 `gh-pages` 分支；GitHub Pages 的 Source 设成 `Deploy from a branch → gh-pages → / (root)`。

注意：不要用 `actions/configure-pages` 自动建站——GITHUB_TOKEN 无权创建 Pages 站点（`Resource not accessible by integration`）。推分支只需要 `contents: write`。

## 提交前检查清单

```bash
npm run validate-data   # 0 errors / 0 warnings
npm run test            # 全绿
npm run audit-content   # 通用句 0 段、算法语言 0 处
npm run build           # 通过，site/ 有产物
```
