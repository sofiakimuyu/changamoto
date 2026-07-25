import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Served from https://<user>.github.io/changamoto/ in production (GitHub Pages),
// and from / during local `vite dev`. Adjust `base` to match the deploy path.
//
// Two separate entry points / HTML pages:
//   • index.html — the public game (src/main.tsx)
//   • admin.html — the internal analytics dashboard (src/admin.tsx). Its own
//     bundle, not linked from the game; reach it at <site>/admin.html.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/changamoto/' : '/',
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
