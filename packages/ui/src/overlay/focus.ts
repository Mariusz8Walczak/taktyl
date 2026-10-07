const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Elementy, do ktorych da sie dojsc klawiszem Tab wewnatrz kontenera (bez ukrytych i wylaczonych). */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.getAttribute("tabindex") !== "-1" &&
      !el.closest("[hidden], [inert]") &&
      el.getAttribute("aria-hidden") !== "true",
  );
}

/** Pulapka fokusu: Tab i Shift+Tab kraza wewnatrz kontenera. Zwraca true, gdy zdarzenie obsluzono. */
export function trapTab(event: KeyboardEvent | React.KeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const items = getFocusable(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    root.focus();
    return true;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === root || !root.contains(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !root.contains(active))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
