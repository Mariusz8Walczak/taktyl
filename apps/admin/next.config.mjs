// I-001: tymczasowy szkielet. output standalone (ADR-0009); outputFileTracingRoot na korzen monorepo,
// zeby standalone zawieral pakiety workspace. Naglowki bezpieczenstwa i noindex ustawia proxy (I-004).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: join(here, "../.."),
};

export default nextConfig;
