<div align="center">

# PANTHEON · 万神殿

**你的灵魂不是一种人格。它是一座万神殿。**

一场神话原型驱动的人格测试：不告诉你「你是哪位神」，而是告诉你**哪几位神住在你里面、它们在争什么**。

[在线测试](https://jiehua1995.github.io/PANTHEON/) · [设计文档](design/) · [参与贡献](CONTRIBUTING.md) · [MIT License](LICENSE)

</div>

---

## 它会给你什么

做完 52 道情境题，你拿到的不是一张标签，而是一套谱系：

| 输出 | 含义 |
| --- | --- |
| **主神格** | 你最自然地存在于世界的方式 |
| **副神格** | 你用来实现主神格那种欲望的**手段**（不是第二名） |
| **阴影神格** | 被威胁、失控时替你说话的那一位 |
| **隐藏神格** | 你想过、但没活出来的那部分 |
| **内在神战** | 你身体里张力最大的那对力量，以及它们争的那个问题 |
| **神格觉醒** | 未觉醒 → 觉醒 → 过度觉醒 → 堕化，四个状态 |
| **神格称号** | 由四位神格确定性生成，例如「盗火的筑世者」 |
| **可视化** | 多维人格雷达、四股力量、神格轨道、人格星图、张力矩阵、分享卡 |

一段真实输出（长这样）：

> **主神格 · 吉尔伽美什** — 在一件事上做到没人做到过，不是为了赢，而是为了证明自己不是随便哪一个。
> **内在神战**：吉尔伽美什对哈托尔 —— 世界是留下名字的地方，别人的想法只是背景音；而另一面要让欢乐与爱流动。
> **隐藏神格 · 哈托尔**：长期不用它不会让你痛苦，只会让你越来越难说清自己为什么不满足。

## 为什么它不是又一个「你是哪位神」

- **先量向量，再配原型**：16 个连续维度各自落在 −1..+1，先得到你的人格向量，再去找最接近的原型。不是让你从三个形容词里挑一个。
- **四个角色不是排名**：主/副/阴影/隐藏分别用不同的题目与画像选出——副神格看的是「你如何达成主神格的欲望」，阴影看的是「压力下你是谁」。
- **内在冲突是核心内容**：报告会指出你身上最对立的一对力量，给出对比轴和那句你不想承认的问题。
- **允许不好听**：结果只描述模式，不给人定罪。例如「你极度厌恶别人控制你，却未必同样敏感于自己控制别人。」
- **完全可复现**：相同答案 + 相同版本号 ⇒ 完全相同的称号与结果。

## 用起来

**在线**：<https://jiehua1995.github.io/PANTHEON/> —— 手机上直接答题，答案只存在你自己的浏览器里。

**本地**：

```bash
git clone git@github.com:jiehua1995/PANTHEON.git
cd PANTHEON
npm install
npm run dev          # http://localhost:5173
```

**先选神系（可选）**：首页可以圈定测算范围——全部万神殿（86 个原型一起比），或只在希腊 / 北欧 / 凯尔特与欧洲 / 中国 / 日本 / 埃及 / 神话原型里找。范围越小，结果越聚焦。

**终端答题**（不用浏览器，适合帮别人测）：

```bash
npm run test-cli -- --name 张三            # 交互答题 → 报告 + 导出 JSON
npm run test-cli -- --pantheon greek       # 限定希腊神系
npm run test-cli -- --resume               # 中途退出后续答
```

## 它是怎么工作的

```
52 道情境题（7 幕：秩序 / 意志 / 边界 / 欲望 / 冲突 / 深渊 / 神性）
        │  每个选项给多个维度加权，不直接给神格加分
        ▼
三套人格向量（overall 日常 · shadow 压力 · hidden 未活出）
        ▼
86 个原型向量：cosine 相似度 + signature 加成 − anti 惩罚 + 一致性 + 特异性
        ▼
主神格 / 副神格（互补性）/ 阴影神格（压力画像）/ 隐藏神格（hidden − overall 差距）
        ▼
关系层（97% 由向量几何推导，其余手工边）→ 内在神战 → 神格构成 → 确定性称号
        ▼
模块化报告：原型文本 + 维度组合注 + 配对文案 + 现场合成的关系句
```

几条硬约束：

- **纯静态**：无后端、无数据库、无登录，全部计算在浏览器里完成，可直接托管在 GitHub Pages。
- **不上传**：答案与结果只写进本机 `localStorage`。
- **不调用 LLM**：核心测试完全离线可复现，不含任何 API key、也没有「套壳聊天」。
- **数据驱动**：维度、神格、题目、关系、文案全在 `data/*.json`，引擎里没有针对具体神格的 if 分支。

**技术栈**：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Vitest；统计图表用 ECharts（按需引入、SVG 渲染），神格轨道 / 星图 / 星战这类专属视觉是手写 SVG。没有 UI 框架、没有状态库、没有后端。

## 项目结构

```
data/            数据源（JSON）
  dimensions.json   16 个维度定义
  deities/*.json    86 个神格：向量、心理模式、四种状态、阴影、称号词
  questions/*.json  52 道情境题（按幕分文件）
  relationships.json / pair_interpretations.json / dimension_notes.json / titles.json
src/
  engine/         评分、匹配、关系、内在神战、称号、报告拼装
  components/     首页 / 答题 / 结果面板 / 可视化 / 分享卡
  schema/         TypeScript 类型与数据加载
scripts/          数据校验、模拟、审计、命令行测试与报告
design/           设计文档：产品定义、架构、评分算法、可视化
```

数据长这样（`data/deities/` 里的一条）：

```json
{
  "id": "prometheus",
  "name": { "zh": "普罗米修斯", "en": "Prometheus" },
  "pantheon": "greek",
  "category": "deity",
  "archetype": { "core": "盗火者", "theme": "知识转化为改变世界的能力" },
  "vector": { "power": -0.2, "creation": 1.0, "world": 1.0, "authority": -1.0, "risk": 0.9, "...": "共 16 维" },
  "signature_dimensions": { "creation": "very_high", "world": "very_high", "authority": "very_low" },
  "psychology": { "core_drive": "...", "core_fear": "...", "worldview": "...", "...": "共 7 项" },
  "states": { "dormant": "...", "awakened": "...", "overawakened": "...", "fallen": "..." },
  "shadow": { "trigger": "...", "defense": "...", "danger": "..." },
  "titles": { "prefixes": ["盗火", "越界", "启明"], "nouns": ["筑世者", "破壁者", "造火者"] }
}
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发（<http://localhost:5173>） |
| `npm run build` | 构建静态站点 → `site/` |
| `npm run preview` | 预览构建产物 |
| `npm run test` | 单元测试（引擎可复现性、数据门禁、结果页渲染） |
| `npm run validate-data` | 数据与内容总门禁：结构、引用、可达性、文案质量 |
| `npm run simulate` | 10,000 个合成用户，检查主神格分布是否健康 |
| `npm run show-report -- --deity odin` | 直接读一份完整报告 |
| `npm run review-sheet` | 生成给人批注的文案清单（`review/*.md`） |
| `npm run audit-content` | 内容审计：通用句（Barnum）与生成层模板度 |
| `npm run analyze-answers -- samples/` | 汇总多人的真实答案 |

## 参与贡献

想看「怎么加一个神格 / 加一道题 / 改权重」，以及每个门禁到底在检查什么，请看 **[CONTRIBUTING.md](CONTRIBUTING.md)**。算法细节在 [design/SCORING.md](design/SCORING.md)，产品定义在 [design/PRODUCT.md](design/PRODUCT.md)。

## 隐私

测试答案只在你的设备上处理，不上传服务器；进度与历史结果存在浏览器 `localStorage`。终端版把答案写到本机 `samples/`（已在 `.gitignore` 中）。

## 定位说明

这是一个神话原型驱动的人格叙事系统，**不是**临床心理测试、医学工具或命运预测；它吸收原型心理学与神话学的设计思想，但不声称任何科学诊断能力。

## License

[MIT](LICENSE)
