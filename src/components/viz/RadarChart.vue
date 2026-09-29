<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart as EChartsRadar } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { palette } from '../../theme'

echarts.use([EChartsRadar, LegendComponent, TooltipComponent, SVGRenderer])

interface DimDef {
  id: string
  zh: string
}
interface Series {
  name: string
  values: number[]
  color: string
}

const props = defineProps<{ dims: DimDef[]; series: Series[] }>()
const el = ref<HTMLElement>()
let chart: ReturnType<typeof echarts.init> | null = null

/** -1..1 → 0..100 so both poles are visible on the same axis. */
const scale = (values: number[]) => values.map((v) => Math.round((v + 1) * 50))

/** #rrggbb → 带透明度的同色，让面积填充跟着折线走，而不是永远用金色 */
function fade(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color
}

function render(): void {
  if (!chart) return
  const p = palette.value
  // 16 维时标签会互相压住：缩小轴名、收窄半径、把画布加高
  const many = props.dims.length > 10
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {},
    legend: {
      bottom: 0,
      textStyle: { color: p.textMuted, fontSize: 13 },
      data: props.series.map((s) => s.name),
    },
    radar: {
      indicator: props.dims.map((d) => ({ name: d.zh, max: 100, min: 0 })),
      radius: many ? '52%' : '62%',
      splitNumber: 4,
      axisName: { color: p.textSoft, fontSize: many ? 11 : 13, lineHeight: many ? 15 : 16 },
      splitLine: { lineStyle: { color: p.grid } },
      splitArea: { areaStyle: { color: ['rgba(207,200,238,0.02)', 'transparent'] } },
      axisLine: { lineStyle: { color: p.grid } },
    },
    series: [
      {
        type: 'radar',
        symbolSize: 4,
        data: props.series.map((s) => ({
          name: s.name,
          value: scale(s.values),
          lineStyle: { color: s.color, width: 2 },
          itemStyle: { color: s.color },
          areaStyle: {
            color: {
              type: 'radial',
              x: 0.5,
              y: 0.5,
              r: 0.85,
              colorStops: [
                { offset: 0, color: fade(s.color, '40') },
                { offset: 1, color: fade(s.color, '06') },
              ],
            },
            opacity: 1,
          },
        })),
      },
    ],
  })
}

onMounted(() => {
  chart = echarts.init(el.value!, null, { renderer: 'svg' })
  render()
  addEventListener('resize', render)
})
onBeforeUnmount(() => {
  removeEventListener('resize', render)
  chart?.dispose()
})
watch(() => props.series, render, { deep: true })
// ECharts 把颜色写进 SVG，主题切换不会自动跟随 CSS 变量，必须重画
watch(palette, render)
</script>

<template>
  <figure>
    <div ref="el" class="w-full" :class="dims.length > 10 ? 'h-[26rem] sm:h-[30rem]' : 'h-80'" />
    <figcaption class="sr-only">
      <p v-for="dim in dims" :key="dim.id">{{ dim.zh }}：{{ series.map((s) => `${s.name} ${s.values[dims.indexOf(dim)].toFixed(2)}`).join('，') }}</p>
    </figcaption>
  </figure>
</template>
