<script setup lang="ts">
import { computed, ref } from 'vue'
import { pantheonData, computeResult } from '../data'
import { buildReport } from '../engine/report-builder.ts'
import { relationText, relationType } from '../engine/relationships.ts'
import { store } from '../store'
import { buildExport } from '../answer-io'
import { palette, type RoleKey } from '../theme'
import RadarChart from './viz/RadarChart.vue'
import OrbitMap from './viz/OrbitMap.vue'
import GodWar from './viz/GodWar.vue'
import TensionMatrix from './viz/TensionMatrix.vue'
import AwakeningAxis from './viz/AwakeningAxis.vue'
import ConstellationMap from './viz/ConstellationMap.vue'
import ShareCard from './ShareCard.vue'

defineEmits<{ restart: [] }>()

const result = computed(() => store.result ?? computeResult(store.answers, store.scopeId || null))
const sections = computed(() => buildReport(result.value, pantheonData))
const sectionOf = (id: string) => sections.value.find((s) => s.id === id)

const deityOf = (id: string) => pantheonData.deities.find((d) => d.id === id)!
const primary = computed(() => deityOf(result.value.primary.deityId))
const secondary = computed(() => deityOf(result.value.secondary.deityId))
const shadow = computed(() => deityOf(result.value.shadow.deityId))
const hidden = computed(() => deityOf(result.value.hidden.deityId))
const color = (key: RoleKey) => palette.value.roles[key]

const fullMode = ref(false)
const coreDims = computed(() => pantheonData.dimensions.filter((d) => d.core))
const radarDims = computed(() => (fullMode.value ? pantheonData.dimensions : coreDims.value))
const valuesFor = (vector: Record<string, number>) => radarDims.value.map((d) => vector[d.id] ?? 0)
const dimName = (id: string) => pantheonData.dimensions.find((d) => d.id === id)?.zh ?? id

const youVsPrimary = computed(() => [
  { name: '你', values: valuesFor(result.value.vectors.overall), color: palette.value.you },
  { name: primary.value.name.zh, values: valuesFor(primary.value.vector), color: color('primary') },
])

const roles = computed(() =>
  (
    [
      ['主神格', 'primary', result.value.primary, primary.value, '来自你平时的选择'],
      ['副神格', 'secondary', result.value.secondary, secondary.value, '你实现主神格那种欲望的方式'],
      ['阴影神格', 'shadow', result.value.shadow, shadow.value, '来自你被威胁、失控时的反应'],
      ['隐藏神格', 'hidden', result.value.hidden, hidden.value, '来自你想过、但没活出来的那部分'],
    ] as const
  ).map(([label, key, match, deity, note]) => ({
    label,
    key: key as RoleKey,
    deity,
    note,
    strength: match.matchedSimilarity,
  })),
)

const trailing = computed(() => result.value.trailing.map((t) => deityOf(t.deityId).name.zh).join('、'))

const tension = computed(() => {
  const v = result.value.vectors.overall
  const poles = (id: string) => {
    const dim = pantheonData.dimensions.find((d) => d.id === id)!
    return { left: dim.negative.zh.split(' / ')[0], right: dim.positive.zh.split(' / ')[0] }
  }
  return ['power', 'order', 'reason', 'creation', 'time'].map((id) => ({ ...poles(id), value: v[id] ?? 0 }))
})

const awakeningSteps = computed(() =>
  (
    [
      ['dormant', '未觉醒'],
      ['awakened', '觉醒'],
      ['overawakened', '过度觉醒'],
      ['fallen', '堕化'],
    ] as const
  ).map(([key, label]) => ({ key, label, text: primary.value.states[key] })),
)

const orbitNodes = computed(() =>
  (
    [
      ['主神格', 'primary', primary.value, result.value.primary.matchedSimilarity],
      ['副神格', 'secondary', secondary.value, result.value.secondary.matchedSimilarity],
      ['阴影', 'shadow', shadow.value, result.value.shadow.matchedSimilarity],
      ['隐藏', 'hidden', hidden.value, result.value.hidden.matchedSimilarity],
    ] as const
  ).map(([role, key, deity, similarity]) => ({
    role,
    name: deity.name.zh,
    similarity: Math.max(0, similarity),
    relation: relationType(pantheonData, primary.value.id, deity.id) ?? 'unknown',
    color: color(key as RoleKey),
  })),
)

