/**
 * `npm run analyze-answers` — calibration channel.
 *
 *   npm run analyze-answers -- samples/            # real exported answer files
 *   npm run analyze-answers -- --synthesize 12     # human-style synthetic respondents
 *
 * Synthetic respondents are not random: each one is a short human description
 * plus a mood-consistent dimension vector, answered with realistic noise,
 * careless taps and a mild pull away from extremes. They exist to check what
 * human inconsistency does to match accuracy — not to prove the algorithm works.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import { buildReport } from '../src/engine/report-builder.ts'
import { parseExport } from '../src/answer-io.ts'
import type { Answer, PantheonData, PantheonResult, Vector } from '../src/schema/types.ts'

interface Respondent {
  id: string
  note: string
  expected?: string
  answers: Answer[]
  result: PantheonResult
}

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Box–Muller; the shape of the noise matters more than its source. */
function gauss(random: () => number): number {
  const u = Math.max(random(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

interface Persona {
  id: string
  note: string
  from: string
  /** how far this person drifts from the archetype they resemble */
  drift: number
  /** 0..1, how often they tap something without thinking */
  careless: number
}

const PERSONAS: Persona[] = [
  { id: 'ops-lead', note: '运维负责人：流程先行，出事时更紧地抓控制权', from: 'athena', drift: 0.28, careless: 0.04 },
  { id: 'founder', note: '创业者：改世界大于守规则，先干再改', from: 'prometheus', drift: 0.24, careless: 0.06 },
  { id: 'nurse', note: '护士：别人难受时她会先接住，很少反击', from: 'guanyin', drift: 0.3, careless: 0.05 },
  { id: 'researcher', note: '研究者：世界要被记录和命名，讨厌说不清的事', from: 'thoth', drift: 0.22, careless: 0.03 },
  { id: 'sales', note: '销售：喜欢人、喜欢流动、不太承诺长期的事', from: 'inari', drift: 0.32, careless: 0.08 },
  { id: 'artist', note: '创作者：夜里有劲，白天躺平，讨厌被安排', from: 'dionysus', drift: 0.26, careless: 0.09 },
  { id: 'judge', note: '法官式的人：标准比关系重要，一视同仁', from: 'maat', drift: 0.2, careless: 0.02 },
  { id: 'veteran', note: '退役老兵：直来直去，护住自己人', from: 'thor', drift: 0.27, careless: 0.05 },
  { id: 'hermit', note: '独居的译者：安静、稳定、不想改变任何人', from: 'hestia', drift: 0.25, careless: 0.04 },
  { id: 'strategist', note: '投资人：十年周期，信息比结论重要', from: 'odin', drift: 0.23, careless: 0.03 },
  { id: 'activist', note: '行动派：不服就顶着来，不惜代价', from: 'xingtian', drift: 0.3, careless: 0.07 },
  { id: 'pleaser', note: '老好人：谁都不想得罪，最怕起冲突', from: 'baldr', drift: 0.34, careless: 0.06 },
]

/** One person, one mood, one answer sheet. */
function answersFor(data: PantheonData, persona: Persona, noise: number, random: () => number): Answer[] {
  const source = data.deities.find((d) => d.id === persona.from)!
  const latent: Vector = {}
  for (const [dim, value] of Object.entries(source.vector)) {
    latent[dim] = Math.max(-1, Math.min(1, value + gauss(random) * persona.drift))
  }
  return data.questions.map((question) => {
    if (random() < persona.careless) {
      return { questionId: question.id, optionId: question.options[Math.floor(random() * question.options.length)].id }
    }
    let best = question.options[0]
    let bestScore = -Infinity
    for (const option of question.options) {
      let score = 0
      for (const [dim, weight] of Object.entries(option.weights)) score += weight * (latent[dim] ?? 0)
      // most people avoid the most extreme option unless nothing else fits
      const intensity = Object.values(option.weights).reduce((sum, weight) => sum + Math.abs(weight), 0)
      score -= intensity * 0.06
      score += gauss(random) * noise
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    return { questionId: question.id, optionId: best.id }
  })
}

function respondent(data: PantheonData, persona: Persona, answers: Answer[], index = 0, count = 1): Respondent {
  return {
    id: `${persona.id}${count > PERSONAS.length ? `-${index + 1}` : ''}`,
    note: persona.note,
    expected: persona.from,
    answers,
    result: generatePantheonResult(answers, data),
  }
}

function synthesize(data: PantheonData, count: number, noise: number, seed = 20260929): Respondent[] {
  const random = rng(seed)
  return Array.from({ length: count }, (_, index) => PERSONAS[index % PERSONAS.length]).map((persona, index) =>
    respondent(data, persona, answersFor(data, persona, noise, random), index, count),
  )
}

/**
 * Reliability, not accuracy: the same person answering with a different set of
 * small inconsistencies should land on the same archetype most of the time.
 */
function stability(data: PantheonData, rounds: number, noise: number) {
  return PERSONAS.map((persona, index) => {
    const picks: string[] = []
    const ranks: number[] = []
    for (let round = 0; round < rounds; round++) {
      const random = rng(7000 + index * 131 + round * 17)
      const result = generatePantheonResult(answersFor(data, persona, noise, random), data)
      const ranked = Object.entries(result.scores).sort((a, b) => b[1] - a[1]).map(([id]) => id)
      picks.push(result.primary.deityId)
      ranks.push(ranked.indexOf(persona.from) + 1)
    }
    const counts = new Map<string, number>()
    for (const pick of picks) counts.set(pick, (counts.get(pick) ?? 0) + 1)
    const modal = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      id: persona.id,
      note: persona.note,
      expected: persona.from,
      rounds,
      agreement: modal[1] / rounds,
      modal: modal[0],
      distinct: counts.size,
      hitRate: ranks.filter((rank) => rank === 1).length / rounds,
      adjacentRate: ranks.filter((rank) => rank <= 3).length / rounds,
    }
  })
}

function fromFiles(paths: string[], data: PantheonData): { respondents: Respondent[]; errors: string[] } {
  const files = paths.flatMap((path) => (statSync(path).isDirectory() ? readdirSync(path).filter((f) => f.endsWith('.json')).map((f) => join(path, f)) : [path]))
  const respondents: Respondent[] = []
  const errors: string[] = []
  for (const file of files) {
    const parsed = parseExport(readFileSync(file, 'utf8'), data)
    if ('error' in parsed) {
      errors.push(`${file}: ${parsed.error}`)
      continue
    }
    respondents.push({
      id: file.split('/').pop()!,
      note: '真实导出文件',
      answers: parsed.answers,
      result: generatePantheonResult(parsed.answers, data),
    })
  }
  return { respondents, errors }
}

function tally(values: string[]): { id: string; share: number }[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].map(([id, count]) => ({ id, share: count / (values.length || 1) })).sort((a, b) => b.share - a.share)
}

function main(): void {
  const args = process.argv.slice(2)
  const data = loadData()
  const synthesizeAt = args.indexOf('--synthesize')
  const noiseAt = args.indexOf('--noise')
  const noise = noiseAt >= 0 ? Number(args[noiseAt + 1]) : 0.45
  const repeatAt = args.indexOf('--repeat')
  const rounds = repeatAt >= 0 ? Number(args[repeatAt + 1]) : 6
  let respondents: Respondent[] = []
  let errors: string[] = []

  if (synthesizeAt >= 0) {
    respondents = synthesize(data, Number(args[synthesizeAt + 1] ?? PERSONAS.length), noise)
  } else if (args.length > 0) {
    const loaded = fromFiles(args, data)
    respondents = loaded.respondents
    errors = loaded.errors
  } else {
    console.log('用法：npm run analyze-answers -- <目录或文件…> | --synthesize <数量>')
    return
  }

  for (const error of errors) console.error(`ERROR ${error}`)

  console.log(`\n${respondents.length} 份答案 · 神格库 ${data.deities.length} · 题数 ${data.questions.length}\n`)
  console.log('逐一结果')
  let top1 = 0
  let top3 = 0
  for (const respondent of respondents) {
    const ranked = Object.entries(respondent.result.scores).sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const rank = respondent.expected ? ranked.indexOf(respondent.expected) + 1 : 0
    if (respondent.expected) {
      if (rank === 1) top1 += 1
      if (rank > 0 && rank <= 3) top3 += 1
    }
    const sections = buildReport(respondent.result, data)
    console.log(
      `  ${respondent.id.padEnd(18)} ${respondent.result.primary.deityId.padEnd(16)}` +
        ` | 谓 ${respondent.result.title}` +
        ` | ${respondent.result.awakening.state}` +
        (respondent.expected ? ` | 预期 ${respondent.expected}（第 ${rank || '—'} 位）` : '') +
        ` | 段落 ${sections.length}`,
    )
    console.log(`     ${respondent.note}`)
    console.log(
      `     谱系：主 ${respondent.result.primary.deityId} / 副 ${respondent.result.secondary.deityId}` +
        ` / 阴 ${respondent.result.shadow.deityId} / 隐 ${respondent.result.hidden.deityId}（gap ${respondent.result.hidden.gap.toFixed(2)}）`,
    )
  }

  const expected = respondents.filter((r) => r.expected)
  if (expected.length > 0) {
    console.log(`\n预期命中：首位 ${top1}/${expected.length} · 前三 ${top3}/${expected.length}`)
  }

  const printBlock = (label: string, rows: { id: string; share: number }[]) => {
    console.log(`\n${label}`)
    for (const row of rows.slice(0, 8)) console.log(`  ${(row.share * 100).toFixed(1).padStart(5)}%  ${row.id}`)
  }
  printBlock('主神格分布', tally(respondents.map((r) => r.result.primary.deityId)))
  printBlock('阴影神格分布', tally(respondents.map((r) => r.result.shadow.deityId)))
  printBlock('隐藏神格分布', tally(respondents.map((r) => r.result.hidden.deityId)))
  printBlock('觉醒分布', tally(respondents.map((r) => r.result.awakening.state)))

  const missing = data.deities.map((d) => d.id).filter((id) => !respondents.some((r) => r.result.primary.deityId === id))
  console.log(`\n样本中从未出现的候选（${missing.length}）：${missing.slice(0, 20).join(', ') || '无'}`)
  console.log(`不同的称号数量：${new Set(respondents.map((r) => r.result.title)).size}/${respondents.length}`)

  if (synthesizeAt >= 0) {
    console.log(`\n稳定性（同一人物、不同噪声，每人 ${rounds} 轮，噪声 σ=${noise}）`)
    const rows = stability(data, rounds, noise)
    const meanAgreement = rows.reduce((sum, r) => sum + r.agreement, 0) / rows.length
    const meanHit = rows.reduce((sum, r) => sum + r.hitRate, 0) / rows.length
    const meanAdjacent = rows.reduce((sum, r) => sum + r.adjacentRate, 0) / rows.length
    for (const row of rows) {
      console.log(
        `  ${row.id.padEnd(12)} 一致率 ${(row.agreement * 100).toFixed(0).padStart(3)}%` +
          ` | 出现 ${row.distinct} 种主神格 | 预期命中 ${(row.hitRate * 100).toFixed(0)}% / 前三 ${(row.adjacentRate * 100).toFixed(0)}%` +
          ` | 最常见 ${row.modal}`,
      )
    }
    console.log(
      `  平均：一致率 ${(meanAgreement * 100).toFixed(0)}% · 首位命中 ${(meanHit * 100).toFixed(0)}% · 前三命中 ${(meanAdjacent * 100).toFixed(0)}%`,
    )
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
