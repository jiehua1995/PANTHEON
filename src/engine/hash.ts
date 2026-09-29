/** Deterministic 32-bit FNV-1a. Same input ⇒ same result, forever, in any JS runtime. */
export function fnv1a(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function seedOf(parts: readonly (string | number)[]): number {
  return fnv1a(parts.join('|'))
}

/** Deterministic pick. `salt` separates independent choices from one seed. */
export function pick<T>(list: readonly T[], seed: number, salt: number): T {
  return list[(Math.imul(seed ^ Math.imul(salt, 0x9e3779b1), 0x85ebca6b) >>> 0) % list.length]
}

/** Like pick, but guarantees two independent picks don't collide. */
export function pickDistinct<T>(list: readonly T[], seed: number, saltA: number, saltB: number): [T, T] {
  const a = pick(list, seed, saltA)
  if (list.length < 2) return [a, a]
  let b = pick(list, seed, saltB)
  if (b === a) b = list[(list.indexOf(a) + 1) % list.length]
  return [a, b]
}
