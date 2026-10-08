// I-012 (TAKTYL-83, docs/12 par. 4, S36): pomiar Lighthouse na stosie produkcyjnym z compose.
// Chromium z obrazu Playwrighta, host-resolver-rules mapuje taktyl.localhost na usluge proxy (jak w e2e).
// Profil: tryb "Komorka" Lighthouse (emulacja telefonu, symulowane lacze 4G i spowolnienie CPU x4).
// Kazda strona: PERF_RUNS przebiegow (domyslnie 3), do progow bierzemy MEDIANE kazdej metryki (Lighthouse zaleca mediane).
// INP: Lighthouse w trybie nawigacji nie mierzy INP (potrzebna interakcja), wiec uzywamy TBT jako zastepnika (docs/decyzje.md I-012).
// Kod wyjscia 1 przy przekroczeniu progu, chyba ze PERF_ENFORCE=0 (tryb informacyjny).
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import lighthouse from "lighthouse";

const SITE = process.env.PERF_SITE_URL ?? "http://taktyl.localhost";
const PROXY = process.env.PERF_PROXY ?? "proxy:8080";
const HOSTS = (process.env.PERF_HOSTS ?? "taktyl.localhost,admin.taktyl.localhost,api.taktyl.localhost").split(",");
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const ENFORCE = process.env.PERF_ENFORCE !== "0";
// Metryki tylko informacyjne: przekroczenie widac w tabeli, ale nie psuje kodu wyjscia (np. PERF_INFO_METRICS=lcp_ms).
const INFO = new Set((process.env.PERF_INFO_METRICS ?? "").split(",").filter(Boolean));
const OUT = process.env.PERF_OUT ?? "reports";
const PORT = 9222;
// Diagnostyka (TAKTYL-84): PERF_ONLY=glowna,karta ogranicza strony, PERF_SAVE_ALL=1 zapisuje raport kazdego przebiegu.
const ONLY = new Set((process.env.PERF_ONLY ?? "").split(",").filter(Boolean));
const SAVE_ALL = process.env.PERF_SAVE_ALL === "1" || process.env.PERF_SAVE_ALL === "2";
const SAVE_ALL2 = process.env.PERF_SAVE_ALL === "2";

// Progi z docs/12 par. 4. Waga w KB (1 KB = 1024 B), czas w ms. TBT 200 ms to zastepnik INP <= 200 ms.
const LIMITS = {
  tresc: { waga_kb: 800, zadan: 30, lcp_ms: 2000, cls: 0.05, tbt_ms: 200 },
  apka: { waga_kb: 1500, zadan: 45, lcp_ms: 2500, cls: 0.1, tbt_ms: 200 },
};
const PAGES = [
  { name: "glowna", path: "/", kind: "tresc" },
  { name: "listing", path: "/klawiatury", kind: "tresc" },
  { name: "karta", path: "/klawiatury/bazalt-75", kind: "tresc" },
  { name: "kreator", path: "/zbuduj-set", kind: "apka" },
  { name: "koszyk", path: "/koszyk", kind: "apka" },
];

function chromePath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/ms-playwright";
  const dir = readdirSync(root).find((d) => d.startsWith("chromium-") && !d.includes("headless"));
  if (!dir) throw new Error(`Brak chromium w ${root}`);
  return `${root}/${dir}/chrome-linux64/chrome`;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function waitForChrome() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return;
    } catch {
      /* jeszcze nie wstal */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chromium nie wystartowal");
}

