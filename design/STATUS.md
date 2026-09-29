# 项目状态（可复现快照）

最后更新：2026-09-29（第七轮：命令行真人测试通道）

## 完成内容

| 层 | 内容 |
| --- | --- |
| 数据 | 16 维定义、74 个神格、52 题、关系库、称号词池、评分配置、metadata 版本号 |
| 引擎 | 向量构建、相似度、主/副/阴影/隐藏匹配、构成、内在神战、觉醒状态、称号生成、报告拼装 |
| 界面 | 首页仪式入口、7 幕测试流程、结束仪式、13 段结果页、8 类可视化、Canvas 分享卡、localStorage 进度与历史 |
| 工程 | `validate-data` 门禁（含可达性搜索）、`simulate` 分布模拟、`analyze-answers` 校准通道、14 个单测、TypeScript 严格模式、构建到 `docs/` |

## 当前算法

1. 每题选项按维度给权重，per-profile 累加后 `tanh(raw / (denom / 3.7))` 压缩到 −1..1。
2. 主神格 = 0.68·cosine + 0.16·(1−RMS/2) + 0.10·signature命中 + 0.06·一致性 − 0.55·anti命中 − 0.16·中心度。
3. 副神格 = 0.6·匹配 + 0.4·（关系类型 + 与主神格共享高维目标的契合度）。
4. 阴影神格 = shadow 向量最匹配者（排除主神格）；隐藏神格 = hidden − overall 差距最大者。
5. 构成 = 0.6·overall + 0.25·shadow + 0.15·hidden 归一化成 Top 6。
6. 内在神战 = 构成权重 × 方向背离 × 关系类型的最大组合。
7. 称号 = FNV-1a hash(四神格 + 主导维度 + 版本) → 模板 + 词池确定性拼装。

## 数量

- 神格：74（deity 63 / mythic_archetype 11），分布于 7 个体系
- 维度：16（核心 8）
- 题：52（overall 38 / shadow 7 / hidden 7）
- 关系：手工边 4 条 + 几何推导覆盖其余 97% 配对

## 测试结果

```
npm run validate-data   → 74 deities · 16 dimensions · 52 questions · 0 errors · 0 warnings
                          （含：每个神格都能在自己最有利的答案表上当选）
npm run test            → 3 files / 14 tests passed（含结果页 SSR 冒烟 + 可达性门禁回归）
npm run build           → 关键路径 87 KB gzip + 结果页 173 KB gzip（按需加载）
```

## Simulation 结果（10,000 合成用户）

```
主神格最高占比   6.54%（odysseus）；无神格超过 15% 上限
从未成为主神格   0 个
低于 0.2%        4 个（morrigan 0.16% · baldr 0.15% · hestia 0.08% · apollo 0.08%）
觉醒分布         awakened 45% · overawakened 27% · dormant 19% · fallen 8%
称号多样性       10,000 人产生 1,432 个不同称号
```

## 第二轮修掉了什么

| 问题 | 根因 | 修法 | 结果 |
| --- | --- | --- | --- |
| hestia 永远当不上主神格 | 题库里每一个高身份的选项都同时捆绑支配或对抗，用户无法表达「安静而稳定」 | 给 3 个既有选项补 `identity` 正权重（照做但记住 / 独自消化 / 想要一个安静的地方） | 从未当选的神格 1 → 0 |
| 堕化状态从不触发 | 判定条件（anti 命中 ≥ 0.35）跟打分函数互相矛盾：anti 命中会被 0.55 惩罚压掉，该神格根本当不上主神格 | 改成「压力下比日常更像主神格」的判定 | fallen 0% → 8% |
| 9 个神格低于 0.2% | 纯 cosine 让居中原型吃掉用户 | 加数据驱动的中心度惩罚，0/0.08/0.16/0.24 扫参后取 0.16 | 稀有神格 9 → 4，最高占比 7.2% → 6.5% |
| 门禁无法发现「不可达」 | 原来的检查太粗（逐维极值）且目标函数错（最大化 cosine 而非胜出余量） | 换成「最大化我 − 最强对手」的局部搜索，复用引擎同一打分函数 | 抓到题库覆盖缺口、增量累加漂移 bug，并回归成测试 |
| `validate-data` 变慢到 20 秒 | 每次试验都全量重建向量 | 改为增量累加 + 预计算分母，并把慢检查从单测里摘出（`{ reachability: false }`） | 0.8s（关闭搜索）/ 14.5s（完整门禁，可接受） |

