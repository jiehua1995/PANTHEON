import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { loadData, DATA_DIR } from '../src/schema/load-data.ts'
import { validateData } from '../scripts/validate-data.ts'

function fixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pantheon-'))
  mkdirSync(join(dir, 'deities'))
  for (const file of ['metadata.json', 'dimensions.json', 'relationships.json', 'scoring.json', 'titles.json', 'pair_interpretations.json', 'dimension_notes.json']) {
    copyFileSync(join(DATA_DIR, file), join(dir, file))
  }
  copyFileSync(join(DATA_DIR, 'deities/greek.json'), join(dir, 'deities/greek.json'))
  cpSync(join(DATA_DIR, 'questions'), join(dir, 'questions'), { recursive: true })
  return dir
}

function patchDeities(dir: string, mutate: (deities: any[]) => void): void {
  const path = join(dir, 'deities/greek.json')
  const deities = JSON.parse(readFileSync(path, 'utf8')) as any[]
  mutate(deities)
  writeFileSync(path, JSON.stringify(deities))
}

it('shipped data passes the gate', () => {
  const { errors } = validateData(loadData(DATA_DIR), { reachability: false })
  expect(errors).toEqual([])
})

it('catches malformed vectors, duplicate ids, missing blocks and bad references', () => {
  const dir = fixtureDir()
  patchDeities(dir, (deities) => {
    deities[0].vector.creation = 4 // out of range
    deities[0].vector.nodim = 0.1 // unknown dimension
    delete deities[0].states // missing block
    deities[0].titles.nouns = [] // empty title pool
    deities[1].id = deities[0].id // duplicate id
    deities[1].category = 'demigod' // unknown category
  })
  const relationships = JSON.parse(readFileSync(join(dir, 'relationships.json'), 'utf8'))
  relationships.ghost = { prometheus: { type: 'affinity', strength: 0.5 } }
  relationships.prometheus.athena = { type: 'rivalry', strength: 2 }
  writeFileSync(join(dir, 'relationships.json'), JSON.stringify(relationships))

  const codes = new Set(validateData(loadData(dir), { reachability: false }).errors.map((e) => e.code))
  for (const code of [
    'deity.vector',
    'deity.id',
    'deity.states',
    'deity.titles',
    'deity.category',
    'relationship.ref',
    'relationship.type',
    'relationship.strength',
  ]) {
    expect(codes, `expected ${code}`).toContain(code)
  }
})

it('catches options without weights, unknown weight targets and empty option text', () => {
  const dir = fixtureDir()
  writeFileSync(
    join(dir, 'questions/core.json'),
    JSON.stringify([
      {
        id: 'q1',
        act: 'order',
        profile: 'overall',
        text: '问题',
        options: [
          { id: 'a', text: '', weights: {} },
          { id: 'a', text: '选项', weights: { ghostdim: 0.5 } },
        ],
      },
    ]),
  )
  const codes = new Set(validateData(loadData(dir), { reachability: false }).errors.map((e) => e.code))
  expect(codes).toContain('answer.weights')
  expect(codes).toContain('answer.text')
  expect(codes).toContain('answer.id')
})

it('warns when two deities are near-identical (cosine > 0.94)', () => {
  const dir = fixtureDir()
  patchDeities(dir, (deities) => {
    const twin = structuredClone(deities[0])
    twin.id = 'prometheus_twin'
    twin.name = { zh: '普罗米修斯·孪生', en: 'Prometheus Twin' }
    twin.vector.risk = 0.91
    deities.push(twin)
  })
  const warnings = validateData(loadData(dir), { reachability: false }).warnings.map((w) => w.code)
  expect(warnings).toContain('deity.collision')
})

it('flags an archetype that no reachable answer sheet can elect', () => {
  const dir = fixtureDir()
  patchDeities(dir, (deities) => {
    const impossible = structuredClone(deities[1])
    impossible.id = 'impossible_maximalist'
    impossible.name = { zh: '极端者', en: 'Maximalist' }
    // fully inverted: several dimensions cannot be pushed this low by any answer sheet
    for (const dim of Object.keys(impossible.vector)) impossible.vector[dim] = -1
    impossible.anti_dimensions = {}
    deities.push(impossible)
  })

  const codes = validateData(loadData(dir)).warnings.map((w) => w.code)
  expect(codes).toContain('deity.unreachable')

  const skipped = validateData(loadData(dir), { reachability: false }).warnings.map((w) => w.code)
  expect(skipped).not.toContain('deity.unreachable')
})
