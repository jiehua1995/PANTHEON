import type { Answer, PantheonData, PantheonResult } from './schema/types'

export interface AnswerExport {
  app: 'pantheon'
  exportedAt: string
  versions: PantheonResult['versions']
  answers: Answer[]
  /** convenience fields, not used when importing */
  title?: string
  primary?: string
}

export function buildExport(answers: Answer[], result: PantheonResult | null): AnswerExport {
  return {
    app: 'pantheon',
    exportedAt: new Date().toISOString(),
    versions: result?.versions ?? {
      test: '0.0.0',
      scoring: '0.0.0',
      deityDatabase: '0.0.0',
      result: '0.0.0',
    },
    answers,
    title: result?.title,
    primary: result?.primary.deityId,
  }
}

export function parseExport(text: string, data: PantheonData): { answers: Answer[] } | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: '不是合法的 JSON 文件' }
  }
  const record = parsed as Partial<AnswerExport>
  if (record.app !== 'pantheon' || !Array.isArray(record.answers)) {
    return { error: '这不是万神殿导出的答案文件' }
  }
  const questions = new Map(data.questions.map((q) => [q.id, q]))
  const answers: Answer[] = []
  for (const entry of record.answers) {
    const question = questions.get(entry?.questionId ?? '')
    if (!question) return { error: `未知题目：${entry?.questionId}` }
    if (!question.options.some((o) => o.id === entry?.optionId)) {
      return { error: `题目 ${entry.questionId} 没有选项 ${entry?.optionId}` }
    }
    answers.push({ questionId: entry.questionId, optionId: entry.optionId })
  }
  if (answers.length !== data.questions.length) {
    return { error: `答案数量不符：收到 ${answers.length}，需要 ${data.questions.length}（版本可能不同）` }
  }
  return { answers }
}
