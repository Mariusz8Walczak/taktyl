// F-060...F-073, F-068 (TAKTYL-28): karta produktu - wybor wariantu i adres ?sku=, cena z Omnibusem, dostepnosc,
// ilosc, dodanie do koszyka przez adapter, zakladki, galeria, pasek zakupu; S5, S6, S7, S8.
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ConditionsBar, conditionItems } from "../src/components/conditions-bar";
import { BuyColumn } from "../src/components/product/buy-column";
import { Gallery } from "../src/components/product/gallery";
import { ProductProvider } from "../src/components/product/product-context";
import { buildSections } from "../src/components/product/product-sections";
import { ProductTabs } from "../src/components/product/product-tabs";
import { StickyBar } from "../src/components/product/sticky-bar";
import { toClientProduct } from "../src/lib/catalog/product-view";
import { CART_STORAGE_KEY } from "../src/lib/cart/count";
import { COLORS, productFixture, SWITCHES } from "./catalog-fixtures";
import { SHOP_SETTINGS } from "./fixtures";

const NBSP = "\u00A0";
/** Matchery DOM normalizuja twarda spacje do zwyklej; twardej spacji pilnuja testy logiki (catalog-logic). */
const sp = (text: string) => text.replaceAll(NBSP, " ");
const DISPATCH = {
  headline: "Wysyłka dziś",
  message: "Zamów do 14:00, wyślemy dziś. Dostawa kurierem: czwartek, 8 października.",
};

function Page({ slug, sku, children }: { slug: string; sku?: string; children?: ReactNode }) {
  const product = productFixture(slug);
  return (
    <ToastProvider>
      <ProductProvider
        product={toClientProduct(product)}
        colors={COLORS}
        switches={SWITCHES}
        initialSku={sku ?? null}
        categoryName="Klawiatury"
      >
        <Gallery />
        <BuyColumn conditions={<ConditionsBar settings={SHOP_SETTINGS} />} dispatch={DISPATCH} />
        <StickyBar />
        {children}
      </ProductProvider>
    </ToastProvider>
  );
}

beforeEach(() => {
  window.history.replaceState(null, "", "/klawiatury/x");
  window.dataLayer = [];
});

describe("cena i promocja (F-064)", () => {
  it("S5: Granit TKL - 599,00 zł, przekreslone 699,00 zł, -14%, zdanie Omnibus", () => {
    const { container } = render(<Page slug="granit-tkl" />);
    expect(container.querySelector(".cena__kwota")).toHaveTextContent(sp(`599,00${NBSP}zł`));
    expect(container.querySelector("del")).toHaveTextContent(sp(`699,00${NBSP}zł`));
    expect(screen.getByText("−14%")).toBeInTheDocument();
    expect(
      screen.getByText(sp(`Najniższa cena z 30 dni przed obniżką: 699,00${NBSP}zł`)),
    ).toBeInTheDocument();
  });

  it("S6: Wrobel - 129,00 zł, przekreslone 139,00 zł (nie 149,00), -7%", () => {
    const { container } = render(<Page slug="wrobel" />);
    expect(container.querySelector(".cena__kwota")).toHaveTextContent(sp(`129,00${NBSP}zł`));
    expect(container.querySelector("del")).toHaveTextContent(sp(`139,00${NBSP}zł`));
    expect(screen.getByText("−7%")).toBeInTheDocument();
    expect(container.textContent).not.toContain("149,00");
  });

  it("bez promocji nie ma przekreslenia ani zdania Omnibus", () => {
    const { container } = render(<Page slug="bazalt-75" />);
    expect(container.querySelector("del")).toBeNull();
    expect(screen.queryByText(/Najniższa cena z 30 dni/)).toBeNull();
  });
});

