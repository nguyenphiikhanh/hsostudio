import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: { watch: { ignored: ['**/public/game/**'] } },
  plugins: [
    vue(),
    tailwindcss(),
  ],
})
