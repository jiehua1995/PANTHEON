import type { Answer, DimensionId, PantheonData, ProfileId, ProfileVectors, Vector } from '../schema/types.ts'

export interface VectorBuild {
  vectors: ProfileVectors
  raw: ProfileVectors
  /** per-dimension max attainable |weight| sum, used to keep tanh compression data-adaptive */
  denominators: Record<ProfileId, Record<DimensionId, number>>
}


/** Per-question maximum |weight| per dimension — the denominator behind tanh compression. */
export function denominatorsOf(
  data: PantheonData,
  profile: ProfileId,
  trimFraction = data.scoring.trimFraction ?? 0,
): Record<DimensionId, number> {
  const dims = data.dimensions.map((d) => d.id)
  const perDimension = Object.fromEntries(dims.map((id) => [id, [] as number[]])) as Record<DimensionId, number[]>
  for (const question of data.questions) {
    if (question.profile !== profile) continue
    for (const id of dims) {
      perDimension[id].push(Math.max(...question.options.map((o) => Math.abs(o.weights[id] ?? 0))))
    }
  }
  return Object.fromEntries(
    dims.map((id) => [id, trimmedSum(perDimension[id], trimFraction)]),
  ) as Record<DimensionId, number>
}

/**
 * Sum after dropping the most extreme `fraction` from both ends.
 * A handful of answers that a respondent would flip on a different day should not
 * decide which god they get, so each dimension is measured robustly.
 */
export function trimmedSum(values: number[], fraction: number): number {
  if (fraction <= 0 || values.length < 5) return values.reduce((a, b) => a + b, 0)
  const sorted = [...values].sort((a, b) => a - b)
  const drop = Math.floor(sorted.length * fraction)
  return sorted.slice(drop, sorted.length - drop).reduce((a, b) => a + b, 0)
}

/** raw sums → the −1..1 vector. Shared by the engine and the data gate's search. */
export function compress(raw: Vector, denominators: Record<DimensionId, number>, scaleDivisor: number): Vector {
  const out: Vector = {}
  for (const [id, value] of Object.entries(raw)) {
    const denom = denominators[id] ?? 0
    out[id] = denom === 0 ? 0 : clamp(Math.tanh(value / (denom / scaleDivisor)))
  }
  return out
}

export function buildVectors(answers: Answer[], data: PantheonData): VectorBuild {
  const dims = data.dimensions.map((d) => d.id)

  const contributions = {
    overall: Object.fromEntries(dims.map((id) => [id, [] as number[]])),
    shadow: Object.fromEntries(dims.map((id) => [id, [] as number[]])),
    hidden: Object.fromEntries(dims.map((id) => [id, [] as number[]])),
  } as Record<ProfileId, Record<DimensionId, number[]>>
  const denominators = {
    overall: denominatorsOf(data, 'overall'),
    shadow: denominatorsOf(data, 'shadow'),
    hidden: denominatorsOf(data, 'hidden'),
  } as Record<ProfileId, Record<DimensionId, number>>

  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a.optionId]))

  // Every question contributes at most one measurement per dimension, so a
  // single flipped answer can be trimmed instead of shifting the whole vector.
  for (const question of data.questions) {
    const optionId = answersByQuestion.get(question.id)
    const option = question.options.find((o) => o.id === optionId) ?? { weights: {} as Vector }
    for (const id of dims) contributions[question.profile][id].push(option.weights[id] ?? 0)
  }

  const trimFraction = data.scoring.trimFraction ?? 0
  const raw: ProfileVectors = {
    overall: Object.fromEntries(dims.map((id) => [id, trimmedSum(contributions.overall[id], trimFraction)])),
    shadow: Object.fromEntries(dims.map((id) => [id, trimmedSum(contributions.shadow[id], trimFraction)])),
    hidden: Object.fromEntries(dims.map((id) => [id, trimmedSum(contributions.hidden[id], trimFraction)])),
  }
  const vectors: ProfileVectors = {
    overall: compress(raw.overall, denominators.overall, data.scoring.scaleDivisor),
    shadow: compress(raw.shadow, denominators.shadow, data.scoring.scaleDivisor),
    hidden: compress(raw.hidden, denominators.hidden, data.scoring.scaleDivisor),
  }

  return { vectors, raw, denominators }
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v))
