<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { themeMode } from '../theme'

export interface CardRole {
  label: string
  name: string
  color: string
  /** 0–1 */
  strength: number
  strengthText: string
}

export interface CardData {
  title: string
  thesis: string
  primary: { name: string; archetype: string }
  roles: CardRole[]
}

const props = defineProps<{ data: CardData }>()

const RATIOS = {
  '4:5': { w: 1080, h: 1350, label: '4:5 竖版' },
  '1:1': { w: 1080, h: 1080, label: '1:1 方版' },
  '9:16': { w: 1080, h: 1920, label: '9:16 全屏' },
} as const
type RatioKey = keyof typeof RATIOS

const ratio = ref<RatioKey>('4:5')
const size = computed(() => RATIOS[ratio.value])
const canvas = ref<HTMLCanvasElement>()
const preview = ref('')

const SERIF = '"Noto Serif SC", "Songti SC", ui-serif, Georgia, serif'

/** 卡片跟随应用主题：暗色是夜里那张，亮色是纸面那张。 */
const skin = computed(() =>
  themeMode.value === 'light'
    ? {
        bg: ['#faf7f1', '#f2ece1'] as const,
        frame: 'rgba(150,99,26,0.45)',
        frameInner: 'rgba(32,26,51,0.16)',
        title: '#201a33',
        body: 'rgba(32,26,51,0.72)',
        muted: 'rgba(32,26,51,0.5)',
        accent: '#96631a',
        track: 'rgba(32,26,51,0.12)',
        panel: 'rgba(32,26,51,0.04)',
      }
    : {
        bg: ['#0b0818', '#181130'] as const,
        frame: 'rgba(232,201,138,0.5)',
        frameInner: 'rgba(207,200,238,0.18)',
        title: '#f6f3ff',
        body: 'rgba(233,229,250,0.86)',
        muted: 'rgba(207,200,238,0.62)',
        accent: '#e8c98a',
        track: 'rgba(207,200,238,0.18)',
        panel: 'rgba(255,255,255,0.05)',
      },
)

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    if (ctx.measureText(line + char).width > maxWidth) {
      lines.push(line)
      line = char
    } else line += char
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function draw(): void {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const { w, h } = size.value
  const s = skin.value
  const pad = w * 0.11
  const contentWidth = w - pad * 2

  // 底色
  const bg = ctx.createLinearGradient(0, 0, w * 0.5, h)
  bg.addColorStop(0, s.bg[0])
  bg.addColorStop(1, s.bg[1])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const glow = ctx.createRadialGradient(w / 2, h * 0.3, 20, w / 2, h * 0.3, w * 0.85)
  glow.addColorStop(0, themeMode.value === 'light' ? 'rgba(150,99,26,0.10)' : 'rgba(232,201,138,0.16)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)

  // 双细框
  ctx.strokeStyle = s.frame
  ctx.lineWidth = 2
  ctx.strokeRect(pad * 0.45, pad * 0.45, w - pad * 0.9, h - pad * 0.9)
  ctx.strokeStyle = s.frameInner
  ctx.lineWidth = 1
  ctx.strokeRect(pad * 0.62, pad * 0.62, w - pad * 1.24, h - pad * 1.24)

  // 三段式：上 1/3 标题 + 主神格，中 1/3 四条进度，下 1/3 命题 + 落款。
  const zoneTop = pad * 0.62
  const zoneBottom = h - pad * 0.62
  const zone = (zoneBottom - zoneTop) / 3
  ctx.textAlign = 'center'

  // ── 第一段：称号 + 主神格 ──
  const titleFont = Math.round(w * 0.075)
  const titleLine = w * 0.09
  ctx.font = `bold ${titleFont}px ${SERIF}`
  const titleLines = wrap(ctx, props.data.title, contentWidth)
  const labelFont = Math.round(w * 0.026)
  const nameFont = Math.round(w * 0.062)
  const noteFont = Math.round(w * 0.03)
  const block1 = titleLines.length * titleLine + w * 0.03 + labelFont * 1.5 + nameFont * 1.25 + noteFont * 1.7
  // 结构上防止重叠：内容高于一段时按比例缩小字体
  const fit1 = block1 > zone ? zone / block1 : 1

  let y = zoneTop + (zone - block1 * fit1) / 2
  ctx.fillStyle = s.title
  ctx.font = `bold ${Math.round(titleFont * fit1)}px ${SERIF}`
  for (const line of titleLines) {
    y += titleLine * fit1
    ctx.fillText(line, w / 2, y)
  }
  y += w * 0.03 + labelFont * 1.5
  ctx.fillStyle = s.accent
  ctx.font = `bold ${Math.round(nameFont * fit1)}px ${SERIF}`
  ctx.fillText(props.data.primary.name, w / 2, y - labelFont * 0.2)
  y += nameFont * 1.25
  ctx.fillStyle = s.body
  ctx.font = `${Math.round(noteFont * fit1)}px ${SERIF}`
  ctx.fillText(props.data.primary.archetype, w / 2, y + noteFont)

  // ── 第二段：四条角色进度条 ──
  const barHeight = w * 0.02
  const rowGap = zone / 4
  let barY = zoneTop + zone + rowGap * 0.35
  for (const role of props.data.roles) {
    ctx.textAlign = 'left'
    ctx.fillStyle = s.body
    ctx.font = `${Math.round(w * 0.03)}px ${SERIF}`
    ctx.fillText(`${role.label} · ${role.name}`, pad, barY)

    ctx.textAlign = 'right'
    ctx.fillStyle = s.muted
    ctx.font = `${Math.round(w * 0.028)}px ${SERIF}`
    ctx.fillText(role.strengthText, w - pad, barY)

    const trackY = barY + w * 0.022
    ctx.fillStyle = s.track
    roundRect(ctx, pad, trackY, contentWidth, barHeight, barHeight / 2)
    ctx.fill()

    const filled = Math.max(barHeight, contentWidth * Math.max(0, Math.min(1, role.strength)))
    const grad = ctx.createLinearGradient(pad, 0, pad + filled, 0)
    grad.addColorStop(0, role.color)
    grad.addColorStop(1, themeMode.value === 'light' ? role.color : `${role.color}cc`)
    ctx.fillStyle = grad
    roundRect(ctx, pad, trackY, filled, barHeight, barHeight / 2)
    ctx.fill()

    barY += rowGap
  }

  // ── 第三段：核心命题 + 落款 ──
  ctx.textAlign = 'center'
  ctx.fillStyle = s.panel
  const quoteFont = Math.round(w * 0.033)
  const quoteLines = (() => {
    ctx.font = `${quoteFont}px ${SERIF}`
    return wrap(ctx, props.data.thesis, contentWidth - w * 0.08)
  })()
  const panelHeight = quoteLines.length * quoteFont * 1.6 + w * 0.075
  const footerBlock = w * 0.085
  const block3 = panelHeight + footerBlock
  const zone3Top = zoneTop + zone * 2
  const panelY = zone3Top + Math.max(0, (zone - block3) / 2)
  roundRect(ctx, pad, panelY, contentWidth, panelHeight, w * 0.03)
  ctx.fill()

  ctx.fillStyle = s.body
  ctx.font = `${quoteFont}px ${SERIF}`
  quoteLines.forEach((line, index) =>
    ctx.fillText(line, w / 2, panelY + w * 0.085 + index * quoteFont * 1.6),
  )

  // 落款（品牌只留在这里）
  ctx.fillStyle = s.accent
  ctx.font = `${Math.round(w * 0.024)}px ${SERIF}`
  ctx.fillText('P A N T H E O N   ·   万 神 殿', w / 2, panelY + panelHeight + w * 0.035)
  ctx.fillStyle = s.muted
  ctx.font = `${Math.round(w * 0.022)}px ${SERIF}`
  ctx.fillText('你的灵魂不是一种人格。它是一座万神殿。', w / 2, panelY + panelHeight + w * 0.072)

  preview.value = canvas.value!.toDataURL('image/png')
}

function download(): void {
  const link = document.createElement('a')
  link.download = `pantheon-${props.data.primary.name}-${ratio.value.replace(':', 'x')}.png`
  link.href = preview.value
  link.click()
}

onMounted(draw)
watch(() => props.data, draw, { deep: true })
watch([ratio, themeMode], () => {
  preview.value = ''
  requestAnimationFrame(draw)
})
</script>

<template>
  <div class="flex flex-col items-center gap-5">
    <canvas ref="canvas" :width="size.w" :height="size.h" class="hidden" />
    <img
      :src="preview"
      alt="神格分享卡"
      class="mx-auto w-full max-w-sm rounded-2xl shadow-2xl"
      style="border: 1px solid var(--line)"
    />
    <div class="flex flex-wrap items-center justify-center gap-4">
      <button class="btn-strong" @click="download">保存分享卡</button>
      <div class="flex gap-2 text-[0.85rem]">
        <button
          v-for="(option, key) in RATIOS"
          :key="key"
          class="rounded-full px-4 py-1.5 transition"
          :style="{
            border: `1px solid ${ratio === key ? 'var(--accent)' : 'var(--line)'}`,
            color: ratio === key ? 'var(--accent)' : 'var(--text-muted)',
          }"
          :aria-pressed="ratio === key"
          @click="ratio = key as RatioKey"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  </div>
</template>
