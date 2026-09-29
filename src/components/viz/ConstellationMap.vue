<script setup lang="ts">
import { computed } from 'vue'
import type { Vector } from '../../schema/types'
import { palette } from '../../theme'

const props = defineProps<{ vector: Vector; dimensions: { id: string; zh: string }[] }>()

const CLUSTERS: { key: string; zh: string; dims: string[] }[] = [
  { key: 'mind', zh: '心智', dims: ['reason', 'transcendence'] },
  { key: 'will', zh: '意志', dims: ['power', 'creation', 'world'] },
  { key: 'order', zh: '秩序', dims: ['order', 'authority', 'morality'] },
  { key: 'desire', zh: '欲望', dims: ['desire', 'risk'] },
  { key: 'social', zh: '联结', dims: ['social', 'empathy'] },
  { key: 'shadow', zh: '阴影', dims: ['conflict', 'identity', 'sacrifice'] },
  { key: 'time', zh: '时间', dims: ['time'] },
]

const SIZE = 400
const CENTER = SIZE / 2

const stars = computed(() =>
  CLUSTERS.map((cluster, index) => {
    const values = cluster.dims.map((id) => props.vector[id] ?? 0)
    const strength = values.reduce((a, b) => a + b, 0) / values.length
    const angle = (-90 + index * (360 / CLUSTERS.length)) * (Math.PI / 180)
    const radius = 60 + (1 - (strength + 1) / 2) * 90
    const x = CENTER + Math.cos(angle) * radius
    const y = CENTER + Math.sin(angle) * radius
    return {
      ...cluster,
      strength,
      x,
      y,
      r: 4 + Math.abs(strength) * 12,
      // 标签沿半径往外放，避免七个簇名互相重叠
      labelX: x + Math.cos(angle) * 26,
      labelY: y + Math.sin(angle) * 26,
      anchor: Math.cos(angle) > 0.3 ? 'start' : Math.cos(angle) < -0.3 ? 'end' : 'middle',
    }
  }),
)
</script>

<template>
  <figure>
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="mx-auto w-full max-w-md" role="img" aria-label="人格星图">
      <defs>
        <filter id="star-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g :stroke="palette.faint">
        <line
          v-for="(star, index) in stars"
          :key="`e-${star.key}`"
          :x1="star.x"
          :y1="star.y"
          :x2="stars[(index + 1) % stars.length].x"
          :y2="stars[(index + 1) % stars.length].y"
        />
      </g>
      <g>
        <circle :cx="CENTER" :cy="CENTER" r="4" :fill="palette.you" />
      </g>
      <g v-for="star in stars" :key="star.key" filter="url(#star-glow)">
        <circle
          :cx="star.x"
          :cy="star.y"
          :r="star.r"
          :fill="star.strength >= 0 ? palette.roles.you : palette.roles.shadow"
          :opacity="0.55 + Math.abs(star.strength) * 0.4"
        />
        <text :x="star.labelX" :y="star.labelY" :text-anchor="star.anchor" font-size="14" font-weight="600" :fill="palette.text">{{ star.zh }}</text>
      </g>
    </svg>
    <figcaption class="sr-only">
      <p v-for="star in stars" :key="`c-${star.key}`">{{ star.zh }} 聚合强度 {{ star.strength.toFixed(2) }}</p>
    </figcaption>
  </figure>
</template>
