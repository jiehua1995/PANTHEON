/**
 * `npm run test-cli` — 在终端里做一次真人测试。
 *
 *   npm run test-cli                  # 交互答题，结束时写入 samples/<名字>-<时间>.json
 *   npm run test-cli -- --name 张三   # 直接在文件名里标记受访者
 *   npm run test-cli -- --resume      # 上次中途退出，从这里继续
 *   npm run test-cli -- --no-shuffle  # 与网页版一样保持选项固定顺序
 *
 * 答案只写在本机 samples/ 目录（已加入 .gitignore，不会被提交）。
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { loadData } from '../src/schema/load-data.ts'
import { generatePantheonResult } from '../src/engine/index.ts'
import { formatReport } from '../src/engine/report-text.ts'
import type { Answer, Question } from '../src/schema/types.ts'

const OUT_DIR = process.env.PANTHEON_SAMPLES ?? 'samples'
const PROGRESS = join(OUT_DIR, '.in-progress.json')

function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function shuffled<T>(list: T[], seed: number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = ((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0) % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function formatQuestion(question: Question, order: { id: string; text: string }[]): string {
  const lines = [question.text, '']
  order.forEach((option, index) => lines.push(`  ${index + 1}. ${option.text}`))
  return lines.join('\n')
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const value = (flag: string) => {
    const index = args.indexOf(flag)
    return index >= 0 ? args[index + 1] : undefined
  }
  const shuffle = !args.includes('--no-shuffle')
  const resume = args.includes('--resume')

  const data = loadData()
  const actOrder = data.metadata.acts.map((act) => act.id)
  const questions = [...data.questions].sort((a, b) => actOrder.indexOf(a.act) - actOrder.indexOf(b.act))

  mkdirSync(OUT_DIR, { recursive: true })
  // 用异步迭代器逐行读：readline.question() 在管道输入下会丢行（所有行会先被 emit 掉）
  const rl = createInterface({ input: stdin, output: stdout, terminal: Boolean(stdin.isTTY) })
  const reader = rl[Symbol.asyncIterator]()
  const ask = async (prompt: string): Promise<string | null> => {
    stdout.write(prompt)
    const { value, done } = await reader.next()
    return done ? null : String(value).trim()
  }

  let label = value('--name')
  let answers: Answer[] = []
  if (resume && existsSync(PROGRESS)) {
    const saved = JSON.parse(readFileSync(PROGRESS, 'utf8')) as { label?: string; answers: Answer[] }
    answers = saved.answers
    label = label ?? saved.label
    console.log(`\n继续上次：已完成 ${answers.length}/${questions.length} 题\n`)
  }

  console.log('万神殿 · 神格谱系（命令行版）')
  console.log('输入选项编号（1-4）后回车。b=上一题，q=保存并退出。')
  console.log('你的答案只保存在本机 samples/ 目录，不会上传。\n')

  while (!label) {
    const typed = await ask('受访者标记（随便起，只用于文件名）：')
    if (typed === null) {
      console.log('\n没有输入，已退出。')
      rl.close()
      return
    }
    if (typed) label = typed
  }

  let index = answers.length
  while (index < questions.length) {
    const question = questions[index]
    const act = data.metadata.acts.find((a) => a.id === question.act)!
    if (index === 0 || questions[index - 1].act !== question.act) {
      console.log(`\n──────── ${act.numeral} · ${act.zh} ────────`)
    }
    const order = shuffle
      ? shuffled(question.options, fnv1a(`${label}:${question.id}`))
      : question.options
    console.log(`\n[${index + 1}/${questions.length}] ${formatQuestion(question, order)}`)

    const raw = (await ask('> '))?.toLowerCase() ?? 'q'
    if (raw === 'q' || raw === '') {
      if (raw === '') continue
      writeFileSync(PROGRESS, JSON.stringify({ label, answers }, null, 2))
      console.log(`\n已保存 ${answers.length}/${questions.length} 到 ${PROGRESS}。下次加 --resume 继续。`)
      rl.close()
      return
    }
    if (raw === 'b') {
      if (answers.length > 0) {
        answers.pop()
        index = answers.length
      }
      continue
    }

    const digit = Number.parseInt(raw, 10)
    const letter = ['a', 'b', 'c', 'd'].indexOf(raw)
    const position = Number.isNaN(digit) ? (letter >= 0 ? letter + 1 : -1) : digit
    const option = order[position - 1]
    if (!option) {
      console.log('  请输入 1-4（b=上一题，q=退出并保存）')
      continue
    }
    answers.push({ questionId: question.id, optionId: option.id })
    index = answers.length
    writeFileSync(PROGRESS, JSON.stringify({ label, answers }, null, 2))
  }

  rl.close()

  const result = generatePantheonResult(answers, data)
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  const slug = label.replace(/[^\p{L}\p{N}_-]+/gu, '_')
  const file = join(OUT_DIR, `${slug}-${stamp}.json`)
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        app: 'pantheon',
        exportedAt: new Date().toISOString(),
        versions: result.versions,
        answers,
        title: result.title,
        primary: result.primary.deityId,
        label,
        source: 'cli',
      },
      null,
      2,
    )}\n`,
  )
  if (existsSync(PROGRESS)) unlinkSync(PROGRESS)

  console.log(`\n${'='.repeat(60)}`)
  console.log(formatReport(result, data, `${label}（cli）`))
  console.log(`\n答案已写入 ${file}`)
  console.log('再测一个人：npm run test-cli；汇总：npm run analyze-answers -- samples/')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
