import type { Deity, DimensionGap, PantheonData, PantheonResult } from '../schema/types.ts'
import { deityById } from './index.ts'
import { pairNote, relationText } from './relationships.ts'
import { selectDimensionNotes } from './dimension-notes.ts'

export interface ReportSection {
  id: string
  heading: string
  body: string[]
}

const sentence = (text: string) => text.trim()

/**
 * Modular assembly: archetype text gives the skeleton, the respondent's own
 * dimension values give the parts that could not be written in advance.
 */
export function buildReport(result: PantheonResult, data: PantheonData): ReportSection[] {
  const primary = deityById(data, result.primary.deityId)
  const secondary = deityById(data, result.secondary.deityId)
  const shadow = deityById(data, result.shadow.deityId)
  const hidden = deityById(data, result.hidden.deityId)
  const notes = selectDimensionNotes(result.vectors.overall, data, 2)
  const pair = pairNote(data, primary.id, secondary.id)

  return [
    {
      id: 'primary',
      heading: `主神格 · ${primary.name.zh}`,
      body: [
        sentence(primary.psychology.core_drive),
        agreementSentence(result.closest[0], primary, data),
        contrastSentence(result.diverging[0], primary, data),
        ...notes,
        ...(result.closeCall
          ? [
              `还有一点值得说明：${secondary.name.zh}在你身上几乎和${primary.name.zh}一样强。主神格决定你要什么，副神格决定你用什么方式去拿——这两股力量不是主次关系，而是分工。`,
            ]
          : []),
        `这份神格最容易收到的账是：${sentence(primary.shadow.danger)}`,
      ],
    },
    {
      id: 'secondary',
      heading: `副神格 · ${secondary.name.zh}`,
      body: [
        `${secondary.name.zh}是你实现「${primary.archetype.theme}」的方式：${sentence(secondary.archetype.theme)}。`,
        relationText(data, primary.id, secondary.id),
        sentence(secondary.psychology.power_pattern),
        `遇到阻力时，${sentence(secondary.psychology.conflict_pattern)}`,
        ...(pair ? [pair.secondary] : []),
      ],
    },
    {
      id: 'shadow',
      heading: `阴影神格 · ${shadow.name.zh}`,
      body: [
        `当你被威胁、被轻慢，或者事情开始脱离控制时，你滑向的不是${primary.name.zh}，而是${shadow.name.zh}。`,
        `触发点很具体：${sentence(shadow.shadow.trigger)}`,
        `第一反应是：${sentence(shadow.shadow.defense)}这条路能立刻把控制感拿回来，但真正的问题是：${sentence(shadow.shadow.danger)}`,
      ],
    },
    {
      id: 'hidden',
      heading: `隐藏神格 · ${hidden.name.zh}`,
      body: [
        `你的隐藏神格与显性人格之间的距离是 ${(result.hidden.gap * 100).toFixed(0)} 分。这是你没有活出来的那一部分。`,
        `它想要：${sentence(hidden.psychology.core_drive)}`,
        `你对${primary.name.zh}式的活法越熟练，${hidden.name.zh}就越只能待在想象、玩笑和深夜的冲动里。`,
        `代价：它不会消失，只会换个方式回来——等到「${sentence(hidden.shadow.trigger).replace(/[。；，]$/, '')}」这种事发生时，你会发现自己突然很不像自己。`,
      ],
    },
    ...(result.conflicts ? [conflictSection(result.conflicts, primary, data)] : []),
    {
      id: 'awakening',
      heading: `神格觉醒 · ${primary.name.zh}`,
      body: [
        `当前状态：${STATE_ZH[result.awakening.state]}。${stateNote(result, primary)}`,
        ...(Object.entries(primary.states) as [PantheonResult['awakening']['state'], string][])
          .filter(([key]) => key !== result.awakening.state)
          .map(([key, text]) => `${STATE_ZH[key]}时：${sentence(text)}`),
      ],
    },
    {
      id: 'power-cost',
      heading: '你的力量与代价',
      body: [
        `力量：${sentence(primary.states.awakened)}`,
        `代价：${sentence(primary.psychology.failure_pattern)}`,
        `在关系里，${sentence(primary.psychology.relationship_pattern)}`,
        `成长方向：把${shadow.name.zh}的防御换成一次有意识的表达，而不是等到失控时才让它替你说话。`,
      ],
    },
  ]
}

