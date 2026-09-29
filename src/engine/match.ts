import type { Deity, DimensionId, PantheonData, ProfileVectors, SignatureLevel, Vector } from '../schema/types.ts'
import { cosine, euclideanSimilarity } from './similarity.ts'

/** 引擎内部的候选评分：比 DeityMatch 多出三套画像的相似度，角色标定在生成结果时再做。 */
export interface ScoredDeity {
  deityId: string
  deity: Deity
  score: number
  similarity: number
  signatureHit: number
  contradiction: number
  consistency: number
  cosOverall: number
  cosShadow: number
  cosHidden: number
}

/**
 * How much `value` satisfies the level on this dimension. With `softness` > 0 the
 * transition is a ramp rather than a step, so a small change in the answers moves
 * the score a little instead of flipping it — retakes stay in the same archetype.
 */
function hits(
  level: SignatureLevel,
  value: number,
  thresholds: PantheonData['scoring']['signatureThresholds'],
  softness: number,
): number {
  const threshold = thresholds[level]
  if (threshold === 0) return 0.5 // "mid": no discriminating power
  const ramp = (x: number) => Math.max(0, Math.min(1, x))
  if (softness <= 0) return threshold > 0 ? (value >= threshold ? 1 : 0) : value <= threshold ? 1 : 0
  return threshold > 0
    ? ramp((value - (threshold - softness)) / (2 * softness))
    : ramp((threshold + softness - value) / (2 * softness))
}

const mean = (list: number[], fallback = 0) =>
  list.length === 0 ? fallback : list.reduce((a, b) => a + b, 0) / list.length

export function scoreDeities(vectors: ProfileVectors, data: PantheonData): ScoredDeity[] {
  const centrality = centralityOf(data)
  return data.deities.map((deity) => scoreOne(deity, vectors, data, centrality)).sort((a, b) => b.score - a.score)
}

/** Single-deity scoring. Shared with the data gate so both use one definition. */
export function scoreOne(
  deity: Deity,
  vectors: ProfileVectors,
  data: PantheonData,
  centrality: Map<string, number> = centralityOf(data),
): ScoredDeity {
  const weights = data.scoring.primary
  const softness = data.scoring.signatureSoftness ?? 0
  const cosOverall = cosine(vectors.overall, deity.vector)
  const cosShadow = cosine(vectors.shadow, deity.vector)
  const cosHidden = cosine(vectors.hidden, deity.vector)

  const signatureHit = mean(
    Object.entries(deity.signature_dimensions).map(([id, level]) =>
      hits(level as SignatureLevel, vectors.overall[id] ?? 0, data.scoring.signatureThresholds, softness),
    ),
  )
  const contradiction = mean(
    Object.entries(deity.anti_dimensions).map(([id, level]) =>
      hits(level as SignatureLevel, vectors.overall[id] ?? 0, data.scoring.signatureThresholds, softness),
    ),
  )
  const consistency = 1 - mean([Math.abs(cosOverall - cosShadow), Math.abs(cosOverall - cosHidden)]) / 2

  const score =
    weights.cosine * cosOverall +
    weights.euclidean * euclideanSimilarity(vectors.overall, deity.vector) +
    weights.signature * signatureHit +
    weights.consistency * consistency -
    weights.contradiction * contradiction -
    weights.specificity * (centrality.get(deity.id) ?? 0)

  return {
    deityId: deity.id,
    deity,
    score,
    similarity: cosOverall,
    signatureHit,
    contradiction,
    consistency,
    cosOverall,
    cosShadow,
    cosHidden,
  }
}

/**
 * 0 = the most distinctive archetype in the fleet, 1 = the one sitting closest to
 * the fleet average. Derived from the data, so it stays honest as the library grows.
 */
export function centralityOf(data: PantheonData): Map<string, number> {
  const mean: Vector = {}
  for (const deity of data.deities) {
    for (const [id, value] of Object.entries(deity.vector)) mean[id] = (mean[id] ?? 0) + value / data.deities.length
  }
  const raw = data.deities.map((deity) => ({ id: deity.id, value: cosine(mean, deity.vector) }))
  const min = Math.min(...raw.map((r) => r.value))
  const max = Math.max(...raw.map((r) => r.value))
  const span = max - min || 1
  return new Map(raw.map((r) => [r.id, (r.value - min) / span]))
}

export function topDimensions(vector: Vector, count: number): DimensionId[] {
  return Object.entries(vector)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, count)
    .map(([id]) => id)
}
