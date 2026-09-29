import type { PantheonData, Vector } from '../schema/types.ts'

export interface DimensionNote {
  id: string
  when: Record<string, { min?: number; max?: number }>
  text: string
}

const matches = (note: DimensionNote, vector: Vector): boolean =>
  Object.entries(note.when).every(([dim, range]) => {
    const value = vector[dim] ?? 0
    if (range.min !== undefined && value < range.min) return false
    if (range.max !== undefined && value > range.max) return false
    return true
  })

/** How far past the thresholds this vector sits — deeper matches read as more specific. */
const depth = (note: DimensionNote, vector: Vector): number =>
  Object.entries(note.when).reduce((sum, [dim, range]) => {
    const value = vector[dim] ?? 0
    if (range.min !== undefined) return sum + Math.max(0, value - range.min)
    if (range.max !== undefined) return sum + Math.max(0, range.max - value)
    return sum
  }, 0)

/**
 * Sentences built from the respondent's own numbers rather than from the archetype
 * they landed on. Two-dimension notes win over one-dimension ones, so the report
 * says something the archetype text cannot.
 */
export function selectDimensionNotes(vector: Vector, data: PantheonData, limit = 2): string[] {
  const notes = (data.dimensionNotes ?? []) as DimensionNote[]
  return notes
    .filter((note) => matches(note, vector))
    .map((note) => ({ note, conditions: Object.keys(note.when).length, score: depth(note, vector) }))
    .sort((a, b) => b.conditions - a.conditions || b.score - a.score || a.note.id.localeCompare(b.note.id))
    .slice(0, limit)
    .map((entry) => entry.note.text)
}