/** The dimension you match your archetype on most closely — said as behaviour, not as a number. */
function agreementSentence(gap: DimensionGap | undefined, deity: Deity, data: PantheonData): string {
  if (!gap) return `你和${deity.name.zh}的重合不是某一项特别像，而是整体方向一致。`
  const dim = data.dimensions.find((d) => d.id === gap.id)!
  if (Math.abs(gap.user) < 0.2 && Math.abs(gap.deity) < 0.2) {
    return `你和${deity.name.zh}最重合的地方是「${dim.zh}」——你们都把它放在了不重要的位置。`
  }
  return `你和${deity.name.zh}最重合的地方是「${dim.zh}」：这一项上你和他几乎完全踩在同一个点上，没有在演。`
}

/** The biggest divergence, named on both sides so it reads as a real disagreement. */
function contrastSentence(gap: DimensionGap | undefined, deity: Deity, data: PantheonData): string {
  if (!gap) return ''
  const dim = data.dimensions.find((d) => d.id === gap.id)!
  const side = (value: number) => (value > 0 ? dim.positive.zh : dim.negative.zh).split(' / ')[0]
  if (Math.abs(gap.delta) < 0.25) {
    return `你和${deity.name.zh}没有真正的分歧：差别最大的「${dim.zh}」也只是同一种方向的两种力度。`
  }
  if (gap.user * gap.deity > 0) {
    const youDeeper = Math.abs(gap.user) > Math.abs(gap.deity)
    return `你们最大的不同不在方向，而在力度：在「${dim.zh}」上你们都在「${side(gap.deity)}」这一侧，${
      youDeeper ? '你比他走得更远' : '他比你走得更远'
    }。`
  }
  return `你们最大的分歧在「${dim.zh}」：你偏「${side(gap.user)}」，他偏「${side(gap.deity)}」。这不是他错了，是你们对同一件事的定价不同。`
}

function conflictSection(
  conflicts: NonNullable<PantheonResult['conflicts']>,
  primary: Deity,
  data: PantheonData,
): ReportSection {
  const a = deityById(data, conflicts.a)
  const b = deityById(data, conflicts.b)
  const pair = pairNote(data, conflicts.a, conflicts.b)
  return {
    id: 'conflict',
    heading: '内在神战',
    body: [
      `${a.name.zh}对${b.name.zh}。这是你谱系里张力最大的一组：两者都强，方向相反。`,
      conflicts.question,
      ...(pair ? [pair.conflict] : []),
      ...conflicts.axes.map(
        (axis) => `${axis.zh}：${a.name.zh}倾向「${axis.leftLabel}」，${b.name.zh}倾向「${axis.rightLabel}」。`,
      ),
      conflicts.axes.length > 0
        ? `这场内战不会结束，也不该结束：在${conflicts.axes.map((axis) => `「${axis.zh}」`).join('、')}上，你会一辈子来回定价。要练的不是选中一边，而是知道在什么代价下让哪一边先说话。`
        : `这场内战不会结束，也不该结束。要练的不是选中一边，而是知道在什么代价下让哪一边先说话。`,
      `当${primary.name.zh}被压得太紧时，这场内战会最先失控。`,
    ],
  }
}

const STATE_ZH: Record<PantheonResult['awakening']['state'], string> = {
  dormant: '未觉醒',
  awakened: '觉醒',
  overawakened: '过度觉醒',
  fallen: '堕化',
}

/** The awakened note is the same sentence as 力量 below it — say something else instead. */
function stateNote(result: PantheonResult, primary: Deity): string {
  if (result.awakening.state === 'awakened' && result.awakening.note === primary.states.awakened) {
    return '你还能自由使用这份神格，而不是被它推着走。'
  }
  if (result.awakening.state === 'dormant' && result.awakening.note === primary.states.dormant) {
    return '这些倾向目前还只是习惯，称不上立场——它还没有替你做决定。'
  }
  return sentence(result.awakening.note)
}
