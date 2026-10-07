// F-009: stopka (4 kolumny, dane z ustawien, bez obcych domen i logotypow).
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Footer } from "../src/components/layout/footer";
import { SHOP_SETTINGS } from "./fixtures";

describe("Footer (F-009)", () => {
  it("ma landmark contentinfo i 4 kolumny z wlasciwymi tytulami i zapis do newslettera (F-223)", () => {
    render(<Footer settings={SHOP_SETTINGS} />);
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer)
        .getAllByRole("heading", { level: 2 })
        .map((h) => h.textContent),
    ).toEqual(["Sklep", "Pomoc", "Informacje prawne", "Kontakt", "Newsletter"]);
  });

  it("pokazuje etykiete demo, platnosci i dostawe tekstem z ustawien", () => {
    render(<Footer settings={SHOP_SETTINGS} />);
    expect(screen.getByText(SHOP_SETTINGS.demo.label)).toBeInTheDocument();
    expect(
      screen.getByText(/BLIK, Karta płatnicza, Szybki przelew, Przelew tradycyjny\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Automat paczkowy, Kurier, Odbiór osobisty \(Warszawa\)\./),
    ).toBeInTheDocument();
  });

  it("dane kontaktowe sa fikcyjne: domena taktyl.example, adres z ustawien, BDO bez numeru", () => {
    render(<Footer settings={SHOP_SETTINGS} />);
    expect(screen.getByRole("link", { name: "kontakt@taktyl.example" })).toHaveAttribute(
      "href",
      "mailto:kontakt@taktyl.example",
    );
    expect(screen.getByRole("link", { name: "+48 22 000 00 00" })).toHaveAttribute(
      "href",
      "tel:+48220000000",
    );
    expect(
      screen.getByText("ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Nr BDO: — (sklep fikcyjny)")).toBeInTheDocument();
  });

  it("nie ma obcych domen, logotypow ani odnosnika do platformy ODR", () => {
    const { container } = render(<Footer settings={SHOP_SETTINGS} />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      expect(href).toMatch(/^(\/[a-z0-9\-/]*|mailto:[^@]+@taktyl\.example|tel:\+?\d+)$/);
    }
    expect(container.querySelectorAll("img, svg, picture, canvas, iframe")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/https?:\/\//);
    expect(container.textContent).not.toMatch(/\bODR\b|ec\.europa/i);
  });

  it("stopka jest sekcja ciemna (.sekcja--mod)", () => {
    render(<Footer settings={SHOP_SETTINGS} />);
    expect(screen.getByRole("contentinfo")).toHaveClass("sekcja--mod");
  });

  it("nie ma bledow axe", async () => {
    const { container } = render(<Footer settings={SHOP_SETTINGS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
