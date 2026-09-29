<script setup lang="ts">
import { onMounted, ref } from 'vue'

const emit = defineEmits<{ done: [] }>()

const steps = ['正在排列你的神格谱系', '识别核心原型', '解析阴影', '寻找隐藏神格', '计算内在张力']
const step = ref(0)

onMounted(() => {
  const timer = setInterval(() => {
    step.value += 1
    if (step.value >= steps.length) {
      clearInterval(timer)
      emit('done')
    }
  }, 420)
})
</script>

<template>
  <section class="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
    <div class="relative h-40 w-40">
      <div class="absolute inset-0 rounded-full" style="border: 1px solid var(--line)" />
      <div class="absolute inset-4 rounded-full" style="border: 1px solid var(--accent); opacity: 0.45" />
      <div
        class="absolute inset-0 animate-pulse rounded-full"
        style="background: color-mix(in srgb, var(--accent) 8%, transparent)"
      />
    </div>
    <ul class="space-y-3 text-[1rem] soft">
      <li v-for="(label, index) in steps" :key="label" :class="index > step ? 'opacity-25' : ''">
        {{ label }}
      </li>
    </ul>
  </section>
</template>
