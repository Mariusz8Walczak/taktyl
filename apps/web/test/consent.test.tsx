// F-240, F-242 (docs/10 §2): tryb zgody, baner (rownorzedne przyciski, a11y), stopka. S24: pierwsza wizyta.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ConsentManager } from "../src/components/consent/consent-manager";
import { CookieSettingsButton } from "../src/components/consent/cookie-settings-button";
import { DemoBar } from "../src/components/layout/demo-bar";
import { CONSENT_BOOTSTRAP_SCRIPT } from "../src/lib/consent/bootstrap";
import {
  ACCEPT_ALL,
  CONSENT_KEY,
  NECESSARY_ONLY,
  readConsent,
  resetConsentRuntime,
  saveConsent,
} from "../src/lib/consent/consent";

const calls = (): unknown[][] =>
  (window.dataLayer ?? []).map((e) => Array.from(e as unknown as ArrayLike<unknown>));
const gtmScript = () => document.head.querySelector("script[src]");

beforeEach(() => {
  window.dataLayer = [];
  resetConsentRuntime();
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

describe("fragment trybu zgody w <head> (docs/10 §2)", () => {
  it("domyslnie wszystko denied + wait_for_update 500", () => {
    new Function(CONSENT_BOOTSTRAP_SCRIPT)();
    expect(calls()).toEqual([
      [
        "consent",
        "default",
        {
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          analytics_storage: "denied",
          wait_for_update: 500,
        },
      ],
    ]);
  });

  it("powracajacy uzytkownik: zapisana decyzja jest odtworzona zaraz po default", () => {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ v: 1, at: "x", analytics: true, marketing: false }),
    );
    new Function(CONSENT_BOOTSTRAP_SCRIPT)();
    expect(calls()[1]).toEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted",
      },
    ]);
  });

  it("TAKTYL-84: powracajacy uzytkownik dostaje html[data-zgody-zapisane] przed malowaniem (CSS chowa baner z HTML)", () => {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ v: 1, at: "x", analytics: false, marketing: false }),
    );
    document.documentElement.removeAttribute("data-zgody-zapisane");
    new Function(CONSENT_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement).toHaveAttribute("data-zgody-zapisane");
    document.documentElement.removeAttribute("data-zgody-zapisane");
  });

  it("brak decyzji: znacznika nie ma", () => {
    document.documentElement.removeAttribute("data-zgody-zapisane");
    new Function(CONSENT_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement).not.toHaveAttribute("data-zgody-zapisane");
  });

  it("uszkodzony localStorage nie rzuca", () => {
    window.localStorage.setItem(CONSENT_KEY, "{nie json");
    expect(() => new Function(CONSENT_BOOTSTRAP_SCRIPT)()).not.toThrow();
  });
});

describe("saveConsent", () => {
  it("akceptacja wszystkich: update granted, zapis z data", () => {
    const rec = saveConsent(ACCEPT_ALL, undefined, new Date("2026-10-07T10:00:00Z"));
    expect(rec.at).toBe("2026-10-07T10:00:00.000Z");
    expect(calls()).toEqual([
      [
        "consent",
        "update",
        {
          ad_storage: "granted",
          ad_user_data: "granted",
          ad_personalization: "granted",
          analytics_storage: "granted",
        },
      ],
    ]);
    expect(readConsent()).toMatchObject({ analytics: true, marketing: true });
  });

  it("odrzucenie: wszystko denied", () => {
    saveConsent(NECESSARY_ONLY);
    expect(calls()[0]?.[2]).toMatchObject({ analytics_storage: "denied", ad_storage: "denied" });
  });

  it("wyjatek localStorage: decyzja zostaje w pamieci", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("zablokowane", "SecurityError");
    });
    saveConsent({ analytics: true, marketing: false });
    expect(readConsent()).toMatchObject({ analytics: true, marketing: false });
  });

  it("GTM: bez ID nic sie nie laduje; z ID dopiero po zgodzie analitycznej", () => {
    saveConsent(ACCEPT_ALL);
    expect(gtmScript()).toBeNull();
    saveConsent(NECESSARY_ONLY, "GTM-ABC123");
    expect(gtmScript()).toBeNull();
    saveConsent({ analytics: true, marketing: false }, "GTM-ABC123");
    expect(gtmScript()?.getAttribute("src")).toContain("GTM-ABC123");
  });

  it("GTM odrzuca nieprawidlowy identyfikator", () => {
    saveConsent(ACCEPT_ALL, 'x"><script>');
    expect(gtmScript()).toBeNull();
  });
});

