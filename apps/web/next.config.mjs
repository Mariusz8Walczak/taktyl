// I-001 / TAKTYL-23: output standalone (ADR-0009); outputFileTracingRoot na korzen monorepo, zeby standalone
// zawieral pakiety workspace. Pakiety workspace (dist bez rozszerzen w importach) kompiluje Next.
// F-244: X-Robots-Tag takze z aplikacji (proxy ustawia go dodatkowo, regula 10).
import process from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCsp } from "./csp.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: join(here, "../.."),
  // I-012 (TAKTYL-84, docs/12 par. 4): mniej, wiekszych plikow JS w pierwszym widoku. Turbopack domyslnie dzieli kod
  // na ok. 11 malych chunkow; przy HTTP/1.1 (6 polaczen na host, tak liczy to model Lighthouse) kazdy dodatkowy plik
  // to kolejna fala zadan. Limit chunkow na grupe zbija je do 7 (-3,5 kB gzip, mniej narzutu runtime). Tresc kodu
  // bez zmian.
  experimental: {
    turbopackChunking: { maxChunkCountPerGroup: 1, minChunkSize: 100000, maxMergeChunkSize: 1000000 },
  },
  transpilePackages: ["@taktyl/ui", "@taktyl/contracts", "@taktyl/domain", "@taktyl/tokens"],
  async headers() {
    // TAKTYL-70 (SEC-04): CSP tylko w produkcji (dev: HMR wymaga eval i websocketow).
    const csp =
      process.env.NODE_ENV === "production"
        ? [
            {
              key: "Content-Security-Policy",
              value: buildCsp({ gtm: Boolean(process.env.PUBLIC_GTM_ID) }),
            },
          ]
        : [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, ...csp],
      },
    ];
  },
};

export default nextConfig;