## 仍然存在的问题

## 第三轮做了什么

| 事项 | 结果 |
| --- | --- |
| 校准通道 | 结果页「导出我的答案」+ 首页「导入一份答案」+ `npm run analyze-answers`：同一份 JSON 既能还原测试，也能进分析脚本 |
| 真人式样本 | `--synthesize N`：12 个「人物描述 + 情绪化维度 + 随手乱点 + 避开极端选项」的合成受访者，并测重测稳定性（`--repeat`） |
| 稳定性调优 | 软阈值 `signatureSoftness 0.3`、`signature 0.25`、`specificity 0.26`、`anti 0.8`：首位命中 36% → 45%，前三 70% → 72%，重测一致率 54% → 60% |
| 簇分隔 | 7 条数据驱动的 anti 分隔线（frigg/brigid/okuninushi/houyi/set/nezha/apollo）：首位命中 45% → **52%**，前三 72% → **76%**，最高占比降到 6.0% |
| 不生效的尝试 | 裁尾（trimFraction）15%/25% 反而变差 → 保留旋钮、默认 0，并写进文档 |
| 诚实报告 | `closeMargin 0.025` + 「接近票」提示：分差极小时明说「你在两者之间，第二名是 X」 |
| 可视化品味 | `src/theme.ts` 统一 4 角色配色（主/副/阴影/隐藏），雷达 / 构成条 / 轨道图 / 分享卡同色；分享卡新增 1:1 与 4:5 |
| 移动端 | 结果页吸顶导航（`scrollIntoView`，不破坏 hash 路由）+ 长段落 `<details>` 折叠 + 雷达「查看数值」表 |
| 可访问性 | 全站 `:focus-visible` 描边、按钮高度 ≥48px、`prefers-reduced-motion`、图表 sr-only 文本 + 可见数值表 |

## 第三轮实测（σ=0.35 真人式样本，每人 10 轮）

```
首位命中 52% · 前三命中 76% · 重测一致率 58%
噪声敏感性：σ=0.7 时 43% / 65% / 54%（噪声越大越不稳定，符合预期）
```

## 第四轮：内容与文案

先把「文案差」变成可测的东西，再动手。新建 `npm run audit-content`：对 N 份合成报告统计**每一段话出现在多少比例的报告里**——出现在一半以上报告里的句子就不是在描述任何人。

改前基线暴露的不是 Barnum，而是三处结构性毛病（读一份真实报告才看出来）：

1. 副神格与阴影神格是**同一个神**，两套不相干的文字描述它；
2. 构成里主神格与路人并列（prometheus 18% / isis 18% / nuwa 17%），看起来像坏了；
3. 全文是「触发：… 防御：… 危险：…」的字段清单，不是报告。

| 改动 | 内容 |
| --- | --- |
| 角色互斥 | 阴影排除主+副；隐藏排除主+副+阴 |
| 构成排序 | 按角色优先（主 > 副 > 阴影 > 隐藏），百分比仍来自匹配强度；负分夹到非负 |
| 维度组合注 | 新增 `data/dimension_notes.json`（30 条，双维度组合优先），报告里额外输出 2 句**按你自己数字**生成的话 |
| 报告叙事化 | 去掉字段标签，合成叙事段落；去掉重复句（觉醒 vs 力量） |
| 关系兜底句 | 删除 61% 通用的兜底句，改为按两条向量现场合成（共同高维 + 最大分歧维） |
| 称号多样性 | 词池扩容 + 允许用隐藏神格的词缀命名；新增 3 个模板 |
| 措辞 bug 修复 | 「都偏克制」被写成「分歧」；中立维度被写成「重合」；负百分比 |

改后实测（400 份合成报告）：

