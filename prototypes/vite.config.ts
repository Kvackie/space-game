import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const page = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// One page per stack so each gets its own bundle and can be measured alone.
export default defineConfig({
  base: './',
  server: { port: 5180 },
  build: {
    manifest: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      input: {
        index: page('index.html'),
        three: page('three/index.html'),
        babylon: page('babylon/index.html'),
        'phaser-three': page('phaser-three/index.html'),
      },
    },
  },
})
