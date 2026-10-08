// B-300..B-306 (TAKTYL-61): testy jednostkowe sanityzacji tresci (XSS), walidatorow opisow, tresci prawnych i opinii.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  countWords,
  describeDescription,
  earliestReviewDate,
  forbiddenWords,
  guideWarnings,
  legalContentErrors,
  medicalClaims,
  reviewErrors,
  variantLabels,
} from "./content-rules.js";
import { isSafeUrl, sanitizeMarkdown, stripTags } from "./content-sanitizer.js";

/** Zestaw ladunkow XSS: po sanityzacji nie moze zostac zywy znacznik z niebezpieczna tresca ani niebezpieczny adres. */
const XSS: string[] = [
  "<script>alert(1)</script>",
  "<SCRIPT SRC=//evil.example/x.js></SCRIPT>",
  "<scr<script>ipt>alert(1)</scr</script>ipt>",
  "<img src=x onerror=alert(1)>",
  "<img/src=x/onerror=alert(1)>",
  "<svg onload=alert(1)>",
  "<svg><script>alert(1)</script></svg>",
  "<iframe src=javascript:alert(1)></iframe>",
  "<iframe srcdoc='<script>alert(1)</script>'>",
  "<object data=javascript:alert(1)>",
  "<embed src=javascript:alert(1)>",
  "<a href=javascript:alert(1)>klik</a>",
  '<a href="JaVaScRiPt:alert(1)">klik</a>',
  '<a href="jav&#x61;script:alert(1)">klik</a>',
  '<a href="&#106;avascript:alert(1)">klik</a>',
  '<a href="java\tscript:alert(1)">klik</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">klik</a>',
  '<a href="vbscript:msgbox(1)">klik</a>',
  '<a href="//evil.example/phish">klik</a>',
  '<a href="https://evil.example/phish">klik</a>',
  '<a href="https://taktyl.example.evil.example/">klik</a>',
  '<a/href="javascript:alert(1)">klik</a>',
  '<a href="x" onclick="alert(1)">klik</a>',
  '<a h[re](http://x)f="javascript:alert(1)">klik</a>',
  "[klik](javascript:alert(1))",
  "[klik](JAVASCRIPT:alert(1))",
  "[klik](data:text/html,<script>alert(1)</script>)",
  "[klik](https://evil.example)",
  "![obraz](https://evil.example/x.png)",
  "![obraz](javascript:alert(1))",
  "[ref]: javascript:alert(1)\n\n[klik][ref]",
  "<p onclick=alert(1)>akapit</p>",
  '<p style="background:url(javascript:alert(1))">akapit</p>',
  "<p on<script></script>click=alert(1)>akapit</p>",
  "<style>@import 'http://evil.example/x.css';</style>",
  "<link rel=stylesheet href=//evil.example/x.css>",
  "<meta http-equiv=refresh content='0;url=javascript:alert(1)'>",
  "<base href=javascript:alert(1)//>",
  "<form action=javascript:alert(1)><button>x</button></form>",
  "<math><mi xlink:href=javascript:alert(1)>x</mi></math>",
  "<details open ontoggle=alert(1)>x</details>",
  "<body onload=alert(1)>",
  "<!--<script>alert(1)</script>-->",
  "<img src=x onerror=alert(1)",
  "<script>alert(1)",
  "<<script>script>alert(1)<</script>/script>",
  '<a href="javascript:alert(1)"\n>klik</a>',
  "<audio src=x onerror=alert(1)>",
  "<video><source onerror=alert(1)></video>",
  "<textarea><script>alert(1)</script></textarea>",
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  "<template><script>alert(1)</script></template>",
];

const DANGEROUS = [
  /<\s*script/i,
  /<\s*iframe/i,
  /<\s*img/i,
  /<\s*svg/i,
  /<\s*object/i,
  /<\s*embed/i,
  /<\s*style/i,
  /<\s*link/i,
  /<\s*meta/i,
  /<\s*form/i,
  /<\s*math/i,
  /<\s*body/i,
  /<\s*base/i,
  /<\s*audio/i,
  /<\s*video/i,
  /<\s*details/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:/i,
  /evil\.example/i,
  /!\[/,
];

/** Wszystkie znaczniki w wyniku to dokladnie dozwolone formy: bez atrybutow, poza <a href="bezpieczny-adres">. */
function onlyAllowedTags(html: string): boolean {
  const tags = html.match(/<[^>]*>?/g) ?? [];
  return tags.every(
    (t) =>
      /^<\/?(?:p|br|hr|strong|b|em|i|code|pre|blockquote|ul|ol|li|h2|h3|h4|a|table|thead|tbody|tr|th|td)>$/.test(
        t,
      ) || /^<a href="([^"<>]*)">$/.test(t),
  );
}

