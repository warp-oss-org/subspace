import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
    },
  },
})
