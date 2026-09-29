# 评分与匹配算法

## 1. 维度向量

16 个连续维度，取值 −1.0 ~ +1.0。维度定义在 `data/dimensions.json`（含 `core` 标记，决定“核心 8 维”雷达显示哪些）。引擎不得假设维度数量或名称，一切从定义文件读取。

维度之间必须保持独立：例如 `power = +0.9, authority = -0.9`（自己想掌控方向，但极度排斥别人对自己拥有权威）是合法且重要的结构，不能合并。

## 2. 三个 Profile

| profile | 含义 | 题源 |
| --- | --- | --- |
| `overall` | 平时最稳定、最常见的行为方式 | 行动 / 价值 / 一般情境 / 决策题 |
| `shadow` | 压力、失败、背叛、羞辱、失控、被威胁时滑向的模式 | 深渊幕专门题 |
| `hidden` | 显性行为没有表达，但在欲望、幻想、理想环境与未实现倾向中很强的部分 | 神性幕专门题 |

每题带 `profile` 字段。题目不得直接给神格加分：只给维度权重。

## 3. 向量生成

对每个 profile 独立累加：

```
raw[d] = Σ (optionWeight[d])
vector[d] = clamp(tanh(raw[d] / k), -1, 1)      // k 为可调尺度常数，待 Phase 1 用 simulation 校准
```

`tanh` 压缩保证极端答题不产生 ±3 的畸形向量；`k` 与题目难度/权重尺度绑定，是留给实测的校准旋钮，不靠纸面推导定死。

## 4. 主神格

不允许 `argmax(cosine)` 一击定胜负：

```
primary_score =
    w1 · cosine_similarity(user, deity)
  + w2 · (1 − normalized_euclidean)
  + w3 · signature_bonus          // 命中该神格的 signature_dimensions，按 very_high/high/low 加权
  − w4 · contradiction_penalty    // 命中该神格的 anti_dimensions
  + w5 · profile_consistency      // 该候选在 overall/shadow/hidden 上的一致性
  − w6 · centrality               // 靠近神格库平均向量的程度（0..1）
```

实际取值：`w1 0.68 · w2 0.16 · w3 0.10 · w4 0.55 · w5 0.06 · w6 0.16`，写在 `data/scoring.json`，便于 simulation 调参。

**为什么有 centrality 项**：纯 cosine 会让词汇/向量最"居中"的原型吃掉大量用户（实测 lugh、odysseus 各占 7%），而靠边的原型几乎不可获得。centrality 由数据算出（每个神格向量与全库平均向量的 cosine，做 min–max 归一化），越居中惩罚越大，因此不需要任何针对具体神格的分支。specificity 从 0 → 0.24 扫过一遍后取 0.16：主神格最高占比 7.2% → 6.5%，低于 0.2% 的神格从 9 个降到 4 个。

## 5. 副神格

副神格不是第二高分，而是：

> 你通常**怎样实现**主神格的欲望。

候选排序在 primary 排除后计算，并额外加 **complementarity 分**：与主神格在 `relationships` 中关系类型为 `complement`、且共享至少一个高维目标的候选优先。例：Prometheus 的“改造世界”可以通过 Athena（设计/战略）、Ares（对抗）、Hermes（信息与绕过边界）实现——三者必须能产出不同的副神格文案。

## 6. 阴影神格

由 `shadow_vector` 匹配，语义是“受威胁时的自我保护方式”，不是“邪恶人格”。

候选必须给出 shadow 形态描述（来自该神格 `shadow.trigger / defense / danger`）并做过度化的重新表述，例如 Athena shadow = 过度分析 + 过度控制 + 把人变成变量。禁止复用主神格段落。

## 7. 隐藏神格

```
hidden_gap[d] = similarity(hidden_vector, d) − similarity(overall_vector, d)
```

取 `hidden_gap` 最大者。输出重点是**对照解释**：overall 与 hidden 的结构差异说明了什么（典型：Overall → Athena，Hidden → Dionysus）。

## 8. 神格构成

取 Top 5–7，把匹配分归一化为构成百分比。必须明确这是**叙事构成值，不是概率**，UI 文案用“神格构成”，不得写“你有 31% 普罗米修斯 DNA”。

## 9. 内在神战

寻找满足以下条件的原型对：两者匹配分都高、在 `relationships` 中为 `tension` / `conflict`，且核心向量方向相反。输出：两侧对比条（同一组语义轴上的相反倾向）+ 一句核心矛盾问句。

## 10. 称号

```
seed = hash(primary + secondary + shadow + hidden + dominant dimensions + versions)
```

