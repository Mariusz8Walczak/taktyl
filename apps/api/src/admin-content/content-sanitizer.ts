// B-300, B-304, B-305, B-307 (docs/14 par. 7 A03, docs/17 par. 3.5): sanityzacja tresci wpisywanych w panelu. Zapisujemy Markdown
// ograniczony do listy dozwolonych znacznikow HTML i adresow (allowlista, nie czarna lista): bez skryptow, ramek, obrazow,
// atrybutow zdarzen (on*), stylow i adresow javascript:/data:. Funkcje czyste, bez I/O.

/** Dozwolone znaczniki HTML w Markdownie (bez atrybutow poza href w <a>). */
export const ALLOWED_TAGS: ReadonlySet<string> = new Set([
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

/** Znaczniki, ktorych tresc znika razem ze znacznikiem (nie zostaje jako tekst). */
const DROP_WITH_CONTENT =
  "script|style|iframe|frame|frameset|object|embed|applet|noscript|template|svg|math|form|textarea|select|option|button|title|head|link|meta|base|audio|video|canvas|map|dialog|xmp|plaintext|noembed|noframes";
const DROP_BLOCK = new RegExp(`<(${DROP_WITH_CONTENT})\\b[\\s\\S]*?<\\/\\1\\s*>`, "gi");

/** Adres dozwolony w odnosniku: wzgledny, kotwica, https w domenie taktyl.example albo mailto na taktyl.example. */
const SAFE_URL =
  /^(?:\/(?![/\\])[^\s<>"']*|#[A-Za-z0-9_-]*|https:\/\/(?:[a-z0-9-]+\.)*taktyl\.example(?:[/?#][^\s<>"']*)?|mailto:[^@\s<>"']+@taktyl\.example)$/i;

export const isSafeUrl = (url: string): boolean => SAFE_URL.test(url.trim());

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Dekodowanie encji przed ocena adresu: `jav&#x61;script:` ma byc ocenione jako javascript:. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) =>
      String.fromCodePoint(Math.min(Number.parseInt(h, 16) || 0, 0x10ffff)),
    )
    .replace(/&#(\d+);?/g, (_, d: string) =>
      String.fromCodePoint(Math.min(Number(d) || 0, 0x10ffff)),
    )
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

const urlOk = (raw: string): boolean => {
  const decoded = decodeEntities(raw);
  return !CONTROL_CHARS.test(decoded) && isSafeUrl(decoded);
};

const escapeAttr = (s: string): string =>
  s
    .replace(/&(?!amp;|#\d+;|#x[0-9a-f]+;)/gi, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/[<>]/g, "");

/** Wartosc atrybutu href z surowego tekstu znacznika (w cudzyslowach, apostrofach albo bez). */
function hrefOf(attrs: string): string | null {
  const m = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? "") : null;
}

const TAG = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g;

/** Usuwa wszystkie znaczniki HTML (tytuly, leady, opisy: czysty tekst). Pozostale `<` sa zamieniane na encje. */
export function stripTags(input: string): string {
  let out = input.replace(/\0/g, "");
  for (let i = 0; i < 8; i++) {
    const next = out
      .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
      .replace(DROP_BLOCK, "")
      .replace(/<\/?[a-zA-Z!?][^>]*>/g, "");
    if (next === out) break;
    out = next;
  }
  return out.replace(/</g, "&lt;");
}

/** Jedno przejscie: komentarze, bloki niebezpieczne, znaczniki spoza allowlisty, odbudowa dozwolonych bez atrybutow. */
function sanitizeHtmlPass(input: string): string {
  return input
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(DROP_BLOCK, "")
    .replace(TAG, (full, rawName: string, attrs: string) => {
      const name = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (full.startsWith("</")) return `</${name}>`;
      if (name === "a") {
        const href = hrefOf(attrs);
        return href !== null && urlOk(href) ? `<a href="${escapeAttr(href.trim())}">` : "<a>";
      }
      return `<${name}>`;
    });
}

/** Wzorzec dokladnych form wypuszczanych przez sanitizer (znacznik bez atrybutow albo <a href="...">), tylko male litery. */
const EXACT_ALLOWED = new RegExp(
  `<(?!\\/?(?:${[...ALLOWED_TAGS].filter((t) => t !== "a").join("|")})>|\\/a>|a>|a href="[^"<>]*">)`,
  "g",
);

/** Skladnia Markdown: obrazy znikaja (regula 1), definicje i odnosniki tylko z bezpiecznym adresem (inaczej sam tekst). */
function sanitizeMarkdownSyntax(input: string): string {
  return input
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(
      /^[ \t]*(!?)\[[^\]\n]*\]:[ \t]*<?([^\s>]*)>?.*$/gm,
      (line, bang: string, url: string) => (bang === "" && urlOk(url) ? line : ""),
    )
    .replace(
      /\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g,
      (full, text: string, url: string) => (urlOk(url) ? full : text),
    );
}

/**
 * Sanityzuje Markdown z ewentualnym HTML. HTML i skladnia Markdown sa czyszczone na przemian do punktu stalego (odporne na
 * obejscia, w ktorych usuniecie jednego fragmentu sklada nowy znacznik lub odnosnik, np. `<scr<script>ipt>`); na koncu kazde `<`,
 * ktore nie otwiera dokladnie wypuszczonego znacznika, staje sie `&lt;`.
 */
export function sanitizeMarkdown(input: string): string {
  let out = input.replace(/\r\n?/g, "\n").replace(/\0/g, "");
  for (let i = 0; i < 8; i++) {
    const next = sanitizeMarkdownSyntax(sanitizeHtmlPass(out));
    if (next === out) break;
    out = next;
  }
  out = out.replace(EXACT_ALLOWED, "&lt;");
  return out
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
