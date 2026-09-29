import { expect, it } from 'vitest'
import { loadData, DATA_DIR } from '../src/schema/load-data.ts'
import { generatePantheonResult, deityById } from '../src/engine/index.ts'
import { relationText, relationType } from '../src/engine/relationships.ts'
import { selectDimensionNotes } from '../src/engine/dimension-notes.ts'
import { buildReport } from '../src/engine/report-builder.ts'
import type { Answer, Vector } from '../src/schema/types.ts'

const data = loadData(DATA_DIR)

/** A deterministic synthetic persona: pick the option that best fits a fixed target vector. */
function answersFor(target: Partial<Vector>, salt = 0): Answer[] {
  return data.questions.map((question, index) => {
    let best = question.options[0]
    let bestScore = -Infinity
    for (const [optionIndex, option] of question.options.entries()) {
      let score = 0
      for (const [id, weight] of Object.entries(option.weights)) score += weight * (target[id] ?? 0)
      score += ((index * 7 + optionIndex * 13 + salt) % 5) * 0.02
      if (score > bestScore) {
        bestScore = score
        best = option
      }
    }
    return { questionId: question.id, optionId: best.id }
  })
}

const personaA = answersFor({ creation: 1, world: 1, authority: -1, risk: 1, time: 0.8 })
const personaB = answersFor({ order: 1, authority: 1, desire: -1, conflict: 0.8, time: 0.6 }, 4)

it('is fully reproducible for the same answers and versions', () => {
  const first = generatePantheonResult(personaA, data)
  const second = generatePantheonResult(structuredClone(personaA), data)
  expect(JSON.stringify(second)).toEqual(JSON.stringify(first))
  expect(second.title).toEqual(first.title)
  expect(second.hash).toEqual(first.hash)
})

it('produces different reads for different answer sets', () => {
  const a = generatePantheonResult(personaA, data)
  const b = generatePantheonResult(personaB, data)
  expect(a.primary.deityId).not.toEqual(b.primary.deityId)
  expect(a.title).not.toEqual(b.title)
})

it('returns a well-formed谱系 for every profile', () => {
  for (const answers of [personaA, personaB]) {
    const result = generatePantheonResult(answers, data)
    const ids = data.deities.map((d) => d.id)
    for (const match of [result.primary, result.secondary, result.shadow, result.hidden]) {
      expect(ids).toContain(match.deityId)
      expect(Number.isFinite(match.score)).toBe(true)
    }
    expect(result.title.length).toBeGreaterThan(0)
    expect(result.thesis.length).toBeGreaterThan(0)
    expect(result.composition.length).toBeGreaterThan(2)
    const share = result.composition.reduce((sum, c) => sum + c.share, 0)
    expect(share).toBeCloseTo(1, 5)
    for (const entry of result.composition) expect(entry.share).toBeGreaterThanOrEqual(0)
    expect(result.secondary.deityId).not.toEqual(result.primary.deityId)
    expect(['dormant', 'awakened', 'overawakened', 'fallen']).toContain(result.awakening.state)
    expect(result.awakening.note.length).toBeGreaterThan(0)
  }
})