describe("wybor wariantu i adres (F-062, F-063, S7)", () => {
  it("zmiana wariantu aktualizuje cene, stan i adres ?sku= (replaceState); wariant domyslny - adres kanoniczny", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" />);
    expect(window.location.search).toBe("");
    await user.click(screen.getByRole("radio", { name: /Kobalt/ }));
    expect(window.location.search).toBe("?sku=K-BZL75-KOB-SLZ");
    await user.click(screen.getByRole("radio", { name: /Grafit/ }));
    expect(window.location.search).toBe("");
  });

  it("adres z ?sku= wybiera wariant przy wejsciu", () => {
    render(<Page slug="bazalt-75" sku="K-BZL75-KOB-PRG" />);
    expect(screen.getByRole("radio", { name: /Kobalt/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Próg/ })).toBeChecked();
  });

  it("S7: Kobalt + Szept - 'Brak w tym kolorze', 'Dodaj do koszyka' nieaktywny z wyjasnieniem", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" />);
    await user.click(screen.getByRole("radio", { name: /Kobalt/ }));
    await user.click(screen.getByRole("radio", { name: /Szept/ }));
    expect(window.location.search).toBe("?sku=K-BZL75-KOB-SZP");
    expect(screen.getAllByText("Brak w tym kolorze")).toHaveLength(1);
    const add = screen.getByRole("button", { name: "Dodaj do koszyka" });
    expect(add).toBeDisabled();
    const reason = document.getElementById(add.getAttribute("aria-describedby")!);
    expect(reason).toHaveTextContent(/Wybierz inny kolor, przełącznik lub rozmiar/);
    // termin wysylki nie jest pokazywany dla wariantu bez stanu
    expect(screen.queryByText("Wysyłka dziś")).toBeNull();
  });

  it("kafle: kombinacja bez stanu jest oznaczona 'Brak' i wybieralna, reszta aktywna", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" sku="K-BZL75-KOB-PRG" />);
    const szept = screen.getByRole("radio", { name: /Szept/ });
    expect(szept).toBeEnabled();
    expect(szept.closest("label")).toHaveTextContent("Brak");
    expect(szept.closest("label")).toHaveClass("is-brak");
    expect(screen.getByRole("radio", { name: /Ślizg/ }).closest("label")).not.toHaveTextContent(
      "Brak",
    );
    await user.click(szept);
    expect(szept).toBeChecked();
  });
});

describe("dostepnosc, ilosc, termin (F-065, F-066, S8)", () => {
  it("S8: Jerzyk Mgla - 'Ostatnie sztuki (zostaly 2 szt.)', ilosc maks. 2", async () => {
    const user = userEvent.setup();
    render(<Page slug="jerzyk" />);
    await user.click(screen.getByRole("radio", { name: /Mgła/ }));
    expect(screen.getByText(sp(`Ostatnie sztuki (zostały 2${NBSP}szt.)`))).toBeInTheDocument();
    const qty = screen.getByRole("group", { name: /Ilość/ });
    const plus = within(qty).getByRole("button", { name: "Zwiększ ilość" });
    await user.click(plus);
    expect(within(qty).getByRole("status")).toHaveTextContent("2");
    expect(plus).toBeDisabled();
  });

  it("wariant dostepny: stan 'Dostepny' i termin z API", () => {
    render(<Page slug="bazalt-75" />);
    expect(screen.getByText("Dostępny")).toBeInTheDocument();
    expect(screen.getByText("Wysyłka dziś")).toBeInTheDocument();
    expect(screen.getByText(/Dostawa kurierem: czwartek, 8 października\./)).toBeInTheDocument();
  });

  it("ilosc nie przekracza min(stan, 10)", async () => {
    const user = userEvent.setup();
    const stock = productFixture("bazalt-75").variants.find(
      (v) => v.sku === "K-BZL75-GRF-SLZ",
    )!.stock;
    render(<Page slug="bazalt-75" />);
    const plus = screen.getByRole("button", { name: "Zwiększ ilość" });
    for (let i = 0; i < 15; i++) if (!(plus as HTMLButtonElement).disabled) await user.click(plus);
    expect(
      within(screen.getByRole("group", { name: /Ilość/ })).getByRole("status"),
    ).toHaveTextContent(String(Math.min(stock, 10)));
  });
});

