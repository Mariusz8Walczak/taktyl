import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, expect, vi } from "vitest";

expect.extend(axeMatchers);

interface NavMock {
  pathname: string;
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  search: string;
}
const nav = (): NavMock => {
  const g = globalThis as { __nav?: NavMock };
  g.__nav ??= { pathname: "/", search: "", push: vi.fn(), replace: vi.fn() };
  return g.__nav;
};

// next/navigation bez kontekstu routera: testy czytaja i ustawiaja globalThis.__nav.
vi.mock("next/navigation", () => ({
  usePathname: () => nav().pathname,
  useSearchParams: () => new URLSearchParams(nav().search),
  useRouter: () => ({ push: nav().push, replace: nav().replace, refresh: () => undefined }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
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
  delete (globalThis as { __nav?: NavMock }).__nav;
  window.localStorage.clear();
  window.sessionStorage.clear();
});
