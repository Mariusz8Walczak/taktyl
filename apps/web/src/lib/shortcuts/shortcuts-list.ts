// F-010: lista skrotow pokazywana w oknie "?" (laduje sie razem z oknem, nie jest w bazie JS strony).
import type { ShortcutKey } from "./keys";

export interface ShortcutInfo {
  key: ShortcutKey;
  /** Tekst na klawiszu <kbd>. */
  keycap: string;
  label: string;
}

/** Lista pokazywana w oknie "?" (kolejnosc jak w docs/02 F-010). */
export const SHORTCUTS: readonly ShortcutInfo[] = [
  { key: "/", keycap: "/", label: "Przejdź do wyszukiwarki" },
  { key: "esc", keycap: "Esc", label: "Zamknij okno, szufladę lub menu" },
  { key: "?", keycap: "?", label: "Pokaż listę skrótów" },
];
