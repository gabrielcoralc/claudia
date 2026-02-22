import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/__tests__/**/*.test.ts', 'src/renderer/src/__tests__/**/*.test.ts'],
    globals: true,
    // Electron is not available in test env — mocked per-test
    // better-sqlite3 is run in-process (native Node.js)
  }
})
