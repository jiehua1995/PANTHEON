import type { PantheonData, PantheonResult } from '../schema/types.ts'
import { buildReport } from './report-builder.ts'
import { selectDimensionNotes } from './dimension-notes.ts'

const name = (data: PantheonData, id: string) => data.deities.find((d) => d.id === id)!.name.zh

/** 终端里的报告排版，`show-report` 与 `test-cli` 共用一份。 */
export function formatReport(result: PantheonResult, data: PantheonData, source?: string): string {
  const lines: string[] = []
  lines.push(`# 称号：${result.title}`)
  lines.push(
    `# 谱系：主 ${name(data, result.primary.deityId)} / 副 ${name(data, result.secondary.deityId)}` +
      ` / 阴影 ${name(data, result.shadow.deityId)} / 隐藏 ${name(data, result.hidden.deityId)}`,
  )
  lines.push(
    `# 觉醒：${STATE[result.awakening.state]}${result.closeCall ? ' · 双主神格（前两名几乎同高）' : ''}`,
  )
  lines.push(
    `# 构成：${result.composition.map((c) => `${name(data, c.deityId)} ${(c.share * 100).toFixed(0)}%`).join(' · ')}`,
  )
  lines.push(`# 命题：${result.thesis}`)
  if (source) lines.push(`# 来源：${source}`)
  lines.push(`# 命中的维度注：${selectDimensionNotes(result.vectors.overall, data, 2).length} 条`)
  lines.push(
    `# 调试（开发用）：primary ${result.primary.score.toFixed(3)} / second ${result.secondary.score.toFixed(3)}` +
      ` / margin ${result.margin.toFixed(3)} / hash ${result.hash}`,
  )

  for (const section of buildReport(result, data)) {
    lines.push('', `## ${section.heading}`)
    for (const paragraph of section.body) lines.push(`   ${paragraph}`)
  }
  return lines.join('\n')
}

const STATE: Record<PantheonResult['awakening']['state'], string> = {
  dormant: '未觉醒',
  awakened: '觉醒',
  overawakened: '过度觉醒',
  fallen: '堕化',
}
