import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// Writes the real base path into dist/404.html after the build.
function base404() {
  let base = '/'
  return {
    name: 'base-404',
    configResolved(config) { base = config.base },
    closeBundle() {
      if (!existsSync('dist/404.html')) return
      const html = readFileSync('dist/404.html', 'utf8')
      writeFileSync('dist/404.html', html.replace('__BASE__', base))
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), base404()],
  base: command === 'serve' ? '/' : (process.env.VITE_BASE || '/'),
}))