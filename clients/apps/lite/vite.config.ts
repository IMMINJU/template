import { defineConfig } from 'vite'

// 5173은 다른 프로젝트와 겹치기 쉬워 고정 포트 사용
export default defineConfig({
  server: {
    port: 5283,
    strictPort: true,
    proxy: {
      // 부르는 서버마다 경로 하나. 확인용 서버에 붙일 때는 <서버>_URL (verify-local)
      '/api/notes': {
        target: process.env.NOTES_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