const cardData = computed(() => ({
  title: result.value.title,
  thesis: result.value.thesis,
  primary: {
    name: primary.value.name.zh,
    archetype: `${primary.value.archetype.core} · ${primary.value.archetype.theme}`,
  },
  roles: roles.value.map((r) => ({
    label: r.label,
    name: r.deity.name.zh,
    color: color(r.key),
    strength: r.strength,
    strengthText: strengthWord(r.strength),
  })),
}))

const nav = [
  { id: 'card-head', label: '谱系' },
  { id: 'card-strength', label: '匹配' },
  { id: 'card-radar', label: '图谱' },
  { id: 'card-primary', label: '主神格' },
  { id: 'card-conflict', label: '内战' },
  { id: 'card-awakening', label: '觉醒' },
  { id: 'card-share', label: '分享' },
]

function jumpTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function downloadAnswers(): void {
  const payload = buildExport(store.answers, result.value)
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `pantheon-answers-${payload.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const pct = (value: number) => `${clamp01((value + 1) / 2) * 100}%`
const signed = (value: number) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`
function barFill(value: number): Record<string, string> {
  const half = clamp01(Math.abs(value)) * 50
  return value >= 0
    ? { left: '50%', width: `${half}%`, background: 'var(--accent)', opacity: '0.75' }
    : { right: '50%', width: `${half}%`, background: 'var(--secondary)', opacity: '0.75' }
}

function strengthWord(value: number): string {
  if (value >= 0.6) return '强'
  if (value >= 0.35) return '中'
  if (value >= 0.15) return '偏弱'
  return '很弱'
}

const dimRow = (id: string) => {
  const dim = pantheonData.dimensions.find((d) => d.id === id)!
  return {
    zh: dim.zh,
    you: result.value.vectors.overall[id] ?? 0,
    negative: dim.negative.zh.split(' / ')[0],
    positive: dim.positive.zh.split(' / ')[0],
  }
}

const paragraphCards = ['primary', 'secondary', 'shadow', 'hidden', 'power-cost'] as const
</script>

<template>
  <nav
    class="sticky top-0 z-10 -mx-6 mb-6 flex gap-5 overflow-x-auto px-6 py-3 text-[0.85rem] backdrop-blur"
    style="background: color-mix(in srgb, var(--bg) 92%, transparent)"
    aria-label="结果页导航"
  >
    <button
      v-for="item in nav"
      :key="item.id"
      class="shrink-0 muted underline-offset-4 transition hover:text-[var(--accent)] hover:underline"
      @click="jumpTo(item.id)"
    >
      {{ item.label }}
    </button>
  </nav>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <!-- 谱系总览 -->
    <section id="card-head" class="card scroll-mt-20 md:col-span-2 xl:col-span-3">
      <p class="text-[0.72rem] tracking-[0.4em] accent">你的神格谱系</p>
      <h1 class="mt-3 text-[2rem] leading-[1.35] sm:text-[2.4rem]">{{ result.title }}</h1>
      <div class="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p class="text-[1.5rem]" :style="{ color: color('primary') }">{{ primary.name.zh }}</p>
        <p class="text-[0.95rem] muted">{{ primary.archetype.core }} · {{ primary.archetype.theme }}</p>
      </div>
      <p class="mt-4 text-[0.85rem] muted">
        测算范围：{{ result.scope ? result.scope.zh : '全部万神殿' }}
        <span v-if="result.scope"> · 只在{{ result.scope.zh }}体系内比较</span>
      </p>
      <div class="mt-5 flex flex-wrap gap-2.5 text-[0.92rem]">
        <span
          v-for="role in roles"
          :key="role.label"
          class="rounded-full px-4 py-1.5"
          :style="{ border: `1px solid ${color(role.key)}66`, background: 'var(--surface)' }"
        >
          {{ role.label }} · {{ role.deity.name.zh }}
        </span>
      </div>
      <p
        v-if="result.closeCall"
        class="mt-5 rounded-2xl px-5 py-4 text-[0.95rem] leading-[1.9]"
        style="border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 8%, transparent)"
      >
        <strong>你的谱系里有两股几乎同高的力量。</strong>
        {{ secondary.name.zh }}在你身上几乎和{{ primary.name.zh }}一样强。这不是「一个压过另一个」的结构：
        主神格决定你想要什么，副神格决定你用什么方式去拿。
      </p>
      <p class="mt-5 text-[0.78rem] muted">
        版本 test {{ result.versions.test }} · scoring {{ result.versions.scoring }} · deity
        {{ result.versions.deityDatabase }} · result {{ result.versions.result }}
      </p>
    </section>

    <!-- 匹配强度 -->
    <section id="card-strength" class="card scroll-mt-20">
      <h2 class="card-title">四股力量</h2>
      <ul class="mt-4 space-y-4">
        <li v-for="role in roles" :key="role.label" class="space-y-1.5">
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-[0.98rem]">
              <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: color(role.key) }" />
              <span class="ml-2">{{ role.label }} · {{ role.deity.name.zh }}</span>
            </p>
            <p class="shrink-0 text-[0.9rem] muted">{{ strengthWord(role.strength) }}</p>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full" style="background: var(--surface-strong)">
            <div
              class="h-2 rounded-full"
              :style="{ width: `${clamp01(role.strength) * 100}%`, background: color(role.key) }"
            />
          </div>
          <p class="text-[0.82rem] muted">{{ role.note }}</p>
        </li>
      </ul>
      <p v-if="trailing" class="mt-4 text-[0.85rem] muted">另外还有两位原型也离你不远：{{ trailing }}</p>
    </section>

    <!-- 多维人格 -->
    <section id="card-radar" class="card scroll-mt-20 md:col-span-2 xl:col-span-2">
      <div class="flex items-center justify-between gap-3">
        <h2 class="card-title">你的多维人格</h2>
        <button class="text-[0.82rem] muted underline" :aria-pressed="fullMode" @click="fullMode = !fullMode">
          {{ fullMode ? '只看核心 8 维' : '看完整 16 维' }}
        </button>
      </div>
      <RadarChart
        :dims="radarDims"
        :series="[{ name: '你', values: valuesFor(result.vectors.overall), color: palette.you }]"
      />
      <details class="text-[0.88rem] muted">
        <summary class="cursor-pointer underline-offset-4 hover:underline">查看具体数值</summary>
        <ul class="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <li v-for="dim in radarDims" :key="dim.id" class="space-y-1.5">
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-[0.92rem]" style="color: var(--text)">{{ dimRow(dim.id).zh }}</span>
              <span class="tabular-nums text-[0.92rem] accent">{{ signed(dimRow(dim.id).you) }}</span>
            </div>
            <div class="relative h-2.5 rounded-full" style="background: var(--surface-strong)">
              <div class="absolute inset-y-0 left-1/2 w-px" style="background: var(--line-strong)" />
              <div class="absolute inset-y-0 rounded-full" :style="barFill(dimRow(dim.id).you)" />
              <div class="absolute top-1/2 -translate-y-1/2" :style="{ left: pct(dimRow(dim.id).you) }">
                <div
                  class="h-3.5 w-3.5 -translate-x-1/2 rounded-full"
                  style="background: var(--accent); box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent)"
                />
              </div>
            </div>
            <div class="flex justify-between text-[0.76rem] muted">
              <span>{{ dimRow(dim.id).negative }}</span>
              <span>{{ dimRow(dim.id).positive }}</span>
            </div>
          </li>
        </ul>
        <p class="mt-4 text-[0.76rem] muted">中间那条竖线是中性点，读数是 −1（左极）到 +1（右极）。</p>
      </details>
    </section>

    <!-- 为什么是它 -->
    <section class="card md:col-span-2 xl:col-span-1">
      <h2 class="card-title">为什么是{{ primary.name.zh }}</h2>
      <RadarChart :dims="radarDims" :series="youVsPrimary" />
      <div class="mt-3 space-y-2 text-[0.92rem] leading-[1.85]">
        <p><span class="muted">最接近：</span>{{ result.closest.map((g) => dimName(g.id)).join('、') }}</p>
        <p><span class="muted">最大差异：</span>{{ result.diverging.map((g) => dimName(g.id)).join('、') }}</p>
      </div>
    </section>

    <!-- 内在神战 -->
    <section v-if="result.conflicts" id="card-conflict" class="card scroll-mt-20 md:col-span-2 xl:col-span-2">
      <h2 class="card-title">内在神战</h2>
      <div class="mt-4 space-y-4">
        <p v-for="(paragraph, i) in sectionOf('conflict')?.body ?? []" :key="i" class="text-[0.98rem] leading-[1.95] soft">
          {{ paragraph }}
        </p>
        <GodWar
          :a="deityOf(result.conflicts.a).name.zh"
          :b="deityOf(result.conflicts.b).name.zh"
          :axes="result.conflicts.axes"
        />
      </div>
    </section>

    <!-- 觉醒 -->
    <section id="card-awakening" class="card scroll-mt-20 md:col-span-2 xl:col-span-3">
      <h2 class="card-title">神格觉醒 · {{ primary.name.zh }}</h2>
      <div class="mt-4 space-y-3">
        <p v-for="(paragraph, i) in sectionOf('awakening')?.body ?? []" :key="i" class="text-[0.95rem] leading-[1.9] soft">
          {{ paragraph }}
        </p>
      </div>
      <AwakeningAxis class="mt-5" :state="result.awakening.state" :steps="awakeningSteps" />
    </section>

    <!-- 人格张力 + 人格星图：并排各占一半 -->
    <div class="grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-3">
      <section class="card">
        <h2 class="card-title">人格张力</h2>
        <div class="mt-5">
          <TensionMatrix :items="tension" />
        </div>
      </section>
      <section class="card">
        <h2 class="card-title">人格星图</h2>
        <ConstellationMap class="mt-3" :vector="result.vectors.overall" :dimensions="pantheonData.dimensions" />
      </section>
    </div>

    <!-- 神格轨道：全宽 -->
    <section class="card md:col-span-2 xl:col-span-3">
      <h2 class="card-title">神格轨道</h2>
      <div class="mt-3 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <OrbitMap :nodes="orbitNodes" />
        <p class="text-[0.92rem] leading-[1.95] muted">
          实线＝协同，虚线＝张力。距离表示你与那个原型的接近程度，圆点越大越接近。
          {{ relationText(pantheonData, primary.id, secondary.id) }}
        </p>
      </div>
    </section>

    <!-- 五段长文：都是全宽 -->
    <section
      v-for="id in paragraphCards"
      :key="id"
      :id="id === 'primary' ? 'card-primary' : undefined"
      class="card scroll-mt-20 md:col-span-2 xl:col-span-3"
    >
      <h2 class="card-title">{{ sectionOf(id)?.heading }}</h2>
      <div class="mt-4 space-y-3.5">
        <p v-for="(paragraph, i) in sectionOf(id)?.body ?? []" :key="i" class="text-[0.98rem] leading-[1.95] soft">
          {{ paragraph }}
        </p>
      </div>
    </section>

    <!-- 分享卡 -->
    <section id="card-share" class="card scroll-mt-20 md:col-span-2 xl:col-span-2">
      <h2 class="card-title">分享卡</h2>
      <div class="mt-4">
        <ShareCard :data="cardData" />
      </div>
    </section>

    <!-- 操作 -->
    <section class="card flex flex-col justify-center gap-4">
      <h2 class="card-title">接下来</h2>
      <button class="btn w-full" @click="$emit('restart')">再测一次</button>
      <button class="btn w-full" @click="downloadAnswers">导出我的答案</button>
      <p class="text-[0.78rem] leading-6 muted">
        同版本 + 同答案 ⇒ 同结果（hash {{ result.hash }}）。
      </p>
    </section>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 1.25rem;
  padding: 1.5rem;
  display: block;
}
.card-title {
  font-size: 0.74rem;
  letter-spacing: 0.25em;
  color: var(--text-muted);
}
</style>
