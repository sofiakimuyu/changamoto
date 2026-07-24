import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://<user>.github.io/changamoto/ in production (GitHub Pages),
// and from / during local `vite dev`. Adjust `base` to match the deploy path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/changamoto/' : '/',
  plugins: [react()],
}))