由模板 + 神格 title pool（`titles.prefixes` × `titles.nouns`）确定性地拼装。相同输入永远得到同一称号；不得使用 `Math.random()`。模板池与词汇池都在数据文件里，代码不硬编码词。

## 11. 结果对象

```
{
  versions: { test, scoring, deityDatabase, result },
  vectors: { overall, shadow, hidden },
  primary, secondary, shadow, hidden,      // 各含 score + matched dimensions + 说明
  composition: [{ deityId, share }],
  conflicts: [{ a, b, axis[], question }],
  title, coreThesis,
  sections: [...]                          // 模块化拼装的报告段落
}
```

## 12. 验证门槛

- `npm run validate-data`：结构、引用、覆盖率（每维正负权重是否都被使用）门禁。
- 相似度矩阵：`cosine > 0.94` 的神格对必须人工判断（合并 / 重新定义 / 调整 vector / 强化 signature）。
- `npm run simulate`（≥ 10,000 用户）：输出主 / 副 / 阴影 / 隐藏分布与 pair 分布。单神格主神格出现率 > 12–15% 或 < 0.2% 都触发复查（调试阈值，非硬标准）。
- 选项位置偏差：A/B/C/D 不得固定对应某种倾向，需人工平衡或随机化。

## 13. 关系层：几何推导 + 手工覆盖

手写 74 × 73 对关系不现实。因此 `src/engine/relationships.ts` 采用两层：

1. `data/relationships.json` 中人工写下的边（例如 `prometheus → zeus: tension`）优先，可带 `note`；
2. 其余所有配对按两条向量的 cosine 落入阈值带推导：

| cosine | 类型 |
| --- | --- |
| ≥ 0.90 | mirror 镜像 |
| ≥ 0.60 | affinity 亲和 |
| ≥ 0.05 | complement 互补 |
| ≤ −0.40 | conflict 冲突 |
| ≤ −0.05 | tension 张力 |
| 其余 | 未定义（中性并存） |

阈值写在 `data/scoring.json` 的 `relations` 里，代码不含任何具体神格分支。实测覆盖率 97%（未定义带仅 3% 的配对），每个神格至少有一条被定义的关系。

## 14. 校准过的实际取值

| 参数 | 值 | 依据 |
| --- | --- | --- |
| `scaleDivisor` | 3.7 | 让 10,000 人模拟的向量分布能覆盖 ±0.8 区间，同时不让所有维度饱和 |
| `primary.cosine` 权重 | 0.68 | 方向比距离更可信 |
| `primary.contradiction` 权重 | 0.55 | anti_dimensions 命中即强烈降权 |
| `primary.specificity` 权重 | 0.16 | 0/0.08/0.16/0.24 扫参后，稀有神格最少且最低占比最高的一档 |
| `awakening.shadowPressureMargin` | 0.09 | 阴影相似度超出日常相似度 0.09 才算「过度觉醒」 |
| `awakening.fallenShadowCapture` | 0.05 | 压力下的自己比日常的自己更像主神格，才算堕化 |

觉醒状态的四条规则（按顺序判定）：

1. `fallen` — 命中主神格 anti_dimensions ≥ 0.6（极端），或压力向量对主神格的相似度比日常向量高 ≥ 0.05，且主神格相似度 ≥ 0.45；
2. `overawakened` — 全库最高阴影相似度 − 主神格相似度 ≥ 0.09；
3. `dormant` — 主神格相似度 ≤ 0.42，或第一名与第二名差距 < 0.02（神格尚未分化）；
4. 否则 `awakened`。

早期版本用「anti 命中 ≥ 0.35」判堕化，实际上不可能触发：anti 命中会在打分阶段就被 0.55 的惩罚压下去，这个神格根本当不上主神格。**能触发的状态机不能和打分函数互相矛盾。**

## 15. 可达性门禁（`npm run validate-data` 的一部分）

对每个神格做两件事，都用引擎自身的评分函数，避免门禁与线上算法漂移：

1. 在真实答案空间里做局部搜索，最大化「我 − 最强对手」的得分差；若最大余量仍 ≤ 0，说明没有任何可达用户最像它 → `deity.crowded`；
2. 同时用一次廉价的 cosine 搜索给出「最贴近它的答案表」的相似度；若 < 0.8 → `deity.unreachable`。

这条门禁抓到过的真实问题：

- 题库负向权重偏弱时，`order / reason / world / sacrifice / transcendence` 的极低端不可达，4 个神格在数学上无法被匹配；
- 增量累加实现中「接受一次改动后用旧选项回滚」的漂移 bug（表面现象是余量为正却选不出该神格）。

## 16. 稳定性：同一份人格重测会不会变卦