describe("ConsentManager (F-240)", () => {
  it("TAKTYL-84: baner jest w HTML z serwera (stan domyslny), bez czekania na hydracje", () => {
    const html = renderToString(<ConsentManager />);
    expect(html).toContain('class="zgody"');
    expect(html).toContain("Akceptuję wszystkie");
    expect(html).toContain("Tylko niezbędne");
    expect(html).toContain("Ustawienia");
  });

  it("S24: pierwsza wizyta - pasek demo i baner z rownorzednymi przyciskami, bez wywolan do narzedzi", async () => {
    render(
      <>
        <DemoBar label="Taktyl to sklep demonstracyjny." />
        <ConsentManager gtmId="GTM-ABC123" />
      </>,
    );
    const all = await screen.findByRole("button", { name: "Akceptuję wszystkie" });
    const necessary = screen.getByRole("button", { name: "Tylko niezbędne" });
    expect(all.className).toBe(necessary.className); // ten sam wariant i rozmiar
    expect(screen.getByRole("button", { name: "Ustawienia" })).toBeInTheDocument();
    expect(screen.getAllByText(/sklep demonstracyjny/i).length).toBeGreaterThan(0);
    expect(gtmScript()).toBeNull(); // brak GTM przed zgoda
    expect(calls().filter((c) => c[0] === "consent")).toEqual([]); // update dopiero po decyzji
  });

  it("baner nie jest modalny, nie kradnie fokusu i nie ma bledow a11y", async () => {
    const { container } = render(<ConsentManager />);
    const region = await screen.findByRole("region", { name: "Zgody na pliki cookies" });
    expect(region).not.toHaveAttribute("aria-modal");
    expect(document.body).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Tylko niezbedne: baner znika, decyzja zapisana, GTM nie laduje", async () => {
    const user = userEvent.setup();
    render(<ConsentManager gtmId="GTM-ABC123" />);
    await user.click(await screen.findByRole("button", { name: "Tylko niezbędne" }));
    expect(screen.queryByRole("region", { name: "Zgody na pliki cookies" })).toBeNull();
    expect(readConsent()).toMatchObject({ analytics: false, marketing: false });
    expect(gtmScript()).toBeNull();
  });

  it("Akceptuje wszystkie: GTM zaladowany (ID ustawione)", async () => {
    const user = userEvent.setup();
    render(<ConsentManager gtmId="GTM-ABC123" />);
    await user.click(await screen.findByRole("button", { name: "Akceptuję wszystkie" }));
    expect(gtmScript()).not.toBeNull();
  });

  it("Ustawienia: kategorie, niezbedne zablokowane, Esc nie jest decyzja, zapis wyboru", async () => {
    const user = userEvent.setup();
    render(<ConsentManager />);
    await user.click(await screen.findByRole("button", { name: "Ustawienia" }));
    await screen.findByRole("dialog", { name: "Ustawienia cookies" });
    expect(screen.getByRole("checkbox", { name: "Niezbędne" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(readConsent()).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Ustawienia" }));
    await user.click(await screen.findByRole("checkbox", { name: "Analityczne" }));
    await user.click(screen.getByRole("button", { name: "Zapisz wybór" }));
    expect(readConsent()).toMatchObject({ analytics: true, marketing: false });
  });

  it("zapisana decyzja: brak banera, a link ze stopki otwiera ustawienia z obecnymi wartosciami", async () => {
    const user = userEvent.setup();
    saveConsent({ analytics: true, marketing: false });
    render(
      <>
        <ConsentManager />
        <CookieSettingsButton />
      </>,
    );
    expect(screen.queryByRole("region", { name: "Zgody na pliki cookies" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ustawienia cookies" }));
    expect(await screen.findByRole("checkbox", { name: "Analityczne" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Marketingowe" })).not.toBeChecked();
  });
});