it('writes report sections that never contain empty or broken text', () => {
  for (const answers of [personaA, personaB]) {
    const result = generatePantheonResult(answers, data)
    const sections = buildReport(result, data)
    expect(sections.map((s) => s.id)).toEqual(
      expect.arrayContaining(['primary', 'secondary', 'shadow', 'hidden', 'awakening', 'power-cost']),
    )
    for (const section of sections) {
      expect(section.heading.length).toBeGreaterThan(0)
      for (const paragraph of section.body) {
        expect(paragraph.trim().length).toBeGreaterThan(8)
        expect(paragraph).not.toMatch(/undefined|NaN|\[object/)
      }
    }
  }
})

it('matches the shadow profile to a real shadow story, not the primary段落', () => {
  const result = generatePantheonResult(personaA, data)
  const shadow = deityById(data, result.shadow.deityId)
  const primary = deityById(data, result.primary.deityId)
  expect(shadow.shadow.danger.length).toBeGreaterThan(0)
  if (shadow.id !== primary.id) expect(shadow.psychology.core_drive).not.toEqual(primary.psychology.core_drive)
})

it('builds a conflict block whenever a tension pair is reachable', () => {
  const result = generatePantheonResult(personaB, data)
  if (result.conflicts) {
    expect(result.conflicts.axes.length).toBeGreaterThan(0)
    expect(result.conflicts.question.length).toBeGreaterThan(8)
    for (const axis of result.conflicts.axes) {
      expect(axis.a > 0 !== axis.b > 0).toBe(true)
    }
  }
})

it('keeps the whole deity fleet self-consistent', () => {
  const problems: string[] = []
  const dims = data.dimensions.map((d) => d.id)
  for (const deity of data.deities) {
    if (Object.keys(deity.vector).length !== dims.length) problems.push(`${deity.id}: vector size`)
    if (deity.archetype.theme.length < 6) problems.push(`${deity.id}: thin theme`)
  }
  expect(problems).toEqual([])
})

it('completes the relationship graph by derivation, with curated edges winning', () => {
  expect(relationType(data, 'prometheus', 'zeus')).toBe('tension')
  expect(relationText(data, 'prometheus', 'zeus')).toContain('权力')

  let defined = 0
  let total = 0
  const lonely: string[] = []
  for (const left of data.deities) {
    let own = 0
    for (const right of data.deities) {
      if (left.id === right.id) continue
      total += 1
      if (relationType(data, left.id, right.id)) {
        defined += 1
        own += 1
      }
    }
    if (own === 0) lonely.push(left.id)
  }
  expect(lonely).toEqual([])
  expect(defined / total).toBeGreaterThan(0.8)
})

it('keeps the four谱系 roles distinct, and reports each role on its own profile', () => {
  const targets = [
    { creation: 1, world: 1, authority: -1, risk: 1 },
    { order: 1, authority: 1, desire: -1, conflict: 0.8 },
    { social: 1, empathy: 1, conflict: -1 },
    { power: 1, conflict: 1, time: -1 },
    { reason: 1, transcendence: 1, social: -1 },
  ]
  for (const [index, target] of targets.entries()) {
    const result = generatePantheonResult(answersFor(target, index), data)
    const roles = [result.primary.deityId, result.secondary.deityId, result.shadow.deityId, result.hidden.deityId]
    expect(new Set(roles).size, `roles repeat for target ${index}: ${roles.join(', ')}`).toBe(4)
    // 匹配强度分别在各自的画像上计算：主/副看整体，阴影看压力，隐藏看「未活出的部分」
    expect(result.primary.matchedProfile).toBe('overall')
    expect(result.secondary.matchedProfile).toBe('overall')
    expect(result.shadow.matchedProfile).toBe('shadow')
    expect(result.hidden.matchedProfile).toBe('hidden')
    // 构成只回答「还有哪些原型离你近」，必须是单调递减（早期把两套指标混在一起，会出现 0.9% 排在 20% 前面）
    const shares = result.composition.map((c) => c.share)
    expect([...shares].sort((a, b) => b - a)).toEqual(shares)
    expect(shares.every((s) => s >= 0)).toBe(true)
    // 紧随其后的候选不能是已经作为角色出现的那四位
    const roleIds = new Set(roles)
    for (const t of result.trailing) expect(roleIds.has(t.deityId)).toBe(false)
    // 内战的两个神必须是前面已经介绍过的角色（曾经出现「赛特 对 奥德修斯」这种谁都没提过的组合）
    if (result.conflicts) {
      expect(roleIds.has(result.conflicts.a), `conflict ${result.conflicts.a} 不是角色`).toBe(true)
      expect(roleIds.has(result.conflicts.b), `conflict ${result.conflicts.b} 不是角色`).toBe(true)
    }
  }
})

it('selects dimension notes from the respondent’s own numbers', () => {
  const sharp = selectDimensionNotes({ power: 0.9, authority: -0.9, order: 0.6, conflict: -0.7 }, data, 2)
  expect(sharp.length).toBe(2)
  for (const note of sharp) {
    expect(note.length).toBeGreaterThan(15)
    expect(note).not.toMatch(/\$\{|undefined|NaN/)
  }
  // a flat, undifferentiated vector should not be handed strong claims
  const flat = selectDimensionNotes({}, data, 2)
  expect(flat.length).toBeLessThanOrEqual(2)
})

it('never lets one sentence describe most people (Barnum guard)', () => {
  const users = 24
  const frequency = new Map<string, number>()
  for (let index = 0; index < users; index++) {
    const target: Vector = {}
    for (const [dimIndex, dim] of data.dimensions.entries()) {
      target[dim.id] = Math.sin(index * 1.7 + dimIndex * 2.3)
    }
    const result = generatePantheonResult(answersFor(target, index), data)
    for (const paragraph of new Set(buildReport(result, data).flatMap((section) => section.body))) {
      frequency.set(paragraph, (frequency.get(paragraph) ?? 0) + 1)
    }
  }
  const tooCommon = [...frequency.entries()].filter(([, count]) => count / users > 0.8)
  expect(tooCommon.map(([text]) => text.slice(0, 40))).toEqual([])
})