describe("dodanie do koszyka (F-066, adapter z TAKTYL-39 w przyszlosci)", () => {
  it("zapisuje minimalny format z docs/03 §7 bez cen, pokazuje toast i wysyla add_to_cart po potwierdzeniu", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" />);
    await user.click(screen.getByRole("button", { name: "Zwiększ ilość" }));
    await user.click(screen.getByRole("button", { name: "Dodaj do koszyka" }));
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!);
    expect(stored.lines).toEqual([{ type: "item", sku: "K-BZL75-GRF-SLZ", qty: 2 }]);
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).not.toMatch(/price|cena/i);
    expect(await screen.findByText("Dodano do koszyka")).toBeInTheDocument();
    const ev = window.dataLayer?.find((e) => e.event === "add_to_cart") as
      { ecommerce: { currency: string; value: number; items: { quantity: number }[] } } | undefined;
    expect(ev?.ecommerce).toMatchObject({ currency: "PLN", value: 1498 });
    expect(ev?.ecommerce.items[0]?.quantity).toBe(2);
  });

  it("wariant bez stanu: nic nie trafia do koszyka", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" sku="K-BZL75-KOB-SZP" />);
    await user.click(screen.getByRole("button", { name: "Dodaj do koszyka" }));
    expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText("Dodano do koszyka")).toBeNull();
  });

  it("'Dodaj do setu' to odnosnik do kreatora z biezacym SKU w parametrze kategorii (F-112)", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" />);
    expect(screen.getByRole("link", { name: "Dodaj do setu" })).toHaveAttribute(
      "href",
      "/zbuduj-set?k=K-BZL75-GRF-SLZ",
    );
    await user.click(screen.getByRole("radio", { name: /Kobalt/ }));
    expect(screen.getByRole("link", { name: "Dodaj do setu" })).toHaveAttribute(
      "href",
      "/zbuduj-set?k=K-BZL75-KOB-SLZ",
    );
  });

  it("view_item przy wejsciu i przy zmianie wariantu (docs/10 §4)", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" />);
    await user.click(screen.getByRole("radio", { name: /Kobalt/ }));
    const events = (window.dataLayer ?? []).filter((e) => e.event === "view_item");
    expect(events).toHaveLength(2);
  });
});

