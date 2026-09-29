/**
 * `npm run review-sheet` — 生成给人看的文案审查清单。
 *
 *   review/deities.md   74 个神格的心理学 / 状态 / 阴影文本，按曝光度排序
 *   review/questions.md 52 道题与 208 个选项（附维度权重，便于核对选项是否真的对应那些维度）
 *
 * 用法：直接在文件里标 ❌ / ⚠️，或把「编号 + 一句为什么」发回来。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import type { PantheonData } from '../src/schema/types.ts'

const OUT = 'review'

const DIM_ZH: Record<string, string> = {}

function exposure(data: PantheonData, users = 600): Map<string, number> {
  let seed = 20260929
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
  const counts = new Map<string, number>()
  for (let i = 0; i < users; i++) {
    const answers = data.questions.map((question) => {
      let best = question.options[0]
      let bestScore = -Infinity
      for (const option of question.options) {
        let score = 0
        for (const [, weight] of Object.entries(option.weights)) score += weight * (rand() * 2 - 1)
        score += (rand() - 0.5) * 0.8
        if (score > bestScore) {
          bestScore = score
          best = option
        }
      }
      return { questionId: question.id, optionId: best.id }
    })
    const result = generatePantheonResult(answers, data)
    for (const id of [result.primary.deityId, result.secondary.deityId, result.shadow.deityId, result.hidden.deityId]) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return new Map([...counts.entries()].map(([id, count]) => [id, count / users]))
}

function weightHint(weights: Record<string, number>): string {
  return Object.entries(weights)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([dim, weight]) => `${DIM_ZH[dim] ?? dim}${weight > 0 ? '+' : '−'}${Math.abs(weight)}`)
    .join(' ')
}

function main(): void {
  const data = loadData()
  for (const dim of data.dimensions) DIM_ZH[dim.id] = dim.zh
  mkdirSync(OUT, { recursive: true })

  // ---------- 神格清单 ----------
  const exposureMap = exposure(data)
  const deities = [...data.deities].sort((a, b) => (exposureMap.get(b.id) ?? 0) - (exposureMap.get(a.id) ?? 0))
  const lines: string[] = [
    '# 神格文案审查清单',
    '',
    `共 ${deities.length} 个神格，按**曝光度**排序（该神格出现在一份报告任一角色里的概率，600 个合成用户）。`,
    '在下面任意一行后面写 ❌（不对/太空）或 ⚠️（凑合），也可以只写编号 + 一句理由。',
    '',
    '检查点：① 说得像不像一个具体的人，而不是形容词堆叠；② 有没有代价/自我欺骗；',
    '③ 同类神格之间是否真的有区别；④ 有没有哪句换到别的神格也成立。',
    '',
    '---',
    '',
  ]

  deities.forEach((deity, index) => {
    const share = ((exposureMap.get(deity.id) ?? 0) * 100).toFixed(1)
    lines.push(`## ${index + 1}. ${deity.name.zh}（${deity.id}）· 曝光 ${share}% · ${deity.category === 'deity' ? '神格' : '神话原型'}`)
    lines.push(`**${deity.archetype.core}** — ${deity.archetype.theme}`)
    lines.push('')
    lines.push(`- 核心欲望：${deity.psychology.core_drive}`)
    lines.push(`- 核心恐惧：${deity.psychology.core_fear}`)
    lines.push(`- 世界观：${deity.psychology.worldview}`)
    lines.push(`- 权力方式：${deity.psychology.power_pattern}`)
    lines.push(`- 关系模式：${deity.psychology.relationship_pattern}`)
    lines.push(`- 冲突模式：${deity.psychology.conflict_pattern}`)
    lines.push(`- 失败模式：${deity.psychology.failure_pattern}`)
    lines.push('')
    lines.push(`- 未觉醒：${deity.states.dormant}`)
    lines.push(`- 觉醒：${deity.states.awakened}`)
    lines.push(`- 过度：${deity.states.overawakened}`)
    lines.push(`- 堕化：${deity.states.fallen}`)
    lines.push('')
    lines.push(`- 阴影触发：${deity.shadow.trigger}`)
    lines.push(`- 阴影防御：${deity.shadow.defense}`)
    lines.push(`- 阴影危险：${deity.shadow.danger}`)
    lines.push('')
    lines.push(
      `- signature：${Object.entries(deity.signature_dimensions).map(([id, level]) => `${DIM_ZH[id]}:${level}`).join(' ')}` +
        ` · anti：${Object.entries(deity.anti_dimensions).map(([id, level]) => `${DIM_ZH[id]}:${level}`).join(' ')}`,
    )
    lines.push(`- 可用称号词：${deity.titles.prefixes.map((p) => `${p}…`).join(' / ')} + ${deity.titles.nouns.join(' / ')}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  })
  writeFileSync(join(OUT, 'deities.md'), `${lines.join('\n')}\n`)

  // ---------- 题目清单 ----------
  const questionLines: string[] = [
    '# 题目与选项审查清单',
    '',
    `${data.questions.length} 道题、${data.questions.length * 4} 个选项。括号里是该选项的维度权重，用来核对「这个说法真的对应这些维度吗」。`,
    '检查点：① 是否描述了一个真实处境（不是「你喜欢自由还是秩序」）；② 四个选项是否都站得住、没有好人答案；',
    '③ 权重是否配得上这句话（例如说「我怕得罪人」，就不该给权威 +0.7）。',
    '',
    '---',
    '',
  ]
  const acts = data.metadata.acts
  for (const act of acts) {
    const inAct = data.questions.filter((q) => q.act === act.id)
    if (inAct.length === 0) continue
    questionLines.push(`## ${act.numeral} ${act.zh}（${inAct.length} 题）`, '')
    for (const question of inAct) {
      const profile = question.profile === 'overall' ? '' : question.profile === 'shadow' ? ' · 深渊' : ' · 神性'
      questionLines.push(`### ${question.id}${profile}`)
      questionLines.push(`${question.text}`)
      questionLines.push('')
      for (const option of question.options) {
        questionLines.push(`- ${option.id}. ${option.text}　（${weightHint(option.weights)}）`)
      }
      questionLines.push('')
    }
    questionLines.push('---', '')
  }
  writeFileSync(join(OUT, 'questions.md'), `${questionLines.join('\n')}\n`)

  console.log(`已写出 ${join(OUT, 'deities.md')}（${deities.length} 个神格）与 ${join(OUT, 'questions.md')}（${data.questions.length} 道题）`)
  console.log(`曝光度最高：${deities.slice(0, 5).map((d) => `${d.name.zh} ${((exposureMap.get(d.id) ?? 0) * 100).toFixed(0)}%`).join(' · ')}`)
}

main()
