// TAKTYL-31, TAKTYL-57: wstawia twarde spacje w treściach (docs/01 §4): content/pages/*.md, content/guides/*.md,
// content/faq.json i data/reviews.json. Idempotentny. Uruchomienie: node scripts/nbsp-pages.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NB = " ";

/** Twarda spacja: liczba + jednostka, tysiące, „×” w wymiarach i jednoliterowe spójniki. */
export function nbsp(text) {
  return text
    .replace(
      /(\d) (dni|dzień|lat|lata|zł|g|kg|mm|cm|Hz|GHz|DPI|mAh|h|min)(?![\p{L}])/gu,
      `$1${NB}$2`,
    )
    .replace(/(\d) × (\d)/gu, `$1${NB}×${NB}$2`)
    .replace(/(?<![\d,+])(\d{1,3}) (\d{3})(?= (?:DPI|Hz|zł|mAh|g|mm)(?![\p{L}]))/gu, `$1${NB}$2`)
    .replace(/(^|[ \n(>])([wzioauWZIOAU]) /gu, `$1$2${NB}`)
    .replace(/ ([wzioauWZIOAU]) /gu, ` $1${NB}`);
}

function markdownDir(dir, frontmatter) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    const p = path.join(dir, f);
    const t = fs.readFileSync(p, "utf8");
    const m = t.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
    if (!m) throw new Error(`${f}: brak frontmattera`);
    // We frontmatterze tylko tytuł i lead (reszta to klucze techniczne).
    const fm = !frontmatter
      ? m[1]
      : m[1].replace(/^(title|lead): (.*)$/gmu, (_, k, v) => `${k}: ${nbsp(v)}`);
    fs.writeFileSync(p, fm + nbsp(m[2]));
  }
}

markdownDir(path.join(root, "content", "pages"), false);
markdownDir(path.join(root, "content", "guides"), true);

const faqPath = path.join(root, "content", "faq.json");
if (fs.existsSync(faqPath)) {
  const faq = JSON.parse(fs.readFileSync(faqPath, "utf8"));
  for (const it of faq) {
    it.question = nbsp(it.question);
    it.answer_md = nbsp(it.answer_md);
  }
  fs.writeFileSync(faqPath, JSON.stringify(faq, null, 2) + "\n");
}

const reviewsPath = path.join(root, "data", "reviews.json");
if (fs.existsSync(reviewsPath)) {
  const reviews = JSON.parse(fs.readFileSync(reviewsPath, "utf8"));
  for (const list of Object.values(reviews)) {
    for (const r of list) {
      r.text = nbsp(r.text);
    }
  }
  fs.writeFileSync(reviewsPath, JSON.stringify(reviews, null, 2) + "\n");
}
console.log("ok");
