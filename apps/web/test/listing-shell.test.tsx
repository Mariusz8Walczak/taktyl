// F-021...F-027, F-029, A-14 (TAKTYL-27): wyspa kliencka listingu - filtry, zetony, szuflada, "Pokaz wiecej", pomiar.
import type { FacetsResponse } from "@taktyl/contracts";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { facetDefs } from "../src/lib/catalog/listing-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/klawiatury",
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: () => {}, prefetch: () => {} }),
}));
const more = vi.hoisted(() => ({ loadMoreCards: vi.fn() }));
vi.mock("../src/components/listing/load-more-action", () => more);

import { ListingShell, type ListingShellProps } from "../src/components/listing/listing-shell";

type Facet = FacetsResponse["facets"][number];
const FACETS: Facet[] = [
  {
    id: "rozmiar",
    label: "Rozmiar",
    type: "multi",
    values: [
      { v: "60", label: "60%", count: 1, disabled: false },
      { v: "75", label: "75%", count: 1, disabled: false },
      { v: "100", label: "100%", count: 0, disabled: true },
    ],
  },
  {
    id: "lacznosc",
    label: "Łączność",
    type: "multi",
    values: [{ v: "bt", label: "Bluetooth", count: 3, disabled: false }],
  },
  {
    id: "kolor",
    label: "Kolor",
    type: "multi",
    values: [{ v: "grafit", label: "Grafit", count: 5, disabled: false }],
  },
  {
    id: "hotswap",
    label: "Wymiana przełączników bez lutowania",
    type: "bool",
    count: 4,
    disabled: false,
  },
  { id: "cena", label: "Cena", type: "range", min_gr: 29900, max_gr: 74900 },
];

function card(id: string, name: string) {
  return (
    <li
      key={id}
      className="karta"
      data-track-item={JSON.stringify({ item_id: `SKU-${id}`, item_name: name })}
    >
      <h3>
        <a href={`/klawiatury/${id}`} className="karta__link">
          {name}
        </a>
      </h3>
    </li>
  );
}

function props(over: Partial<ListingShellProps> = {}): ListingShellProps {
  return {
    category: { id: "klawiatury", name: "Klawiatury" },
    facets: FACETS,
    defs: facetDefs(FACETS),
    state: {},
    sort: "polecane",
    total: 2,
    queryKey: "",
    swatches: { grafit: "red" },
    cards: [card("a", "Alfa"), card("b", "Beta")],
    initialCount: 2,
    nextCursor: null,
    initialPage: 1,
    empty: <p>Brak produktów dla wybranych filtrów</p>,
    trackItems: [],
    ...over,
  };
}

beforeEach(() => {
  nav.push.mockClear();
  more.loadMoreCards.mockReset();
  window.history.replaceState(null, "", "/klawiatury");
  window.dataLayer = [];
});

