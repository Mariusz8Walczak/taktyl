#!/usr/bin/env node
// TAKTYL-77, docs/12 §4: budzet JS (gzip) ladowanego przez strone. Liczy skrypty z HTML-a odpowiedzi:
// <script src> (bez nomodule) oraz <link rel=modulepreload|preload as=script>, kazdy plik raz. Inline pomijamy.
//   node scripts/measure-js.mjs [--base http://localhost:3000] [--budget] [--content 150] [--app 400] [--list] [--strict]
// Strony tresciowe (/, /klawiatury, /klawiatury/bazalt-75) maja budzet --content, aplikacyjne (/zbuduj-set,
// /koszyk) budzet --app. Bez --budget tylko wypisuje tabele. Kod wyjscia 1 przy przekroczeniu (CI).
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const base = opt("base", process.env.MEASURE_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const enforce = args.includes("--budget");
const budgetContent = Number(opt("content", "150"));
const budgetApp = Number(opt("app", "400"));
const list = args.includes("--list");
const strict = args.includes("--strict");

const PAGES = [
  { path: "/", kind: "tresc" },
  { path: "/klawiatury", kind: "tresc" },
  { path: "/klawiatury/bazalt-75", kind: "tresc" },
  { path: "/poradnik", kind: "tresc" },
  { path: "/poradnik/rozmiary-klawiatur", kind: "tresc" },
  { path: "/faq", kind: "tresc" },
  { path: "/kontakt", kind: "tresc" },
  { path: "/szukaj?q=lupek", kind: "tresc" },
  { path: "/zbuduj-set", kind: "apka" },
  { path: "/koszyk", kind: "apka" },
];

const fileCache = new Map();
async function gzSize(url) {
  if (!fileCache.has(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    fileCache.set(url, gzipSync(Buffer.from(await res.arrayBuffer())).length);
  }
  return fileCache.get(url);
}

/** Adresy skryptow z HTML-a: <script src> bez nomodule/ <link rel=preload|modulepreload as=script>. */
function scriptUrls(html) {
  const urls = new Set();
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (/\bnomodule\b/i.test(tag)) continue;
    const m = /\bsrc="([^"]+)"/i.exec(tag);
    if (m) urls.add(m[1]);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel="(?:modulepreload|preload)"/i.test(tag) || !/as="script"/i.test(tag)) continue;
    if (/\bnomodule\b/i.test(tag)) continue;
    const m = /\bhref="([^"]+)"/i.exec(tag);
    if (m) urls.add(m[1]);
  }
  return [...urls].map((u) => new URL(u.replaceAll("&amp;", "&"), `${base}/`).href);
}

const rows = [];
let failed = false;
for (const page of PAGES) {
  const res = await fetch(`${base}${page.path}`, { redirect: "follow" });
  if (!res.ok) {
    rows.push({
      page: page.path,
      kind: page.kind,
      files: 0,
      kb: NaN,
      status: `HTTP ${res.status}`,
    });
    // 404: strona jeszcze nie istnieje (zadania rownolegle); z --strict liczy sie jako blad
    if (res.status !== 404 || strict) failed = true;
    continue;
  }
  const urls = scriptUrls(await res.text());
  const sizes = await Promise.all(urls.map(async (u) => [u, await gzSize(u)]));
  const total = sizes.reduce((s, [, n]) => s + n, 0);
  const budget = page.kind === "tresc" ? budgetContent : budgetApp;
  const kb = total / 1024;
  const over = kb > budget;
  if (over && enforce) failed = true;
  rows.push({ page: page.path, kind: page.kind, files: urls.length, kb, budget, over });
  if (list) {
    for (const [u, n] of sizes.sort((a, b) => b[1] - a[1])) {
      console.log(
        `  ${(n / 1024).toFixed(1).padStart(7)} kB  ${u.replace(`${base}/_next/static/`, "")}`,
      );
    }
  }
}

console.log("\nStrona                     Typ     Pliki   gzip kB   Budzet   Wynik");
for (const r of rows) {
  const kb = Number.isNaN(r.kb) ? "   -" : r.kb.toFixed(1).padStart(7);
  const res = r.status ?? (r.over ? "PRZEKROCZONY" : "ok");
  console.log(
    `${r.page.padEnd(26)} ${r.kind.padEnd(6)} ${String(r.files).padStart(5)} ${kb}   ${String(r.budget ?? "-").padStart(6)}   ${res}`,
  );
}
if (failed && enforce) {
  console.error("\nBudzet JS przekroczony (docs/12 §4).");
  process.exit(1);
}
if (failed) process.exit(1);
