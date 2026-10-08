import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Read only the public API URL from the repository's PowerShell-style .env.
// AWS credentials stay on the server side and are never exposed to Vite.
if (process.env.VITE_API_BASE_URL === undefined) {
  try {
    const repositoryEnv = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../.env'), 'utf8')
    const match = repositoryEnv.match(/^\s*\$env:VITE_API_BASE_URL\s*=\s*(["'])(.*?)\1\s*$/im)
    if (match?.[2]) process.env.VITE_API_BASE_URL = match[2]
  } catch {
    // A root .env is optional; Vite can still use the local backend proxy.
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
