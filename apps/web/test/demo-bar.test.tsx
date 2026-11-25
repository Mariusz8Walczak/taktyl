// F-001: pasek demo (zamkniecie pamietane w localStorage przez DEMO_BAR_DAYS dni, storage w try/catch, bez migania).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DEMO_BAR_ATTR,
  DEMO_BAR_DAYS,
  DEMO_BAR_KEY,
  demoBarClosed,
  DEMO_BAR_SCRIPT,
  DemoBar,
} from "../src/components/layout/demo-bar";
import { SHOP_SETTINGS } from "./fixtures";

const label = SHOP_SETTINGS.demo.label;

describe("DemoBar (F-001)", () => {
  it("pokazuje tekst z ustawien sklepu", () => {
    render(<DemoBar label={label} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
  });

  it("zamkniecie usuwa pasek, zapisuje date w localStorage i ustawia atrybut na <html>", async () => {
    render(<DemoBar label={label} />);
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_BAR_KEY)).toMatch(/^closed:\d+$/);
    expect(document.documentElement.getAttribute(DEMO_BAR_ATTR)).toBe("closed");
  });

  it("zamkniety nie wraca w nowej sesji (localStorage), ale wraca po DEMO_BAR_DAYS dniach", () => {
    window.localStorage.setItem(DEMO_BAR_KEY, `closed:${Date.now()}`);
    window.sessionStorage.clear();
    const { unmount } = render(<DemoBar label={label} />);
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    unmount();
    const old = Date.now() - (DEMO_BAR_DAYS + 1) * 24 * 60 * 60 * 1000;
    expect(demoBarClosed(`closed:${old}`)).toBe(false);
    window.localStorage.setItem(DEMO_BAR_KEY, `closed:${old}`);
    render(<DemoBar label={label} />);
    expect(screen.getByText(label)).toBeVisible();
    window.localStorage.removeItem(DEMO_BAR_KEY);
  });

  it("wyjatek storage przy zapisie nie psuje zamykania (zapas w pamieci)", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    render(<DemoBar label={label} />);
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("wyjatek storage przy odczycie nie psuje renderu: pasek jest widoczny", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    render(<DemoBar label={label} />);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("skrypt przed malowaniem ustawia atrybut dla zamknietego paska i nie rzuca przy wyjatku storage", () => {
    window.localStorage.setItem(DEMO_BAR_KEY, `closed:${Date.now()}`);
    new Function(DEMO_BAR_SCRIPT)();
    window.localStorage.removeItem(DEMO_BAR_KEY);
    expect(document.documentElement.getAttribute(DEMO_BAR_ATTR)).toBe("closed");

    document.documentElement.removeAttribute(DEMO_BAR_ATTR);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    expect(() => new Function(DEMO_BAR_SCRIPT)()).not.toThrow();
    expect(document.documentElement.hasAttribute(DEMO_BAR_ATTR)).toBe(false);
  });
});
