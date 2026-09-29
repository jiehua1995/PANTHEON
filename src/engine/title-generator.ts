import type { Deity, PantheonData } from '../schema/types.ts'
import { fnv1a, pick, pickDistinct, seedOf } from './hash.ts'

export interface TitleInput {
  primary: Deity
  secondary: Deity
  shadow: Deity
  hidden: Deity
  dominantDimensions: string[]
  versions: PantheonData['metadata']['versions']
}

/** Deterministic: identical answers + versions always produce this exact title. */
export function generateTitle(input: TitleInput, data: PantheonData): string {
  const pools = data.titles
  const titleSeed = seedOf([
    input.primary.id,
    input.secondary.id,
    input.shadow.id,
    input.hidden.id,
    ...input.dominantDimensions,
    ...Object.values(input.versions),
  ])
  const pattern = pick(pools.patterns, titleSeed, 1)
  const prefix = pick(input.primary.titles.prefixes, titleSeed, 2)
  const noun = pick(input.primary.titles.nouns, titleSeed, 3)
  // the hidden archetype gets to name part of the title: it is the part you never lived out
  const prefix2 = pick(input.hidden.titles.prefixes, titleSeed, 13)
  const noun2 = pick(input.hidden.titles.nouns, titleSeed, 14)
  const [power, force] = pickDistinct(pools.powers, titleSeed, 4, 5)
  const [forceA] = pickDistinct(pools.forces, titleSeed, 6, 7)
  const image = pick(pools.images, titleSeed, 8)
  const role = pick(pools.roles, titleSeed, 9)
  const field = pick(pools.fields, titleSeed, 10)
  const act = pick(pools.acts, titleSeed, 11)
  const subject = pick(pools.subjects, titleSeed, 12)

  const tokens: Record<string, string> = {
    prefix,
    noun,
    prefix2,
    noun2,
    role,
    image,
    field,
    act,
    subject,
    power: power,
    force: fnv1a(force) === fnv1a(forceA) ? force : forceA,
  }

  const title = pattern.replace(/\{(\w+)\}/g, (_, key: string) => tokens[key] ?? '')
  return title.length > 0 ? title : `${prefix}的${noun}`
}
