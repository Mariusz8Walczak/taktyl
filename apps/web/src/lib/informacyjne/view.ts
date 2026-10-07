// F-221, F-247 (docs/05 §8, docs/11 §1): model widoku strony informacyjnej i prawnej. Czyste funkcje bez I/O:
// baner demo z danych strony (`demo_notice`), spis tresci z naglowkow H2 dla dluzszych stron, data aktualizacji
// przez Intl w strefie Europe/Warsaw (regula 7), opis do <meta>.
import { applyNbsp } from "@taktyl/domain";
import { extractToc, type MdBlock } from "../content/markdown";

/** Tekst banera na gorze kazdej strony prawnej (docs/05 §8, docs/11 §1.3). */
export const DEMO_NOTICE = "Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.";

/** Spis tresci od tylu sekcji H2 (regulamin: 9, polityka prywatnosci: 6; krotsze strony go nie potrzebuja). */
export const TOC_MIN_SECTIONS = 6;

/** Strony treści, które obsługuje ten widok (adresy z docs/05 §1). */
export const INFO_PAGES = [
  "dostawa-i-platnosci",
  "zwroty-i-reklamacje",
  "regulamin",
  "polityka-prywatnosci",
  "cookies",
  "o-sklepie",
  "zuzyty-sprzet",
] as const;
export type InfoSlug = (typeof INFO_PAGES)[number];

const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "long",
  timeZone: "Europe/Warsaw",
});

/** "7 października 2026" - dzien kalendarzowy w strefie Europe/Warsaw. */
export function formatUpdated(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/**
 * Baner pokazujemy z danych strony; tresc zaczyna sie w pliku zrodlowym tym samym zdaniem jako cytat, wiec go
 * usuwamy, zeby nie dublowac (gdy `demo_notice` jest false, cytat zostaje jako zwykla tresc).
 */
export function stripDemoNotice(blocks: readonly MdBlock[], demo: boolean): MdBlock[] {
  const [first, ...rest] = blocks;
  if (demo && first?.kind === "quote" && first.text.replace(/\s+/g, " ").trim() === DEMO_NOTICE) {
    return rest;
  }
  return [...blocks];
}

export function infoToc(blocks: readonly MdBlock[]): { id: string; text: string }[] {
  const toc = extractToc(blocks);
  return toc.length >= TOC_MIN_SECTIONS ? toc : [];
}

/** Opis do <meta>: lead albo pierwszy akapit, do 160 znakow. */
export function pageDescription(lead: string | null, blocks: readonly MdBlock[]): string {
  const text = lead ?? blocks.find((b) => b.kind === "p")?.text ?? "";
  const plain = text.replace(/[*_`]/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const cut = plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}…` : plain;
  return applyNbsp(cut);
}
