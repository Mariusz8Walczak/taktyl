import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, expect, vi } from "vitest";
import { resetMemoryStorage } from "../src/lib/storage/safe-storage";

expect.extend(axeMatchers);

// Biezaca sciezka dla usePathname (testy ustawiaja globalThis.__pathname).
vi.mock("next/navigation", () => ({
  usePathname: () => (globalThis as { __pathname?: string }).__pathname ?? "/",
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
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-pasek-demo");
});
