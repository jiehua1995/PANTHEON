import type { Answer, PantheonData, PantheonResult } from './schema/types'
import { generatePantheonResult, deityById } from './engine/index.ts'
import { buildReport } from './engine/report-builder.ts'

import metadata from '../data/metadata.json'
import dimensions from '../data/dimensions.json'
import relationships from '../data/relationships.json'
import pairInterpretations from '../data/pair_interpretations.json'
import dimensionNotes from '../data/dimension_notes.json'
import scoring from '../data/scoring.json'
import titles from '../data/titles.json'
import greek from '../data/deities/greek.json'
import greekOlympians from '../data/deities/greek_olympians.json'
import norse from '../data/deities/norse.json'
import celtic from '../data/deities/celtic.json'
import chinese from '../data/deities/chinese.json'
import japanese from '../data/deities/japanese.json'
import egyptian from '../data/deities/egyptian.json'
import mythic from '../data/deities/mythic.json'
import celticMore from '../data/deities/celtic_more.json'
import mythicHeroes from '../data/deities/mythic_heroes.json'
import q1 from '../data/questions/1_order.json'
import q2 from '../data/questions/2_will.json'
import q3 from '../data/questions/3_boundary.json'
import q4 from '../data/questions/4_desire.json'
import q5 from '../data/questions/5_conflict.json'
import q6 from '../data/questions/6_abyss.json'
import q7 from '../data/questions/7_divinity.json'

/** Same JSON files the validator reads — the browser build imports them statically. */
export const pantheonData = {
  metadata,
  dimensions,
  relationships,
  pairInterpretations,
  dimensionNotes,
  scoring,
  titles,
  deities: [
    ...greek,
    ...greekOlympians,
    ...norse,
    ...celtic,
    ...celticMore,
    ...chinese,
    ...japanese,
    ...egyptian,
    ...mythic,
    ...mythicHeroes,
  ],
  questions: [...q1, ...q2, ...q3, ...q4, ...q5, ...q6, ...q7],
} as unknown as PantheonData

/** scopeId = 神系分组 id（见 metadata.pantheons），null 表示全部万神殿 */
export function scopeOf(scopeId: string | null): { id: string; zh: string; members: string[] } | null {
  if (!scopeId) return null
  const group = pantheonData.metadata.pantheons.find((entry) => entry.id === scopeId)
  return group ? { id: group.id, zh: group.zh, members: group.members } : null
}

export function computeResult(answers: Answer[], scopeId: string | null = null): PantheonResult {
  return generatePantheonResult(answers, pantheonData, scopeOf(scopeId))
}

export function report(answers: Answer[], scopeId: string | null = null) {
  const result = computeResult(answers, scopeId)
  return { result, sections: buildReport(result, pantheonData) }
}

export const deity = (id: string) => deityById(pantheonData, id)
