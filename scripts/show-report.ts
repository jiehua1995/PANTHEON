/**
 * `npm run show-report` — read one full report exactly as a user would see it.
 *
 *   npm run show-report -- --deity prometheus      # a typical person of that archetype
 *   npm run show-report -- --answers my.json       # a real exported answer file
 *   npm run show-report -- --deity odin --noise 0.6
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import { formatReport } from '../src/engine/report-text.ts'
import { parseExport } from '../src/answer-io.ts'
import type { Answer, PantheonData, Vector } from '../src/schema/types.ts'

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function answersLike(data: PantheonData, deityId: string, noise: number, seed: number): Answer[] {
  const deity = data.deities.find((d) => d.id === deityId)
  if (!deity) throw new Error(`未知神格：${deityId}（可用：${data.deities.map((d) => d.id).join(', ')}）`)
  const random = rng(seed)
  const latent: Vector = Object.fromEntries(
    Object.entries(deity.vector).map(([dim, value]) => [dim, Math.max(-1, Math.min(1, value + (random() - 0.5) * noise))]),
  )
  return data.questions.map((question) => {
    let best = question.options[0]
    let bestScore = -Infinity
    for (const option of question.options) {
      let score = 0
      for (const [dim, weight] of Object.entries(option.weights)) score += weight * (latent[dim] ?? 0)
      score += (random() - 0.5) * 0.5
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    return { questionId: question.id, optionId: best.id }
  })
}

function main(): void {
  const args = process.argv.slice(2)
  const value = (flag: string) => {
    const index = args.indexOf(flag)
    return index >= 0 ? args[index + 1] : undefined
  }
  const data = loadData()
  const answersFile = value('--answers')
  const pantheonId = value('--pantheon')
  const group = pantheonId ? data.metadata.pantheons.find((p) => p.id === pantheonId) : null
  if (pantheonId && !group) {
    console.error(`未知神系：${pantheonId}（可选：${data.metadata.pantheons.map((p) => p.id).join(', ')}）`)
    process.exit(1)
  }
  const scope = group ? { id: group.id, zh: group.zh, members: group.members } : null
  let answers: Answer[]
  let label: string

  if (answersFile) {
    const parsed = parseExport(readFileSync(answersFile, 'utf8'), data)
    if ('error' in parsed) {
      console.error(parsed.error)
      process.exit(1)
    }
    answers = parsed.answers
    label = answersFile
  } else {
    const deityId = value('--deity') ?? data.deities[0].id
    answers = answersLike(data, deityId, Number(value('--noise') ?? 0.5), Number(value('--seed') ?? 7))
    label = `${deityId} 的典型答题（噪声 ${value('--noise') ?? 0.5}）`
  }

  const result = generatePantheonResult(answers, data, scope)
  console.log(`\n${formatReport(result, data, label)}\n`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
