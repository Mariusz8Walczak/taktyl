// Audyt regula 2 (TAKTYL-9): kolory wpisane wprost poza plikiem tokenow.
// Szuka #[0-9a-fA-F]{3,8} i rgb( w apps/** i packages/** (bez node_modules, dist, .next, .turbo, coverage).
// Wyjatki: packages/tokens/css/tokens.css oraz pliki graficzne SVG od wlasciciela w apps/web/public/ (logo, favicon:
// to grafika, nie stylowanie; docs/09 §7, DESIGN-072). Kod wyjscia 1 przy trafieniu.
// Uzycie: node scripts/audit-tokens.mjs [katalog-glowny]   (domyslnie: korzen repo)
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
const SKIP_DIRS = new Set(["node_modules", "dist", ".next", ".turbo", "coverage", ".git"]);
const EXT = /\.(css|scss|sass|less|ts|tsx|mts|cts|js|jsx|mjs|cjs|html|svg|json|md|mdx)$/i;
const ALLOWED = join("packages", "tokens", "css", "tokens.css");
const GRAPHICS_DIR = join("apps", "web", "public") + sep;
// Zewnetrzny dekoder Draco (three.js, MIT) w apps/web/public/3d/draco: kod cudzy, nie stylowanie (ADR-0011).
const VENDOR_DIR = join("apps", "web", "public", "3d", "draco") + sep;
// Hex: '#' nie moze byc czescia encji HTML (&#106;) ani wnetrzem tokenu (a#fff) - I-007.
const PATTERNS = [/(?<![&\w])#[0-9a-fA-F]{3,8}\b/, /rgb\(/i];

const hits = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name));
    } else if (EXT.test(e.name)) {
      const rel = relative(root, join(dir, e.name));
      if (rel === ALLOWED) continue;
      if (rel.startsWith(GRAPHICS_DIR) && /\.svg$/i.test(e.name)) continue;
      if (rel.startsWith(VENDOR_DIR)) continue;
      readFileSync(join(dir, e.name), "utf8")
        .split(/\r?\n/)
        .forEach((line, i) => {
          if (PATTERNS.some((p) => p.test(line))) hits.push(`${rel.split(sep).join("/")}:${i + 1}: ${line.trim()}`);
        });
    }
  }
}
for (const top of ["apps", "packages"]) {
  try {
    walk(join(root, top));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

if (hits.length) {
  console.error(`audit:tokens - ${hits.length} trafien poza plikiem tokenow (regula 2):`);
  for (const h of hits) console.error("  " + h);
  process.exit(1);
}
console.log("audit:tokens - 0 trafien");
