import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    strictPort: true,
    proxy: {
      // 부르는 서버마다 경로 하나. 확인용 서버에 붙일 때는 <서버>_URL (verify-local)
      '/api/notes': {
        target: process.env.NOTES_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/templates': {
        target: process.env.TEMPLATES_URL ?? 'http://127.0.0.1:8003',
        changeOrigin: true,
      },
    },
  },
})
