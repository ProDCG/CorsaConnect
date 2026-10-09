import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, '')
            },
            '/stream': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            },
            '^/(rigs|groups|server|settings|catalogs|carpool|mappool|presets|branding|telem_config|sync|command|leaderboard|lobby|drivers|mumble)': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
            }
        }
    }
})