describe("B-300 sanityzacja tresci (testy XSS)", () => {
  for (const payload of XSS) {
    it(`neutralizuje: ${JSON.stringify(payload).slice(0, 70)}`, () => {
      const out = sanitizeMarkdown(`Tekst przed.\n\n${payload}\n\nTekst po.`);
      for (const bad of DANGEROUS) expect(out, String(bad)).not.toMatch(bad);
      expect(onlyAllowedTags(out), out).toBe(true);
      for (const m of out.matchAll(/<a href="([^"]*)">/g)) {
        expect(isSafeUrl(m[1] ?? ""), out).toBe(true);
      }
      expect(out).toContain("Tekst przed.");
      expect(out).toContain("Tekst po.");
      // wynik jest punktem stalym: kolejna sanityzacja nic nie zmienia
      expect(sanitizeMarkdown(out)).toBe(out);
    });
  }

  it("zachowuje dozwolony Markdown i HTML (naglowki, listy, tabele, pogrubienia, bezpieczne odnosniki)", () => {
    const ok = [
      "> Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.",
      "",
      "## Dostawa",
      "",
      "1. **Kurier** w <strong>1 dzień</strong>.",
      "2. [Zwroty](/zwroty-i-reklamacje) i [kontakt](mailto:kontakt@taktyl.example).",
      "",
      "| Nazwa | Czas |",
      "|---|---|",
      "| Koszyk | do wyczyszczenia |",
      "",
      '<a href="https://www.taktyl.example/poradnik">poradnik</a> oraz [kotwica](#dostawa).',
    ].join("\n");
    expect(sanitizeMarkdown(ok)).toBe(ok);
  });

  it("usuwa atrybuty z dozwolonych znacznikow i odbudowuje odnosnik z bezpiecznym adresem", () => {
    expect(sanitizeMarkdown('<p class="x" onclick="y">a</p>')).toBe("<p>a</p>");
    expect(sanitizeMarkdown('<A HREF="/zwroty" target="_blank" onclick="x">b</A>')).toBe(
      '<a href="/zwroty">b</a>',
    );
  });

  it("zwykle znaki mniejszosci nie tworza znacznikow (a < b, <3)", () => {
    expect(sanitizeMarkdown("a < b i <3")).toBe("a &lt; b i &lt;3");
  });

  it("stripTags (tytuly, leady, opisy) zostawia sam tekst", () => {
    expect(stripTags("<b>Tytul</b><script>x()</script> 2")).toBe("Tytul 2");
    expect(stripTags("<scr<script></script>ipt>alert(1)</scr<script></script>ipt>")).not.toMatch(
      /<\s*script/i,
    );
    expect(stripTags("a < b")).toBe("a &lt; b");
  });
});

describe("B-301 walidator opisu produktu (ostrzezenia, nie blokada)", () => {
  const words = (n: number): string => Array.from({ length: n }, (_, i) => `slowo${i}`).join(" ");

  it("poprawny opis: 70 slow, 2 akapity, bez zakazanych slow = zero ostrzezen", () => {
    const text = `${words(35)}\n\n${words(35)}`;
    const r = describeDescription(text);
    expect(r).toMatchObject({ words: 70, paragraphs: 2, warnings: [] });
  });

  it("za krotki, za dlugi i zla liczba akapitow", () => {
    expect(describeDescription(words(10)).warnings.map((w) => w.code)).toEqual([
      "description_length",
      "description_paragraphs",
    ]);
    const long = `${words(70)}\n\n${words(70)}`;
    expect(describeDescription(long).warnings.map((w) => w.code)).toEqual(["description_length"]);
    const four = [words(20), words(20), words(20), words(20)].join("\n\n");
    expect(describeDescription(four).warnings.map((w) => w.code)).toEqual([
      "description_paragraphs",
    ]);
  });

  it("zakazane slowa z docs/04 par. 7 w kazdej odmianie i z przedrostkiem ultra-", () => {
    const text =
      "To najlepsza, rewolucyjna i profesjonalna mysz. Premium, idealnie, niesamowita, ultra-lekka.";
    expect(forbiddenWords(text)).toEqual([
      "najlepsza",
      "rewolucyjna",
      "profesjonalna",
      "premium",
      "idealnie",
      "niesamowita",
      "ultra-",
    ]);
    const warn = describeDescription(text).warnings.find(
      (w) => w.code === "description_forbidden_words",
    );
    expect(warn?.details).toContain("idealnie");
    expect(forbiddenWords("Waży 63 g, ma 4 przyciski.")).toEqual([]);
    expect(countWords("raz  dwa\ntrzy")).toBe(3);
  });

  it("Q-07: obietnice medyczne wykrywane w odmianie, bez falszywych trafien; opisy z seeda czyste", () => {
    expect(
      medicalClaims(
        "Leczy nadgarstek, ma działanie terapeutyczne i chroni przed kontuzją. RSI, cieśń nadgarstka.",
      ),
    ).toEqual(["leczy", "terapeutyczne", "chroni przed kontuzją", "rsi", "cieśń nadgarstka"]);
    expect(medicalClaims("Odciąża nadgarstek, waży 63 g. Lecz klik jest głośny.")).toEqual([]);
    const seed = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../../data/descriptions.json", import.meta.url)),
        "utf8",
      ),
    ) as Record<string, string>;
    for (const [id, text] of Object.entries(seed)) expect(medicalClaims(text), id).toEqual([]);
  });

  it("artykul poradnika 600-900 slow", () => {
    const body = (n: number) => `## Tytul\n\n${words(n)}`;
    expect(guideWarnings(body(700))).toEqual([]);
    expect(guideWarnings(body(100))[0]?.code).toBe("guide_length");
    expect(guideWarnings(body(1000))[0]?.code).toBe("guide_length");
  });
});

