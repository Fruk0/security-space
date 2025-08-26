import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    coverage: { reporter: ['text', 'html'] },
    include: ['**/__tests__/**/*.test.ts?(x)'],
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
})

