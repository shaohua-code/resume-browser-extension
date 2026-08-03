import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Manifest 引用固定文件名，构建时保留 sidepanel.html 作为扩展侧边栏入口。
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: { sidepanel: 'sidepanel.html' } },
  },
  server: {
    port: 5175,
    host:'0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    '/uploads': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
})
