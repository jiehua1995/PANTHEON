import { ref } from 'vue'

export type Route = '' | 'test' | 'result' | 'about'

const parse = (): Route => {
  if (typeof location === 'undefined') return ''
  const raw = location.hash.replace(/^#\/?/, '')
  return (['test', 'result', 'about'].includes(raw) ? raw : '') as Route
}

export const route = ref<Route>(parse())

if (typeof addEventListener === 'function') {
  addEventListener('hashchange', () => {
    route.value = parse()
  })
}

export function navigate(to: Route): void {
  if (typeof location === 'undefined') {
    route.value = to
    return
  }
  location.hash = to ? `#/${to}` : '#/'
  route.value = to
  if (typeof scrollTo === 'function') scrollTo({ top: 0 })
}
