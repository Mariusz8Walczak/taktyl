import { defineConfig } from "vitest/config";

export default defineConfig({
  // I-008 (TAKTYL-75): Vitest 5 / Vite 8 transformuje JSX przez oxc (opcja esbuild jest ignorowana).
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    testTimeout: 20_000, // TAKTYL-68: axe w jsdom pod obciazeniem potrafi przekroczyc domyslne 5 s
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
