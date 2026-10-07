// F-220, F-221 (docs/16 §2): maly parser Markdownu ograniczonego (ten sam podzbior co sanityzacja w API, ADM-010):
// naglowki ##-####, akapity, listy, cytat, linia, tabela, pogrubienie, kursywa, kod, odnosniki. Czysty, bez I/O.
// Tresc z API jest juz po sanityzacji, a render sklada elementy React (bez dangerouslySetInnerHTML).
import { normalizeSearchText } from "@taktyl/domain";

export type MdBlock =
  | { kind: "h"; level: 2 | 3 | 4; text: string; id: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "table"; head: string[]; rows: string[][] };

/** Adres naglowka: male litery bez znakow diakrytycznych (ł osobno, docs/04 §9), myslniki. */
export function headingSlug(text: string): string {
  const plain = text.replace(/[*_`]/g, "");
  return (
    normalizeSearchText(plain)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sekcja"
  );
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}
const isSeparator = (line: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  const used = new Map<string, number>();
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? "").trimEnd();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(Math.max((h[1] as string).length, 2), 4) as 2 | 3 | 4;
      const text = h[2] as string;
      const base = headingSlug(text);
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      blocks.push({ kind: "h", level, text, id: n === 0 ? base : `${base}-${n + 1}` });
      continue;
    }
    if (/^(?:-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }
    if (line.trimStart().startsWith("|") && isSeparator(lines[i + 1] ?? "")) {
      flush();
      const head = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").trimStart().startsWith("|")) {
        rows.push(splitRow(lines[i] as string));
        i++;
      }
      i--;
      blocks.push({ kind: "table", head, rows });
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flush();
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === "quote") prev.text += ` ${q[1] as string}`;
      else blocks.push({ kind: "quote", text: q[1] as string });
      continue;
    }
    const li = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const kind = li[1] ? "ul" : "ol";
      const prev = blocks[blocks.length - 1];
      if (prev?.kind === kind) prev.items.push(li[3] as string);
      else blocks.push({ kind, items: [li[3] as string] });
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** F-220: spis tresci z naglowkow H2. */
export function extractToc(blocks: readonly MdBlock[]): { id: string; text: string }[] {
  return blocks.flatMap((b) =>
    b.kind === "h" && b.level === 2 ? [{ id: b.id, text: b.text.replace(/[*_`]/g, "") }] : [],
  );
}
