import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import gameAssetsPlugin from './scripts/vite-game-assets.mjs'

// https://vite.dev/config/
export default defineConfig({
  server: { watch: { ignored: ['**/public/game/**'] } },
  plugins: [
    gameAssetsPlugin(),
    vue(),
    tailwindcss(),
  ],
})
