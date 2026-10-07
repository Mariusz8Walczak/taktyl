// TAKTYL-57 (F-220, F-221, F-076, docs/04 §8, docs/11, CLAUDE.md reguły 4-5): walidacja treści P1.
// Sprawdza: content/guides/*.md (4 poradniki), data/reviews.json (opinie demo), content/faq.json, content/pages/*.md.
// Uruchomienie w Dockerze:
//   docker run --rm -v "$PWD":/app -w /app node:24-alpine node scripts/validate-content.mjs
// Marki (reguła 5): lista lokalna z env FORBIDDEN_BRANDS (po przecinku lub w osobnych liniach) albo z pliku
// .claude/marki-zakazane.local.txt. Bez listy kontrola marek jest pomijana z ostrzeżeniem.
// Data odniesienia okna opinii: CONTENT_REF_DATE (domyślnie 2026-10-07, dzień zatwierdzenia treści).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const readJson = (f) => JSON.parse(read(f));

const products = readJson("data/products.json");
const colors = readJson("data/colors.json");
const switches = readJson("data/switches.json");
const rules = readJson("data/rules.json");
const shop = readJson("data/shop.json");

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------------------------------------------------------------- wspólne reguły

const FORBIDDEN =
  /(najlepsz\p{L}*|rewolucyjn\p{L}*|profesjonaln\p{L}*|premium|idealn\p{L}*|niesamowit\p{L}*|ultra-)/giu;
const EMOJI = /\p{Extended_Pictographic}/u;
const LOREM = /lorem|ipsum/i;
const AUTHENTICITY =
  /(zweryfikowan\p{L}*|potwierdzon\p{L}* (?:zakup|zamówieni)\p{L}*|prawdziw\p{L}* opini\p{L}*|opinia klienta)/iu;
const NB = " ";

const brandsRaw =
  process.env.FORBIDDEN_BRANDS ??
  (fs.existsSync(path.join(root, ".claude", "marki-zakazane.local.txt"))
    ? read(".claude/marki-zakazane.local.txt")
    : "");
