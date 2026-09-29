/**
 * `npm run audit-content` — does the report actually differ between people?
 *
 * A sentence that shows up in most users' reports cannot be describing anyone,
 * so we measure document frequency of every report paragraph over a synthetic
 * population and report the offenders. This turns "文案太差" into a number.
 */
import { fileURLToPath } from 'node:url'
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import { buildReport } from '../src/engine/report-builder.ts'
import { relationText } from '../src/engine/relationships.ts'
import type { Answer, PantheonData, Vector } from '../src/schema/types.ts'

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function answersFor(data: PantheonData, latent: Vector, random: () => number): Answer[] {
  return data.questions.map((question) => {
    let best = question.options[0]
    let bestScore = -Infinity
    for (const option of question.options) {
      let score = 0
      for (const [dim, weight] of Object.entries(option.weights)) score += weight * (latent[dim] ?? 0)
      score += (random() - 0.5) * 0.8
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    return { questionId: question.id, optionId: best.id }
  })
}

function latent(data: PantheonData, random: () => number): Vector {
  const vector: Vector = {}
  for (const dim of data.dimensions) {
    vector[dim.id] = Math.max(-1, Math.min(1, (random() + random() + random() - 1.5) / 1.0))
  }
  return vector
}

function main(): void {
  const users = Number(process.env.AUDIT_USERS ?? 400)
  const data = loadData()
  const random = rng(20260930)
  const frequency = new Map<string, number>()
  let paragraphs = 0
  const perUserUnique: number[] = []
  const titles = new Set<string>()

  for (let i = 0; i < users; i++) {
    const answers = answersFor(data, latent(data, random), random)
    const result = generatePantheonResult(answers, data)
    titles.add(result.title)
    const seen = new Set<string>()
    for (const section of buildReport(result, data)) {
      for (const paragraph of section.body) {
        const text = paragraph.trim()
        if (!text) continue
        paragraphs += 1
        seen.add(text)
      }
    }
    perUserUnique.push(seen.size)
    for (const text of seen) frequency.set(text, (frequency.get(text) ?? 0) + 1)
  }

  const rows = [...frequency.entries()].map(([text, count]) => ({ text, share: count / users })).sort((a, b) => b.share - a.share)
  const bucket = (from: number, to: number) => rows.filter((r) => r.share > from && r.share <= to).length

  console.log(`\n${users} 份报告 · 段落总数 ${paragraphs} · 不同段落 ${rows.length} · 平均每份 ${(paragraphs / users).toFixed(1)} 段`)
  console.log(`每人独有段落（只出现在他这一份里）：平均 ${(perUserUnique.reduce((a, b) => a + b, 0) / perUserUnique.length).toFixed(1)} 段`)
  console.log(`不同称号：${titles.size}/${users}`)

  console.log('\n通用度分布（有多少段落被这么多比例的用户共享）')
  console.log(`  出现于 >50% 的报告：${bucket(0.5, 1)} 段`)
  console.log(`  30–50%：${bucket(0.3, 0.5)} 段`)
  console.log(`  10–30%：${bucket(0.1, 0.3)} 段`)
  console.log(`  5–10%：${bucket(0.05, 0.1)} 段`)
  console.log(`  <5%（有区分度）：${bucket(0, 0.05)} 段`)

  const generic = rows.filter((r) => r.share > 0.5)
  if (generic.length > 0) {
    console.log('\n出现在一半以上报告里的段落（Barnum 风险）')
    for (const row of generic.slice(0, 15)) console.log(`  ${(row.share * 100).toFixed(0).padStart(3)}%  ${row.text.slice(0, 78)}`)
  }

  // 生成层同样会模板化：抽查随机配对的「关系句」，看开头是不是又是同一句
  const pairs = 400
  const openings = new Map<string, number>()
  for (let i = 0; i < pairs; i++) {
    const a = data.deities[Math.floor(random() * data.deities.length)]
    const b = data.deities[Math.floor(random() * data.deities.length)]
    if (a.id === b.id) continue
    const text = relationText(data, a.id, b.id)
    const head = text.replace(/她/g, '他').slice(0, 6)
    openings.set(head, (openings.get(head) ?? 0) + 1)
  }
  const [topOpening, count] = [...openings.entries()].sort((a, b) => b[1] - a[1])[0]
  console.log(
    `\n关系句（${pairs} 组随机配对）：最高频开头「${topOpening}…」占 ${((count / pairs) * 100).toFixed(1)}%` +
      (count / pairs > 0.4 ? ' —— 超过 40%，生成层又模板化了' : ''),
  )

  // 用户不该看到算法内部语言：分数、相似度、画像、权重、hash
  const jargon = ['分差', '相似度', '匹配强度', '画像', '权重', 'hash', 'margin', 'primary', 'second']
  const leaks: string[] = []
  const decimal = /\d+\.\d{2,}/
  for (const [text, share] of frequency) {
    if (decimal.test(text) || jargon.some((word) => text.includes(word))) {
      leaks.push(`出现率 ${(share * 100).toFixed(0)}%：${text.slice(0, 60)}`)
    }
  }
  console.log(
    `\n用户可见段落里的算法语言：${leaks.length} 处` +
      (leaks.length > 0 ? '（这些是给开发者看的，不该出现在报告里）' : ''),
  )
  for (const leak of leaks.slice(0, 8)) console.log(`  ${leak}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
