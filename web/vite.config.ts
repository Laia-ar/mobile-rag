import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// All presentation resources are bundled. The WebView never fetches the UI.
export default defineConfig({
  base: '/',
  plugins: [react(), {
    name: 'bundled-palmera-assets',
    resolveId(id) { if (id === 'virtual:palmera-assets') return '\0palmera-assets' },
    load(id) {
      if (id !== '\0palmera-assets') return
      const publicDir = path.resolve(__dirname, 'public')
      const assets: Record<string, string> = {}
      const mime: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }
      const visit = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name)
          if (entry.isDirectory()) visit(file)
          else if (mime[path.extname(file)]) assets[path.relative(publicDir, file).split(path.sep).join('/')] = `data:${mime[path.extname(file)]};base64,${fs.readFileSync(file).toString('base64')}`
        }
      }
      visit(publicDir)
      return `export default ${JSON.stringify(assets)}`
    },
  }],
  build: { target: 'esnext', rollupOptions: { output: { inlineDynamicImports: true } } },
})
