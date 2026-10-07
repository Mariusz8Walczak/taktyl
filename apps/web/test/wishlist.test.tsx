// F-045, F-132, A-10 (TAKTYL-55): ulubione - aria-pressed, spojny stan miedzy kartami, toast, add_to_wishlist,
// przeniesienie do koszyka przez adapter, pusty stan, wyjatek localStorage.
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CardActions } from "../src/components/compare/card-actions";
import { BuyColumn } from "../src/components/product/buy-column";
import { ProductProvider } from "../src/components/product/product-context";
import { toClientProduct } from "../src/lib/catalog/product-view";
import { WishlistPage } from "../src/components/wishlist/wishlist-page";
import { FavoriteButton } from "../src/components/wishlist/favorite-button";
import { toLiteProduct } from "../src/lib/compare/lite";
import { WISHLIST_KEY, wishlist } from "../src/lib/wishlist/store";
import { COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

const addToCart = vi.fn(async (_input: unknown) => ({ ok: true }));
vi.mock("../src/lib/cart-adapter", () => ({ addToCart: (a: unknown) => addToCart(a) }));

const bazalt = productFixture("bazalt-75");
const SKUS = bazalt.variants.map((v) => v.sku);
const SKU = "K-BZL75-GRF-PRG";
const CATALOG = [toLiteProduct(bazalt, COLORS, SWITCHES)];
const events = (name: string) => (window.dataLayer ?? []).filter((e) => e.event === name);

beforeEach(() => {
  window.dataLayer = [];
  addToCart.mockClear();
});

function buttons() {
  return (
    <ToastProvider>
      <section aria-label="Karta na liscie">
        <FavoriteButton
          sku="K-BZL75-GRF-SLZ"
          productSkus={SKUS}
          name="Bazalt 75"
          category="klawiatury"
          priceGr={74900}
        />
      </section>
      <section aria-label="Karta produktu">
        <FavoriteButton
          sku={SKU}
          productSkus={SKUS}
          name="Bazalt 75"
          category="klawiatury"
          priceGr={74900}
          variantLabel="Grafit · Próg"
        />
      </section>
    </ToastProvider>
  );
}

describe("FavoriteButton (F-045, A-10)", () => {
  it("etykieta tekstowa, aria-pressed, toast i add_to_wishlist", async () => {
    const user = userEvent.setup();
    render(buttons());
    const list = within(screen.getByRole("region", { name: "Karta na liscie" }));
    const btn = list.getByRole("button", { name: /Dodaj do ulubionych: Bazalt 75/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await user.click(btn);
    expect(screen.getByText("Dodano do ulubionych")).toBeInTheDocument();
    expect(list.getByRole("button", { name: /Usuń z ulubionych/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const [ev] = events("add_to_wishlist");
    expect(ev).toMatchObject({
      event: "add_to_wishlist",
      ecommerce: { currency: "PLN", value: 749 },
    });
    expect(JSON.stringify(ev)).toContain("K-BZL75-GRF-SLZ");
    expect(JSON.parse(window.localStorage.getItem(WISHLIST_KEY) ?? "{}").skus).toEqual([
      "K-BZL75-GRF-SLZ",
    ]);
  });

  it("stan spojny w calym serwisie: drugi przycisk tego samego modelu tez jest wcisniety", async () => {
    const user = userEvent.setup();
    render(buttons());
    await user.click(
      within(screen.getByRole("region", { name: "Karta na liscie" })).getByRole("button"),
    );
    const page = within(screen.getByRole("region", { name: "Karta produktu" }));
    expect(page.getByRole("button", { name: /Usuń z ulubionych/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // usuniecie na stronie produktu zdejmuje serce tez z karty; zdarzenia add_to_wishlist tylko przy dodaniu
    await user.click(page.getByRole("button"));
    expect(
      within(screen.getByRole("region", { name: "Karta na liscie" })).getByRole("button"),
    ).toHaveAttribute("aria-pressed", "false");
    expect(events("add_to_wishlist")).toHaveLength(1);
  });

  it("'Cofnij' po usunieciu przywraca ulubione", async () => {
    const user = userEvent.setup();
    wishlist.add(SKU);
    render(buttons());
    await user.click(
      within(screen.getByRole("region", { name: "Karta produktu" })).getByRole("button"),
    );
    expect(wishlist.skus()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(wishlist.skus()).toEqual([SKU]);
  });

  it("A-10: klasa animacji tylko po dodaniu, nie po usunieciu", async () => {
    const user = userEvent.setup();
    const { container } = render(buttons());
    const first = screen.getAllByRole("button")[0] as HTMLElement;
    expect(container.querySelector(".is-dodano")).toBeNull();
    await user.click(first);
    expect(container.querySelector(".ulubione-przycisk__serce.is-dodano")).not.toBeNull();
    await user.click(screen.getAllByRole("button")[0] as HTMLElement);
    expect(container.querySelector(".is-dodano")).toBeNull();
  });

  it("zdarzenie storage z innej karty zmienia stan serca", async () => {
    render(buttons());
    act(() => {
      window.localStorage.setItem(WISHLIST_KEY, JSON.stringify({ v: 1, skus: [SKU] }));
      window.dispatchEvent(new StorageEvent("storage", { key: WISHLIST_KEY }));
    });
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Usuń z ulubionych/ })).toHaveLength(2),
    );
  });

  it("wyjatek localStorage: dziala z pamiecia, strona sie nie psuje", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    render(buttons());
    await user.click(screen.getAllByRole("button")[0] as HTMLElement);
    expect(screen.getAllByRole("button", { name: /Usuń z ulubionych/ })).toHaveLength(2);
  });

  it("karta listingu: oba przyciski z etykietami tekstowymi i bez bledow axe", async () => {
    const { container } = render(
      <ToastProvider>
        <ul>
          <li>
            <CardActions
              id="k-bazalt-75"
              category="klawiatury"
              name="Bazalt 75"
              sku={SKU}
              skus={SKUS}
              priceGr={74900}
            />
          </li>
        </ul>
      </ToastProvider>,
    );
    // przyciski sa doladowywane po hydratacji (budzet JS)
    expect(await screen.findByRole("button", { name: /Dodaj do ulubionych/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Porównaj/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("karta produktu (F-045)", () => {
  it("przyciski ulubione i porownaj w kolumnie zakupu, ulubione dotyczy wybranego wariantu", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ProductProvider
          product={toClientProduct(bazalt)}
          colors={COLORS}
          switches={SWITCHES}
          initialSku={SKU}
          categoryName="Klawiatury"
        >
          <BuyColumn conditions={null} dispatch={null} />
        </ProductProvider>
      </ToastProvider>,
    );
    const fav = await screen.findByRole("button", { name: /Dodaj do ulubionych: Bazalt 75/ });
    expect(screen.getByRole("button", { name: /Porównaj: Bazalt 75/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(fav);
    expect(wishlist.skus()).toEqual([SKU]);
    expect(JSON.stringify(events("add_to_wishlist"))).toContain("Grafit");
  });
});

describe("WishlistPage (F-132)", () => {
  it("pusty stan z zaproszeniem", async () => {
    render(
      <ToastProvider>
        <WishlistPage catalog={CATALOG} />
      </ToastProvider>,
    );
    expect(await screen.findByText(/Nie masz jeszcze ulubionych produktów/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zbuduj set" })).toHaveAttribute("href", "/zbuduj-set");
  });

  it("siatka kart z wariantem i cena; bez bledow axe", async () => {
    wishlist.add(SKU);
    const { container } = render(
      <ToastProvider>
        <WishlistPage catalog={CATALOG} />
      </ToastProvider>,
    );
    expect(await screen.findByRole("link", { name: "Bazalt 75" })).toHaveAttribute(
      "href",
      `/klawiatury/bazalt-75?sku=${SKU}`,
    );
    expect(screen.getByText("Grafit · Próg")).toBeInTheDocument();
    expect(screen.getByText(/Zapisane: 1 produkt\./)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("'Dodaj do koszyka' przenosi pozycje przez adapter i zdejmuje ja z ulubionych", async () => {
    const user = userEvent.setup();
    wishlist.add(SKU);
    render(
      <ToastProvider>
        <WishlistPage catalog={CATALOG} />
      </ToastProvider>,
    );
    await user.click(await screen.findByRole("button", { name: /Dodaj do koszyka: Bazalt 75/ }));
    expect(addToCart).toHaveBeenCalledWith({ sku: SKU, qty: 1 });
    await waitFor(() => expect(wishlist.skus()).toEqual([]));
    expect(screen.getByText("Przeniesiono do koszyka")).toBeInTheDocument();
    expect(events("add_to_cart")).toHaveLength(1);
  });

  it("porazka dodania do koszyka zostawia ulubione", async () => {
    const user = userEvent.setup();
    addToCart.mockResolvedValueOnce({ ok: false });
    wishlist.add(SKU);
    render(
      <ToastProvider>
        <WishlistPage catalog={CATALOG} />
      </ToastProvider>,
    );
    await user.click(await screen.findByRole("button", { name: /Dodaj do koszyka/ }));
    expect(wishlist.skus()).toEqual([SKU]);
  });

  it("'Usuń z ulubionych' i SKU spoza katalogu", async () => {
    const user = userEvent.setup();
    wishlist.add(SKU);
    wishlist.add("X-NIE-MA-TAKIEGO");
    render(
      <ToastProvider>
        <WishlistPage catalog={CATALOG} />
      </ToastProvider>,
    );
    expect(await screen.findByText(/nie jest już w katalogu/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń z listy" }));
    expect(wishlist.skus()).toEqual([SKU]);
    await user.click(screen.getByRole("button", { name: /Usuń z ulubionych: Bazalt 75/ }));
    expect(await screen.findByText(/Nie masz jeszcze ulubionych/)).toBeInTheDocument();
  });
});