describe("B-306 walidator tresci prawnych (z numerem linii)", () => {
  const codes = (t: string) => legalContentErrors(t).map((e) => e.code);

  it("czysta tresc fikcyjna przechodzi", () => {
    expect(
      codes(
        "NIP: — (sklep fikcyjny). REGON: — (sklep fikcyjny).\nKontakt: kontakt@taktyl.example, +48 22 000 00 00.\nData 2026-10-07 12:00.",
      ),
    ).toEqual([]);
  });

  it("odrzuca ODR, numery NIP/REGON/KRS/BDO, obce e-maile i prawdziwe telefony; wskazuje linie", () => {
    const text = [
      "Wstep",
      "Platforma ODR: https://ec.europa.eu/consumers/odr",
      "NIP: 123-456-78-90",
      "KRS 0000123456",
      "Pisz na biuro@firma.com",
      "Dzwon 601 234 567",
    ].join("\n");
    const errors = legalContentErrors(text);
    expect(errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(["odr_link", "forbidden_identifier", "invalid_domain", "real_phone"]),
    );
    expect(errors.find((e) => e.code === "odr_link")?.message).toContain("linia 2");
    expect(errors.find((e) => e.code === "invalid_domain")?.message).toContain("linia 5");
    expect(errors.find((e) => e.code === "real_phone")?.message).toContain("linia 6");
    expect(errors.every((e) => e.path === "body_md")).toBe(true);
  });

  it("ODR: slowa „odróżnieniu”, „odręczny”, „odrzucona” nie sa odnosnikiem do platformy (D-011)", () => {
    expect(
      codes("W odróżnieniu od sklepu stacjonarnego. Odręczny podpis. Reklamacja odrzucona."),
    ).toEqual([]);
    expect(codes("Platforma ODR")).toEqual(["odr_link"]);
    expect(codes("Spor rozwiaze ODR.")).toEqual(["odr_link"]);
  });

  it("strony z seeda (content/pages) przechodza walidator i sanityzacje bez zmian", () => {
    const dir = fileURLToPath(new URL("../../../../content/pages/", import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) {
      const raw = readFileSync(`${dir}${f}`, "utf8").replace(/\r\n?/g, "\n");
      const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
      expect(legalContentErrors(body), f).toEqual([]);
      expect(sanitizeMarkdown(body), f).toBe(body);
    }
  });
});

describe("B-302 walidator opinii demo", () => {
  const NOW = new Date("2026-10-07T10:00:00Z");
  const ctx = {
    today: "2026-10-07",
    earliest: earliestReviewDate(NOW),
    allowedLabels: variantLabels([
      { colorLabel: "Grafit", switchName: "Próg" },
      { colorLabel: "Mgła", size: "xl" },
    ]),
  };
  const good = {
    author: "Ola K.",
    date: "2026-09-14",
    rating: 5,
    variant_label: "Grafit · Próg",
    text: "Cicha i lekka. Pasuje do małej dłoni.",
  };
  const codes = (over: Partial<typeof good>) =>
    reviewErrors(0, { ...good, ...over }, ctx).map((e) => e.code);

  it("poprawna opinia przechodzi; 6 miesiecy wstecz to 2026-04-07", () => {
    expect(codes({})).toEqual([]);
    expect(ctx.earliest).toBe("2026-04-07");
    expect(codes({ date: "2026-04-07" })).toEqual([]);
    expect(codes({ variant_label: "Mgła · XL" })).toEqual([]);
  });

  it("autor, data, wariant, dlugosc i twierdzenia o autentycznosci", () => {
    expect(codes({ author: "ola" })).toEqual(["invalid_author"]);
    expect(codes({ author: "Ola Kowalska" })).toEqual(["invalid_author"]);
    expect(codes({ date: "2026-10-08" })).toEqual(["future_date"]);
    expect(codes({ date: "2026-04-06" })).toEqual(["too_old"]);
    expect(codes({ variant_label: "Zielony" })).toEqual(["unknown_variant_label"]);
    expect(codes({ text: "Raz. Dwa. Trzy. Cztery. Piec." })).toEqual(["invalid_length"]);
    expect(codes({ text: "   " })).toEqual(["invalid_length"]);
    expect(codes({ text: "To prawdziwa opinia klienta." })).toEqual(["claims_authenticity"]);
    expect(codes({ text: "Zweryfikowany zakup, polecam." })).toEqual(["claims_authenticity"]);
  });
});