const chrome = spawn(
  chromePath(),
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${PORT}`,
    `--host-resolver-rules=${HOSTS.map((h) => `MAP ${h} ${PROXY}`).join(",")}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
let failed = false;
try {
  await waitForChrome();
  mkdirSync(OUT, { recursive: true });
  const siteHost = new URL(SITE).hostname;
  const results = [];
  for (const page of PAGES) {
    if (ONLY.size && !ONLY.has(page.name)) continue;
    const runs = [];
    // Diagnostyka: PERF_SAVE_ALL=2 zapisuje artefakty (slad, log sieci) dodatkowego przebiegu strony (tylko zbieranie).
    if (SAVE_ALL2) {
      await lighthouse(`${SITE}${page.path}`, {
        port: PORT,
        logLevel: "error",
        onlyCategories: ["performance"],
        gatherMode: `${OUT}/art-${page.name}`,
      });
    }
    for (let i = 0; i < RUNS; i += 1) {
      const url = `${SITE}${page.path}`;
      const r = await lighthouse(url, {
        port: PORT,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance"],
      });
      const a = r.lhr.audits;
      // Prefetch widokow RSC (`?_rsc=`, next/link) startuje po zaladowaniu i dotyczy innych stron, nie pierwszego widoku:
      // nie liczymy go do wagi ani liczby zadan (docs/decyzje.md I-012).
      const reqs = a["network-requests"].details.items.filter((q) => !/[?&]_rsc=/.test(q.url));
      const foreign = [...new Set(reqs.map((q) => new URL(q.url)).filter((u) => u.protocol.startsWith("http") && u.hostname !== siteHost).map((u) => u.hostname))];
      runs.push({
        waga_kb: reqs.reduce((s, q) => s + (q.transferSize || 0), 0) / 1024,
        zadan: reqs.filter((q) => q.url.startsWith("http")).length,
        lcp_ms: a["largest-contentful-paint"].numericValue,
        cls: a["cumulative-layout-shift"].numericValue,
        tbt_ms: a["total-blocking-time"].numericValue,
        obce: foreign,
        perf: r.lhr.categories.performance.score,
      });
      if (i === 0) writeFileSync(`${OUT}/lhr-${page.name}.json`, r.report);
      if (SAVE_ALL) writeFileSync(`${OUT}/lhr-${page.name}-${i}.json`, r.report);
    }
    const lim = LIMITS[page.kind];
    const row = { strona: page.name, sciezka: page.path, rodzaj: page.kind, przebiegow: RUNS };
    const naruszenia = [];
    const informacyjne = [];
    for (const k of Object.keys(lim)) {
      row[k] = median(runs.map((x) => x[k]));
      if (row[k] > lim[k]) {
        const txt = `${k} ${row[k].toFixed(k === "cls" ? 3 : 0)} > ${lim[k]}`;
        (INFO.has(k) ? informacyjne : naruszenia).push(txt);
      }
    }
    row.runs_lcp_ms = runs.map((x) => Math.round(x.lcp_ms));
    row.perf = median(runs.map((x) => x.perf));
    row.obce_domeny = [...new Set(runs.flatMap((x) => x.obce))];
    if (row.obce_domeny.length) naruszenia.push(`obce domeny: ${row.obce_domeny.join(", ")}`);
    row.naruszenia = naruszenia;
    row.informacyjne = informacyjne;
    results.push(row);
  }
  console.log(`\nLighthouse (tryb Komorka, mediana z ${RUNS}), progi docs/12 par. 4; TBT zamiast INP\n`);
  console.log("strona    waga KB  zadan  LCP ms   CLS    TBT ms  wynik  naruszenia");
  for (const r of results) {
    console.log(
      [
        r.strona.padEnd(9),
        r.waga_kb.toFixed(0).padStart(7),
        String(r.zadan).padStart(6),
        r.lcp_ms.toFixed(0).padStart(7),
        r.cls.toFixed(3).padStart(7),
        r.tbt_ms.toFixed(0).padStart(7),
        (r.perf * 100).toFixed(0).padStart(6),
        r.naruszenia.length ? `  NARUSZENIA: ${r.naruszenia.join("; ")}` : "  ok",
        r.informacyjne.length ? `  PRZEKROCZENIE (informacyjnie): ${r.informacyjne.join("; ")}` : "",
      ].join(" "),
    );
  }
  writeFileSync(`${OUT}/perf-summary.json`, JSON.stringify({ runs: RUNS, limits: LIMITS, results }, null, 2));
  failed = results.some((r) => r.naruszenia.length);
} finally {
  chrome.kill();
}
if (failed) {
  console.error(ENFORCE ? "\nBUDZET PRZEKROCZONY" : "\nBUDZET PRZEKROCZONY (tryb informacyjny, PERF_ENFORCE=0)");
  process.exit(ENFORCE ? 1 : 0);
}
