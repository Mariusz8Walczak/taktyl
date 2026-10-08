// I-001 / TAKTYL-50: output standalone (ADR-0009); outputFileTracingRoot na korzen monorepo, zeby standalone zawieral
// pakiety workspace. Pakiety workspace (dist bez rozszerzen w importach) kompiluje Next. Backpanel: X-Robots-Tag takze
// z aplikacji (proxy Caddy ustawia go dodatkowo), brak buforowania stron panelu.
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
  transpilePackages: ["@taktyl/ui", "@taktyl/contracts", "@taktyl/domain", "@taktyl/tokens"],
  // Adres sklepu do odnosnikow "Zobacz w sklepie" (wartosc publiczna, nie sekret) trafia do bundla klienta.
  env: { PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? "http://taktyl.localhost" },
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
          // TAKTYL-70 (SEC-04): CSP tylko w produkcji (dev: HMR wymaga eval i websocketow).
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Content-Security-Policy",
                  value: buildCsp({
                    siteUrl: process.env.PUBLIC_SITE_URL ?? "http://taktyl.localhost",
                  }),
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