```
出现于 >50% 报告的段落   2 段 → 0 段
只出现在 <5% 报告里的段落 3960/4007 → 4891/4962
不同称号                 140/300 (47%) → 307/400 (77%)
四个角色互不相同         回归测试覆盖（5 组目标向量）
构成排序                 回归测试覆盖（composition[0]=主神格，[1]=副神格）
```

新增内容相关的门禁/测试：`dimension_notes` 的维度引用与阈值范围校验、「`when` 为空 = Barnum」直接报错、Barnum 回归测试（24 份报告里不允许有段落超过 80% 出现率）。

## 第五轮：按曝光度分批重写文案（进行中）

重写顺序不靠感觉，先量「谁最常出现在别人的报告里」。`scripts/validate-data.ts` 现在还会检查：

- `deity.text.thin`：prose 字段少于 14 字（`visual.symbol/geometry/motif` 是关键词记号，不计入）；
- `deity.text.duplicate`：同一句话被两个神格共用。

基线（74 个神格 × 14 个 prose 字段 = 1036 段）：**339 段过短，0 段重复**。

曝光度（2000 个随机用户，出现在任一角色的比例）：

```
47.1% lugh   31.1% isis   19.0% odysseus   18.6% gilgamesh   13.7% izanagi
13.3% athena 13.2% jiutianxuannv 13.1% morgan_le_fay 12.7% caishen 9.7% prometheus
```

已完成批次（24 个神格，每段按「具体行为 + 代价」重写，不是加形容词）：

| 批次 | 神格 |
| --- | --- |
| 1（最高曝光） | lugh, isis, odysseus, gilgamesh, izanagi, athena, jiutianxuannv, morgan_le_fay, caishen, prometheus, dionysus, xiwangmu |
| 2 | freyja, change, skadi, inari, sunwukong, merlin, cernunnos, zhongkui, baldr, morrigan, loki, erlang |
| 3 | shennong, fenrir, persephone, fuxi, artemis, hephaestus, hathor, aphrodite, nuwa, hel, izanami, heimdall |
| 4 | odin, thor, frigg, maat, sekhmet, guanyin, guanyu, tyr, tsukuyomi, hecate, susanoo, xingtian |
| 5 | zeus, poseidon, hades, hera, demeter, apollo, ares, hermes, hestia, ra, osiris, horus, anubis |
| 6 | thoth, set, bastet, amaterasu, okuninushi, ame_no_uzume, brigid, yuhuang, houyi, nezha, mazu, taishanglaojun, jingwei |

结果：**74/74 全部重写完成**，每一份报告都使用新文案；又修掉一个措辞 bug——关系句把同侧写成「分歧」，现在改说「差别更多在力度」。

### 句法门禁：模板疲劳

字数够了不代表文案好。加完长度检查后又发现：**68/74 个 `core_drive` 都以「他要/她要」开头，24 个 `states.fallen` 都以「只剩」开头，24 个 `worldview` 都以「世界」开头**——74 个神格读起来像一个神格换了 74 个名字。

因此 `validate-data` 增加了 `deity.text.template`：同一个字段里，相同的句法开头不得超过 30%，相同结尾不得超过 20%（「他/她」算同一种开头）。据此重写了 74 条 core_drive、20 条 worldview、24 条 fallen 和 26 条过短句。

最终内容指标：

```
过短字段（<10 字）     339 → 0
句法模板（开头 >30%）   3 处 → 0
跨神格重复句            0
内容审计 >50% 通用段落  0
test                  17/17 · build 通过
```

## 第六轮：题库与生成层

同样的标准套到**用户最先看到的内容**上，又发现两类问题：

1. **5 道题是列表式提问**（「你最想拥有的一种自由是：」「深夜里你最常想象的是：」），正是 spec 第 30 条禁止的问卷感；另有 12 道情境只有 12–17 字，缺上下文与代价。
2. **生成层在模板化**：抽查 14 组随机配对，9 组都用「冲突」当分岔维度，句式完全一致。

改法：

