// B-102 (D-006): strony informacyjne i prawne z content/pages/*.md (frontmatter + tresc Markdown).
import { pageFrontmatterSchema } from "./schemas.js";

export interface SeedPage {
  slug: string;
  title: string;
  /** Data aktualizacji z frontmattera (RRRR-MM-DD), uzyta jako `published_at`. */
  updated: string;
  demoNotice: boolean;
  bodyMd: string;
}

/** Prosty frontmatter `klucz: wartosc` miedzy liniami `---`; tresc po nim bez zmian (poza obcieciem krawedzi). */
export function parsePage(source: string, file: string): SeedPage {
  const text = (source.charCodeAt(0) === 0xfeff ? source.slice(1) : source)
    .split("\r\n")
    .join("\n");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: brak frontmattera`);
  const fm: Record<string, string> = {};
  for (const line of (m[1] ?? "").split("\n")) {
    if (line.trim() === "") continue;
    const i = line.indexOf(":");
    if (i < 1) throw new Error(`${file}: niepoprawna linia frontmattera "${line}"`);
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const parsed = pageFrontmatterSchema.safeParse(fm);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`${file}: niepoprawny frontmatter\n${lines.join("\n")}`);
  }
  const bodyMd = (m[2] ?? "").trim();
  if (bodyMd === "") throw new Error(`${file}: pusta tresc`);
  return {
    slug: parsed.data.slug,
    title: parsed.data.title,
    updated: parsed.data.updated,
    demoNotice: parsed.data.demo,
    bodyMd,
  };
}
