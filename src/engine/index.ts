import type {
  Answer,
  ConflictAxis,
  Deity,
  DeityMatch,
  DimensionGap,
  PantheonData,
  PantheonResult,
  RelationshipType,
  Vector,
} from '../schema/types.ts'
import { buildVectors } from './vectors.ts'
import { scoreDeities, topDimensions, type ScoredDeity } from './match.ts'
import { relationText, relationType } from './relationships.ts'
import { generateTitle } from './title-generator.ts'
import { seedOf } from './hash.ts'

const RELATION_BONUS: Record<RelationshipType, number> = {
  complement: 1,
  affinity: 0.8,
  mirror: 0.6,
  tension: 0.35,
  conflict: 0.15,
  suppression: 0,
}
const UNRELATED_BONUS = 0.3

export interface ResultScope {
  id: string
  zh: string
  members: string[]
}

/**
 * `scope` 限定候选神系：用户先选「希腊 / 北欧 / 中国 …」，算法只在那个神系里找神格。
 * 实现上就是把 deity 列表换成一个子集，下游（评分、构成、内战、称号）全部不用改。
 */
export function generatePantheonResult(
  answers: Answer[],
  data: PantheonData,
  scope: ResultScope | null = null,
): PantheonResult {
  const scoped: PantheonData = scope
    ? { ...data, deities: data.deities.filter((deity) => scope.members.includes(deity.pantheon)) }
    : data
  const { scoring } = scoped
  const { vectors } = buildVectors(answers, scoped)
  const scored = scoreDeities(vectors, scoped)
  const primary = scored[0]

  const secondary = pickSecondary(primary, scored, vectors.overall, scoped)
  const shadow = pickShadow(primary, secondary, scored, scoped)
  const hidden = pickHidden(primary, secondary, shadow, scored, scoped)

  const compositionScore = (s: ScoredDeity) =>
    scoring.composition.base * s.cosOverall +
    scoring.composition.shadow * s.cosShadow +
    scoring.composition.hidden * s.cosHidden

  // 「构成」只回答「还有哪些原型离你近」；四位角色单独展示。
  // 早期把两套指标（角色选择标准 vs 混合分数）混进同一张图，会出现 0.9% 排在 20% 前面这种矛盾。
  const ranked = [...scored].sort((a, b) => compositionScore(b) - compositionScore(a))
  const kept = ranked.slice(0, scoring.composition.top)
  const shareWeight = (s: ScoredDeity) => Math.max(compositionScore(s), 0)
  const total = kept.reduce((sum, s) => sum + shareWeight(s), 0) || 1
  const composition = kept.map((s) => ({
    deityId: s.deityId,
    share: shareWeight(s) / total,
  }))

  const roleIds = new Set([primary.deityId, secondary.deityId, shadow.deityId, hidden.deityId])
  const trailing = ranked
    .filter((s) => !roleIds.has(s.deityId))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({ deityId: s.deityId, score: s.score }))

  const gaps = dimensionGaps(vectors.overall, primary.deity, data)
  const sortedByDelta = [...gaps].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const dominantDimensions = topDimensions(vectors.overall, 4)
  const title = generateTitle(
    {
      primary: primary.deity,
      secondary: secondary.deity,
      shadow: shadow.deity,
      hidden: hidden.deity,
      dominantDimensions,
      versions: data.metadata.versions,
    },
    data,
  )

  return {
    scope: scope ? { id: scope.id, zh: scope.zh } : null,
    versions: data.metadata.versions,
    hash: seedOf([
      JSON.stringify(answers),
      scope?.id ?? 'all',
      ...Object.values(data.metadata.versions),
    ]),
    vectors,
    primary: strip(primary, 'overall', primary.cosOverall),
    secondary: strip(secondary, 'overall', secondary.cosOverall),
    margin: primary.score - (scored[1]?.score ?? 0),
    closeCall: primary.score - (scored[1]?.score ?? 0) < scoring.closeMargin,
    shadow: strip(shadow, 'shadow', shadow.cosShadow),
    hidden: { ...strip(hidden, 'hidden', hidden.cosHidden), gap: hidden.cosHidden - hidden.cosOverall },
    composition,
    trailing,
    scores: Object.fromEntries(scored.map((s) => [s.deityId, s.score])),
    closest: [...gaps].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta)).slice(0, 4),
    diverging: sortedByDelta.slice(0, 4),
    conflicts: pickConflict(
      [
        { match: primary, weight: primary.cosOverall },
        { match: secondary, weight: secondary.cosOverall },
        { match: shadow, weight: shadow.cosShadow },
        { match: hidden, weight: hidden.cosHidden },
      ],
      trailing,
      scored,
      primary.deityId,
      scoped,
    ),
    awakening: awakeningOf(primary, scored, shadow, vectors, data),
    title,
    thesis: primary.deity.psychology.worldview,
  }
}

