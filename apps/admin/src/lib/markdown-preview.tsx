// B-310, B-305 (docs/15 par. 9): podglad Markdownu ograniczonego "Tak to wyglada w sklepie". Bez dangerouslySetInnerHTML:
// tekst jest skladany w elementy React, a surowy HTML z pola pokazuje sie jako zwykly tekst. Dozwolone: naglowki ##-####,
// akapity, listy, cytat, linia, pogrubienie, kursywa, kod, odnosniki z adresem z tej samej allowlisty co sanityzacja w API
// (isSafeContentUrl z @taktyl/domain, ADM-010). Obrazy znikaja (regula 1).
import { isSafeContentUrl } from "@taktyl/domain";
import type { ReactNode } from "react";

const INLINE =
  /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]*\]\([^)\s]*\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const withoutImages = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of withoutImages.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(withoutImages.slice(last, at));
    const tok = m[0];
    const key = `${keyBase}-${n++}`;
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const link = /^\[([^\]]*)\]\(([^)\s]*)\)$/.exec(tok);
      const label = link?.[1] ?? tok;
      const href = link?.[2] ?? "";
      out.push(
        isSafeContentUrl(href) ? (
          <a key={key} href={href} className="tk-link" target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          label
        ),
      );
    } else {
      out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    }
    last = at + tok.length;
  }
  if (last < withoutImages.length) out.push(withoutImages.slice(last));
  return out;
}

type Block =
  | { kind: "h"; level: 2 | 3 | 4; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" };

export function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === "") {
      flush();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      const level = Math.min(Math.max((h[1] as string).length, 2), 4) as 2 | 3 | 4;
      blocks.push({ kind: "h", level, text: h[2] as string });
      continue;
    }
    if (/^(?:-{3,}|\*{3,})$/.test(line.trim())) {
      flush();
      blocks.push({ kind: "hr" });
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

export function MarkdownPreview({ markdown, label }: { markdown: string; label: string }) {
  const blocks = parseBlocks(markdown);
  return (
    <div className="adm-podglad" role="region" aria-label={label}>
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.kind) {
          case "h": {
            const H = `h${b.level}` as "h2" | "h3" | "h4";
            return <H key={key}>{inline(b.text, key)}</H>;
          }
          case "p":
            return <p key={key}>{inline(b.text, key)}</p>;
          case "quote":
            return <blockquote key={key}>{inline(b.text, key)}</blockquote>;
          case "hr":
            return <hr key={key} />;
          case "ul":
          case "ol": {
            const L = b.kind;
            return (
              <L key={key}>
                {b.items.map((t, j) => (
                  <li key={`${key}-${j}`}>{inline(t, `${key}-${j}`)}</li>
                ))}
              </L>
            );
          }
        }
      })}
    </div>
  );
}
