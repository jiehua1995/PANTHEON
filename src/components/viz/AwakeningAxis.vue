<script setup lang="ts">
import type { AwakeningState } from '../../schema/types'

defineProps<{
  state: AwakeningState
  steps: { key: AwakeningState; label: string; text: string }[]
}>()
</script>

<template>
  <figure class="space-y-4">
    <ol class="grid gap-3 sm:grid-cols-4">
      <li
        v-for="step in steps"
        :key="step.key"
        class="rounded-2xl px-5 py-4 text-[0.92rem] leading-[1.9] transition"
        :style="{
          border: `1px solid ${step.key === state ? 'var(--accent)' : 'var(--line)'}`,
          background: step.key === state ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--surface)',
          color: step.key === state ? 'var(--text)' : 'var(--text-muted)',
        }"
      >
        <p class="mb-1 tracking-widest">{{ step.label }}</p>
        <p>{{ step.text }}</p>
      </li>
    </ol>
  </figure>
</template>
