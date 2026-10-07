// F-069, F-110 (TAKTYL-38): blok "Dokoncz set" na karcie produktu - trzy elementy, cena z rabatem, zmiana wariantu,
// "Otworz w kreatorze" (pdp_complete), dodanie grupy setu, ukrycie bez kompletu. Dane z data/*.json.
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CompleteSet } from "../src/components/product/complete-set";
import { CompleteSetBlock } from "../src/components/product/complete-set-block";
import { CompleteSetLazy } from "../src/components/product/complete-set-lazy";
import { CompleteSetStatic } from "../src/components/product/complete-set-static";
import type { CompleteSetProps } from "../src/lib/builder/complete-view";
import { ProductProvider, useProduct } from "../src/components/product/product-context";
import { toBuilderProduct } from "../src/lib/builder/catalog";
import { loadCompleteSet } from "../src/lib/builder/complete";
import { toClientProduct } from "../src/lib/catalog/product-view";
import { CART_STORAGE_KEY } from "../src/lib/cart/count";
import { cardFixture, COLORS, productFixture, SWITCHES } from "./catalog-fixtures";
import { RULES, SHOP, builderData, expectedSetPrice } from "./builder-fixtures";

const plain = (t: string | null | undefined) => (t ?? "").replaceAll(" ", " ");
const PRESET = ["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"] as const;
const sw = SWITCHES.map((s) => ({ ...s, sound: "" }));
const events = (name: string) => (window.dataLayer ?? []).filter((e) => e.event === name);

function SwitchColor() {
  const { select } = useProduct();
  return (
    <button type="button" onClick={() => select("color", "mgla")}>
      Wybierz Mgłę na karcie
    </button>
  );
}

const bazalt = productFixture("bazalt-75");
const BLOCK_PROPS: CompleteSetProps = {
  profile: "programowanie",
  skus: { k: PRESET[0], m: PRESET[1], p: PRESET[2] },
  products: [bazalt, productFixture("pustulka"), productFixture("szron")].map(toBuilderProduct),
  anchor: "k",
  colors: builderData().colors,
  switches: sw,
  rules: RULES,
  setDiscount: {
    percent: SHOP.set_discount.percent,
    categories: SHOP.set_discount.requires_categories,
  },
};

function Page({ anchorSku, children }: { anchorSku: string; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ProductProvider
        product={toClientProduct(bazalt)}
        colors={COLORS}
        switches={SWITCHES}
        initialSku={anchorSku}
        categoryName="Klawiatury"
      >
        <SwitchColor />
        {children}
      </ProductProvider>
    </ToastProvider>
  );
}

function renderBlock(anchorSku: string = PRESET[0]) {
  return render(
    <Page anchorSku={anchorSku}>
      <CompleteSetBlock {...BLOCK_PROPS} />
    </Page>,
  );
}

beforeEach(() => {
  window.dataLayer = [];
  window.history.replaceState(null, "", "/klawiatury/bazalt-75");
});

