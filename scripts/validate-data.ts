/**
 * `npm run validate-data` — data gate for the whole project.
 * Fails (exit 1) on structural errors, reports near-duplicate deities as warnings.
 */
import { fileURLToPath } from 'node:url'
import type {
  Deity,
  DimensionDefinition,
  PantheonData,
  Question,
  Vector,
} from '../src/schema/types.ts'
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import { compress, denominatorsOf } from '../src/engine/vectors.ts'
import { centralityOf, scoreOne } from '../src/engine/match.ts'
import { cosine } from '../src/engine/similarity.ts'

export interface Issue {
  code: string
  where: string
  message: string
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

export interface ValidateOptions {
  /** the reachability search is the slow part (~10s on 74 deities); tests skip it */
  reachability?: boolean
}

export function validateData(
  data: PantheonData,
  options: ValidateOptions = {},
): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const err = (code: string, where: string, message: string) =>
    errors.push({ code, where, message })
  const warn = (code: string, where: string, message: string) =>
    warnings.push({ code, where, message })

  const { metadata } = data
  if (!metadata || !metadata.versions) {
    err('metadata', 'metadata.json', 'missing metadata or versions block')
    return { errors, warnings }
  }
  for (const act of metadata.acts ?? []) {
    if (!isText(act?.line)) warn('act.line', `act "${act?.id ?? '?'}"`, '这一幕没有描述句')
  }

  // ---- dimensions ---------------------------------------------------------
  const dims = new Map<string, DimensionDefinition>()
  for (const [i, d] of data.dimensions.entries()) {
    const where = `dimensions[${i}] ${d?.id ?? '?'}`
    if (!isText(d?.id)) {
      err('dimension.id', where, 'missing dimension id')
      continue
    }
    if (dims.has(d.id)) err('dimension.id', where, `duplicate dimension id "${d.id}"`)
    dims.set(d.id, d)
    for (const field of ['zh', 'en', 'question'] as const) {
      if (!isText(d[field])) err('dimension.text', where, `empty ${field}`)
    }
    for (const pole of ['negative', 'positive'] as const) {
      if (!isText(d[pole]?.zh) || !isText(d[pole]?.en)) {
        err('dimension.text', where, `empty ${pole} pole text`)
      }
    }
    if (typeof d.core !== 'boolean') err('dimension.core', where, 'core flag must be boolean')
  }
  if (dims.size === 0) err('dimension.none', 'dimensions.json', 'no dimensions defined')

