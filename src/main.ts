import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { initStore } from './store'
import { initTheme } from './theme'

initTheme()
initStore()
createApp(App).mount('#app')