describe("blok Dokoncz set (F-069)", () => {
  it("sekcja ciemna z trzema elementami, cena setu z rabatem (kontrolnie z presets.json)", () => {
    const { container } = renderBlock();
    const section = screen.getByTestId("dokoncz-set");
    expect(section).toHaveClass("sekcja--mod");
    expect(container.querySelectorAll(".dokoncz__pozycja")).toHaveLength(3);
    const exp = expectedSetPrice([...PRESET]);
    expect(plain(section.textContent)).toContain("1203,30 zł");
    expect(exp.total).toBe(120330);
    expect(plain(section.textContent)).toContain("−133,70 zł");
    expect(plain(section.textContent)).toContain("Dopasowanie: Pasuje");
  });

  it("zmiana wariantu myszki przelicza cene i rabat", async () => {
    const user = userEvent.setup();
    renderBlock();
    const select = screen.getByLabelText("Wariant: Pustułka");
    expect(select).toHaveValue("M-PST-GRF");
    await user.selectOptions(select, "M-PST-MGL");
    const exp = expectedSetPrice(["K-BZL75-GRF-PRG", "M-PST-MGL", "P-SZR-XL-GRF"]);
    const text = plain(screen.getByTestId("dokoncz-set").textContent);
    expect(text).toContain(
      plain(
        new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(
          exp.total / 100,
        ),
      ),
    );
  });

  it("wariant bez stanu jest wylaczony na liscie", () => {
    renderBlock();
    const select = screen.getByLabelText("Wariant: Szron");
    const options = within(select).getAllByRole("option");
    expect(options.length).toBeGreaterThan(1);
  });

  it("produkt z karty: wariant z wyboru powyzej wchodzi do setu", async () => {
    const user = userEvent.setup();
    renderBlock();
    await user.click(screen.getByRole("button", { name: "Wybierz Mgłę na karcie" }));
    const link = screen.getByRole("link", { name: "Otwórz w kreatorze" });
    expect(new URL(link.getAttribute("href") ?? "", "http://x").searchParams.get("k")).toMatch(
      /^K-BZL75-MGL-/,
    );
  });

  it("Otworz w kreatorze: k, m, p, krok=podsumowanie i wejscie pdp_complete", () => {
    renderBlock();
    const href =
      screen.getByRole("link", { name: "Otwórz w kreatorze" }).getAttribute("href") ?? "";
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/zbuduj-set");
    expect(url.searchParams.get("k")).toBe(PRESET[0]);
    expect(url.searchParams.get("m")).toBe(PRESET[1]);
    expect(url.searchParams.get("p")).toBe(PRESET[2]);
    expect(url.searchParams.get("krok")).toBe("podsumowanie");
    expect(url.searchParams.get("profil")).toBe("programowanie");
    expect(url.searchParams.get("wejscie")).toBe("pdp_complete");
  });

  it("Dodaj set do koszyka: grupa setu, add_to_cart z rabatem, set_add_to_cart", async () => {
    const user = userEvent.setup();
    renderBlock();
    await user.click(screen.getByRole("button", { name: "Dodaj set do koszyka" }));
    await waitFor(() => expect(events("set_add_to_cart")).toHaveLength(1));
    const cart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "{}") as {
      lines: { type: string; items: { sku: string }[] }[];
    };
    expect(cart.lines.find((l) => l.type === "set")?.items.map((i) => i.sku)).toEqual([...PRESET]);
    const add = events("add_to_cart")[0]?.ecommerce as {
      value: number;
      items: { discount: number; item_list_id: string }[];
    };
    expect(add.value).toBe(1203.3);
    expect(Math.round(add.items.reduce((s, i) => s + i.discount, 0) * 100)).toBe(13370);
    expect(add.items[0]?.item_list_id).toBe("dokoncz-set");
    expect(events("set_add_to_cart")[0]).toMatchObject({ discount: 133.7 });
    expect(events("set_add_to_cart")[0]).not.toHaveProperty("preset_id");
  });

  it("a11y: axe bez naruszen", async () => {
    const { container } = renderBlock();
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});

describe("leniwe ladowanie bloku (budzet JS karty, docs/12 §4)", () => {
  it("najpierw statyczny widok z cena i odnosnikiem, interaktywna wersja po zblizeniu do widoku", async () => {
    let trigger: (() => void) | null = null;
    class IO {
      constructor(cb: IntersectionObserverCallback) {
        trigger = () =>
          cb(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", IO);
    render(
      <Page anchorSku={PRESET[0]}>
        <CompleteSetLazy props={BLOCK_PROPS}>
          <CompleteSetStatic {...BLOCK_PROPS} />
        </CompleteSetLazy>
      </Page>,
    );
    const section = screen.getByTestId("dokoncz-set");
    expect(plain(section.textContent)).toContain("1203,30 zł");
    expect(screen.getByRole("link", { name: "Otwórz w kreatorze" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodaj set do koszyka" })).toBeDisabled();
    expect(screen.getByLabelText("Wariant: Pustułka")).toBeDisabled();
    await waitFor(() => expect(trigger).not.toBeNull());
    act(() => trigger?.());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Dodaj set do koszyka" })).toBeEnabled(),
    );
    expect(screen.getByLabelText("Wariant: Pustułka")).toBeEnabled();
    expect(plain(screen.getByTestId("dokoncz-set").textContent)).toContain("1203,30 zł");
    vi.unstubAllGlobals();
  });
});

describe("ladowanie danych bloku", () => {
  function stubApi(complete: Response | "error") {
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        );
        if (url.pathname.endsWith("/complete-set")) {
          if (complete === "error") throw new Error("API niedostepne");
          return complete;
        }
        if (url.pathname === "/v1/rules") return json(RULES);
        if (url.pathname === "/v1/products") {
          const category = url.searchParams.get("category") as "myszki" | "podkladki";
          const slugs = category === "myszki" ? ["pustulka"] : ["szron"];
          return json({
            items: slugs.map((s) => cardFixture(productFixture(s))),
            next_cursor: null,
            total: slugs.length,
          });
        }
        const slug = url.pathname.split("/").pop() ?? "";
        return json(productFixture(slug));
      }),
    );
  }

  it("zwraca komplet z API wraz z pelnymi produktami", async () => {
    const exp = expectedSetPrice([...PRESET]);
    stubApi(
      new Response(
        JSON.stringify({
          profile: "programowanie",
          items: PRESET.map((sku) => ({
            sku,
            name: sku.startsWith("K") ? "Bazalt 75" : sku.startsWith("M") ? "Pustułka" : "Szron",
            price_gr: 1,
          })),
          sum_gr: exp.sum,
          set_discount_gr: exp.discount,
          total_gr: exp.total,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const data = await loadCompleteSet(bazalt, PRESET[0]);
    expect(data).toMatchObject({
      profile: "programowanie",
      skus: { k: PRESET[0], m: PRESET[1], p: PRESET[2] },
      anchor: "k",
    });
    expect(data?.products.map((p) => p.id).sort()).toEqual([
      "k-bazalt-75",
      "m-pustulka",
      "p-szron",
    ]);
  });

  it("gdy API nie zwroci kompletu, blok jest ukryty (null)", async () => {
    stubApi("error");
    expect(await loadCompleteSet(bazalt, PRESET[0])).toBeNull();
    const el = await CompleteSet({
      product: bazalt,
      sku: PRESET[0],
      colors: builderData().colors,
      switches: sw,
      settings: {
        set_discount: { percent: 10, categories: ["klawiatury", "myszki", "podkladki"] },
      },
    });
    expect(el).toBeNull();
  });

  it("404 z API tez ukrywa blok", async () => {
    stubApi(new Response(JSON.stringify({ title: "Not found", status: 404 }), { status: 404 }));
    expect(await loadCompleteSet(bazalt, PRESET[0])).toBeNull();
  });
});
