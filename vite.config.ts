import { defineConfig } from 'vitest/config'

export default defineConfig({
  // relative base so the build works under the GitHub Pages project path
  base: './',
  server: { port: 5190 },
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 3000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
