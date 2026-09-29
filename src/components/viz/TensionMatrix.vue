<script setup lang="ts">
defineProps<{ items: { left: string; right: string; value: number }[] }>()
</script>

<template>
  <figure class="space-y-3">
    <div v-for="item in items" :key="item.left" class="space-y-1">
      <div class="flex justify-between text-[0.85rem] muted">
        <span>{{ item.left }}</span>
        <span>{{ item.right }}</span>
      </div>
      <div class="relative h-2 rounded-full" style="background: var(--surface-strong)">
        <div
          class="absolute inset-y-0 left-0 rounded-full"
          style="width: 100%; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 20%, transparent), transparent)"
        />
        <div class="absolute top-1/2 -translate-y-1/2" :style="{ left: `${((item.value + 1) / 2) * 100}%` }">
          <div
            class="h-3.5 w-3.5 -translate-x-1/2 rounded-full"
            style="background: var(--accent); box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 70%, transparent)"
          />
        </div>
      </div>
    </div>
    <figcaption class="sr-only">
      <p v-for="item in items" :key="`t-${item.left}`">{{ item.left }} 到 {{ item.right }}：{{ item.value.toFixed(2) }}</p>
    </figcaption>
  </figure>
</template>