const strip = (
  s: ScoredDeity,
  matchedProfile: DeityMatch['matchedProfile'],
  matchedSimilarity: number,
): DeityMatch => ({
  deityId: s.deityId,
  score: s.score,
  similarity: s.similarity,
  signatureHit: s.signatureHit,
  contradiction: s.contradiction,
  consistency: s.consistency,
  matchedProfile,
  matchedSimilarity,
})

/** Secondary answers "how do you get what the primary wants", not "second place". */
function pickSecondary(
  primary: ScoredDeity,
  scored: ScoredDeity[],
  user: Vector,
  data: PantheonData,
): ScoredDeity {
  const shared = Object.keys(primary.deity.vector).filter((id) => (primary.deity.vector[id] ?? 0) >= 0.4)

  const complementarity = (candidate: Deity) => {
    const type = relationType(data, primary.deityId, candidate.id)
    const relation = type ? RELATION_BONUS[type] : UNRELATED_BONUS
    const relevant = shared.filter((id) => (candidate.vector[id] ?? 0) >= 0.35 && (user[id] ?? 0) > 0.2)
    const alignment =
      relevant.length === 0
        ? 0
        : relevant.reduce((sum, id) => sum + (1 - Math.abs((user[id] ?? 0) - (candidate.vector[id] ?? 0)) / 2), 0) /
          relevant.length
    return 0.65 * relation + 0.35 * alignment
  }

  const { base, complementarity: weight } = data.scoring.secondary
  const best = scored
    .slice(1, 14)
    .map((s) => ({ s, value: base * s.cosOverall + weight * complementarity(s.deity) }))
    .sort((a, b) => b.value - a.value)[0]
  return best?.s ?? scored[1]
}

function pickShadow(
  primary: ScoredDeity,
  secondary: ScoredDeity,
  scored: ScoredDeity[],
  data: PantheonData,
): ScoredDeity {
  const excluded = new Set<string>()
  if (data.scoring.shadow.excludePrimary) excluded.add(primary.deityId)
  if (data.scoring.shadow.excludeSecondary) excluded.add(secondary.deityId)
  return [...scored].sort((a, b) => b.cosShadow - a.cosShadow).find((s) => !excluded.has(s.deityId))!
}

/** "The self you never lived out": biggest hidden-minus-overall gap. */
function pickHidden(
  primary: ScoredDeity,
  secondary: ScoredDeity,
  shadow: ScoredDeity,
  scored: ScoredDeity[],
  data: PantheonData,
): ScoredDeity {
  const gapOf = (s: ScoredDeity) => s.cosHidden - s.cosOverall
  const ranked = [...scored].sort((a, b) => gapOf(b) - gapOf(a))
  // The four roles should read as four different forces whenever the data allows it.
  const taken = new Set([primary.deityId, secondary.deityId, shadow.deityId])
  const best = ranked.find((s) => !taken.has(s.deityId)) ?? ranked[0]
  return best
}

function dimensionGaps(user: Vector, deity: Deity, data: PantheonData): DimensionGap[] {
  return data.dimensions.map((dim) => {
    const u = user[dim.id] ?? 0
    const d = deity.vector[dim.id] ?? 0
    return { id: dim.id, user: u, deity: d, delta: u - d }
  })
}