const brandList = brandsRaw
  .split(/[\r\n,]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const BRANDS = brandList.length
  ? new RegExp(brandList.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "iu")
  : null;

/** Kontrole wspólne dla każdego tekstu (poradnik, opinia, FAQ, strona). */
function commonChecks(where, text, { allowStraightQuotes = false } = {}) {
  for (const m of text.matchAll(FORBIDDEN)) err(where, `zakazane słowo „${m[0]}”`);
  if (BRANDS && BRANDS.test(text)) err(where, "marka z listy lokalnej");
  if (EMOJI.test(text)) err(where, "emoji");
  if (/!/.test(text)) err(where, "wykrzyknik");
  if (!allowStraightQuotes && /"/.test(text)) err(where, "proste cudzysłowy (użyj „…”)");
  if (LOREM.test(text)) err(where, "lorem ipsum");
  if (/kliknij tutaj/i.test(text)) err(where, "„Kliknij tutaj”");
  if (/\d (g|kg|mm|cm|Hz|GHz|DPI|mAh|h|min|dni|zł)(?![\p{L}])/u.test(text))
    err(where, "zwykła spacja między liczbą a jednostką (użyj twardej)");
  if (/(^|[ \n(>])[wzioauWZIOAU] [^\s]/u.test(text))
    err(where, "zwykła spacja po jednoliterowym spójniku");
  for (const m of text.matchAll(/[^\s@<>"()[\]]+@([^\s@<>"()[\],;]+)/g)) {
    if (m[1].replace(/[.)]+$/, "").toLowerCase() !== "taktyl.example")
      err(where, `adres e-mail spoza domeny taktyl.example: ${m[0]}`);
  }
  if (/ec\.europa\.eu\/consumers\/odr|\bplatform\p{L}*\s+ODR\b|\bODR\b/iu.test(text))
    err(where, "odnośnik do platformy ODR");
  if (/\b(NIP|REGON|KRS|BDO)\b\s*[:-]?\s*\d/i.test(text)) err(where, "numer NIP/REGON/KRS/BDO");
  if (/\b\d{3}[- ]\d{3}[- ]\d{2}[- ]\d{2}\b/.test(text)) err(where, "ciąg przypominający NIP");
  for (const m of text.matchAll(
    /(?<!\d)(?:\+48[  -]?)?(?:\d{3}[  -]?\d{3}[  -]?\d{3}|\d{2}[  -]?\d{3}[  -]?\d{2}[  -]?\d{2})(?!\d)/g,
  )) {
    const digits = m[0].replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
    if (!/0{7}$/.test(digits)) err(where, `numer telefonu inny niż fikcyjny: ${m[0]}`);
  }
}

const countWords = (t) => t.split(/\s+/).filter(Boolean).length;
/** Liczenie jak w API (apps/api/src/admin-content/content-rules.ts guideWarnings). */
const apiGuideWords = (md) =>
  countWords(
    md
      .replace(/<[^>]*>/g, " ")
      .replace(/[#>*_`|-]+/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"),
  );

function parseMarkdown(file) {
  const t = read(file).replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(t);
  if (!m) {
    err(file, "brak frontmattera");
    return null;
  }
  const fm = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    if (i < 1) {
      err(file, `niepoprawna linia frontmattera „${line}”`);
      continue;
    }
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: m[2].trim() };
}

const BANNER = "Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.";

// ---------------------------------------------------------------- poradniki (F-220)

const GUIDES = {
  "jak-wybrac-przelaczniki": "Jak wybrać przełączniki",
  "rozmiary-klawiatur": "Rozmiary klawiatur: od 60% do 100%",
  "jak-dobrac-mysz-do-dloni": "Jak dobrać myszkę do dłoni",
  "jaka-podkladka": "Jaka podkładka: szybka, kontrolna, mata na biurko",
};
const guideFiles = fs.existsSync(path.join(root, "content/guides"))
  ? fs.readdirSync(path.join(root, "content/guides")).filter((f) => f.endsWith(".md"))
  : [];
const guideSummary = [];
for (const slug of Object.keys(GUIDES)) {
  if (!guideFiles.includes(`${slug}.md`)) err(`content/guides/${slug}.md`, "brak pliku");
}
for (const f of guideFiles) {
  const file = `content/guides/${f}`;
  const slug = f.replace(/\.md$/, "");
  if (!(slug in GUIDES)) err(file, "poradnik spoza listy F-220");
  const doc = parseMarkdown(file);
  if (!doc) continue;
  const { fm, body } = doc;
  const keys = Object.keys(fm).sort().join(",");
  if (keys !== "demo,lead,profile,reading_minutes,slug,title,updated")
    err(file, `frontmatter ma klucze: ${keys}`);
  if (fm.slug !== slug) err(file, `slug „${fm.slug}” różni się od nazwy pliku`);
  if (GUIDES[slug] && fm.title !== GUIDES[slug])
    err(file, `tytuł „${fm.title}” różni się od F-220`);
  if (fm.demo !== "true") err(file, "demo musi być true");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.updated ?? "")) err(file, "updated: format RRRR-MM-DD");
  if (!(fm.profile in rules.profiles)) err(file, `profil „${fm.profile}” spoza rules.json`);
  if (!fm.lead || fm.lead.length < 20 || fm.lead.length > 220) err(file, "lead: 20-220 znaków");
  const words = apiGuideWords(body);
  const plainWords = countWords(body);
  if (words < 600 || words > 900) err(file, `${words} słów wg API (wymagane 600-900)`);
  if (plainWords < 600 || plainWords > 900) err(file, `${plainWords} tokenów (wymagane 600-900)`);
  const minutes = Math.ceil(words / 200);
  if (Number(fm.reading_minutes) !== minutes)
    err(file, `reading_minutes ${fm.reading_minutes}, wynika z długości: ${minutes}`);
  if (!body.startsWith(`> ${BANNER}`)) err(file, "brak nagłówka „Wzór treści…” na początku treści");
  // Nagłówki: jeden H1 robi strona; w treści od H2, bez przeskoków.
  let prev = 1;
  for (const line of body.split("\n")) {
    const h = /^(#{1,6}) /.exec(line);
    if (!h) continue;
    const lvl = h[1].length;
    if (lvl === 1) err(file, `H1 w treści: „${line}”`);
    if (lvl > prev + 1) err(file, `przeskok poziomu nagłówka: „${line}”`);
    prev = lvl;
  }
  // Zakończenie: wejście do kreatora z ustawionym profilem.
  const links = [...body.matchAll(/\]\((\/zbuduj-set\?profil=([a-z]+))\)/g)];
  if (links.length !== 1) err(file, `oczekiwano 1 odnośnika do kreatora, jest ${links.length}`);
  else {
    if (links[0][2] !== fm.profile)
      err(file, `odnośnik do kreatora ma profil ${links[0][2]}, frontmatter ${fm.profile}`);
    const last = body
      .split("\n")
      .filter((l) => l.trim())
      .at(-1);
    if (!last.includes(links[0][1])) err(file, "odnośnik do kreatora nie jest w ostatnim akapicie");
    const label = /\[([^\]]+)\]\(\/zbuduj-set/.exec(body)?.[1] ?? "";
    const profLabel = rules.profiles[fm.profile]?.label.replace(/ \(.*\)$/, "");
    const wanted = rules.profiles[fm.profile]?.label;
    if (!label.includes(wanted) && !label.includes(profLabel ?? ""))
      err(file, `etykieta odnośnika „${label}” nie nazywa profilu „${wanted}”`);
  }
  for (const m of body.matchAll(/\]\((?!\/)([^)]*)\)/g)) err(file, `odnośnik zewnętrzny: ${m[1]}`);
  if (/!\[/.test(body)) err(file, "obraz w treści (reguła 1)");
  commonChecks(file, body);
  commonChecks(`${file} (frontmatter)`, `${fm.title}\n${fm.lead}`);
  guideSummary.push(
    `${slug.padEnd(26)} ${String(words).padStart(3)} słów (API), ${String(plainWords).padStart(3)} tokenów, profil ${fm.profile}`,
  );
}

