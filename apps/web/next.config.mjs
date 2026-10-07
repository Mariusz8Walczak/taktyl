// I-001 / TAKTYL-23: output standalone (ADR-0009); outputFileTracingRoot na korzen monorepo, zeby standalone
// zawieral pakiety workspace. Pakiety workspace (dist bez rozszerzen w importach) kompiluje Next.
// F-244: X-Robots-Tag takze z aplikacji (proxy ustawia go dodatkowo, regula 10).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true }, // lint to osobny job (I-006)
  outputFileTracingRoot: join(here, "../.."),
  transpilePackages: ["@taktyl/ui", "@taktyl/contracts", "@taktyl/domain", "@taktyl/tokens"],
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