function pickConflict(
  roles: { match: ScoredDeity; weight: number }[],
  trailing: { deityId: string; score: number }[],
  scored: ScoredDeity[],
  primaryId: string,
  data: PantheonData,
): PantheonResult['conflicts'] {
  const byId = new Map(scored.map((s) => [s.deityId, s]))
  // 内战必须发生在用户已经认识的四个角色之间。早期从「构成前六」里挑，
  // 就会出现「赛特 对 奥德修斯」这种前面从没提到过的两个神在打架。
  const pool = [
    ...roles.map((r) => ({ deity: r.match.deity, weight: r.weight })),
    ...trailing.map((t) => ({ deity: byId.get(t.deityId)!.deity, weight: t.score })),
  ]
  const roleCount = roles.length
  const tensions = (onlyRoles: boolean) =>
    pool.flatMap((left, i) =>
      pool.slice(i + 1).flatMap((right, offset) => {
        const j = i + 1 + offset
        // 第一轮只在四个角色之间找；只有实在找不出张力时才把后来者算进来
        if (onlyRoles && (i >= roleCount || j >= roleCount)) return []
        const type = relationType(data, left.deity.id, right.deity.id)
        const typeWeight = type === 'tension' || type === 'conflict' ? 1.4 : type === 'mirror' ? 1.1 : 1
        const opposition = (1 - cosineOf(left.deity.vector, right.deity.vector)) / 2
        // 主角优先：让主神格参与的那一组更容易胜出，故事才接得上开头
        const anchor = left.deity.id === primaryId || right.deity.id === primaryId ? 1.25 : 1
        return [
          { a: left.deity, b: right.deity, value: left.weight * right.weight * opposition * typeWeight * anchor },
        ]
      }),
    )

  const rolePairs = tensions(true)
  const allPairs = rolePairs.length > 0 ? rolePairs : tensions(false)
  const sorted = [...allPairs].sort((x, y) => y.value - x.value)
  // 主神格应该是内战的一方：这是用户读到的那条故事线。
  // 比较用的是「对立程度」而不是加权分——阴影画像的相似度天然更高，直接比分数会失真。
  const anchored = sorted.filter((pair) => pair.a.id === primaryId || pair.b.id === primaryId)
  const oppositionOf = (pair: { a: Deity; b: Deity }) =>
    (1 - cosineOf(pair.a.vector, pair.b.vector)) / 2
  const anchoredOpposition = Math.max(0, ...anchored.map(oppositionOf))
  const strongestOpposition = Math.max(0, ...sorted.map(oppositionOf))
  const keepPrimary = anchoredOpposition * 1.5 >= strongestOpposition
  const pool2 = keepPrimary && anchored.length > 0 ? anchored : sorted
  const chosen = [...pool2].sort((x, y) => y.value - x.value)[0]
  if (!chosen) return null
  const best = chosen

  const axes = buildAxes(best.a, best.b, data)
  return {
    a: best.a.id,
    b: best.b.id,
    axes,
    question:
      relationText(data, best.a.id, best.b.id) !== '' && data.relationships[best.a.id]?.[best.b.id]?.note
        ? data.relationships[best.a.id][best.b.id].note!
        : `${best.a.name.zh}要${best.a.archetype.theme}；${best.b.name.zh}要${best.b.archetype.theme}。当这两件事同时要你先满足时，你更常放弃哪一个？`,
  }
}

function buildAxes(a: Deity, b: Deity, data: PantheonData): ConflictAxis[] {
  const pole = (dim: PantheonData['dimensions'][number], positive: boolean) =>
    (positive ? dim.positive.zh : dim.negative.zh).split(' / ')[0]

  return data.dimensions
    .map((dim) => {
      const av = a.vector[dim.id] ?? 0
      const bv = b.vector[dim.id] ?? 0
      return { dim, av, bv, separation: Math.abs(av - bv) }
    })
    .filter(({ av, bv, separation }) => separation >= 0.7 && av > 0 !== bv > 0)
    .sort((x, y) => y.separation - x.separation)
    .slice(0, 4)
    .map(({ dim, av, bv }) => ({
      id: dim.id,
      zh: dim.zh,
      leftLabel: pole(dim, av > 0),
      rightLabel: pole(dim, bv > 0),
      a: av,
      b: bv,
    }))
}

function awakeningOf(
  primary: ScoredDeity,
  scored: ScoredDeity[],
  shadow: ScoredDeity,
  vectors: PantheonResult['vectors'],
  data: PantheonData,
): PantheonResult['awakening'] {
  const {
    dormantPrimary,
    shadowPressureMargin,
    fallenShadowCapture,
    fallenMinSimilarity,
    fallenContradiction,
  } = data.scoring.awakening
  const shadowPressure = Math.max(...scored.map((s) => s.cosShadow))
  const runnerUp = scored.find((s) => s.deityId !== primary.deityId)
  const undifferentiated = primary.similarity - (runnerUp?.similarity ?? 0) < 0.02
  // 堕化 = 压力之下你反而更贴近自己神格的极端形态，而不只是被别的影子带走。
  const shadowSelf = cosineOf(vectors.shadow, primary.deity.vector)
  const state =
    primary.contradiction >= fallenContradiction
      ? 'fallen'
      : shadowSelf - primary.similarity >= fallenShadowCapture && primary.similarity >= fallenMinSimilarity
        ? 'fallen'
        : shadowPressure - primary.similarity >= shadowPressureMargin
          ? 'overawakened'
          : primary.similarity <= dormantPrimary || undifferentiated
            ? 'dormant'
            : 'awakened'
  const note =
    state === 'fallen'
      ? `${primary.deity.states.fallen}——压力越大，你越像它极端的那一面，而不是它平衡时的样子。`
      : state === 'overawakened' && shadow.cosShadow > primary.similarity
        ? `${primary.deity.states.overawakened}——压力越大，越容易是${shadow.deity.name.zh}替你说话，而不是${primary.deity.name.zh}。`
        : primary.deity.states[state]
  return { state, note }
}

const cosineOf = (a: Vector, b: Vector) => {
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

export function deityById(data: PantheonData, id: string): Deity {
  const deity = data.deities.find((d) => d.id === id)
  if (!deity) throw new Error(`unknown deity "${id}"`)
  return deity
}
