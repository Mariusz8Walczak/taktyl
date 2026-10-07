import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(axeMatchers);

// axe-core wywoluje canvas.getContext przy sprawdzaniu ligatur ikon; jsdom go nie implementuje.
HTMLCanvasElement.prototype.getContext = () => null;
afterEach(() => cleanup());