// ---------------------------------------------------------------- opinie (F-076, docs/04 §8)

const REF = new Date(`${process.env.CONTENT_REF_DATE ?? "2026-10-07"}T00:00:00Z`);
const earliest = new Date(REF);
earliest.setUTCMonth(earliest.getUTCMonth() - 6);
const iso = (d) => d.toISOString().slice(0, 10);
const AUTHOR = /^\p{Lu}\p{Ll}+ \p{Lu}\.$/u;

const labelsOf = (p) => {
  const out = new Set();
  for (const v of p.variants) {
    const c = colors[v.color].label;
    out.add(c);
    if (v.switch) out.add(`${c} · ${switches.find((s) => s.id === v.switch).name}`);
    if (v.size) out.add(`${c} · ${v.size.toUpperCase()}`);
  }
  return out;
};

const reviews = readJson("data/reviews.json");
let reviewTotal = 0;
const ratings = [];
const lengths = new Map();
const productIds = new Set(products.map((p) => p.id));
for (const id of Object.keys(reviews))
  if (!productIds.has(id)) err("data/reviews.json", `opinie dla nieznanego produktu ${id}`);
for (const p of products) {
  const list = reviews[p.id];
  const where = `data/reviews.json[${p.id}]`;
  if (!Array.isArray(list)) {
    err(where, "brak opinii");
    continue;
  }
  if (list.length < 3 || list.length > 6) err(where, `${list.length} opinii (wymagane 3-6)`);
  reviewTotal += list.length;
  const allowed = labelsOf(p);
  const authors = new Set();
  const sentenceCounts = new Set();
  if (list.every((r) => r.rating === 5)) err(where, "same piątki");
  list.forEach((r, i) => {
    const w = `${where}[${i}]`;
    const keys = Object.keys(r).sort().join(",");
    if (keys !== "author,date,demo,rating,text,variant") err(w, `pola: ${keys}`);
    if (r.demo !== true) err(w, "demo musi być true");
    if (!Number.isInteger(r.rating) || r.rating < 3 || r.rating > 5)
      err(w, `ocena ${r.rating} poza 3-5`);
    ratings.push(r.rating);
    if (!AUTHOR.test(r.author)) err(w, `autor „${r.author}” (wymagane „Imię I.”)`);
    if (authors.has(r.author)) err(w, `powtórzony autor ${r.author}`);
    authors.add(r.author);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(r.date)))
      err(w, `data „${r.date}”`);
    else if (r.date > iso(REF) || r.date < iso(earliest))
      err(w, `data ${r.date} poza oknem ${iso(earliest)}..${iso(REF)}`);
    if (!allowed.has(r.variant)) err(w, `wariant „${r.variant}” nie istnieje w products.json`);
    const sentences = r.text.match(/[^.!?]+(?:[.!?]+|$)/g)?.filter((s) => s.trim()) ?? [];
    if (sentences.length < 1 || sentences.length > 4 || r.text.length > 600)
      err(w, `${sentences.length} zdań (wymagane 1-4, do 600 znaków)`);
    sentenceCounts.add(sentences.length);
    lengths.set(sentences.length, (lengths.get(sentences.length) ?? 0) + 1);
    if (AUTHENTICITY.test(r.text)) err(w, "twierdzenie o autentyczności");
    commonChecks(w, r.text);
    commonChecks(`${w}.author`, r.author);
    if (
      !/\d|hot-swap|gasket|top mount|Trzask|Szept|Próg|Ślizg|przewód|Bluetooth|chwyt|kształt|tkanin|szkł|filc|korek|splot|powierzchni|podświetl|pokrętł|przyciski|kółk|blok|rząd F|strzałk|opór|kontrol|szybk|wilgoć|zatrzymani|głośn|cich|odbiornik|keycap/iu.test(
        r.text,
      )
    )
      warn(w, "brak widocznego odniesienia do atrybutu (sprawdź ręcznie)");
  });
  if (sentenceCounts.size < 2) err(where, "wszystkie opinie tej samej długości");
}
for (const n of [1, 2, 3])
  if (!lengths.get(n)) err("data/reviews.json", `brak opinii o długości ${n} zdań`);