| 项目 | 改动 |
| --- | --- |
| 题目文案 | 重写 17 道（5 道列表题改成真实情境，12 道补上上下文与代价），权重**一字未动**——权重是校准过的，动文字不动数字 |
| 选项文案 | 补 4 个过短选项（如「被控制。」→「被管得太细。」） |
| 门禁 | 题目与选项纳入同一套检查：`question.text.thin`（<18 字）、`answer.text.thin`（<6 字）、`question/answer.text.template` |
| 生成层 | 关系句从固定一句改成 4 种句式，并从最强三个候选里按 pair 哈希选分岔维度，不再人人都是「冲突」 |
| 审计 | `audit-content` 增加「关系句开头集中度」检查（超过 40% 视为生成层模板化） |
| 假选项检查 | `answer.dead_option`：随机取 1500 个人格向量，若某个选项从来不是最优，它就不是真选项（spec §32）。当前 52 题 × 4 选项**全部通过** |

验收：

```
question.text.thin   17 → 0
answer.text.thin      2 → 0
题/选项 句法模板       0
关系句最高频开头      100%（旧）→ 27.5%（400 组随机配对）
validate-data        74 deities · 0 errors · 0 warnings
simulate             最高主神格 6.12% · 无神格超 15% · 0 个从未当选（权重未变，分布保持一致）
distinct titles      3,574 / 10,000 用户
```

## 第七轮：命令行真人测试

真人样本一直是唯一没法自己补上的证据。新增 `npm run test-cli`：

- 交互答题，按「Ⅰ 秩序 … Ⅶ 神性」分幕，`1-4` 选择、`b` 回上一题、`q` 保存进度；
- 选项默认按「受访者 + 题号」哈希**打乱显示顺序**，抵消位置偏差（导出存原始 optionId，与网页版结果等价）；
- 结束即打印完整报告，并写入 `samples/<名字>-<时间>.json`，与该网页版「导出我的答案」同一格式；
- `samples/` 已加入 `.gitignore`：只在本机，不提交、不上传。

顺带把报告排版抽成 `src/engine/report-text.ts`，`show-report` 与 `test-cli` 共用一份，避免两处文字漂移；并修掉两个「负数取模」bug（`(a ^ b) % n` 在 JS 里可能是负索引，会静默产出 `undefined`）。

真人数据回来后要校准的四件事（都还只有合成口径）：

1. `scaleDivisor` 3.7：真人的答案分布比合成模型集中还是分散？
2. `specificity` 0.26：真实用户的主神格是否也过度集中在 odysseus / lugh 这类居中原型？
3. `fallen 9%`：合成口径偏高还是偏低？
4. 「被说中」的主观评价：哪几段最像、哪几段最空——这是纯人工输入，脚本测不出来。

1. **4 个神格低于 0.2%**（morrigan / baldr / hestia / apollo）：都能当选（门禁保证），但盆地区域仍然窄。它们都在密集象限（温暖-有序-低支配，或预言-对抗）。下一步应重写它们的 2–3 个核心选项，而不是继续调阈值。
2. **簇密度仍高**：31 个神格至少有一个 cosine ≥ 0.88 的近邻（nuwa~brigid 0.93、shennong~mazu 0.93、nezha~susanoo 0.93）。这就是重测一致率停在 58–60% 的结构原因；继续做只能靠重定义向量或合并原型，而不是调参。
3. **apollo 仍最低（0.05%）**：加 `time: very_high` 的 anti 后略有改善，但仍在雅典娜的影子里。
4. **fallen 的 8% 仍未用真人验证**：该比例由 `fallenShadowCapture = 0.05` 决定。
5. **门禁的搜索是启发式**：局部搜索能证明「存在能赢的答案表」，不能证明「无解」。
6. **关系图层仍以几何推导为主**：人工边 4 条 + 20 组高频 pair 专属文案（`data/pair_interpretations.json`）。

## 下一步建议

1. 收起真人样本后跑 `npm run analyze-answers -- samples/`，用真人口径替换本文所有合成数字（尤其是 `fallen` 比例与 `specificity`）。
2. 按 §17 的方法继续切簇：优先 nezha~susanoo、shennong~mazu、nuwa~brigid 三对（cos ≥ 0.93）。
3. apollo / morrigan 需要重写核心选项（内容活，不是参数活）。
4. 上线（git init + Pages main /docs）。
