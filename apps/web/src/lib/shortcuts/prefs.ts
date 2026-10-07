// F-010 (WCAG 2.1.4): preferencje skrotow klawiszowych w `taktyl.prefs.v1` (localStorage, wszystko w try/catch przez
// safe-storage, docs/11 pulapka 10). Klucz niesie tylko ustawienia interfejsu, zadnych danych osobowych.
import { readItem, writeItem } from "../storage/safe-storage";

export const PREFS_KEY = "taktyl.prefs.v1";
/** Zdarzenie okna po zmianie preferencji (hosty skrotow czytaja swiezy stan). */
export const PREFS_EVENT = "taktyl:prefs";

export interface Prefs {
  /** false = uzytkownik wylaczyl skroty jednoklawiszowe. */
  shortcuts: boolean;
}

const DEFAULTS: Prefs = { shortcuts: true };

function readAll(): Record<string, unknown> {
  try {
    const raw = readItem("local", PREFS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function readPrefs(): Prefs {
  const all = readAll();
  return { shortcuts: typeof all.shortcuts === "boolean" ? all.shortcuts : DEFAULTS.shortcuts };
}

/** Zapisuje ustawienie, zachowujac obce klucze obiektu (inne zadania moga dopisywac swoje). */
export function writePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...readAll(), ...patch };
  writeItem("local", PREFS_KEY, JSON.stringify(next));
  const prefs = readPrefs();
  try {
    window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: prefs }));
  } catch {
    /* brak window: nic do powiadomienia */
  }
  return prefs;
}

export const shortcutsEnabled = (): boolean => readPrefs().shortcuts;
