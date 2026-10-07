// TAKTYL-31: wstawia twarde spacje w content/pages/*.md (docs/01 §4). Idempotentny.
// Uruchomienie: node scripts/nbsp-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'pages');
const NB = ' ';
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
  const p = path.join(dir, f);
  const t = fs.readFileSync(p, 'utf8');
  const m = t.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  const body = m[2]
    .replace(/(\d) (dni|dzień|lat|zł|g|kg|mm|cm|Hz)(?![\p{L}])/gu, `$1${NB}$2`)
    .replace(/(^|[ \n(>])([wzioauWZIOAU]) /gu, `$1$2${NB}`)
    .replace(/ ([wzioauWZIOAU]) /gu, ` $1${NB}`);
  fs.writeFileSync(p, m[1] + body);
}
console.log('ok');