`npm run analyze-answers -- --synthesize N --repeat K` 用「真人式」样本人格测量两件事：

- **重测一致率**：同一个人的答案换一批小噪声，主神格不变的比率（同一个人不应该每次看到不同的神）；
- **预期命中**：造这个人时参考的神格，是否真的成为主神格（首位 / 前三）。

σ=0.35（轻度不一致）下的实测：

| 配置 | 重测一致率 | 首位命中 | 前三命中 |
| --- | --- | --- | --- |
| 初版（硬阈值、无特异性） | 54% | 36% | 70% |
| 软阈值 `signatureSoftness 0.3` | 58% | 41% | 70% |
| + `signature 0.25` / `specificity 0.26` / `anti 0.8` | 60% | 45% | 72% |
| + 7 条 anti 分隔线（见 §17） | 58% | **52%** | **76%** |

不生效的尝试也记录在此：按维度裁掉 15%/25% 极端贡献（`trimFraction`）**没有**改善稳定性，反而降低命中（15% → 一致率 56%/首位 30%），因此 `trimFraction` 保留为旋钮但默认 0。

残余抖动不用调参掩盖：74 个原型挤在 16 维里，最近邻本来就相似。产品层的处理是 **接近票**（`closeMargin = 0.025`）——分差很小时结果页与报告都会明说「你在两者之间」，并指出第二名的名字。

## 17. 用数据找分隔线（窄盆地神格的修法）

当某个神格票数过低或重测时被邻居抢走，不要改阈值，先问：「谁在抢它的票，该在哪一维切开？」

做法（`/tmp/poach.mjs` 这一类诊断脚本，一次性使用）：对每一对（窄神格 A / 抢票者 B），按 |A 的值| 排序各维度，找出「A 极端、B 不极端」的维度，把它加成 **B 的 anti_dimensions** —— 意思是「像 A 那样的人，不是 B」。

本轮据此加了 7 条，每条都有语义依据：

| 抢票者 | 新增 anti | 理由 |
| --- | --- | --- |
| frigg | `power: very_low` | 弗丽嘉是会动手干预的人，不是彻底退出支配的人 |
| brigid | `desire: very_low` | 布里吉德不是禁欲型（那是观音的角落） |
| okuninushi | `transcendence: very_high` | 大国主属于此世，不属于仪式与灵界 |
| houyi | `social: very_high`、`reason: very_low` | 后羿是独自出手的人，不是靠关系或纯蛮力的托尔 |
| set | `transcendence: very_high`、`time: very_high` | 赛特要眼前的位置，不讲预兆也不讲长期 |
| nezha | `time: very_high` | 哪吒要立刻重造，不玩十年布局 |
| apollo | `time: very_high` | 阿波罗要此刻呈现的完美形式，不是十年布局（那是雅典娜） |

## 18. 四个角色必须互不相同

- 阴影神格排除主神格**与副神格**（`shadow.excludePrimary / excludeSecondary`）——早期版本会出现「副神格和阴影神格都是伊西斯」，两个角色用两套不相干的文字描述同一个神，报告看起来是坏的。
- 隐藏神格排除主 / 副 / 阴影三者，只要备选里还有第四个神格。
- 构成（Top 6）**按角色优先排序**：主 > 副 > 阴影 > 隐藏，其余按匹配强度补足。百分比仍然来自匹配强度（`0.6·overall + 0.25·shadow + 0.15·hidden`），但排序是叙事层级，不是概率排序——用户不该看到主神格和路人并列第一。`validate-data` 保证四个角色都能当选（§15），所以这个排序不会掩盖任何东西。
- 构成百分比被夹到非负：cosine 为负的候选会算出负分，负的百分比是明显的 bug。

## 19. 内容装配与 Barnum 门禁

报告四层结构：原型文本 → 维度组合注 → 手工配对文案 → 现场合成的关系句（见 README）。两条规则：

1. **维度组合注**（`data/dimension_notes.json`）按 `when` 条件命中，优先级 = 条件数量，其次 = 超出阈值的深度。`when` 为空 = 谁都适用 → 校验直接报错。
2. **配对文案缺失时不许用同一句兜底**。原来的兜底句（「两者看向同一个方向，只是手段和语速不同。」）出现在 61% 的报告里；现在改为按两条向量现场合成：共同高维 + 分歧最大的一维。

`npm run audit-content` 把「文案太差」变成数字：对合成的 N 份报告统计每段话的出现率。

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| 出现于 >50% 报告的段落 | 2 段 | **0 段** |
| 只出现在 <5% 报告里的段落 | 3960 / 4007 | 4891 / 4962 |
| 不同称号 | 140 / 300（47%） | 307 / 400（77%） |
