<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { pantheonData, computeResult } from '../data'
import { answer, commitResult, resetProgress, store } from '../store'

const emit = defineEmits<{ done: [] }>()

const questions = pantheonData.questions
const acts = pantheonData.metadata.acts
const cursor = ref(Math.min(store.answers.length, questions.length))
const phase = ref<'question' | 'act'>('question')
const pendingAct = ref<(typeof acts)[number] | null>(null)

const current = computed(() => questions[cursor.value])
const nextQuestion = computed(() => questions[cursor.value + 1])
const act = computed(() => acts.find((a) => a.id === current.value?.act))
const progress = computed(() => cursor.value / questions.length)

/** 每一幕完成度，用来画分段进度条 */
const actProgress = computed(() =>
  acts.map((entry) => {
    const inAct = questions.filter((q) => q.act === entry.id)
    const answered = inAct.filter((q) => cursor.value > questions.indexOf(q)).length
    return { ...entry, done: answered, total: inAct.length, active: entry.id === act.value?.id }
  }),
)

function choose(optionId: string): void {
  const question = current.value
  if (!question) return
  answer(question.id, optionId)
  const upcoming = nextQuestion.value
  if (!upcoming) {
    finish()
    return
  }
  cursor.value += 1
  if (upcoming.act !== question.act) {
    pendingAct.value = acts.find((a) => a.id === upcoming.act) ?? null
    phase.value = 'act'
  }
}

function finish(): void {
  const result = computeResult(store.answers, store.scopeId || null)
  commitResult(result)
  store.reading = true
  emit('done')
}

function back(): void {
  if (cursor.value === 0) return
  cursor.value -= 1
  phase.value = 'question'
}

function restart(): void {
  resetProgress()
  cursor.value = 0
  phase.value = 'question'
}

/** 键盘答题：1-4 选选项，← 回上一题，回车继续下一幕 */
function onKey(event: KeyboardEvent): void {
  if (phase.value === 'act') {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      phase.value = 'question'
      pendingAct.value = null
    }
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
    event.preventDefault()
    back()
    return
  }
  const index = Number.parseInt(event.key, 10)
  if (index >= 1 && index <= (current.value?.options.length ?? 0)) {
    event.preventDefault()
    choose(current.value!.options[index - 1].id)
  }
}

onMounted(() => addEventListener('keydown', onKey))
onBeforeUnmount(() => removeEventListener('keydown', onKey))
</script>

<template>
  <p v-if="store.scopeId" class="mb-4 text-center text-[0.82rem] muted">
    测试范围：{{ pantheonData.metadata.pantheons.find((p) => p.id === store.scopeId)?.zh }}
  </p>
  <!-- 幕间：给自己一个停顿，而不是直接跳进下一题 -->
  <section
    v-if="phase === 'act' && pendingAct"
    class="flex min-h-[70vh] flex-col items-center justify-center gap-7 text-center"
  >
    <div class="flex flex-col items-center gap-4 rounded-3xl px-10 py-12" style="border: 1px solid var(--line); background: var(--surface)">
      <p class="accent text-6xl leading-none">{{ pendingAct.numeral }}</p>
      <h2 class="text-[2rem] tracking-[0.3em]">{{ pendingAct.zh }}</h2>
      <p class="muted max-w-sm text-[0.98rem] leading-[1.9]">{{ pendingAct.line }}</p>
      <button class="btn-strong mt-2" @click="phase = 'question'; pendingAct = null">继续</button>
      <p class="text-[0.78rem] muted">按回车也可以</p>
    </div>
  </section>

  <section v-else-if="current" class="py-6">
    <div class="rounded-3xl px-6 py-7 sm:px-9 sm:py-9" style="border: 1px solid var(--line); background: var(--surface)">
      <!-- 顶部：幕 + 分段进度 -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-[0.8rem] tracking-[0.3em] muted">{{ act?.numeral }} · {{ act?.zh }}</p>
        <p class="text-[0.8rem] muted">
          {{ current.profile === 'shadow' ? '深渊题 · 你被威胁时' : current.profile === 'hidden' ? '神性题 · 你没活出的部分' : '' }}
        </p>
      </div>

      <div class="mt-4 flex gap-1.5">
        <div
          v-for="entry in actProgress"
          :key="entry.id"
          class="h-1.5 flex-1 overflow-hidden rounded-full"
          :style="{ background: 'var(--surface-strong)', flexGrow: entry.total }"
          :title="`${entry.zh} ${entry.done}/${entry.total}`"
        >
          <div
            class="h-1.5 rounded-full transition-all"
            :style="{
              width: `${(entry.done / entry.total) * 100}%`,
              background: entry.active ? 'var(--accent)' : 'var(--line-strong)',
            }"
          />
        </div>
      </div>

      <h2 class="mt-8 text-[1.4rem] leading-[1.8] sm:text-[1.55rem]">{{ current.text }}</h2>

      <ul class="mt-7 grid gap-3.5 md:grid-cols-2">
        <li v-for="(option, index) in current.options" :key="option.id">
          <button class="option h-full" @click="choose(option.id)">
            <span class="muted mr-2 text-[0.85rem] tabular-nums">{{ index + 1 }}</span>{{ option.text }}
          </button>
        </li>
      </ul>

      <div class="mt-7 flex flex-wrap items-center justify-between gap-4 text-[0.85rem] muted">
        <button v-if="cursor > 0" class="underline" @click="back">上一题</button>
        <span v-else />
        <div class="flex items-center gap-5">
          <span class="hidden sm:inline">键盘 1–4 也能选</span>
          <button class="underline" @click="restart">重新开始</button>
        </div>
      </div>
    </div>

    <p class="mt-4 text-center text-[0.78rem] muted">
      已完成 {{ cursor }} / {{ questions.length }} · {{ Math.round(progress * 100) }}%
    </p>
  </section>
</template>