  // ---- deities ------------------------------------------------------------
  const deities = new Map<string, Deity>()
  const textUsage = new Map<string, string[]>()
  const fieldSamples = new Map<string, string[]>()
  const MIN_TEXT = 10
  for (const deity of data.deities) {
    const where = `deity "${deity?.id ?? '?'}"`
    if (!isText(deity?.id)) {
      err('deity.id', where, 'missing deity id')
      continue
    }
    if (deities.has(deity.id)) err('deity.id', where, `duplicate deity id "${deity.id}"`)
    deities.set(deity.id, deity)

    if (!isText(deity.name?.zh) || !isText(deity.name?.en)) {
      err('deity.name', where, 'empty zh/en name')
    }
    if (!isText(deity.pantheon)) err('deity.pantheon', where, 'missing pantheon')
    if (!metadata.categories.includes(deity.category)) {
      err('deity.category', where, `unknown category "${deity.category}"`)
    }
    if (deity.category === 'mythic_archetype' && deity.pantheon === 'deity') {
      err('deity.category', where, 'mythic_archetype must not claim deity status')
    }
    if (!isText(deity.archetype?.core) || !isText(deity.archetype?.theme)) {
      err('deity.archetype', where, 'missing archetype core/theme')
    }
    if (!Array.isArray(deity.symbols) || deity.symbols.length === 0) {
      err('deity.symbols', where, 'no symbols')
    }
    if (!Array.isArray(deity.tags) || deity.tags.length === 0) {
      err('deity.tags', where, 'no tags')
    }

    // vector
    const missing = [...dims.keys()].filter((id) => !(id in (deity.vector ?? {})))
    for (const id of missing) err('deity.vector', where, `missing dimension "${id}"`)
    for (const [id, value] of Object.entries(deity.vector ?? {})) {
      if (!dims.has(id)) err('deity.vector', where, `unknown dimension "${id}"`)
      if (typeof value !== 'number' || Number.isNaN(value)) {
        err('deity.vector', where, `"${id}" is not a number`)
      } else if (value < -1 || value > 1) {
        err('deity.vector', where, `"${id}" = ${value} outside -1..1`)
      }
    }

    for (const field of ['signature_dimensions', 'anti_dimensions'] as const) {
      for (const [id, level] of Object.entries(deity[field] ?? {})) {
        if (!dims.has(id)) err('deity.signature', where, `${field} -> unknown dimension "${id}"`)
        if (level === undefined || !metadata.signatureLevels.includes(level)) {
          err('deity.signature', where, `${field}.${id} -> unknown level "${level}"`)
        }
      }
    }

    // required prose blocks
    for (const [block, fields] of [
      ['psychology', ['core_drive', 'core_fear', 'worldview', 'power_pattern', 'relationship_pattern', 'conflict_pattern', 'failure_pattern']],
      ['states', ['dormant', 'awakened', 'overawakened', 'fallen']],
      ['shadow', ['trigger', 'defense', 'danger']],
      ['visual', ['symbol', 'geometry', 'motif']],
    ] as const) {
      const value = deity[block] as unknown as Record<string, unknown> | undefined
      if (!value) {
        err(`deity.${block}`, where, `missing ${block} block`)
        continue
      }
      for (const field of fields) {
        if (!isText(value[field])) {
          err(`deity.${block}`, where, `empty ${block}.${field}`)
        } else if (block !== 'visual') {
          // visual.symbol / geometry / motif are keyword tokens, not prose
          const text = String(value[field]).trim()
          const key = `${block}.${field}`
          if (text.length < MIN_TEXT) {
            warn('deity.text.thin', where, `${key} 只有 ${text.length} 字：「${text}」`)
          }
          fieldSamples.set(`${block}.${field}`, [...(fieldSamples.get(`${block}.${field}`) ?? []), text])
          textUsage.set(text, [...(textUsage.get(text) ?? []), `${deity.id}.${key}`])
        }
      }
    }

    if (!Array.isArray(deity.titles?.prefixes) || deity.titles.prefixes.length === 0) {
      err('deity.titles', where, 'empty title prefixes')
    }
    if (!Array.isArray(deity.titles?.nouns) || deity.titles.nouns.length === 0) {
      err('deity.titles', where, 'empty title nouns')
    }
  }
  if (deities.size === 0) err('deity.none', 'data/deities', 'no deities defined')

  // Copy-paste between archetypes: the same sentence cannot describe two different gods.
  for (const [text, users] of textUsage) {
    if (users.length > 1) {
      warn('deity.text.duplicate', users.join(' / '), `同一句被 ${users.length} 个神格共用：「${text.slice(0, 28)}…」`)
    }
  }

  // Template fatigue: 74 gods that all open the same way read like one god with 74 names.
  for (const [field, samples] of fieldSamples) {
    if (samples.length < 8) continue
    const opening = new Map<string, number>()
    const closing = new Map<string, number>()
    for (const text of samples) {
      // 他/她 是同一种句法开头，不能算两种
      const head = text.replace(/她/g, '他').slice(0, 2)
      const tail = text.slice(-4)
      opening.set(head, (opening.get(head) ?? 0) + 1)
      closing.set(tail, (closing.get(tail) ?? 0) + 1)
    }
    const [head, headCount] = [...opening.entries()].sort((a, b) => b[1] - a[1])[0]
    const [tail, tailCount] = [...closing.entries()].sort((a, b) => b[1] - a[1])[0]
    if (headCount / samples.length > 0.3) {
      warn('deity.text.template', field, `${headCount}/${samples.length} 条以「${head}」开头`)
    }
    if (tailCount / samples.length > 0.2) {
      warn('deity.text.template', field, `${tailCount}/${samples.length} 条以「${tail}」结尾`)
    }
  }

  // ---- questions ----------------------------------------------------------
  const questions = new Map<string, Question>()
  const questionTexts: string[] = []
  const optionTexts: string[] = []
  const actIds = new Set(metadata.acts.map((a) => a.id))
  const weightCount: Record<string, { pos: number; neg: number }> = {}
  for (const dim of dims.keys()) weightCount[dim] = { pos: 0, neg: 0 }