describe("galeria (F-060)", () => {
  it("miniatury z aria-label, przelaczanie ujec, ujecia wariantu po zmianie koloru", async () => {
    const user = userEvent.setup();
    render(<Page slug="bazalt-75" />);
    const top = screen.getByRole("button", { name: "Pokaż ujęcie: widok z góry" });
    expect(top).toHaveAttribute("aria-pressed", "false");
    await user.click(top);
    expect(top).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("radio", { name: /Kobalt/ }));
    expect(screen.getByRole("button", { name: "Pokaż ujęcie: widok z góry" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    const slides = screen.getByRole("list", { name: "Zdjęcia produktu" });
    expect(within(slides).getAllByRole("img")[0]).toHaveAccessibleName(
      /Bazalt 75 w kolorze Kobalt/,
    );
  });
});

describe("pasek warunkow (F-067)", () => {
  it("4 pozycje z ustawien sklepu", () => {
    expect(conditionItems(SHOP_SETTINGS)).toEqual([
      "−10% za komplet",
      `Darmowa dostawa od 299${NBSP}zł`,
      "30 dni na zwrot",
      "Wysyłka w 24 h",
    ]);
    render(<ConditionsBar settings={SHOP_SETTINGS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});

describe("pasek zakupu na telefonie (F-068)", () => {
  it("ukryty na starcie (nie zaslania nic), bez klasy rezerwujacej miejsce", () => {
    render(<Page slug="bazalt-75" />);
    const bar = document.querySelector(".pasek-zakupu") as HTMLElement;
    expect(bar).toHaveAttribute("hidden");
    expect(document.documentElement).not.toHaveClass("ma-pasek-zakupu");
  });
});

describe("zakladki i specyfikacja (F-070...F-073)", () => {
  function WithTabs({ slug }: { slug: string }) {
    const product = productFixture(slug);
    return (
      <Page slug={slug}>
        <ProductTabs sections={buildSections(product, SHOP_SETTINGS, SWITCHES)} />
      </Page>
    );
  }

  it("przyciski z aria-expanded/aria-controls; pierwszy panel otwarty, kolejne przelaczaja", async () => {
    const user = userEvent.setup();
    render(<WithTabs slug="bazalt-75" />);
    const opis = screen.getByRole("button", { name: "Opis" });
    const spec = screen.getByRole("button", { name: "Specyfikacja" });
    expect(opis).toHaveAttribute("aria-expanded", "true");
    expect(spec).toHaveAttribute("aria-expanded", "false");
    await user.click(spec);
    expect(spec).toHaveAttribute("aria-expanded", "true");
    expect(opis).toHaveAttribute("aria-expanded", "false");
    const panel = document.getElementById(spec.getAttribute("aria-controls")!)!;
    expect(panel).not.toHaveAttribute("hidden");
    expect(within(panel).getByRole("table")).toBeInTheDocument();
  });

  it("tabela ma naglowki wierszy, formaty z docs/04 i wiersz przelacznika zalezny od wariantu", async () => {
    const user = userEvent.setup();
    render(<WithTabs slug="bazalt-75" />);
    await user.click(screen.getByRole("button", { name: "Specyfikacja" }));
    const table = screen.getByRole("table", { name: /Specyfikacja: Bazalt 75/ });
    expect(within(table).getByRole("rowheader", { name: "Waga" })).toBeInTheDocument();
    const row = (label: string) =>
      within(table).getByRole("rowheader", { name: label }).closest("tr")!;
    expect(row("Waga")).toHaveTextContent(sp(`1,85${NBSP}kg`));
    expect(row("Przełącznik")).toHaveTextContent(sp(`Ślizg (liniowy, 45${NBSP}g)`));
    await user.click(screen.getByRole("radio", { name: /Próg/ }));
    expect(row("Przełącznik")).toHaveTextContent(sp(`Próg (taktylny, 55${NBSP}g)`));
  });

  it("'W zestawie', GPSR i 'Dostawa i zwroty' z danych", async () => {
    const user = userEvent.setup();
    render(<WithTabs slug="bazalt-75" />);
    expect(screen.getByRole("button", { name: "W zestawie" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bezpieczeństwo produktu" }));
    expect(screen.getByText("Taktyl (podmiot fikcyjny)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /@taktyl\.example$/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dostawa i zwroty" }));
    expect(
      screen.getByText(/Ustawowo masz 14 dni na odstąpienie od umowy. W Taktylu — 30./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Automat paczkowy/)).toBeInTheDocument();
  });

  it("pusta lista 'W zestawie' ukrywa sekcje (F-071)", () => {
    const product = { ...productFixture("bazalt-75"), in_box: [] };
    const titles = buildSections(product, SHOP_SETTINGS, SWITCHES).map((s) => s.title);
    expect(titles).toEqual(["Opis", "Specyfikacja", "Bezpieczeństwo produktu", "Dostawa i zwroty"]);
  });

  it("podkladka: rozmiar i przeznaczenie w specyfikacji zaleznie od wariantu", async () => {
    const user = userEvent.setup();
    render(<WithTabs slug="tafla" />);
    await user.click(screen.getByRole("button", { name: "Specyfikacja" }));
    const table = screen.getByRole("table");
    await user.click(screen.getByRole("radio", { name: /^XL(?!X)/ }));
    expect(
      within(table).getByRole("rowheader", { name: "Rozmiar" }).closest("tr"),
    ).toHaveTextContent(sp(`XL · 90 × 40${NBSP}cm`));
    expect(
      within(table).getByRole("rowheader", { name: "Przeznaczenie" }).closest("tr"),
    ).toHaveTextContent("na całe biurko");
  });
});

describe("dostepnosc (a11y)", () => {
  it("karta z zakladkami: bez bledow axe", async () => {
    const product = productFixture("granit-tkl");
    const { container } = render(
      <Page slug="granit-tkl">
        <ProductTabs sections={buildSections(product, SHOP_SETTINGS, SWITCHES)} />
      </Page>,
    );
    await act(async () => {});
    await waitFor(async () => expect(await axe(container)).toHaveNoViolations());
  });
});
