// B-102 (D-006, D-011): strony informacyjne i prawne z content/pages/*.md oraz poradniki z content/guides/*.md
// (frontmatter + tresc Markdown). FAQ i opinie to pliki JSON (content/faq.json, data/reviews.json), czytane w load.ts.
import { guideFrontmatterSchema, pageFrontmatterSchema } from "./schemas.js";

export interface SeedPage {
  slug: string;
  title: string;
  /** Data aktualizacji z frontmattera (RRRR-MM-DD), uzyta jako `published_at`. */
  updated: string;
  demoNotice: boolean;
  bodyMd: string;
}

/** F-220: artykul poradnika; `profile` to profil kreatora dla wejscia z CTA (`guide_profile`). */
export interface SeedGuide {
  slug: string;
  title: string;
  updated: string;
  lead: string;
  profile: string;
  readingMinutes: number;
  demoNotice: boolean;
  bodyMd: string;
}

/** Prosty frontmatter `klucz: wartosc` miedzy liniami `---`; tresc po nim bez zmian (poza obcieciem krawedzi). */
function splitFrontmatter(
  source: string,
  file: string,
): { fm: Record<string, string>; bodyMd: string } {
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
  const bodyMd = (m[2] ?? "").trim();
  if (bodyMd === "") throw new Error(`${file}: pusta tresc`);
  return { fm, bodyMd };
}

function frontmatterError(
  file: string,
  issues: readonly { path: PropertyKey[]; message: string }[],
) {
  const lines = issues.map((i) => `  ${i.path.map(String).join(".")}: ${i.message}`);
  return new Error(`${file}: niepoprawny frontmatter\n${lines.join("\n")}`);
}

export function parsePage(source: string, file: string): SeedPage {
  const { fm, bodyMd } = splitFrontmatter(source, file);
  const parsed = pageFrontmatterSchema.safeParse(fm);
  if (!parsed.success) throw frontmatterError(file, parsed.error.issues);
  return {
    slug: parsed.data.slug,
    title: parsed.data.title,
    updated: parsed.data.updated,
    demoNotice: parsed.data.demo,
    bodyMd,
  };
}

export function parseGuide(source: string, file: string): SeedGuide {
  const { fm, bodyMd } = splitFrontmatter(source, file);
  const parsed = guideFrontmatterSchema.safeParse(fm);
  if (!parsed.success) throw frontmatterError(file, parsed.error.issues);
  return {
    slug: parsed.data.slug,
    title: parsed.data.title,
    updated: parsed.data.updated,
    lead: parsed.data.lead,
    profile: parsed.data.profile,
    readingMinutes: parsed.data.reading_minutes,
    demoNotice: parsed.data.demo,
    bodyMd,
  };
}