  for (const q of data.questions) {
    const where = `question "${q?.id ?? '?'}"`
    if (!isText(q?.id)) {
      err('question.id', where, 'missing question id')
      continue
    }
    if (questions.has(q.id)) err('question.id', where, `duplicate question id "${q.id}"`)
    questions.set(q.id, q)
    if (!isText(q.text)) err('question.text', where, 'empty question text')
    else {
      questionTexts.push(q.text.trim())
      if (q.text.trim().length < 18) warn('question.text.thin', where, `情境只有 ${q.text.trim().length} 字：「${q.text.trim()}」`)
    }
    if (!actIds.has(q.act)) err('question.act', where, `unknown act "${q.act}"`)
    if (!metadata.profiles.includes(q.profile)) {
      err('question.profile', where, `unknown profile "${q.profile}"`)
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      err('question.options', where, 'needs at least 2 options')
      continue
    }
    const optionIds = new Set<string>()
    for (const [i, option] of q.options.entries()) {
      const optWhere = `${where} option ${option?.id ?? i}`
      if (!isText(option?.id)) err('answer.id', optWhere, 'missing option id')
      else if (optionIds.has(option.id)) err('answer.id', optWhere, 'duplicate option id')
      else optionIds.add(option.id)
      if (!isText(option?.text)) err('answer.text', optWhere, 'empty option text')
      else {
        optionTexts.push(option.text.trim())
        if (option.text.trim().length < 6) warn('answer.text.thin', optWhere, `选项只有 ${option.text.trim().length} 字：「${option.text.trim()}」`)
      }
      const weights = option?.weights ?? {}
      if (Object.keys(weights).length === 0) {
        err('answer.weights', optWhere, 'option has no weights')
        continue
      }
      for (const [dim, w] of Object.entries(weights)) {
        if (!dims.has(dim)) {
          err('answer.weights', optWhere, `weight -> unknown dimension "${dim}"`)
          continue
        }
        if (typeof w !== 'number' || Number.isNaN(w)) {
          err('answer.weights', optWhere, `weight "${dim}" is not a number`)
          continue
        }
        if (Math.abs(w) > 1) err('answer.weights', optWhere, `weight "${dim}" = ${w} outside -1..1`)
        if (w > 0) weightCount[dim].pos += 1
        if (w < 0) weightCount[dim].neg += 1
      }
    }
  }

