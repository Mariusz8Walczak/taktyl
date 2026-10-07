// F-243 (TAKTYL-60): panel podgladu zdarzen - nasluchiwanie `taktyl:track`, Wyczysc, Kopiuj jako JSON (Clipboard API
// i zapas), wpisy zgody z dataLayer, Esc, godzina Europe/Warsaw oraz brak ladowania bez parametru ?pomiar.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { TrackingPanel } from "../src/components/tracking-panel/tracking-panel";
import {
  maybeLoadTrackingPanel,
  trackingPanelRequested,
} from "../src/components/tracking-panel/loader";
import { copyText, formatTime } from "../src/lib/tracking-panel/entries";
import { TRACK_DOM_EVENT, track } from "../src/lib/track";

const mount = vi.hoisted(() => ({ fn: vi.fn(() => () => {}) }));
vi.mock("../src/components/tracking-panel/mount", () => ({ mountTrackingPanel: mount.fn }));

const emit = (detail: unknown) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(TRACK_DOM_EVENT, { detail }));
  });

beforeEach(() => {
  window.dataLayer = [];
  mount.fn.mockClear();
});
afterEach(() => window.history.replaceState(null, "", "/"));

describe("nasluchiwanie i lista", () => {
  it("dopisuje zdarzenia z taktyl:track: nazwa, godzina i parametry w JSON", async () => {
    render(<TrackingPanel />);
    emit({ event: "search", search_term: "cicha" });
    emit({ event: "shortcut_use", key: "/" });
    await userEvent.setup().click(screen.getByRole("button", { name: /Podgląd zdarzeń \(2\)/ }));
    const list = screen.getByRole("list", { name: "Zdarzenia" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("search");
    expect(items[0]?.querySelector("pre")?.textContent).toContain('"search_term": "cicha"');
    expect(items[1]).toHaveTextContent("shortcut_use");
    expect(items[0]?.querySelector("time")?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("odbiera zdarzenia wyslane przez track() pod ?pomiar", () => {
    window.history.replaceState(null, "", "/?pomiar=1");
    render(<TrackingPanel />);
    act(() => track("shortcut_use", { key: "?" }));
    expect(screen.getByRole("button", { name: /Podgląd zdarzeń \(1\)/ })).toBeInTheDocument();
  });

  it("zaczyna od historii dataLayer (view_item sprzed otwarcia) i wpisow zgody", () => {
    window.dataLayer = [
      // gtag() wpycha obiekt `arguments`, nie tablice
      (function (..._a: unknown[]) {
        // eslint-disable-next-line prefer-rest-params -- gtag() wpycha dokladnie obiekt `arguments`
        return arguments;
      })("consent", "default", { analytics_storage: "denied" }) as unknown as Record<
        string,
        unknown
      >,
      { ecommerce: null },
      { event: "view_item", ecommerce: { currency: "PLN", value: 899 } },
    ];
    render(<TrackingPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Podgląd zdarzeń \(2\)/ }));
    const items = within(screen.getByRole("list", { name: "Zdarzenia" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("consent default");
    expect(items[0]).toHaveTextContent("analytics_storage");
    expect(items[1]).toHaveTextContent("view_item");
    expect(items[0]?.querySelector("time")).toHaveTextContent("wcześniej");
  });

  it("pokazuje consent update wyslany po otwarciu panelu", () => {
    render(<TrackingPanel />);
    act(() => {
      (function (..._a: unknown[]) {
        // eslint-disable-next-line prefer-rest-params -- jak wyzej
        window.dataLayer?.push(arguments as unknown as Record<string, unknown>);
      })("consent", "update", { analytics_storage: "granted" });
    });
    fireEvent.click(screen.getByRole("button", { name: /Podgląd zdarzeń \(1\)/ }));
    expect(screen.getByText("consent update")).toBeInTheDocument();
    // push nadal dziala i dopisuje do dataLayer
    expect(window.dataLayer).toHaveLength(1);
  });
});

describe("Wyczysc i kopiowanie", () => {
  it("'Wyczyść' usuwa liste", async () => {
    const user = userEvent.setup();
    render(<TrackingPanel />);
    emit({ event: "search", search_term: "x" });
    await user.click(screen.getByRole("button", { name: /Podgląd zdarzeń/ }));
    await user.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(screen.queryByRole("list", { name: "Zdarzenia" })).toBeNull();
    expect(screen.getByText(/Brak zdarzeń/)).toBeInTheDocument();
  });

  it("'Kopiuj jako JSON' wola Clipboard API z lista zdarzen i komunikuje wynik", async () => {
    const user = userEvent.setup(); // user-event podstawia wlasny schowek: nadpisujemy go PO setup()
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<TrackingPanel />);
    emit({ event: "search", search_term: "tkl" });
    await user.click(screen.getByRole("button", { name: /Podgląd zdarzeń/ }));
    await user.click(screen.getByRole("button", { name: "Kopiuj jako JSON" }));
    const copied = JSON.parse(writeText.mock.calls[0]?.[0] as string) as {
      name: string;
      payload: { search_term: string };
    }[];
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ name: "search", payload: { search_term: "tkl" } });
    expect(await screen.findByText("Skopiowano do schowka.")).toBeInTheDocument();
  });

  it("zapas: bez Clipboard API uzywa execCommand('copy'; gdy i to zawiedzie - komunikat", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    expect(await copyText("[]")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    exec.mockReturnValue(false);
    expect(await copyText("[]")).toBe(false);
    exec.mockImplementation(() => {
      throw new Error("zablokowane");
    });
    expect(await copyText("[]")).toBe(false);
  });
});

describe("dostepnosc i uklad", () => {
  it("przycisk ma aria-expanded i aria-controls, Esc zamyka i oddaje fokus", async () => {
    const user = userEvent.setup();
    render(<TrackingPanel />);
    const toggle = screen.getByRole("button", { name: /Podgląd zdarzeń/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toHaveAttribute(
      "hidden",
    );
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Podgląd zdarzeń pomiaru" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("panel jest stały (position: fixed w CSS), a w drzewie nie wymusza ukladu strony", () => {
    const { container } = render(<TrackingPanel />);
    expect(container.querySelector(".pomiar__panel")).not.toBeNull();
    expect(container.querySelector(".pomiar__przycisk")).not.toBeNull();
  });

  it("axe: otwarty panel z wpisami bez naruszen", async () => {
    const { container } = render(<TrackingPanel />);
    emit({ event: "search", search_term: "a" });
    fireEvent.click(screen.getByRole("button", { name: /Podgląd zdarzeń/ }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("godzina Europe/Warsaw", () => {
  it("lato (CEST, +2) i zima (CET, +1) niezaleznie od strefy przegladarki", () => {
    expect(formatTime(Date.UTC(2026, 9, 7, 10, 30, 15))).toBe("12:30:15");
    expect(formatTime(Date.UTC(2026, 0, 7, 10, 30, 15))).toBe("11:30:15");
    expect(formatTime(null)).toBe("wcześniej");
  });
});

describe("ladowanie tylko pod ?pomiar (0 B JS bez parametru)", () => {
  it("bez parametru kod panelu NIE jest ladowany", async () => {
    window.history.replaceState(null, "", "/klawiatury");
    expect(trackingPanelRequested()).toBe(false);
    expect(await maybeLoadTrackingPanel()).toBe(false);
    expect(mount.fn).not.toHaveBeenCalled();
  });

  it("z ?pomiar=1 modul jest ladowany i montowany raz", async () => {
    window.history.replaceState(null, "", "/klawiatury?pomiar=1");
    expect(await maybeLoadTrackingPanel()).toBe(true);
    expect(mount.fn).toHaveBeenCalledTimes(1);
  });
});
