import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/widgets': 'http://localhost:8080',
      '/about.json': 'http://localhost:8080',
      '/journal': 'http://localhost:8080',
      '/helpdesk': 'http://localhost:8080',
      '/assistant': 'http://localhost:8080',
      '/brief': 'http://localhost:8080',
      '/services': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
    },
  },
})
