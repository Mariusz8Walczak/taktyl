// Synchronizacja zrodla prawdy (assets/) do packages/tokens (TAKTYL-9, decyzja D-005).
// Uzycie: node scripts/sync-tokens.mjs          - kopiuje assets/tokens.css i fonty
//         node scripts/sync-tokens.mjs --check  - tylko sprawdza zgodnosc bajtowa (kod 1 przy rozjezdzie)
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = join(root, "packages", "tokens");
const pairs = [[join(root, "assets", "tokens.css"), join(pkg, "css", "tokens.css")]];
for (const f of readdirSync(join(root, "assets", "fonts"))) {
  pairs.push([join(root, "assets", "fonts", f), join(pkg, "assets", "fonts", f)]);
}

const check = process.argv.includes("--check");
let bad = 0;
for (const [src, dst] of pairs) {
  const same = existsSync(dst) && readFileSync(src).equals(readFileSync(dst));
  if (check) {
    if (!same) {
      bad++;
      console.error(`ROZJAZD: ${dst} rozni sie od ${src}`);
    }
  } else if (!same) {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    console.log(`skopiowano ${src} -> ${dst}`);
  }
}
process.exit(bad ? 1 : 0);
