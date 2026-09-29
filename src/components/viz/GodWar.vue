<script setup lang="ts">
import { palette } from '../../theme'

defineProps<{
  a: string
  b: string
  axes: { zh: string; leftLabel: string; rightLabel: string; a: number; b: number }[]
}>()

const width = 100
const bar = (value: number) => Math.round((Math.abs(value) + 0.1) * (width / 2.2))
</script>

<template>
  <figure class="space-y-4">
    <div class="flex justify-between text-[1.05rem] tracking-widest">
      <span>{{ a }}</span>
      <span>{{ b }}</span>
    </div>
    <div v-for="axis in axes" :key="axis.zh" class="space-y-1">
      <div class="flex items-center gap-3 text-[0.8rem] muted">
        <span class="w-24 text-right">{{ axis.leftLabel }}</span>
        <span class="flex-1 text-center tracking-widest muted">{{ axis.zh }}</span>
        <span class="w-24">{{ axis.rightLabel }}</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex flex-1 justify-end">
          <div class="h-2 rounded-l" :style="{ width: `${bar(axis.a)}%`, background: palette.roles.secondary }" />
        </div>
        <div class="h-2 w-px" style="background: var(--line-strong)" />
        <div class="flex flex-1">
          <div class="h-2 rounded-r" :style="{ width: `${bar(axis.b)}%`, background: palette.roles.primary }" />
        </div>
      </div>
    </div>
    <figcaption class="sr-only">
      <p v-for="axis in axes" :key="`f-${axis.zh}`">{{ axis.zh }}：{{ a }} {{ axis.a.toFixed(2) }}，{{ b }} {{ axis.b.toFixed(2) }}</p>
    </figcaption>
  </figure>
</template>
