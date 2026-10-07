// A-04 (docs/07 §3.3): przewijana kwota "Razem" w kreatorze i koszyku. Cyfry przewijaja sie od starej do nowej wartosci
// (JS, requestAnimationFrame), szerokosc stala dzieki font-variant-numeric: tabular-nums (.kwota). Czytnik ekranu
// dostaje tylko wynik koncowy: region aria-live ([data-kwota-live]) jest aktualizowany raz, po zakonczeniu.
import { formatPLN } from "@taktyl/domain";
import { prefersReducedMotion, tokenMs } from "./reduced-motion";

const aktywne = new WeakMap<HTMLElement, number>();

const ease = (t: number): number => 1 - Math.pow(1 - t, 3);

/**
 * Zmienia tekst `el` z `odGr` na `doGr` (grosze). Bez ruchu (reduced-motion, rowne wartosci, czas 0) wartosc jest od razu
 * koncowa. Kolejne wywolanie dla tego samego elementu przerywa poprzednie. Zwraca funkcje anulujaca (stan koncowy).
 */
export function animujKwote(
  el: HTMLElement,
  odGr: number,
  doGr: number,
  ms: number = tokenMs("--d-l"),
): () => void {
  const live = el.closest("[data-kwota]")?.querySelector<HTMLElement>("[data-kwota-live]") ?? null;
  const poprzednie = aktywne.get(el);
  if (poprzednie !== undefined) cancelAnimationFrame(poprzednie);
  aktywne.delete(el);

  const koniec = () => {
    aktywne.delete(el);
    el.textContent = formatPLN(doGr);
    if (live) live.textContent = el.textContent;
  };
  if (
    odGr === doGr ||
    ms <= 0 ||
    prefersReducedMotion() ||
    typeof requestAnimationFrame !== "function"
  ) {
    koniec();
    return koniec;
  }
  const t0 = performance.now();
  const krok = (now: number) => {
    const t = Math.min(1, (now - t0) / ms);
    if (t >= 1) {
      koniec();
      return;
    }
    el.textContent = formatPLN(Math.round(odGr + (doGr - odGr) * ease(t)));
    aktywne.set(el, requestAnimationFrame(krok));
  };
  aktywne.set(el, requestAnimationFrame(krok));
  return () => {
    const id = aktywne.get(el);
    if (id !== undefined) cancelAnimationFrame(id);
    koniec();
  };
}
