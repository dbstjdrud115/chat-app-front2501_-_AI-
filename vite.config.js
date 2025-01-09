import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  define: {global: {},}, //html시절 SockJs쓰려고 설치했다가 개판나서 검색해 설정함.
  plugins: [react()],
})


