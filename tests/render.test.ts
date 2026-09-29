import { renderToString } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { expect, it, beforeAll } from 'vitest'
import ResultView from '../src/components/ResultView.vue'
import { saveProgress, store } from '../src/store.ts'
import { pantheonData } from '../src/data.ts'
import type { Answer } from '../src/schema/types.ts'

beforeAll(() => {
  const memory = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as Storage

  const answers: Answer[] = pantheonData.questions.map((question) => {
    const option = question.options[1] ?? question.options[0]
    return { questionId: question.id, optionId: option.id }
  })
  store.answers = answers
  store.result = null
  saveProgress()
})

it('renders the full result page without placeholders or broken values', async () => {
  const html = await renderToString(createSSRApp(ResultView))
  // 卡片式面板：每张卡的标题与关键区块都必须在
  for (const label of ['你的神格谱系', '四股力量', '你的多维人格', '内在神战', '神格觉醒', '分享卡', '接下来']) {
    expect(html, `缺少卡片：${label}`).toContain(label)
  }
  for (const id of ['card-head', 'card-strength', 'card-radar', 'card-primary', 'card-conflict', 'card-awakening', 'card-share']) {
    expect(html, `缺少锚点：${id}`).toContain(`id="${id}"`)
  }
  expect(html).toContain('主神格 ·')
  expect(html).toContain('隐藏神格 ·')
  expect(html).not.toMatch(/undefined|NaN|\[object/)
  expect(html.length).toBeGreaterThan(4000)
})
