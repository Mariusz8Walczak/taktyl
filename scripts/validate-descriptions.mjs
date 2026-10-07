// TAKTYL-30: walidacja data/descriptions.json (docs/04 §7, docs/11 §2 poz. 24-25, CLAUDE.md reguła 4-5).
// Uruchomienie w Dockerze: docker run --rm -v "$PWD":/app -w /app node:24-alpine node scripts/validate-descriptions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const products = read('data/products.json');
const descriptions = read('data/descriptions.json');

const FORBIDDEN = /(najlepsz\p{L}*|rewolucyjn\p{L}*|profesjonaln\p{L}*|premium|idealn\p{L}*|niesamowit\p{L}*|ultra-)/giu;
// Lista marek jest lokalna (reguła 5): .claude/marki-zakazane.local.txt, jedna nazwa w linii.
const brandsFile = path.join(root, '.claude', 'marki-zakazane.local.txt');
const brands = fs.existsSync(brandsFile)
  ? fs.readFileSync(brandsFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  : [];
const BRANDS = brands.length
  ? new RegExp(brands.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'iu')
  : null;

const NB = ' ';
const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

const ids = new Set(products.map((p) => p.id));
for (const p of products) if (!(p.id in descriptions)) err(p.id, 'brak opisu');
for (const id of Object.keys(descriptions)) if (!ids.has(id)) err(id, 'opis bez produktu');

for (const [id, text] of Object.entries(descriptions)) {
  const paragraphs = text.split(/\n\n/);
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 60 || words > 120) err(id, `${words} słów (wymagane 60-120)`);
  if (paragraphs.length < 2 || paragraphs.length > 3) err(id, `${paragraphs.length} akapitów (wymagane 2-3)`);
  if (paragraphs.some((x) => !x.trim())) err(id, 'pusty akapit');
  for (const m of text.matchAll(FORBIDDEN)) err(id, `zakazane słowo „${m[0]}”`);
  if (BRANDS && BRANDS.test(text)) err(id, 'marka z listy lokalnej');
  if (/[\p{Emoji_Presentation}!]/u.test(text)) err(id, 'emoji lub wykrzyknik');
  if (/"/.test(text)) err(id, 'proste cudzysłowy');
  if (/\d (g|kg|mm|cm|Hz|GHz|DPI|h|mAh|dni|zł)(?![\p{L}])/u.test(text)) err(id, 'zwykła spacja przed jednostką');
  if (/(^|[ \n])[wzioauWZIOAU] [^\s]/u.test(text)) err(id, 'zwykła spacja po jednoliterowym spójniku');
  if (/lorem|ipsum/i.test(text)) err(id, 'lorem ipsum');
  if (/@/.test(text)) err(id, 'adres e-mail w opisie');
  console.log(`${id.padEnd(14)} ${String(words).padStart(3)} słów, ${paragraphs.length} akapity`);
}

if (!BRANDS) console.log('UWAGA: brak .claude/marki-zakazane.local.txt, kontrola marek pominięta');
if (errors.length) {
  console.error(`\nBŁĘDY (${errors.length}):\n` + errors.join('\n'));
  process.exit(1);
}
console.log(`\nOK: ${Object.keys(descriptions).length} opisów, ${NB === ' ' ? 'twarde spacje sprawdzone' : ''}`);
