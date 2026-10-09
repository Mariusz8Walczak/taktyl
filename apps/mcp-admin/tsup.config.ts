import { defineConfig } from "tsup";

// I-014: pakiety workspace (@taktyl/*) sa ESM pod Bundler (importy bez rozszerzen), wiec wchodza do bundla (jak w apps/api);
// reszta zaleznosci (SDK MCP, zod) zostaje zewnetrzna.
export default defineConfig({
  entry: { main: "src/main.ts" },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@taktyl\//],
});
