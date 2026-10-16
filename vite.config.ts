import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // 便于用手机在同一局域网访问，测移动端竖屏
    port: 5173,
  },
  build: {
    // 演示包体积不重要，优先保证可读的报错与稳定的产物
    sourcemap: true,
  },
})
