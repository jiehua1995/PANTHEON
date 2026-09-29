import type { Vector } from '../schema/types.ts'

export function cosine(a: Vector, b: Vector): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (const id of Object.keys(a)) {
    if (!(id in b)) continue
    dot += a[id] * b[id]
    na += a[id] ** 2
    nb += b[id] ** 2
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb)
}

/** 1 = identical, 0 = opposite. RMS distance over shared dimensions. */
export function euclideanSimilarity(a: Vector, b: Vector): number {
  const ids = Object.keys(a).filter((id) => id in b)
  if (ids.length === 0) return 0
  const ms = ids.reduce((sum, id) => sum + (a[id] - b[id]) ** 2, 0) / ids.length
  return 1 - Math.sqrt(ms) / 2
}
