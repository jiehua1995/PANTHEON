import { computed, ref } from 'vue'

export type ThemeMode = 'dark' | 'light'
export type RoleKey = 'you' | 'primary' | 'secondary' | 'shadow' | 'hidden'

export interface Palette {
  ink: string
  text: string
  textSoft: string
  textMuted: string
  grid: string
  faint: string
  roles: Record<RoleKey, string>
  /** 「你」在对比图里的专属颜色：不能和任何角色同色，否则两条线分不开 */
  you: string
  /** 雷达图面积渐变的起止色 */
  area: [string, string]
}

const DARK: Palette = {
  ink: '#08070c',
  text: '#f4f1ff',
  textSoft: 'rgba(233,229,250,0.86)',
  textMuted: 'rgba(207,200,238,0.62)',
  grid: 'rgba(207,200,238,0.16)',
  faint: 'rgba(207,200,238,0.34)',
  roles: { you: '#e8c98a', primary: '#e8c98a', secondary: '#b9a7f0', shadow: '#8d7fb8', hidden: '#5fc9b6' },
  you: '#f4f1ff',
  area: ['rgba(232,201,138,0.34)', 'rgba(232,201,138,0.02)'],
}

const LIGHT: Palette = {
  ink: '#f7f4ee',
  text: '#201a33',
  textSoft: 'rgba(32,26,51,0.84)',
  textMuted: 'rgba(32,26,51,0.58)',
  grid: 'rgba(32,26,51,0.16)',
  faint: 'rgba(32,26,51,0.28)',
  roles: { you: '#a9711b', primary: '#a9711b', secondary: '#5b43b5', shadow: '#5f5486', hidden: '#0f7d70' },
  you: '#201a33',
  area: ['rgba(169,113,27,0.26)', 'rgba(169,113,27,0.02)'],
}

const STORAGE_KEY = 'pantheon.theme.v1'
const mode = ref<ThemeMode>('dark')

export const themeMode = computed(() => mode.value)
export const palette = computed<Palette>(() => (mode.value === 'light' ? LIGHT : DARK))

export function setThemeMode(next: ThemeMode): void {
  mode.value = next
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = next
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* 隐私模式下写不进去，忽略 */
    }
  }
}

export function toggleTheme(): void {
  setThemeMode(mode.value === 'dark' ? 'light' : 'dark')
}

/** 首次加载：优先本机存过的偏好，否则跟随系统。 */
export function initTheme(): void {
  if (typeof document === 'undefined') return
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    saved = null
  }
  const prefersLight =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)').matches : false
  setThemeMode(saved === 'light' || saved === 'dark' ? saved : prefersLight ? 'light' : 'dark')
}
