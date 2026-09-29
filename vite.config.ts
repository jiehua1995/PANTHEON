import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // './' keeps assets, data fetches and the hash router working under
  // https://user.github.io/<repo>/ without hardcoding the repo name.
  base: './',
  plugins: [vue(), tailwindcss()],
  build: {
    // 默认输出到 site/；要按 GitHub Pages 的「分支 + /docs」方式部署时用
    // PANTHEON_OUT=docs npm run build
    outDir: process.env.PANTHEON_OUT ?? 'site',
    emptyOutDir: true,
  },
})
