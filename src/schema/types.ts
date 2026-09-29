/**
 * Compile-time mirror of data/*.json. The runtime enums (acts, profiles,
 * relationship types, signature levels) live in data/metadata.json and are
 * checked by scripts/validate-data.ts — keep both in sync.
 */

export type DimensionId = string
export type DeityId = string

export interface LocalizedText {
  zh: string
  en: string
}

export interface DimensionDefinition {
  id: DimensionId
  zh: string
  en: string
  /** Shown in the 8-dimension "核心维度" radar. */
  core: boolean
  negative: LocalizedText
  positive: LocalizedText
  question: string
}

/** -1..1 per dimension. Keyed by DimensionId, never hardcoded to 16 dims. */
export type Vector = Record<DimensionId, number>

export type SignatureLevel = 'very_low' | 'low' | 'mid' | 'high' | 'very_high'

export interface DeityPsychology {
  core_drive: string
  core_fear: string
  worldview: string
  power_pattern: string
  relationship_pattern: string
  conflict_pattern: string
  failure_pattern: string
}

export interface DeityStates {
  dormant: string
  awakened: string
  overawakened: string
  fallen: string
}

export interface DeityShadow {
  trigger: string
  defense: string
  danger: string
}

export interface DeityVisual {
  symbol: string
  geometry: string
  motif: string
}

export interface DeityTitles {
  prefixes: string[]
  nouns: string[]
}

export interface Deity {
  id: DeityId
  name: LocalizedText
  pantheon: string
  category: 'deity' | 'mythic_archetype'
  archetype: { core: string; theme: string }
  symbols: string[]
  vector: Vector
  signature_dimensions: Partial<Record<DimensionId, SignatureLevel>>
  anti_dimensions: Partial<Record<DimensionId, SignatureLevel>>
  psychology: DeityPsychology
  states: DeityStates
  shadow: DeityShadow
  visual: DeityVisual
  titles: DeityTitles
  tags: string[]
}

export type RelationshipType =
  | 'affinity'
  | 'complement'
  | 'tension'
  | 'mirror'
  | 'conflict'
  | 'suppression'

export interface RelationshipEdge {
  type: RelationshipType
  /** 0..1 */
  strength: number
  note?: string
}

export type Relationships = Record<DeityId, Record<DeityId, RelationshipEdge>>

export type ActId = string
export type ProfileId = 'overall' | 'shadow' | 'hidden'

export interface AnswerOption {
  id: string
  text: string
  /** Dimension deltas applied by this option. Multiple dims, no deity scores. */
  weights: Vector
}

export interface Question {
  id: string
  act: ActId
  profile: ProfileId
  text: string
  options: AnswerOption[]
}

export interface Metadata {
  name: LocalizedText
  tagline: LocalizedText
  versions: {
    test: string
    scoring: string
    deityDatabase: string
    result: string
  }
  profiles: ProfileId[]
  categories: Deity['category'][]
  pantheons: { id: string; zh: string; en: string; members: string[] }[]
  relationshipTypes: RelationshipType[]
  signatureLevels: SignatureLevel[]
  acts: { id: ActId; numeral: string; zh: string; en: string; line: string }[]
}

export interface PantheonData {
  metadata: Metadata
  dimensions: DimensionDefinition[]
  deities: Deity[]
  relationships: Relationships
  pairInterpretations: Record<string, { secondary: string; conflict: string }>
  dimensionNotes: { id: string; when: Record<string, { min?: number; max?: number }>; text: string }[]
  questions: Question[]
  scoring: ScoringConfig
  titles: TitlePools
}

export interface ScoringConfig {
  /** raw weights are compressed with tanh(raw / (datasetWeightSum / scaleDivisor)) */
  scaleDivisor: number
  /** fraction of each dimension's per-question contributions dropped from both ends before summing */
  trimFraction: number
  /** width of the ramp around each signature/anti threshold; 0 = hard cutoff */
  signatureSoftness: number
  primary: {
    cosine: number
    euclidean: number
    signature: number
    consistency: number
    contradiction: number
    /** penalty for archetypes that sit near the middle of the fleet (they would otherwise hoover up users) */
    specificity: number
  }
  secondary: { base: number; complementarity: number }
  shadow: { excludePrimary: boolean; excludeSecondary: boolean }
  hidden: { minGap: number }
  /** score gap below which the result is reported as "you are between two archetypes" */
  closeMargin: number
  /** cosine thresholds for the derived relationship layer (data/relationships.json overrides) */
  relations: {
    mirror: number
    affinity: number
    complement: number
    tension: number
    conflict: number
  }
  signatureThresholds: Record<SignatureLevel, number>
  composition: {
    top: number
    base: number
    shadow: number
    hidden: number
  }
  awakening: {
    dormantPrimary: number
    /** how far the stress pattern may out-match the everyday pattern before it counts as over-awakened */
    shadowPressureMargin: number
    /** how much more strongly the stress pattern matches the primary archetype than the everyday pattern does */
    fallenShadowCapture: number
    /** you can only fall from an archetype you actually have */
    fallenMinSimilarity: number
    fallenContradiction: number
  }
  simulation: { users: number; maxPrimaryShare: number; minPrimaryShare: number }
}

export interface TitlePools {
  patterns: string[]
  images: string[]
  roles: string[]
  fields: string[]
  acts: string[]
  powers: string[]
  forces: string[]
  subjects: string[]
}

export interface Answer {
  questionId: string
  optionId: string
}

export interface ProfileVectors {
  overall: Vector
  shadow: Vector
  hidden: Vector
}

export interface DeityMatch {
  deityId: DeityId
  /** final ranking score */
  score: number
  similarity: number
  signatureHit: number
  contradiction: number
  consistency: number
  /** 这个角色是按哪套画像选出来的 */
  matchedProfile: 'overall' | 'shadow' | 'hidden'
  /** 该画像下的匹配强度（0–1），用来回答「这个角色有多像」 */
  matchedSimilarity: number
}

export interface DimensionGap {
  id: DimensionId
  user: number
  deity: number
  delta: number
}

export interface ConflictAxis {
  id: DimensionId
  zh: string
  leftLabel: string
  rightLabel: string
  a: number
  b: number
}

export type AwakeningState = 'dormant' | 'awakened' | 'overawakened' | 'fallen'

export interface PantheonResult {
  versions: Metadata['versions']
  /** 用户选择的神系范围；null = 全部万神殿 */
  scope: { id: string; zh: string } | null
  hash: number
  vectors: ProfileVectors
  primary: DeityMatch
  secondary: DeityMatch
  /** primary score minus runner-up score; small values mean the result is a genuine toss-up */
  margin: number
  closeCall: boolean
  shadow: DeityMatch
  hidden: DeityMatch & { gap: number }
  composition: { deityId: DeityId; share: number }[]
  /** 紧随四位角色之后、按总分排名的原型（不进构成条，只作为一句补充） */
  trailing: { deityId: DeityId; score: number }[]
  scores: Record<DeityId, number>
  closest: DimensionGap[]
  diverging: DimensionGap[]
  conflicts: {
    a: DeityId
    b: DeityId
    question: string
    axes: ConflictAxis[]
  } | null
  awakening: { state: AwakeningState; note: string }
  title: string
  thesis: string
}
