// F-001: pasek demo (zamykany na sesje, storage w try/catch, bez migania).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DEMO_BAR_ATTR,
  DEMO_BAR_KEY,
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

  it("zamkniecie usuwa pasek, zapisuje sesje i ustawia atrybut na <html>", async () => {
    render(<DemoBar label={label} />);
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByText(label)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(DEMO_BAR_KEY)).toBe("closed");
    expect(document.documentElement.getAttribute(DEMO_BAR_ATTR)).toBe("closed");
  });

  it("zamkniety w tej sesji nie wraca po ponownym wejsciu na strone", () => {
    window.sessionStorage.setItem(DEMO_BAR_KEY, "closed");
    render(<DemoBar label={label} />);
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });

  it("w nowej sesji (pusty sessionStorage) pasek wraca", () => {
    window.sessionStorage.setItem(DEMO_BAR_KEY, "closed");
    window.sessionStorage.clear();
    render(<DemoBar label={label} />);
    expect(screen.getByText(label)).toBeVisible();
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

  it("skrypt przed malowaniem ustawia atrybut dla zamknietej sesji i nie rzuca przy wyjatku storage", () => {
    window.sessionStorage.setItem(DEMO_BAR_KEY, "closed");
    new Function(DEMO_BAR_SCRIPT)();
    expect(document.documentElement.getAttribute(DEMO_BAR_ATTR)).toBe("closed");

    document.documentElement.removeAttribute(DEMO_BAR_ATTR);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    expect(() => new Function(DEMO_BAR_SCRIPT)()).not.toThrow();
    expect(document.documentElement.hasAttribute(DEMO_BAR_ATTR)).toBe(false);
  });
});
