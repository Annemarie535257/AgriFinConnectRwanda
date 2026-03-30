import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEV_API_PROXY_TARGET = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: DEV_API_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