const avgAll = ratings.length
  ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)
  : "n/a";

// ---------------------------------------------------------------- FAQ (F-221)

const faq = readJson("content/faq.json");
if (!Array.isArray(faq) || faq.length < 8 || faq.length > 12)
  err("content/faq.json", `${faq.length} pytań (wymagane 8-12)`);
const faqKeys = new Set();
faq.forEach((it, i) => {
  const w = `content/faq.json[${i}]`;
  if (Object.keys(it).sort().join(",") !== "answer_md,key,question")
    err(w, "pola: key, question, answer_md");
  if (!/^[a-z0-9-]{2,30}$/.test(it.key)) err(w, `klucz „${it.key}”`);
  if (faqKeys.has(it.key)) err(w, `zdublowany klucz ${it.key}`);
  faqKeys.add(it.key);
  if (it.question.length < 5 || it.question.length > 200) err(w, "pytanie: 5-200 znaków");
  if (it.answer_md.length < 5 || it.answer_md.length > 3000) err(w, "odpowiedź: 5-3000 znaków");
  if (!/\?$/.test(it.question)) err(w, "pytanie powinno kończyć się znakiem zapytania");
  if (/gwarancj/i.test(it.answer_md)) err(w, "gwarancja nie jest w danych (nie wymyślamy)");
  if (/rękojmi/i.test(it.answer_md)) err(w, "„rękojmia” zamiast „niezgodność towaru z umową”");
  for (const m of it.answer_md.matchAll(/\]\((?!\/)([^)]*)\)/g))
    err(w, `odnośnik zewnętrzny: ${m[1]}`);
  commonChecks(w, `${it.question}\n${it.answer_md}`);
});
const faqAll = faq.map((f) => f.answer_md).join("\n");
for (const c of shop.codes)
  if (!faqAll.includes(c.code)) err("content/faq.json", `brak kodu ${c.code}`);