  // ---- question / option voice ---------------------------------------------
  // 每个选项都必须可能被选中：随便取样一堆人格向量，如果有选项从来不是最优，
  // 那它就不是一个选项，只是凑数（spec §32 要求每题都构成真实取舍）。
  {
    const dimensionIds = [...dims.keys()]
    const samples = 1500
    let seed = 12345
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296)
    const targets = Array.from({ length: samples }, () =>
      Object.fromEntries(dimensionIds.map((id) => [id, rand() * 2 - 1])) as Record<string, number>,
    )
    for (const question of questions.values()) {
      const chosen = new Set<string>()
      for (const target of targets) {
        let best = question.options[0]
        let bestScore = -Infinity
        for (const option of question.options) {
          const score = Object.entries(option.weights).reduce((sum, [id, weight]) => sum + weight * target[id], 0)
          if (score > bestScore) {
            bestScore = score
            best = option
          }
        }
        chosen.add(best.id)
      }
      for (const option of question.options) {
        if (!chosen.has(option.id)) {
          warn('answer.dead_option', `question "${question.id}" option ${option.id}`, '没有任何人格向量会选中它——这不是一个真实选项')
        }
      }
    }
  }

  for (const [label, samples, openLimit, closeLimit] of [
    ['question.text.template', questionTexts, 0.25, 0.2],
    ['answer.text.template', optionTexts, 0.3, 0.2],
  ] as const) {
    if (samples.length < 8) continue
    const opening = new Map<string, number>()
    const closing = new Map<string, number>()
    for (const text of samples) {
      const head = text.replace(/她/g, '他').slice(0, 2)
      const tail = text.slice(-4)
      opening.set(head, (opening.get(head) ?? 0) + 1)
      closing.set(tail, (closing.get(tail) ?? 0) + 1)
    }
    const [head, headCount] = [...opening.entries()].sort((a, b) => b[1] - a[1])[0]
    const [tail, tailCount] = [...closing.entries()].sort((a, b) => b[1] - a[1])[0]
    if (headCount / samples.length > openLimit) {
      warn(label, `${label.split('.')[0]}s`, `${headCount}/${samples.length} 条以「${head}」开头`)
    }
    if (tailCount / samples.length > closeLimit) {
      warn(label, `${label.split('.')[0]}s`, `${tailCount}/${samples.length} 条以「${tail}」结尾`)
    }
  }

  // ---- relationships ------------------------------------------------------
  const noteIds = new Set<string>()
  for (const note of data.dimensionNotes ?? []) {
    const where = `dimension_notes.${note?.id ?? '?'}`
    if (!isText(note?.id)) err('note.id', where, 'missing note id')
    else if (noteIds.has(note.id)) err('note.id', where, `duplicate note id "${note.id}"`)
    else noteIds.add(note.id)
    if (!isText(note?.text)) err('note.text', where, 'empty note text')
    const conditions = Object.entries(note?.when ?? {})
    if (conditions.length === 0) err('note.when', where, 'note matches everyone — that is Barnum text')
    for (const [dim, range] of conditions) {
      if (!dims.has(dim)) err('note.dim', where, `unknown dimension "${dim}"`)
      for (const bound of ['min', 'max'] as const) {
        const value = range?.[bound]
        if (value === undefined) continue
        if (typeof value !== 'number' || value < -1 || value > 1) {
          err('note.range', where, `${dim}.${bound} must be a number in -1..1`)
        }
      }
      if (range?.min !== undefined && range?.max !== undefined && range.min > range.max) {
        err('note.range', where, `${dim}: min > max`)
      }
    }
  }

  for (const [key, note] of Object.entries(data.pairInterpretations ?? {})) {
    const where = `pair_interpretations.${key}`
    for (const id of key.split('|')) {
      if (!deities.has(id)) err('pair.ref', where, `unknown deity "${id}"`)
    }
    if (key.split('|').length !== 2) err('pair.key', where, 'key must be "deityA|deityB"')
    if (!isText(note?.secondary)) err('pair.text', where, 'empty secondary text')
    if (!isText(note?.conflict)) err('pair.text', where, 'empty conflict text')
  }

  for (const [from, edges] of Object.entries(data.relationships)) {
    if (!deities.has(from)) {
      err('relationship.ref', `relationships.${from}`, 'source deity does not exist')
    }
    for (const [to, edge] of Object.entries(edges)) {
      const where = `relationships.${from}.${to}`
      if (!deities.has(to)) err('relationship.ref', where, 'target deity does not exist')
      if (!metadata.relationshipTypes.includes(edge?.type)) {
        err('relationship.type', where, `unknown type "${edge?.type}"`)
      }
      if (typeof edge?.strength !== 'number' || edge.strength < 0 || edge.strength > 1) {
        err('relationship.strength', where, `strength must be 0..1, got ${edge?.strength}`)
      }
    }
  }

  // ---- coverage + collision (warnings) ------------------------------------
  if (data.questions.length > 0) {
    for (const [dim, counts] of Object.entries(weightCount)) {
      if (counts.pos === 0) warn('coverage', `dimension ${dim}`, 'never weighted positive')
      if (counts.neg === 0) warn('coverage', `dimension ${dim}`, 'never weighted negative')
    }
  }

  const list = [...deities.values()].filter((d) => d.vector)
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const score = cosine(list[i].vector, list[j].vector)
      if (score > 0.94) {
        warn(
          'deity.collision',
          `${list[i].id} ~ ${list[j].id}`,
          `cosine ${score.toFixed(3)} > 0.94 — redefine, merge or sharpen signatures`,
        )
      }
    }
  }

  // ---- reachability -------------------------------------------------------
  // Two failure modes, told apart on purpose:
  //   unreachable — the answer space has no sheet that even resembles this
  //                 archetype (question coverage / vector outside range);
  //   crowded     — it is reachable, but a neighbouring archetype wins even on
  //                 this deity's own best answer sheet (differentiation).
  if (options.reachability !== false && data.questions.length > 0) {
    for (const deity of deities.values()) {
      if (!deity.vector) continue
      const { answers, margin, cosineBest } = bestFitAnswers(deity, data)
      const elected = generatePantheonResult(answers, data).primary.deityId
      if (cosineBest < 0.8) {
        warn('deity.unreachable', `deity "${deity.id}"`, `no answer sheet comes closer than cosine ${cosineBest.toFixed(2)}`)
      } else if (elected !== deity.id) {
        warn(
          'deity.crowded',
          `deity "${deity.id}"`,
          `even its best sheet (cosine ${cosineBest.toFixed(2)}, margin ${margin.toFixed(3)}) elects "${elected}"`,
        )
      }
    }
  }

  return { errors, warnings }
}

/**
 * The most favourable answer sheet this deity can actually be given: the search
 * maximises "my score minus the best rival score" using the engine's own scoring
 * function, so a negative margin means no reachable user is closest to this
 * archetype — the honest definition of crowded out.
 */
