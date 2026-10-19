import { defineConfig } from 'vite'

// Tauri 가 이 개발 서버를 창에 띄운다 (tauri.conf.json 의 devUrl)
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
})
