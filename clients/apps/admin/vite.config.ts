import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5281,
    strictPort: true,
    proxy: {
      // 부르는 서버마다 경로 하나. 확인용 서버에 붙일 때는 <서버>_URL (verify-local)
      '/api/tags': {
        target: process.env.TAGS_URL ?? 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
      '/api/activity': {
        target: process.env.ACTIVITY_URL ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/api/templates': {
        target: process.env.TEMPLATES_URL ?? 'http://127.0.0.1:8003',
        changeOrigin: true,
      },
    },
  },
})
