import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/** Matches production (vercel.json): `/` → marketing `home.html`, `/app` → SPA shell */
function marketingHomeAtRoot() {
  return {
    name: 'marketing-home-at-root',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const raw = req.url ?? ''
        const pathOnly = raw.split('?')[0] ?? ''
        const qs = raw.includes('?') ? `?${raw.split('?').slice(1).join('?')}` : ''
        if (pathOnly === '/app' || pathOnly.startsWith('/app/')) {
          req.url = `/app.html${qs}`
          return next()
        }
        if (pathOnly === '/' || pathOnly === '/index.html') {
          req.url = `/home.html${qs}`
          return next()
        }
        if (pathOnly === '/students' || pathOnly === '/students/') {
          const tail = qs && qs !== '?' ? `&${qs.slice(1)}` : ''
          req.url = `/home.html?audience=student${tail}`
          return next()
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [marketingHomeAtRoot(), react()],
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'app.html'),
    },
  },
})
