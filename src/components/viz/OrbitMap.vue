<script setup lang="ts">
import { computed } from 'vue'
import { palette } from '../../theme'

interface OrbitNode {
  role: string
  name: string
  similarity: number
  relation: string
  color?: string
}

const props = defineProps<{ nodes: OrbitNode[] }>()

// 画布要留出余量：标签沿半径往外排，360 的框会把边缘字号裁掉
const SIZE = 470
const CENTER = SIZE / 2

/** Closer to the centre = more similar. Strong links get solid strokes, tension dashed. */
const placed = computed(() =>
  props.nodes.map((node, index) => {
    const angle = (-90 + index * (360 / Math.max(props.nodes.length, 1))) * (Math.PI / 180)
    // 半径 + 标签偏移 + 文字宽度必须留在画布内，否则边缘的字会被裁掉
    const distance = CENTER * 0.34 + (1 - Math.max(0, Math.min(1, node.similarity))) * CENTER * 0.24
    const x = CENTER + Math.cos(angle) * distance
    const y = CENTER + Math.sin(angle) * distance
    // 标签沿半径往外放：四个角上的字再也不会互相压住，也不会盖住中心
    const out = 14 + (5 + Math.max(0, node.similarity) * 9)
    return {
      ...node,
      x,
      y,
      size: 5 + Math.max(0, node.similarity) * 9,
      dash: node.relation === 'tension' || node.relation === 'conflict' ? '6 6' : undefined,
      width: node.relation === 'mirror' ? 3 : 1.4,
      labelX: x + Math.cos(angle) * out,
      labelY: y + Math.sin(angle) * out,
      anchor: Math.cos(angle) > 0.3 ? 'start' : Math.cos(angle) < -0.3 ? 'end' : 'middle',
      nameDy: Math.sin(angle) >= 0 ? 6 : -6,
    }
  }),
)
</script>

<template>
  <figure>
    <svg
      :viewBox="`0 0 ${SIZE} ${SIZE}`"
      class="mx-auto block w-full max-w-lg overflow-visible"
      role="img"
      aria-label="神格轨道图"
    >
      <defs>
        <filter id="orbit-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g :stroke="palette.faint">
        <line v-for="node in placed" :key="`l-${node.name}`" :x1="CENTER" :y1="CENTER" :x2="node.x" :y2="node.y" :stroke-dasharray="node.dash" :stroke-width="node.width" />
      </g>
      <g filter="url(#orbit-glow)">
        <circle :cx="CENTER" :cy="CENTER" r="18" :fill="palette.you" opacity="0.92" />
      </g>
      <text :x="CENTER" :y="CENTER + 5" text-anchor="middle" font-size="13" font-weight="600" :fill="palette.ink">YOU</text>
      <g v-for="node in placed" :key="node.name" filter="url(#orbit-glow)">
        <circle :cx="node.x" :cy="node.y" :r="node.size" :fill="node.color ?? palette.roles.secondary" opacity="0.9" />
      </g>
      <g v-for="node in placed" :key="`t-${node.name}`">
        <text
          :x="node.labelX"
          :y="node.labelY + node.nameDy"
          :text-anchor="node.anchor"
          font-size="15"
          font-weight="600"
          :fill="palette.text"
        >
          {{ node.name }}
        </text>
        <text
          :x="node.labelX"
          :y="node.labelY + node.nameDy + (node.nameDy > 0 ? 18 : -18)"
          :text-anchor="node.anchor"
          font-size="12"
          :fill="palette.textMuted"
        >
          {{ node.role }}
        </text>
      </g>
    </svg>
    <figcaption class="sr-only">
      <p v-for="node in placed" :key="`c-${node.name}`">
        {{ node.role }}：{{ node.name }}，与你的接近度 {{ node.similarity.toFixed(2) }}，关系 {{ node.relation }}
      </p>
    </figcaption>
  </figure>
</template>
