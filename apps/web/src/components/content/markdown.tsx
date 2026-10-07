// F-220, F-221, wzorzec: tresc artykulu / strony informacyjnej (`blog-details`, docs/08 §6). Komponent serwerowy,
// zero JS po stronie klienta. Tresc z API jest po sanityzacji; mimo to skladamy elementy React (bez HTML-a z tekstu),
// obrazy znikaja (regula 1), a odnosniki przechodza przez ta sama allowliste co w API (isSafeContentUrl).
import { isSafeContentUrl } from "@taktyl/domain";
import Link from "next/link";
import type { ReactNode } from "react";
import { parseMarkdown, type MdBlock } from "../../lib/content/markdown";
import "../../styles/poradnik.css";

const INLINE =
  /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]*\]\([^)\s]*\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const source = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of source.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(source.slice(last, at));
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
      if (!isSafeContentUrl(href)) out.push(label);
      else if (href.startsWith("/") && !href.startsWith("//"))
        out.push(
          <Link key={key} href={href} className="tk-link">
            {label}
          </Link>,
        );
      else
        out.push(
          <a key={key} href={href} className="tk-link">
            {label}
          </a>,
        );
    } else {
      out.push(<em key={key}>{inline(tok.slice(1, -1), key)}</em>);
    }
    last = at + tok.length;
  }
  if (last < source.length) out.push(source.slice(last));
  return out;
}

function Block({ b, k }: { b: MdBlock; k: string }) {
  switch (b.kind) {
    case "h": {
      const H = `h${b.level}` as "h2" | "h3" | "h4";
      return <H id={b.id}>{inline(b.text, k)}</H>;
    }
    case "p":
      return <p>{inline(b.text, k)}</p>;
    case "quote":
      return <blockquote>{inline(b.text, k)}</blockquote>;
    case "hr":
      return <hr />;
    case "ul":
    case "ol": {
      const L = b.kind;
      return (
        <L>
          {b.items.map((t, j) => (
            <li key={`${k}-${j}`}>{inline(t, `${k}-${j}`)}</li>
          ))}
        </L>
      );
    }
    case "table":
      return (
        <div className="tresc-tabela" role="region" aria-label="Tabela" tabIndex={0}>
          <table>
            <thead>
              <tr>
                {b.head.map((c, j) => (
                  <th key={`${k}-h${j}`} scope="col">
                    {inline(c, `${k}-h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={`${k}-r${i}`}>
                  {r.map((c, j) => (
                    <td key={`${k}-r${i}-${j}`}>{inline(c, `${k}-r${i}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ markdown, blocks }: { markdown?: string; blocks?: readonly MdBlock[] }) {
  const list = blocks ?? parseMarkdown(markdown ?? "");
  return (
    <div className="tresc-tekst">
      {list.map((b, i) => (
        <Block key={`b${i}`} b={b} k={`b${i}`} />
      ))}
    </div>
  );
}
