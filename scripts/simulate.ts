/**
 * `npm run simulate` — synthetic population check for distribution health.
 * Users have a latent personality vector; they pick the option that fits it best,
 * with noise plus a careless-answer rate. Pure randomness would understate
 * clustering, which is exactly the failure mode this gate exists to catch.
 */
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import type { Answer, PantheonData, Vector } from '../src/schema/types.ts'
import { fileURLToPath } from 'node:url'

interface Options {
  users: number
  noise: number
  careless: number
  seed: number
}

const DEFAULTS: Options = { users: 10_000, noise: 0.7, careless: 0.05, seed: 20260929 }

function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function latentVector(data: PantheonData, random: () => number): Vector {
  const vector: Vector = {}
  for (const dim of data.dimensions) {
    // gaussian-ish, then clipped: most people sit near the middle
    const value = (random() + random() + random() + random() - 2) / 0.95
    vector[dim.id] = Math.max(-1, Math.min(1, value))
  }
  return vector
}

function simulateAnswers(data: PantheonData, latent: Vector, options: Options, random: () => number): Answer[] {
  return data.questions.map((question) => {
    if (random() < options.careless) {
      return { questionId: question.id, optionId: question.options[Math.floor(random() * question.options.length)].id }
    }
    let best = question.options[0]
    let bestScore = -Infinity
    for (const option of question.options) {
      let score = 0
      for (const [id, weight] of Object.entries(option.weights)) score += weight * (latent[id] ?? 0)
      score += (random() - 0.5) * options.noise
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    return { questionId: question.id, optionId: best.id }
  })
}

function tally(counter: Map<string, number>): { id: string; share: number }[] {
  const total = [...counter.values()].reduce((a, b) => a + b, 0) || 1
  return [...counter.entries()]
    .map(([id, count]) => ({ id, share: count / total }))
    .sort((a, b) => b.share - a.share)
}

export function runSimulation(data: PantheonData, options: Options = DEFAULTS) {
  const random = rng(options.seed)
  const primary = new Map<string, number>()
  const secondary = new Map<string, number>()
  const shadow = new Map<string, number>()
  const hidden = new Map<string, number>()
  const pairs = new Map<string, number>()
  const titles = new Map<string, number>()
  const awakening = new Map<string, number>()

  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1)

  for (let i = 0; i < options.users; i++) {
    const answers = simulateAnswers(data, latentVector(data, random), options, random)
    const result = generatePantheonResult(answers, data)
    bump(primary, result.primary.deityId)
    bump(secondary, result.secondary.deityId)
    bump(shadow, result.shadow.deityId)
    bump(hidden, result.hidden.deityId)
    bump(pairs, [result.primary.deityId, result.secondary.deityId].sort().join(' × '))
    bump(titles, result.title)
    bump(awakening, result.awakening.state)
  }

  return { primary: tally(primary), secondary: tally(secondary), shadow: tally(shadow), hidden: tally(hidden), pairs: tally(pairs), titles: tally(titles), awakening: tally(awakening) }
}

function printBlock(label: string, rows: { id: string; share: number }[], limit = 12) {
  console.log(`\n${label}`)
  for (const row of rows.slice(0, limit)) {
    console.log(`  ${(row.share * 100).toFixed(2).padStart(6)}%  ${row.id}`)
  }
  if (rows.length > limit) console.log(`  … ${rows.length - limit} more`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = loadData()
  const options = { ...DEFAULTS, users: Number(process.env.SIM_USERS ?? DEFAULTS.users) }
  const report = runSimulation(data, options)
  console.log(`simulated ${options.users} users · ${data.deities.length} deities · ${data.questions.length} questions`)
  printBlock('Primary distribution', report.primary)
  printBlock('Secondary distribution', report.secondary, 8)
  printBlock('Shadow distribution', report.shadow, 8)
  printBlock('Hidden distribution', report.hidden, 8)
  printBlock('Pair distribution', report.pairs, 8)
  console.log('\nAwakening', report.awakening.map((r) => `${r.id} ${(r.share * 100).toFixed(0)}%`).join(' · '))
  console.log(`distinct titles: ${report.titles.length} for ${options.users} users`)

  const { maxPrimaryShare, minPrimaryShare } = data.scoring.simulation
  const covered = new Set(report.primary.map((r) => r.id))
  const missing = data.deities.filter((d) => !covered.has(d.id)).map((d) => d.id)
  const tooCommon = report.primary.filter((r) => r.share > maxPrimaryShare)
  const tooRare = report.primary.filter((r) => r.share < minPrimaryShare)
  console.log('\ngate check (debug thresholds, not hard rules)')
  console.log(`  never primary (${missing.length}): ${missing.slice(0, 20).join(', ') || 'none'}`)
  console.log(`  above ${(maxPrimaryShare * 100).toFixed(0)}%: ${tooCommon.map((r) => `${r.id} ${(r.share * 100).toFixed(1)}%`).join(', ') || 'none'}`)
  console.log(
    `  below ${(minPrimaryShare * 100).toFixed(1)}%: ` +
      (tooRare.map((r) => `${r.id} ${(r.share * 100).toFixed(2)}%`).join(', ') || 'none'),
  )
}
