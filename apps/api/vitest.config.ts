import { defineConfig } from "vitest/config";

// Testy integracyjne (*.int.test.ts) dzielą jedną bazę, więc pliki idą po kolei.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts", "test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
