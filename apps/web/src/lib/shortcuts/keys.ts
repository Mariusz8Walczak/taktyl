// F-010 (docs/10 §6 `shortcut_use`): czysta logika skrotow, bez React. Skrot jednoklawiszowy nie dziala z modyfikatorem
// (Ctrl/Alt/Meta zostaja dla przegladarki i czytnika) ani gdy fokus jest w polu tekstowym.
export type ShortcutKey = "/" | "esc" | "?";

const FIELD_SELECTOR = "input, textarea, select, [contenteditable]";

/** Fokus w polu tekstowym, liscie wyboru albo elemencie edytowalnym - skroty nie dzialaja. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(FIELD_SELECTOR) === null) return false;
  const editable = target.closest("[contenteditable]");
  if (editable && editable.getAttribute("contenteditable") === "false") {
    return target.closest("input, textarea, select") !== null;
  }
  return true;
}

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  defaultPrevented?: boolean;
  isComposing?: boolean;
}

/** Ktory skrot jednoklawiszowy wywolalo zdarzenie ("/" albo "?"); Esc obsluguja nakladki. */
export function matchShortcut(e: KeyLike): "/" | "?" | null {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return null;
  return e.key === "/" ? "/" : e.key === "?" ? "?" : null;
}

/** Czy na stronie jest otwarta nakladka (@taktyl/ui: .tk-overlay bez `hidden`). */
export function overlayOpen(doc: Document = document): boolean {
  return doc.querySelector(".tk-overlay:not([hidden])") !== null;
}
