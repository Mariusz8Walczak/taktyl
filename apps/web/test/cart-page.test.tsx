// F-151...F-157, A-11, A-18 (TAKTYL-40): strona /koszyk z atrapa wyceny liczona domena; S13, S14, S15, S16.
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CartPage } from "../src/components/cart/cart-page";
import { cartStore, getCart } from "../src/lib/cart/store";
import { cartUi } from "../src/lib/cart/ui";
import { CATALOG, PROGRAMISTA, stubQuoteFetch } from "./cart-fixtures";

const SETTINGS = {
  freeShippingThresholdGr: 29900,
  shippingFromGr: 1299,
  setDiscountPercent: 10,
  codes: [
    { code: "TAKTYL10", label: "x" },
    { code: "DOSTAWA0", label: "y" },
  ],
};

function renderPage() {
  return render(
    <ToastProvider>
      <CartPage settings={SETTINGS} />
    </ToastProvider>,
  );
}
const addProgramista = () =>
  cartStore.addSet({ skus: PROGRAMISTA, profile: "programowanie", id: "set-1" });

beforeEach(() => {
  cartUi.reset();
  stubQuoteFetch();
});

describe("pusty koszyk (F-156)", () => {
  it("tekst i dwa przyciski, H1 Koszyk", async () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Koszyk" })).toBeInTheDocument();
    expect(
      await screen.findByText("Koszyk jest pusty. Zacznij od kreatora setu albo od klawiatury."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zbuduj set" })).toHaveAttribute("href", "/zbuduj-set");
    expect(screen.getByRole("link", { name: "Zobacz klawiatury" })).toHaveAttribute(
      "href",
      "/klawiatury",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("lista, licznik i podsumowanie", () => {
  it("licznik z liczebnikiem, grupa 'Twój set · −10%', sumy z wyceny (S12)", async () => {
    addProgramista();
    cartStore.addItem("P-TFL-M-GRF", 1);
    renderPage();
    expect(await screen.findByTestId("koszyk-licznik")).toHaveTextContent("2 produkty");
    expect(await screen.findByRole("heading", { name: "Twój set · −10%" })).toBeInTheDocument();
    const summary = await screen.findByTestId("koszyk-razem");
    // zestaw 1203,30 + Tafla M 69,00 = 1272,30
    await waitFor(() => expect(summary).toHaveTextContent("1272,30 zł"));
    expect(screen.getAllByText("Rabat za set")).toHaveLength(2); // w grupie i w podsumowaniu
    expect(screen.getByRole("link", { name: "Edytuj set" }).getAttribute("href")).toMatch(
      /^\/zbuduj-set\?k=K-BZL75-GRF-PRG&m=M-PST-GRF&p=P-SZR-XL-GRF&profil=programowanie&krok=podsumowanie&edytuj=set-1$/,
    );
  });

  it("zmiana ilosci grupy wola nowa wycene i aktualizuje sumy; ceny nie sa w koszyku", async () => {
    addProgramista();
    const { calls } = stubQuoteFetch();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId("koszyk-razem")).toHaveTextContent("1203,30 zł"));
    await user.click(screen.getByRole("button", { name: "Zwiększ ilość" }));
    await waitFor(() => expect(screen.getByTestId("koszyk-razem")).toHaveTextContent("2406,60 zł"));
    expect(calls.at(-1)?.items[0]).toMatchObject({ type: "set", qty: 2 });
    expect(window.localStorage.getItem("taktyl.cart.v1")).not.toMatch(/price|cena/i);
  });
});

describe("pasek do darmowej dostawy (F-152, A-11, S16)", () => {
  it("Wróbel: 'Brakuje 170,00 zł do darmowej dostawy' (próg 299 zł, 129 zł w koszyku)", async () => {
    cartStore.addItem("M-WRB-GRF", 1);
    renderPage();
    expect(await screen.findByText("Brakuje 170,00 zł do darmowej dostawy")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Postęp do darmowej dostawy" });
    expect(bar).toHaveAttribute("aria-valuenow", "43");
    expect(screen.getByText("od 12,99 zł")).toBeInTheDocument();
  });
  it("po przekroczeniu progu zmienia sie tylko tekst", async () => {
    addProgramista();
    renderPage();
    expect(await screen.findByText("Dostawa jest darmowa.")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Darmowa")).toBeInTheDocument();
  });
});

describe("kod rabatowy (F-153, S13, S14)", () => {
  it("podpowiedz kodow demo z ustawien", async () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    renderPage();
    expect(await screen.findByText("Kody demo: TAKTYL10, DOSTAWA0")).toBeInTheDocument();
    expect(screen.getByLabelText("Kod rabatowy")).toBeInTheDocument();
  });

  it("S13: kod przy samym secie - komunikat o setach, brak rabatu kodu", async () => {
    addProgramista();
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Kod rabatowy"), "taktyl10");
    await user.click(screen.getByRole("button", { name: "Zastosuj kod" }));
    expect(
      await screen.findByText("Kod nie obejmuje setów — rabat za set jest już naliczony."),
    ).toBeInTheDocument();
    expect(getCart().code).toBe("TAKTYL10");
    expect(screen.queryByText("Kod rabatowy", { selector: "dt" })).toBeNull();
    await waitFor(() => expect(screen.getByTestId("koszyk-razem")).toHaveTextContent("1203,30 zł"));
  });

  it("S14: + Tafla M osobno, kod daje −6,90 zł, razem 1265,40 zł", async () => {
    addProgramista();
    cartStore.addItem("P-TFL-M-GRF", 1);
    cartStore.applyCode("TAKTYL10");
    renderPage();
    await waitFor(() => expect(screen.getByTestId("koszyk-razem")).toHaveTextContent("1265,40 zł"));
    const dt = screen.getByText("Kod rabatowy", { selector: "dt" });
    expect(dt.nextElementSibling).toHaveTextContent("−6,90 zł");
    expect(
      screen.getByText(/Kod TAKTYL10 obniżył cenę pozycji spoza setów o 6,90 zł\./),
    ).toBeInTheDocument();
  });

  it("nieznany kod: komunikat i mozliwosc usuniecia", async () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    cartStore.applyCode("BLAD");
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByText("Nie znamy takiego kodu. Sprawdź pisownię."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń kod BLAD" }));
    expect(getCart().code).toBeNull();
  });
});

describe("usuwanie z Cofnij 5 s (F-151, F-154, S15) bez confirm()", () => {
  it("usuniecie pozycji: komunikat z Cofnij przywraca pozycje", async () => {
    cartStore.addItem("P-TFL-M-GRF", 2);
    const confirm = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Usuń z koszyka: Tafla" }));
    expect(getCart().lines).toHaveLength(0);
    const status = screen.getAllByRole("status").find((n) => n.className.includes("toasty"))!;
    expect(within(status).getByText("Usunięto z koszyka: Tafla.")).toBeInTheDocument();
    await user.click(within(status).getByRole("button", { name: "Cofnij" }));
    expect(getCart().lines).toEqual([{ type: "item", sku: "P-TFL-M-GRF", qty: 2 }]);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("S15: usuniecie klawiatury z grupy rozbija set, komunikat, Cofnij przywraca grupe i rabat", async () => {
    addProgramista();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Usuń z setu: Bazalt 75" }));
    expect(await screen.findByText("Set rozdzielony — rabat 10% usunięty.")).toBeInTheDocument();
    expect(getCart().lines.map((l) => l.type)).toEqual(["item", "item"]);
    expect(screen.queryByRole("heading", { name: /Twój set/ })).toBeNull();
    await waitFor(() => expect(screen.queryByText("Rabat za set", { selector: "dt" })).toBeNull());
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(getCart().lines).toHaveLength(1);
    expect(await screen.findByRole("heading", { name: "Twój set · −10%" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("koszyk-razem")).toHaveTextContent("1203,30 zł"));
  });

  it("komunikat 'Cofnij' trwa 5 s, nie 4", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      cartStore.addItem("P-TFL-M-GRF", 1);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderPage();
      await user.click(await screen.findByRole("button", { name: "Usuń z koszyka: Tafla" }));
      await act(async () => void vi.advanceTimersByTime(4500));
      expect(screen.getByRole("button", { name: "Cofnij" })).toBeInTheDocument();
      await act(async () => void vi.advanceTimersByTime(1000));
      expect(screen.queryByRole("button", { name: "Cofnij" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("weryfikacja stanow (F-157)", () => {
  it("wariant bez stanu: oznaczony, przejscie dalej zablokowane, 'Wybierz inny wariant' prowadzi do kreatora na tym kroku", async () => {
    addProgramista();
    stubQuoteFetch({
      catalog: { ...CATALOG, "M-PST-GRF": { ...CATALOG["M-PST-GRF"]!, stock: 0 } },
    });
    renderPage();
    const link = await screen.findByRole("link", { name: "Wybierz inny wariant" });
    expect(link.getAttribute("href")).toContain("krok=myszka");
    expect(link.getAttribute("href")).toContain("edytuj=set-1");
    expect(screen.getByText(/Nie możesz przejść dalej/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Przejdź do zamówienia" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Przejdź do zamówienia" })).toBeNull();
  });

  it("ilosc ponad stan: komunikat ze stanem magazynowym", async () => {
    cartStore.addItem("M-WRB-GRF", 3);
    stubQuoteFetch({
      catalog: { ...CATALOG, "M-WRB-GRF": { ...CATALOG["M-WRB-GRF"]!, stock: 2 } },
    });
    renderPage();
    expect(await screen.findByText(/W magazynie zostało 2 szt\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Przejdź do zamówienia" })).toBeDisabled();
  });

  it("bez problemow: 'Przejdź do zamówienia' to odnosnik do /zamowienie", async () => {
    addProgramista();
    renderPage();
    expect(await screen.findByRole("link", { name: "Przejdź do zamówienia" })).toHaveAttribute(
      "href",
      "/zamowienie",
    );
  });
});

describe("wycena: ladowanie i blad sieci", () => {
  it("blad sieci: komunikat, koszyk zachowany, ponowienie dziala", async () => {
    addProgramista();
    let offline = true;
    stubQuoteFetch({ fail: () => offline });
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByText(
        /Nie udało się sprawdzić cen i dostępności\. Twój koszyk jest zachowany\./,
      ),
    ).toBeInTheDocument();
    expect(getCart().lines).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Przejdź do zamówienia" })).toBeDisabled();
    offline = false;
    await user.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(await screen.findByRole("heading", { name: "Twój set · −10%" })).toBeInTheDocument();
  });

  it("szkielet A-18 dopiero po 300 ms ladowania", async () => {
    addProgramista();
    stubQuoteFetch({ delayMs: 900 });
    renderPage();
    await screen.findByRole("heading", { name: "Koszyk" });
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByTestId("koszyk-szkielet")).toBeNull();
    expect(
      await screen.findByTestId("koszyk-szkielet", undefined, { timeout: 1500 }),
    ).toBeInTheDocument();
  });
});

describe("pomiar", () => {
  it("view_cart raz, z value po rabacie setu i discount w pozycjach (docs/10)", async () => {
    window.dataLayer = [];
    addProgramista();
    renderPage();
    await waitFor(() => expect(window.dataLayer?.some((e) => e.event === "view_cart")).toBe(true));
    const ev = window.dataLayer!.find((e) => e.event === "view_cart") as {
      ecommerce: {
        value: number;
        currency: string;
        items: { discount: number; quantity: number }[];
      };
    };
    expect(ev.ecommerce.value).toBe(1203.3);
    expect(ev.ecommerce.currency).toBe("PLN");
    expect(ev.ecommerce.items.reduce((s, i) => s + Math.round(i.discount * 100), 0)).toBe(13370);
    expect(window.dataLayer!.filter((e) => e.event === "view_cart")).toHaveLength(1);
  });

  it("remove_from_cart po usunieciu elementu setu", async () => {
    window.dataLayer = [];
    addProgramista();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Usuń z setu: Szron" }));
    const ev = window.dataLayer!.find((e) => e.event === "remove_from_cart") as {
      ecommerce: { value: number; items: { item_id: string }[] };
    };
    expect(ev.ecommerce.items[0]?.item_id).toBe("P-SZR-XL-GRF");
    expect(ev.ecommerce.value).toBe(170.1);
  });
});

describe("dostepnosc", () => {
  it("axe: koszyk z grupa setu i pozycja", async () => {
    addProgramista();
    cartStore.addItem("P-TFL-M-GRF", 1);
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "Twój set · −10%" });
    await waitFor(() => expect(screen.getByTestId("koszyk-razem")).toHaveTextContent("1272,30 zł"));
    expect(await axe(container)).toHaveNoViolations();
  });
});
