<script setup lang="ts">
import { ref } from 'vue'
import { pantheonData, computeResult } from '../data'
import { store, clearHistory, resetProgress, commitResult } from '../store'
import { parseExport } from '../answer-io'
import { navigate } from '../router'

defineEmits<{ start: [] }>()

const importError = ref('')

async function importAnswers(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const parsed = parseExport(await file.text(), pantheonData)
  if ('error' in parsed) {
    importError.value = parsed.error
    return
  }
  importError.value = ''
  store.answers = parsed.answers
  commitResult(computeResult(parsed.answers))
  navigate('result')
}

function resume(): void {
  navigate('test')
}
</script>

<template>
  <section class="space-y-9 py-10">
    <p class="tracking-[0.4em] text-[0.75rem] accent">万神殿 · 神格谱系</p>
    <h1 class="text-[2.4rem] leading-[1.25] sm:text-[3.1rem]">
      众神从未离开。<br />他们只是失去了名字。
    </h1>
    <div class="space-y-5 text-[1.06rem] leading-[2] soft">
      <p>有些人被智慧驱动。有些人渴望秩序。有些人天生无法忍受边界。</p>
      <p>而多数人的灵魂，从来不只属于一位神。</p>
      <p class="muted">
        {{ pantheonData.questions.length }} 个情境 · {{ pantheonData.deities.length }} 个神格原型。你会得到主神格、副神格、阴影神格、隐藏神格，以及它们之间的内战。
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-6 pt-3">
      <button class="btn-strong" @click="$emit('start')">进入万神殿</button>
      <button
        v-if="store.answers.length > 0 && store.answers.length < pantheonData.questions.length"
        class="text-[0.95rem] muted underline decoration-dotted"
        @click="resume"
      >
        继续上次（{{ store.answers.length }}/{{ pantheonData.questions.length }}）
      </button>
      <label class="cursor-pointer text-[0.95rem] muted underline decoration-dotted">
        导入一份答案
        <input type="file" accept="application/json" class="hidden" @change="importAnswers" />
      </label>
    </div>
    <p v-if="importError" class="accent text-[0.85rem]">{{ importError }}</p>

    <div v-if="store.history.length" class="space-y-4 border-t pt-7 hairline">
      <p class="text-[0.72rem] tracking-[0.25em] muted">本机历史</p>
      <ul class="space-y-3 text-[0.98rem]">
        <li v-for="entry in store.history.slice(0, 5)" :key="entry.at" class="flex justify-between gap-4">
          <button
            class="text-left soft underline decoration-dotted"
            @click="store.result = entry.result; navigate('result')"
          >
            {{ entry.result.title }}
          </button>
          <span class="shrink-0 muted">{{ new Date(entry.at).toLocaleDateString() }}</span>
        </li>
      </ul>
      <button class="text-[0.8rem] muted underline" @click="clearHistory(); resetProgress()">
        清除本机记录
      </button>
    </div>
  </section>
</template>
