// Stos otwartych nakladek: Esc i pulapka fokusu dzialaja tylko dla gornej (okno nad szuflada).
const stack: symbol[] = [];

export function pushOverlay(): symbol {
  const id = Symbol("nakladka");
  stack.push(id);
  return id;
}

export function removeOverlay(id: symbol): void {
  const i = stack.indexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopOverlay(id: symbol): boolean {
  return stack[stack.length - 1] === id;
}

// Blokada przewijania strony: licznik, bo nakladki moga sie nakladac.
let locks = 0;

export function lockScroll(): void {
  if (locks++ === 0) document.documentElement.classList.add("tk-scroll-lock");
}

export function unlockScroll(): void {
  if (locks > 0 && --locks === 0) document.documentElement.classList.remove("tk-scroll-lock");
}