function bestFitAnswers(
  deity: Deity,
  data: PantheonData,
): { answers: { questionId: string; optionId: string }[]; cosineBest: number; margin: number } {
  const dims = data.dimensions.map((d) => d.id)
  const scaleDivisor = data.scoring.scaleDivisor
  const centrality = centralityOf(data)
  const denominators = {
    overall: denominatorsOf(data, 'overall'),
    shadow: denominatorsOf(data, 'shadow'),
    hidden: denominatorsOf(data, 'hidden'),
  } as const
  const project = (weights: Record<string, number>) =>
    Object.entries(weights).reduce((sum, [dim, weight]) => sum + weight * (deity.vector[dim] ?? 0), 0)

  // Incremental: keep the running raw sums per profile, swap one question at a time.
  const raw = {
    overall: Object.fromEntries(dims.map((id) => [id, 0])) as Vector,
    shadow: Object.fromEntries(dims.map((id) => [id, 0])) as Vector,
    hidden: Object.fromEntries(dims.map((id) => [id, 0])) as Vector,
  }
  const answers = data.questions.map((question) => {
    const option = question.options.reduce((best, candidate) =>
      project(candidate.weights) > project(best.weights) ? candidate : best,
    )
    for (const [dim, weight] of Object.entries(option.weights)) raw[question.profile][dim] += weight
    return { questionId: question.id, optionId: option.id }
  })
  const optionWeights = new Map(
    data.questions.map((q) => [q.id, new Map(q.options.map((o) => [o.id, o.weights as Record<string, number>]))]),
  )

  /** Swap one question's answer, keeping the running raw sums exact by construction. */
  const setOption = (index: number, optionId: string): void => {
    const question = data.questions[index]
    const totals = raw[question.profile]
    const weights = optionWeights.get(question.id)!
    for (const [dim, weight] of Object.entries(weights.get(answers[index].optionId)!)) totals[dim] -= weight
    for (const [dim, weight] of Object.entries(weights.get(optionId)!)) totals[dim] += weight
    answers[index] = { questionId: question.id, optionId }
  }

  /** cheap probe: how close can the answer space get to this archetype at all */
  const cosineNow = () => cosine(compress(raw.overall, denominators.overall, scaleDivisor), deity.vector)
  let cosineBest = cosineNow()
  for (let pass = 0; pass < 2; pass++) {
    let improved = false
    for (const [index, question] of data.questions.entries()) {
      for (const option of question.options) {
        if (answers[index].optionId === option.id) continue
        const previousId = answers[index].optionId
        setOption(index, option.id)
        const candidate = cosineNow()
        if (candidate > cosineBest + 1e-9) {
          cosineBest = candidate
          improved = true
        } else {
          setOption(index, previousId)
        }
      }
    }
    if (!improved) break
  }

  const evaluate = () => {
    const vectors = {
      overall: compress(raw.overall, denominators.overall, scaleDivisor),
      shadow: compress(raw.shadow, denominators.shadow, scaleDivisor),
      hidden: compress(raw.hidden, denominators.hidden, scaleDivisor),
    }
    let mine = -Infinity
    let rival = -Infinity
    for (const candidate of data.deities) {
      const score = scoreOne(candidate, vectors, data, centrality).score
      if (candidate.id === deity.id) mine = score
      else rival = Math.max(rival, score)
    }
    return { margin: mine - rival }
  }
  let best = evaluate()

  for (let pass = 0; pass < 3; pass++) {
    let improved = false
    for (const [index, question] of data.questions.entries()) {
      for (const option of question.options) {
        if (answers[index].optionId === option.id) continue
        const previousId = answers[index].optionId
        setOption(index, option.id)
        const candidate = evaluate()
        if (candidate.margin > best.margin + 1e-9) {
          best = candidate
          improved = true
        } else {
          setOption(index, previousId)
        }
      }
    }
    if (!improved) break
  }
  return { answers, margin: best.margin, cosineBest }
}

export function report(data: PantheonData): boolean {
  const { errors, warnings } = validateData(data)
  for (const w of warnings) console.warn(`warn  [${w.code}] ${w.where} — ${w.message}`)
  for (const e of errors) console.error(`ERROR [${e.code}] ${e.where} — ${e.message}`)
  console.log(
    `\n${data.deities.length} deities · ${data.dimensions.length} dimensions · ` +
      `${data.questions.length} questions · ${errors.length} errors · ${warnings.length} warnings`,
  )
  return errors.length === 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // ponytail: no CJK width handling, output is for humans not parsers
  process.exit(report(loadData()) ? 0 : 1)
}
