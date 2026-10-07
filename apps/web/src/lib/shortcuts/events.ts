// F-010, A-17: zdarzenia i pomiar skrotow. `shortcut_use` (docs/10 §6) z parametrem `key`: "/", "esc", "?".
import { track } from "../track";
import type { ShortcutKey } from "./keys";

/** Okno listy skrotow otwiera tez przycisk w stopce (TAKTYL-59). */
export const OPEN_SHORTCUTS_EVENT = "taktyl:open-shortcuts";
/** Czas klasy `is-wcisniety` (docs/07 §3.1: --d-klik = 90 ms; ten sam czas ma KLIK_MS w @taktyl/ui). */
const KBD_PRESS_MS = 90;
export const OPEN_SEARCH_EVENT = "taktyl:open-search";

/** A-17: klawisz <kbd> wciska sie (klasa `is-wcisniety`, czas z tokenu --d-klik w CSS ui) po uzyciu skrotu. */
export function pressKbd(root: ParentNode, matchText: string, ms = KBD_PRESS_MS): void {
  for (const el of Array.from(root.querySelectorAll("kbd"))) {
    if (el.textContent?.trim() !== matchText) continue;
    el.classList.add("is-wcisniety");
    window.setTimeout(() => el.classList.remove("is-wcisniety"), ms);
  }
}

export function trackShortcut(key: ShortcutKey): void {
  track("shortcut_use", { key });
}