if (!/14 dni/.test(faqAll.replaceAll(NB, " ")) || !/30/.test(faqAll))
  err("content/faq.json", "brak 14 dni (ustawowo) i 30 dni (Taktyl)");
if (!/Omnibus/.test(faqAll)) err("content/faq.json", "brak odpowiedzi o Omnibusie");
if (!/10%/.test(faqAll)) err("content/faq.json", "brak rabatu 10% za set");

// ---------------------------------------------------------------- strony informacyjne (F-221)

const PAGES = [
  "dostawa-i-platnosci",
  "zwroty-i-reklamacje",
  "regulamin",
  "polityka-prywatnosci",
  "cookies",
  "o-sklepie",
  "kontakt",
  "zuzyty-sprzet",
];
for (const slug of PAGES) {
  const file = `content/pages/${slug}.md`;
  if (!fs.existsSync(path.join(root, file))) {
    err(file, "brak pliku");
    continue;
  }
  const doc = parseMarkdown(file);
  if (!doc) continue;
  if (Object.keys(doc.fm).sort().join(",") !== "demo,slug,title,updated")
    err(file, "frontmatter: slug, title, updated, demo");
  if (doc.fm.slug !== slug) err(file, "slug różni się od nazwy pliku");
  if (doc.fm.demo !== "true") err(file, "demo musi być true");
  if (!doc.body.startsWith(`> ${BANNER}`)) err(file, "brak nagłówka „Wzór treści…”");
  if (/^# /m.test(doc.body)) err(file, "H1 w treści");
  // Strony zatwierdzone wcześniej (D-010) kontrolujemy tylko pod kątem zakazów, bez wymogu twardych spacji.
  const text = doc.body.replace(/(\d) (dni|zł|g|cm|mm)\b/g, `$1${NB}$2`);
  commonChecks(file, ["o-sklepie", "kontakt", "zuzyty-sprzet"].includes(slug) ? doc.body : text);
}
const zs = read("content/pages/zuzyty-sprzet.md");
if (!zs.includes("Nr BDO:** — (sklep fikcyjny)") && !zs.includes("Nr BDO: — (sklep fikcyjny)"))
  err("content/pages/zuzyty-sprzet.md", "brak „Nr BDO: — (sklep fikcyjny)”");

// ---------------------------------------------------------------- wynik

console.log(guideSummary.join("\n"));
console.log(
  `opinie: ${reviewTotal} w ${Object.keys(reviews).length} produktach, średnia ${avgAll}, długości (zdania): ${[
    ...lengths,
  ]
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join(" ")}`,
);
console.log(`FAQ: ${faq.length} pytań; strony: ${PAGES.length}`);
if (!BRANDS)
  console.log(
    "UWAGA: brak FORBIDDEN_BRANDS i .claude/marki-zakazane.local.txt, kontrola marek pominięta",
  );
if (warnings.length) console.log(`\nOSTRZEŻENIA (${warnings.length}):\n${warnings.join("\n")}`);
if (errors.length) {
  console.error(`\nBŁĘDY (${errors.length}):\n${errors.join("\n")}`);
  process.exit(1);
}
console.log("\nOK: treści P1 zgodne z docs/04, docs/11 i F-220/F-221/F-076");
