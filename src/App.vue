<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { route, navigate } from './router'
import { store } from './store'
import { themeMode, toggleTheme } from './theme'
import RitualHome from './components/RitualHome.vue'
import TestFlow from './components/TestFlow.vue'
import ReadingRitual from './components/ReadingRitual.vue'
import AboutView from './components/AboutView.vue'

// Result page pulls in ECharts; keep it off the critical path of the test flow.
const ResultView = defineAsyncComponent(() => import('./components/ResultView.vue'))
</script>

<template>
  <div class="min-h-screen" style="background: var(--bg); color: var(--text)">
    <header class="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 text-[0.7rem] tracking-[0.35em]">
      <button class="muted transition hover:text-[var(--accent)]" @click="navigate('')">PANTHEON</button>
      <div class="flex items-center gap-6">
        <button class="tracking-normal muted transition hover:text-[var(--accent)]" @click="navigate('about')">关于</button>
        <button
          class="tracking-normal muted transition hover:text-[var(--accent)]"
          :aria-label="themeMode === 'dark' ? '切换到亮色主题' : '切换到暗色主题'"
          :title="themeMode === 'dark' ? '亮色' : '暗色'"
          @click="toggleTheme"
        >
          {{ themeMode === 'dark' ? '☀ 亮色' : '☾ 暗色' }}
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 pb-20">
      <RitualHome v-if="route === ''" @start="navigate('test')" />
      <TestFlow v-else-if="route === 'test'" @done="navigate('result')" />
      <ReadingRitual v-else-if="route === 'result' && store.reading" @done="store.reading = false" />
      <ResultView v-else-if="route === 'result'" @restart="navigate('test')" />
      <AboutView v-else />
    </main>

    <footer class="mx-auto max-w-3xl px-6 pb-12 text-[0.78rem] leading-7 muted">
      <p>答案只在你的设备中处理，不会上传服务器。结果由本地算法生成，不构成心理诊断。</p>
    </footer>
  </div>
</template>
