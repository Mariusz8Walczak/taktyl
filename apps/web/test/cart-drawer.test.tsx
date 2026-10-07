// F-150, F-157, A-03 (TAKTYL-39): szuflada koszyka - zawartosc, pulapka fokusu, Esc, powrot fokusu na wywolujacy przycisk.
import { ToastProvider } from "@taktyl/ui";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import CartDrawer from "../src/components/cart/cart-drawer";
import { addSet, addToCart } from "../src/lib/cart-adapter";
import { cartStore } from "../src/lib/cart/store";
import { cartUi, useRecentlyAdded } from "../src/lib/cart/ui";
import { CATALOG, PROGRAMISTA, stubQuoteFetch } from "./cart-fixtures";

function Harness() {
  const added = useRecentlyAdded();
  return (
    <ToastProvider>
      <button type="button" onClick={() => void addToCart({ sku: "P-TFL-M-GRF", qty: 1 })}>
        {added ? "Dodano" : "Dodaj do koszyka"}
      </button>
      <button
        type="button"
        onClick={() => void addSet({ skus: PROGRAMISTA, profile: "programowanie" })}
      >
        Dodaj set
      </button>
      <button type="button" onClick={() => cartUi.open()}>
        Otwórz koszyk
      </button>
      <CartDrawer />
    </ToastProvider>
  );
}

beforeEach(() => {
  cartUi.reset();
  stubQuoteFetch();
});

describe("szuflada koszyka", () => {
  it("S12: dodanie setu otwiera szuflade z grupa 'Twój set · −10%', suma i darmowa dostawa", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Dodaj set" }));
    const dialog = await screen.findByRole("dialog", { name: "Koszyk" });
    expect(
      await within(dialog).findByRole("heading", { name: "Twój set · −10%" }),
    ).toBeInTheDocument();
    expect(await within(dialog).findByText("Dostawa jest darmowa.")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByTestId("szuflada-suma")).toHaveTextContent("1203,30 zł"),
    );
    expect(within(dialog).getByRole("link", { name: "Przejdź do zamówienia" })).toHaveAttribute(
      "href",
      "/zamowienie",
    );
    expect(within(dialog).getByRole("link", { name: "Zobacz koszyk" })).toHaveAttribute(
      "href",
      "/koszyk",
    );
  });

  it("A-03: przycisk pokazuje 'Dodano' przez chwile po dodaniu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Dodaj do koszyka" }));
    expect(await screen.findByRole("button", { name: "Dodano" })).toBeInTheDocument();
  });

  it("pusty stan: tekst i dwa przyciski", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const dialog = await screen.findByRole("dialog", { name: "Koszyk" });
    expect(
      within(dialog).getByText("Koszyk jest pusty. Zacznij od kreatora setu albo od klawiatury."),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole("link")).toHaveLength(2);
  });

  it("Esc zamyka, a fokus wraca na przycisk, ktory otworzyl szuflade", async () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Otwórz koszyk" });
    await user.click(opener);
    await screen.findByRole("dialog", { name: "Koszyk" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
  });

  it("pulapka fokusu: Tab i Shift+Tab krazy wewnatrz szuflady", async () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const dialog = await screen.findByRole("dialog", { name: "Koszyk" });
    await screen.findByRole("link", { name: "Przejdź do zamówienia" });
    for (let i = 0; i < 14; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 14; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("zamyka sie tlem", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByTestId("tk-tlo"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("F-157: wariant bez stanu blokuje przejscie dalej i oferuje inny wariant", async () => {
    stubQuoteFetch({
      catalog: { ...CATALOG, "P-TFL-M-GRF": { ...CATALOG["P-TFL-M-GRF"]!, stock: 0 } },
    });
    cartStore.addItem("P-TFL-M-GRF", 1);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const dialog = await screen.findByRole("dialog", { name: "Koszyk" });
    expect(
      await within(dialog).findByRole("link", { name: "Wybierz inny wariant" }),
    ).toHaveAttribute("href", "/podkladki");
    expect(within(dialog).getByRole("button", { name: "Przejdź do zamówienia" })).toBeDisabled();
  });

  it("pozycja: zmiana ilosci i usuniecie z Cofnij w szufladzie", async () => {
    cartStore.addItem("P-TFL-M-GRF", 1);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const dialog = await screen.findByRole("dialog", { name: "Koszyk" });
    await user.click(await within(dialog).findByRole("button", { name: "Zwiększ ilość" }));
    await waitFor(() =>
      expect(within(dialog).getByTestId("szuflada-suma")).toHaveTextContent("138,00 zł"),
    );
  });

  it("view_cart raz na otwarcie szuflady", async () => {
    window.dataLayer = [];
    cartStore.addItem("P-TFL-M-GRF", 1);
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    await waitFor(() =>
      expect(window.dataLayer?.filter((e) => e.event === "view_cart")).toHaveLength(1),
    );
  });

  it("axe: otwarta szuflada z grupa setu", async () => {
    cartStore.addSet({ skus: PROGRAMISTA, profile: "programowanie", id: "set-1" });
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const dialog = await screen.findByRole("dialog", { name: "Koszyk" });
    await within(dialog).findByRole("link", { name: "Przejdź do zamówienia" });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
