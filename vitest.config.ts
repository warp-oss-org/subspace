import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    passWithNoTests: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    exclude: ["**/dist/**", "**/node_modules/**"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*tests*/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/dist/**",
        "**/node_modules/**",
      ],
    },
  },
})
