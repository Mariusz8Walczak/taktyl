// F-042, F-043, A-09, A-18 (TAKTYL-59): "Szybko dodaj" - przycisk dostepny bez najechania, panel wariantow w nakladce,
// niedostepne warianty nieaktywne z opisem, szkielet po 300 ms, dodanie przez cart-adapter, toast i add_to_cart.
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ProductCard } from "../src/components/listing/product-card";
import { QuickAddHost } from "../src/components/listing/quick-add-host";
import { QUICK_ADD_SKELETON_MS } from "../src/components/listing/quick-add-panel";
import type { QuickAddData } from "../src/components/listing/quick-add-action";
import { CART_STORAGE_KEY } from "../src/lib/cart/count";
import { buildCardView, cardTrackSource } from "../src/lib/catalog/card-view";
import { toClientProduct } from "../src/lib/catalog/product-view";
import { cardFixture, COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

const action = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../src/components/listing/quick-add-action", () => ({
  loadQuickAddData: action.load,
}));

function dataFor(slug: string): QuickAddData {
  return {
    product: toClientProduct(productFixture(slug)),
    colors: COLORS.map((c) => ({ id: c.id, label: c.label, swatch: c.swatch })),
    switches: SWITCHES.map((s) => ({
      id: s.id,
      name: s.name,
      type_label: s.type_label,
      force_g: s.force_g,
    })),
  };
}

function Setup({ slug = "bazalt-75", matched = null }: { slug?: string; matched?: string | null }) {
  const p = productFixture(slug);
  const view = buildCardView(cardFixture(p, matched), p, { colors: COLORS, switches: SWITCHES });
  return (
    <ToastProvider>
      <ul>
        <ProductCard view={view} track={cardTrackSource(view, "Klawiatury", 3)} />
      </ul>
      <QuickAddHost />
    </ToastProvider>
  );
}

beforeEach(() => {
  action.load.mockReset();
  action.load.mockImplementation(async (slug: string) => dataFor(slug));
});
afterEach(() => vi.useRealTimers());

describe("przycisk na karcie (F-042, docs/11 pulapka 13)", () => {
  it("jest zwyklym, fokusowalnym przyciskiem bez najechania, z nazwa produktu", () => {
    render(<Setup />);
    const btn = screen.getByRole("button", { name: "Szybko dodaj: Bazalt 75" });
    expect(btn).toHaveTextContent("Szybko dodaj");
    expect(btn).not.toHaveAttribute("hidden");
    expect(btn).not.toHaveAttribute("tabindex", "-1");
    expect(btn.closest("[hidden]")).toBeNull();
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it("niesie SKU karty i slug do panelu, a karta nadal ma jeden odnosnik", () => {
    const { container } = render(<Setup matched="K-BZL75-KOB-PRG" />);
    const btn = screen.getByRole("button", { name: /Szybko dodaj/ });
    expect(btn).toHaveAttribute("data-slug", "bazalt-75");
    expect(btn).toHaveAttribute("data-category", "klawiatury");
    expect(btn).toHaveAttribute("data-sku", "K-BZL75-KOB-PRG");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});

describe("panel wyboru wariantu (F-043)", () => {
  it("klawiatura Enter otwiera okno z kolorem i przelacznikiem, fokus wraca na przycisk po Esc", async () => {
    const user = userEvent.setup();
    render(<Setup />);
    const btn = screen.getByRole("button", { name: /Szybko dodaj/ });
    btn.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "Szybko dodaj: Bazalt 75" });
    expect(within(dialog).getByRole("group", { name: "Kolor" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Przełącznik" })).toBeInTheDocument();
    expect(action.load).toHaveBeenCalledWith("bazalt-75", "klawiatury");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(btn).toHaveFocus();
  });

  it("niedostepne warianty sa oznaczone 'Brak': Kobalt + Szept (stan 0) jest wybieralne, ale blokuje dodanie", async () => {
    const user = userEvent.setup();
    render(<Setup matched="K-BZL75-KOB-PRG" />);
    await user.click(screen.getByRole("button", { name: /Szybko dodaj/ }));
    const dialog = await screen.findByRole("dialog");
    const szept = within(dialog).getByRole("radio", { name: /Szept/ });
    expect(szept.closest("label")).toHaveTextContent("Brak");
    expect(
      within(dialog).getByRole("radio", { name: /Ślizg/ }).closest("label"),
    ).not.toHaveTextContent("Brak");
    await user.click(szept);
    const add = within(dialog).getByRole("button", { name: "Dodaj do koszyka" });
    expect(add).toBeDisabled();
    const reason = document.getElementById(add.getAttribute("aria-describedby")!);
    expect(reason).toHaveTextContent(/Brak/);
  });

  it("dodanie: SKU i ilosc 1 trafiaja do koszyka bez cen, toast 'Dodano do koszyka' i add_to_cart z lista z karty", async () => {
    const user = userEvent.setup();
    window.dataLayer = [];
    render(<Setup />);
    await user.click(screen.getByRole("button", { name: /Szybko dodaj/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Kobalt/ }));
    await user.click(within(dialog).getByRole("button", { name: "Dodaj do koszyka" }));
    expect(await screen.findByText("Dodano do koszyka")).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "{}") as {
      lines?: { sku: string; qty: number }[];
    };
    expect(JSON.stringify(stored)).toContain("K-BZL75-KOB-SLZ");
    expect(JSON.stringify(stored)).not.toMatch(/price|cena/i);
    const ev = window.dataLayer?.find((e) => e.event === "add_to_cart") as
      { ecommerce: { items: Record<string, unknown>[]; value: number } } | undefined;
    expect(ev?.ecommerce.items[0]).toMatchObject({
      item_id: "K-BZL75-KOB-SLZ",
      quantity: 1,
      item_list_name: "Klawiatury",
      index: 3,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("A-18: szkielet pojawia sie dopiero po 300 ms ladowania", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolve!: (v: QuickAddData) => void;
    action.load.mockImplementation(() => new Promise<QuickAddData>((r) => (resolve = r)));
    render(<Setup slug="jerzyk" />);
    // przycisk: klik bez userEvent (zegar sztuczny)
    act(() => screen.getByRole("button", { name: /Szybko dodaj/ }).click());
    await screen.findByRole("dialog");
    expect(screen.queryByTestId("szybko-szkielet")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUICK_ADD_SKELETON_MS + 20);
    });
    expect(screen.getByTestId("szybko-szkielet")).toBeInTheDocument();
    await act(async () => resolve(dataFor("jerzyk")));
    expect(screen.queryByTestId("szybko-szkielet")).toBeNull();
    expect(screen.getByRole("group", { name: "Kolor" })).toBeInTheDocument();
  });

  it("blad pobrania: komunikat zamiast pickera, bez wyjatku", async () => {
    action.load.mockResolvedValue(null);
    render(<Setup slug="wrobel" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Szybko dodaj/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nie udało się wczytać wariantów/);
  });

  it("axe: panel otwarty bez naruszen", async () => {
    render(<Setup />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Szybko dodaj/ }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("group", { name: "Kolor" });
    expect(await axe(dialog)).toHaveNoViolations();
  });
});
