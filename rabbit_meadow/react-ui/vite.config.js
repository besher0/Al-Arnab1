import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dns from 'node:dns'

dns.setDefaultResultOrder('verbatim')

const devPort = Number(process.env.VITE_DEV_PORT || 5173)
const devHost = String(process.env.VITE_DEV_HOST || '127.0.0.1')
const hmrHost = String(
  process.env.VITE_HMR_HOST || (devHost === '0.0.0.0' ? 'localhost' : devHost),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: devHost,
    port: devPort,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: hmrHost,
      port: devPort,
      clientPort: devPort,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
