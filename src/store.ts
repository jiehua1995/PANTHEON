import { reactive } from 'vue'
import type { Answer, PantheonResult } from './schema/types'

const PROGRESS_KEY = 'pantheon.progress.v1'
const HISTORY_KEY = 'pantheon.history.v1'
const SCOPE_KEY = 'pantheon.scope.v1'

export interface HistoryEntry {
  at: number
  result: PantheonResult
}

export const store = reactive({
  answers: [] as Answer[],
  index: 0,
  result: null as PantheonResult | null,
  history: [] as HistoryEntry[],
  reading: false,
  /** 用户选的神系范围（metadata.pantheons 的 id）；空字符串 = 全部 */
  scopeId: '' as string,
})

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function initStore(): void {
  const progress = read<{ answers: Answer[]; index: number }>(PROGRESS_KEY, { answers: [], index: 0 })
  store.answers = progress.answers
  store.index = Math.min(progress.index, progress.answers.length)
  store.history = read<HistoryEntry[]>(HISTORY_KEY, [])
  store.scopeId = read<string>(SCOPE_KEY, '')
}

export function setScope(scopeId: string): void {
  store.scopeId = scopeId
  localStorage.setItem(SCOPE_KEY, JSON.stringify(scopeId))
}

export function saveProgress(): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify({ answers: store.answers, index: store.index }))
}

export function answer(questionId: string, optionId: string): void {
  const existing = store.answers.findIndex((a) => a.questionId === questionId)
  if (existing >= 0) store.answers[existing] = { questionId, optionId }
  else store.answers.push({ questionId, optionId })
  store.index = store.answers.length
  saveProgress()
}

export function resetProgress(): void {
  store.answers = []
  store.index = 0
  localStorage.removeItem(PROGRESS_KEY)
}

export function commitResult(result: PantheonResult): void {
  store.result = result
  store.history = [{ at: Date.now(), result }, ...store.history].slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(store.history))
}

export function clearHistory(): void {
  store.history = []
  localStorage.removeItem(HISTORY_KEY)
}
