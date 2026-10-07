// I-010 (TAKTYL-44, docs/10): odczyt warstwy danych. Kopia lustrzana w sessionStorage przezywa twarde przeladowania,
// dzieki czemu mozna policzyc `purchase` takze po odswiezeniu potwierdzenia (docs/12 S20).
import type { Page } from "@playwright/test";

export type TrackedEvent = { event: string; [key: string]: unknown };

const MIRROR_KEY = "__e2e_datalayer";

/** Wywolaj PRZED pierwsza nawigacja (addInitScript). Nie zmienia zachowania sklepu: tylko dopisuje kopie wpisow. */
export async function mirrorDataLayer(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    const w = window as unknown as { dataLayer: unknown[] };
    const layer: unknown[] = (w.dataLayer = w.dataLayer || []);
    const save = (item: unknown) => {
      try {
        const it = item as unknown as ArrayLike<unknown> & { event?: unknown };
        const tag = Object.prototype.toString.call(it);
        // Czyszczenie `{ ecommerce: null }` nie jest zdarzeniem: pomijamy; wpisy gtag() to Arguments lub tablica.
        if (typeof it.event !== "string" && tag !== "[object Arguments]" && !Array.isArray(it))
          return;
        const raw =
          typeof (it as { event?: unknown }).event === "string"
            ? it
            : {
                event: `gtag_${String(it[0])}_${String(it[1])}`,
                args: Array.from(it as ArrayLike<unknown>),
              };
        const list = JSON.parse(sessionStorage.getItem(key) ?? "[]");
        list.push(JSON.parse(JSON.stringify(raw)));
        sessionStorage.setItem(key, JSON.stringify(list));
      } catch {
        /* brak sessionStorage: pomijamy kopie */
      }
    };
    const original = layer.push.bind(layer);
    layer.push = (...items: unknown[]) => {
      items.forEach(save);
      return original(...items);
    };
  }, MIRROR_KEY);
}

/** Zdarzenia z kopii lustrzanej (bez czyszczen `{ ecommerce: null }`), w kolejnosci wyslania. */
export async function trackedEvents(page: Page): Promise<TrackedEvent[]> {
  const list = await page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key) ?? "[]") as unknown[],
    MIRROR_KEY,
  );
  return (list as TrackedEvent[]).filter((e) => typeof e?.event === "string");
}

/** Zdarzenia bezposrednio z window.dataLayer (bez kopii): wpisy gtag() dostaja nazwe gtag_<komenda>_<podkomenda>. */
export async function liveDataLayer(page: Page): Promise<TrackedEvent[]> {
  return page.evaluate(() => {
    const layer = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []) as unknown[];
    return layer
      .map((item) => {
        const it = item as ArrayLike<unknown> & { event?: unknown };
        if (typeof it.event === "string") return JSON.parse(JSON.stringify(it));
        if (it && typeof it.length === "number" && typeof it[0] === "string") {
          return { event: `gtag_${String(it[0])}_${String(it[1])}`, args: Array.from(it) };
        }
        return null;
      })
      .filter(Boolean) as TrackedEvent[];
  });
}

export const names = (events: TrackedEvent[]): string[] => events.map((e) => e.event);

/** Czy `expected` wystepuje w `actual` w podanej kolejnosci (jako podciag, z dowolnymi zdarzeniami miedzy). */
export function isOrderedSubsequence(actual: string[], expected: string[]): boolean {
  let i = 0;
  for (const name of actual) if (name === expected[i]) i += 1;
  return i === expected.length;
}
