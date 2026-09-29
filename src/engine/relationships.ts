import type { Deity, DeityId, PantheonData, RelationshipType } from '../schema/types.ts'
import { cosine } from './similarity.ts'
import { fnv1a } from './hash.ts'

const deityCache = new WeakMap<PantheonData, Map<DeityId, Deity>>()

function index(data: PantheonData): Map<DeityId, Deity> {
  let map = deityCache.get(data)
  if (!map) {
    map = new Map(data.deities.map((d) => [d.id, d]))
    deityCache.set(data, map)
  }
  return map
}

/**
 * Curated edges in data/relationships.json win; every other pair is derived from
 * vector geometry so the graph stays complete without hand-writing 2,700 pairs.
 */
export function relationType(data: PantheonData, a: DeityId, b: DeityId): RelationshipType | undefined {
  const explicit = data.relationships[a]?.[b]?.type ?? data.relationships[b]?.[a]?.type
  if (explicit) return explicit
  const left = index(data).get(a)
  const right = index(data).get(b)
  if (!left || !right) return undefined

  const { mirror, affinity, complement, tension, conflict } = data.scoring.relations
  const score = cosine(left.vector, right.vector)
  if (score >= mirror) return 'mirror'
  if (score >= affinity) return 'affinity'
  if (score >= complement) return 'complement'
  if (score <= conflict) return 'conflict'
  if (score <= tension) return 'tension'
  return undefined
}

export function relationshipNote(data: PantheonData, a: DeityId, b: DeityId): string | undefined {
  return data.relationships[a]?.[b]?.note ?? data.relationships[b]?.[a]?.note
}

const FALLBACK: Record<RelationshipType, string> = {
  affinity: '两者看向同一个方向，只是手段和语速不同。',
  complement: '一方点燃的东西，另一方负责让它站得住。',
  tension: '两者都想改变同一件事，但对“谁说了算”有根本分歧。',
  mirror: '两者是同一种力量的正反面：一个活在光里，一个活在它的代价里。',
  conflict: '两者的答案无法同时成立，你只能在特定时刻选一边。',
  suppression: '一方的存在方式，长期压住另一方的表达。',
}

const LABEL: Record<RelationshipType, string> = {
  affinity: '亲和 · 同一个方向',
  complement: '互补 · 他补上你缺的那一半',
  tension: '张力 · 同一目标，不同答案',
  mirror: '镜像 · 同一种力量的正反面',
  conflict: '冲突 · 两者的答案无法同时成立',
  suppression: '压制 · 一方长期压住另一方',
}

export const relationLabel = (type: RelationshipType | undefined): string =>
  type ? LABEL[type] : '未定义 · 两者按各自的逻辑并存'

/** Hand-written copy for the pairs people actually get — keyed by sorted ids. */
export function pairNote(
  data: PantheonData,
  a: DeityId,
  b: DeityId,
): { secondary: string; conflict: string } | undefined {
  return data.pairInterpretations?.[[a, b].sort().join('|')]
}

export function relationText(data: PantheonData, a: DeityId, b: DeityId): string {
  const note = relationshipNote(data, a, b)
  if (note) return note
  const left = index(data).get(a)
  const right = index(data).get(b)
  if (!left || !right) return FALLBACK.complement
  return synthesizedRelation(data, left, right)
}

/**
 * For the ~97% of pairs nobody hand-wrote: say something true about *this* pair by
 * reading their two vectors, instead of reusing one generic line for everyone.
 */
function synthesizedRelation(data: PantheonData, left: Deity, right: Deity): string {
  const pole = (dim: PantheonData['dimensions'][number], positive: boolean) =>
    (positive ? dim.positive.zh : dim.negative.zh).split(' / ')[0]

  const seed = fnv1a(`${left.id}|${right.id}`)
  const pick = <T,>(list: T[], salt: number): T =>
    list[((seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0) % list.length]

  const shared = data.dimensions
    .map((dim) => ({ dim, value: Math.min(left.vector[dim.id] ?? 0, right.vector[dim.id] ?? 0) }))
    .filter((entry) => entry.value >= 0.4)
    .sort((a, b) => b.value - a.value)

  const candidates = data.dimensions
    .map((dim) => ({
      dim,
      a: left.vector[dim.id] ?? 0,
      b: right.vector[dim.id] ?? 0,
      separation: Math.abs((left.vector[dim.id] ?? 0) - (right.vector[dim.id] ?? 0)),
    }))
    .sort((x, y) => y.separation - x.separation)
  // a "difference" only reads as a split when the two sit on opposite sides
  const opposed = candidates.filter(
    (candidate) => candidate.a * candidate.b < 0 && Math.abs(candidate.a) >= 0.2 && Math.abs(candidate.b) >= 0.2,
  )

  // 「冲突」在库里差异最大，老是被选中；从最强的三个候选里按 pair 决定，避免整套文案同一句
  const shortlist = (opposed.length > 0 ? opposed : candidates).slice(0, 3)
  const contrast = pick(shortlist, 3)
  const sharedList = shared.slice(0, 3).map((entry) => `「${entry.dim.zh}」`).join('和')

  if (opposed.length === 0 || !contrast || contrast.separation < 0.4) {
    if (contrast && contrast.separation >= 0.4) {
      const deeper = Math.abs(contrast.a) > Math.abs(contrast.b) ? left.name.zh : right.name.zh
      const frame = pick(['力度', '深浅', '幅度'] as const, 5)
      return shared.length > 0
        ? `${sharedList}上他们是同路人；差别在${frame}——同样的「${contrast.dim.zh}」方向上，${deeper}走得更远。`
        : `这不是互补，是同一个方向的两种${frame}：在「${contrast.dim.zh}」上，${deeper}走得更远。`
    }
    return shared.length > 0
      ? `${sharedList}上几乎完全重合，在你身上更像同一股力量的两个名字。`
      : `${left.name.zh} 和 ${right.name.zh} 没有共同的强项维度，它们并存靠的是分工，而不是共鸣。`
  }

  const leftPole = `「${pole(contrast.dim, contrast.a > 0)}」`
  const rightPole = `「${pole(contrast.dim, contrast.b > 0)}」`
  const frames = shared.length > 0
    ? [
        `两者都站在${sharedList}这一侧；把他们分开的是「${contrast.dim.zh}」——${left.name.zh}偏${leftPole}，${right.name.zh}偏${rightPole}。`,
        `共同点是${sharedList}同高，真正的分岔在「${contrast.dim.zh}」：${left.name.zh}往${leftPole}走，${right.name.zh}往${rightPole}走。`,
        `同样重视${sharedList}，但在「${contrast.dim.zh}」上，${left.name.zh}选${leftPole}，${right.name.zh}选${rightPole}。`,
        `在${sharedList}上是同路人，一碰到「${contrast.dim.zh}」就分开：一个偏${leftPole}，一个偏${rightPole}。`,
      ]
    : [
        `共同的高维不多，真正决定他们关系的是「${contrast.dim.zh}」：${left.name.zh}偏${leftPole}，${right.name.zh}偏${rightPole}。`,
        `这两个原型几乎找不到共同的高维，唯一清晰的分界在「${contrast.dim.zh}」——${left.name.zh}偏${leftPole}，${right.name.zh}偏${rightPole}。`,
        `他们不是同路人。把他们放在一起，唯一的接口在「${contrast.dim.zh}」：一个偏${leftPole}，一个偏${rightPole}。`,
      ]
  return pick(frames, 7)
}