describe("ListingShell", () => {
  it("licznik z odmiana i sortowanie bez 'Najlzejsze' dla klawiatur (F-024, F-025)", () => {
    render(<ListingShell {...props({ total: 1 })} />);
    expect(screen.getByRole("status")).toHaveTextContent("1 produkt");
    const sort = screen.getByLabelText("Sortuj");
    expect(within(sort).queryByText("Najlżejsze")).toBeNull();
    expect(within(sort).getByText("Cena rosnąco")).toBeInTheDocument();
  });

  it("zaznaczenie wartosci zmienia adres przez router.push (Wstecz cofa filtr, F-022)", async () => {
    const user = userEvent.setup();
    render(<ListingShell {...props()} />);
    const aside = screen.getByRole("complementary", { name: "Filtry", hidden: true });
    await user.click(within(aside).getByRole("checkbox", { name: /75%/, hidden: true }));
    expect(nav.push).toHaveBeenCalledWith("/klawiatury?rozmiar=75", { scroll: false });
    // filter_apply do dataLayer (docs/10 §5)
    expect(
      window.dataLayer?.some((e) => e.event === "filter_apply" && e.filter_name === "rozmiar"),
    ).toBe(true);
  });

  it("wartosc z zerem wynikow jest nieaktywna (F-021)", () => {
    render(<ListingShell {...props()} />);
    const aside = screen.getByRole("complementary", { name: "Filtry", hidden: true });
    expect(within(aside).getByRole("checkbox", { name: /100%/, hidden: true })).toBeDisabled();
    expect(within(aside).getByRole("checkbox", { name: /75%/, hidden: true })).toBeEnabled();
  });

  it("wybrana wartosc z zerem pozostaje aktywna (mozna ja zdjac)", () => {
    const facets = FACETS.map((f) =>
      f.id === "rozmiar" && f.type === "multi"
        ? {
            ...f,
            values: f.values.map((v) => (v.v === "100" ? { ...v, count: 0, disabled: false } : v)),
          }
        : f,
    );
    render(
      <ListingShell {...props({ facets, defs: facetDefs(facets), state: { rozmiar: ["100"] } })} />,
    );
    const aside = screen.getByRole("complementary", { name: "Filtry", hidden: true });
    expect(within(aside).getByRole("checkbox", { name: /100%/, hidden: true })).toBeEnabled();
  });

  it("zetony aktywnych filtrow: usuniecie zeton zdejmuje filtr, 'Wyczysc wszystko' zdejmuje wszystkie (F-023)", async () => {
    const user = userEvent.setup();
    render(
      <ListingShell
        {...props({
          state: { rozmiar: ["75"], lacznosc: ["bt"], cena: { min: 30000, max: 70000 } },
        })}
      />,
    );
    const group = screen.getByRole("group", { name: "Aktywne filtry" });
    expect(
      within(group).getByRole("button", { name: "Usuń filtr: Rozmiar: 75%" }),
    ).toBeInTheDocument();
    expect(within(group).getAllByRole("button")).toHaveLength(4); // 3 zetony + Wyczysc wszystko
    await user.click(within(group).getByRole("button", { name: "Usuń filtr: Rozmiar: 75%" }));
    expect(nav.push).toHaveBeenLastCalledWith("/klawiatury?lacznosc=bt&cena=300-700", {
      scroll: false,
    });
    await user.click(within(group).getByRole("button", { name: "Wyczyść wszystko" }));
    expect(nav.push).toHaveBeenLastCalledWith("/klawiatury", { scroll: false });
  });

  it("kolor w filtrze ma probke i nazwe", () => {
    render(<ListingShell {...props()} />);
    const aside = screen.getByRole("complementary", { name: "Filtry", hidden: true });
    const opt = within(aside)
      .getByRole("checkbox", { name: /Grafit/, hidden: true })
      .closest("label");
    expect(opt?.querySelector(".tk-probka__kolo")).not.toBeNull();
  });

  it("sortowanie zmienia adres (sort=cena-rosnaco)", async () => {
    const user = userEvent.setup();
    render(<ListingShell {...props()} />);
    await user.selectOptions(screen.getByLabelText("Sortuj"), "cena-rosnaco");
    expect(nav.push).toHaveBeenCalledWith("/klawiatury?sort=cena-rosnaco", { scroll: false });
  });

  it("przelacznik siatki 3/4 kolumn zmienia data-kolumny", async () => {
    const user = userEvent.setup();
    const { container } = render(<ListingShell {...props()} />);
    const grid = container.querySelector("ul.siatka");
    expect(grid).toHaveAttribute("data-kolumny", "3");
    await user.click(screen.getByRole("button", { name: "4 kolumny" }));
    expect(grid).toHaveAttribute("data-kolumny", "4");
    expect(screen.getByRole("button", { name: "4 kolumny" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("szuflada filtrow: przycisk 'Pokaz N produktow' aktualizuje sie na zywo (F-027)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ListingShell {...props({ total: 12, state: { rozmiar: ["75"] } })} />,
    );
    await user.click(screen.getByRole("button", { name: "Filtry (1)" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Pokaż 12 produktów" })).toBeInTheDocument();
    rerender(<ListingShell {...props({ total: 3, state: { rozmiar: ["75"] } })} />);
    expect(within(dialog).getByRole("button", { name: "Pokaż 3 produkty" })).toBeInTheDocument();
    rerender(<ListingShell {...props({ total: 1, state: { rozmiar: ["75"] } })} />);
    expect(within(dialog).getByRole("button", { name: "Pokaż 1 produkt" })).toBeInTheDocument();
    // Esc zamyka, fokus wraca na przycisk (pulapka 12)
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Filtry (1)" })).toHaveFocus();
  });

  it("pusty wynik pokazuje komunikat z propozycjami, nie pusta siatke (F-029)", () => {
    const { container } = render(
      <ListingShell {...props({ total: 0, cards: null, initialCount: 0 })} />,
    );
    expect(screen.getByText("Brak produktów dla wybranych filtrów")).toBeInTheDocument();
    expect(container.querySelector("ul.siatka")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("0 produktów");
  });

  it("klikniecie karty wysyla select_item z items[] (docs/10)", async () => {
    const user = userEvent.setup();
    render(<ListingShell {...props()} />);
    await user.click(screen.getByRole("link", { name: "Alfa" }));
    const ev = window.dataLayer?.find((e) => e.event === "select_item") as
      { ecommerce: { item_list_id: string; items: { item_id: string }[] } } | undefined;
    expect(ev?.ecommerce.item_list_id).toBe("klawiatury");
    expect(ev?.ecommerce.items[0]?.item_id).toBe("SKU-a");
  });

  it("'Pokaz wiecej': dopisuje karty, fokus na pierwszym nowym, adres dostaje strona=2 (F-026)", async () => {
    const user = userEvent.setup();
    more.loadMoreCards.mockResolvedValue({
      nodes: [card("c", "Gamma"), card("d", "Delta")],
      nextCursor: null,
      count: 2,
    });
    render(<ListingShell {...props({ total: 4, nextCursor: "kursor-1" })} />);
    expect(screen.getByText("Wyświetlono 2 z 4 produktów")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pokaż więcej" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Gamma" })).toHaveFocus());
    expect(more.loadMoreCards).toHaveBeenCalledWith(
      expect.objectContaining({ category: "klawiatury", cursor: "kursor-1", startIndex: 2 }),
    );
    expect(screen.getByRole("link", { name: "Delta" })).toBeInTheDocument();
    expect(window.location.search).toBe("?strona=2");
    // brak dalszej partii: przycisk znika
    expect(screen.queryByRole("button", { name: "Pokaż więcej" })).toBeNull();
  });

  it("blad pobrania 'Pokaz wiecej' pokazuje komunikat i zostawia przycisk", async () => {
    const user = userEvent.setup();
    more.loadMoreCards.mockRejectedValue(new Error("siec"));
    render(<ListingShell {...props({ total: 4, nextCursor: "kursor-1" })} />);
    await user.click(screen.getByRole("button", { name: "Pokaż więcej" }));
    expect(await screen.findByText(/Nie udało się pobrać kolejnych produktów/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pokaż więcej" })).toBeInTheDocument();
  });

  it("zakres ceny: pola 'Od' i 'Do' zatwierdzaja zakres (grosze w adresie jako zlote)", async () => {
    const user = userEvent.setup();
    render(<ListingShell {...props()} />);
    const aside = screen.getByRole("complementary", { name: "Filtry", hidden: true });
    const from = within(aside).getByLabelText("Od (zł)");
    await user.clear(from);
    await user.type(from, "300");
    fireEvent.blur(from);
    await act(async () => {});
    expect(nav.push).toHaveBeenCalledWith("/klawiatury?cena=300-", { scroll: false });
  });

  it("dostepnosc: bez bledow axe", async () => {
    const { container } = render(<ListingShell {...props({ state: { rozmiar: ["75"] } })} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
