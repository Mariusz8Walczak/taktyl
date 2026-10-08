import "./animation-event-stub"; // przed react-dom (TAKTYL-36)
import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup, configure } from "@testing-library/react";
import { createElement } from "react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, expect, vi } from "vitest";
import { cartUi } from "../src/lib/cart/ui";
import { resetMemoryStorage } from "../src/lib/storage/safe-storage";

expect.extend(axeMatchers);

// TAKTYL-68: findBy*/waitFor domyslnie czekaja 1 s; pod obciazeniem (rownolegle pakiety turbo, kontener test) lazy-wyspy
// (baner zgod, okna) potrafia sie zamontowac pozniej, co dawalo sporadyczny timeout S24. 5 s to zapas, nie zmiana asercji.
configure({ asyncUtilTimeout: 5000 });

// Biezaca sciezka dla usePathname (testy ustawiaja globalThis.__pathname).
vi.mock("next/navigation", () => ({
  usePathname: () => (globalThis as { __pathname?: string }).__pathname ?? "/",
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {}, prefetch: () => {} }),
}));
// next/link bez kontekstu routera: zwykly odnosnik (nawigacja nie jest tematem tych testow).
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    createElement("a", { href, ...rest }, children),
}));

// axe-core wywoluje canvas.getContext; jsdom go nie implementuje.
HTMLCanvasElement.prototype.getContext = () => null;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (globalThis as { __pathname?: string }).__pathname;
  resetMemoryStorage();
  cartUi.reset(); // stan szuflady i "Dodano" jest modulowy: nie przecieka miedzy testami
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-pasek-demo");
});
