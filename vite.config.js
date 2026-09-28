import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend serves self-signed HTTPS; secure:false skips chain verify
      // in dev only (real auth is token + PIN).
      '/api': { target: 'https://localhost:8080', secure: false },
    },
  },
})
