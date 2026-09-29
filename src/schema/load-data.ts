import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Deity, PantheonData, Question } from './types.ts'

export const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url))

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => readJson(join(dir, f)) as T[])
}

/** Single loader for scripts and tests. The Vue app imports the same JSON via Vite. */
export function loadData(dataDir: string = DATA_DIR): PantheonData {
  return {
    metadata: readJson(join(dataDir, 'metadata.json')) as PantheonData['metadata'],
    dimensions: readJson(join(dataDir, 'dimensions.json')) as PantheonData['dimensions'],
    deities: readJsonDir<Deity>(join(dataDir, 'deities')),
    relationships: readJson(join(dataDir, 'relationships.json')) as PantheonData['relationships'],
    pairInterpretations: readJson(join(dataDir, 'pair_interpretations.json')) as PantheonData['pairInterpretations'],
    dimensionNotes: readJson(join(dataDir, 'dimension_notes.json')) as PantheonData['dimensionNotes'],
    questions: readJsonDir<Question>(join(dataDir, 'questions')),
    scoring: readJson(join(dataDir, 'scoring.json')) as PantheonData['scoring'],
    titles: readJson(join(dataDir, 'titles.json')) as PantheonData['titles'],
  }
}
