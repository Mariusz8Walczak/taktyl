import { defineConfig } from "tsup";

// API-001: pakiety workspace (@taktyl/*) sa ESM budowane pod Bundler (importy bez rozszerzen), wiec Node
// nie zaladuje ich wprost. Budujemy bundle ESM: kod wlasny i @taktyl/* wchodza do dist, reszta zaleznosci
// zostaje zewnetrzna (node_modules w obrazie). Drugie wejscie to seed, uruchamiany w obrazie bez tsx.
export default defineConfig({
  entry: { main: "src/main.ts", seed: "prisma/seed/index.ts" },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  noExternal: [/^@taktyl\//],
});
