import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Served from https://tatuafumbo.com/ (GitHub Pages on a custom domain — see
// public/CNAME) and from / during local `vite dev`, so the base path is the
// root in both cases. If the site ever moves back to a github.io sub-path,
// `base` must become '/changamoto/' again or every asset URL 404s.
//
// Two separate entry points / HTML pages:
//   • index.html — the public game (src/main.tsx)
//   • admin.html — the internal analytics dashboard (src/admin.tsx). Its own
//     bundle, not linked from the game; reach it at <site>/admin.html.
export default defineConfig(() => ({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
}))
