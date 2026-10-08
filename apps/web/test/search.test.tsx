// F-005 (TAKTYL-29): wyszukiwarka - klawiatura, ARIA, debounce, abort, szkielet A-18, brak wynikow, zdarzenie search.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { SearchBox } from "../src/components/search/search-box";
import { buildOptions, highlightParts } from "../src/lib/search/suggest";
import type { SuggestResponse } from "../src/lib/search/suggest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push }),
}));

const RESPONSE: SuggestResponse = {
  products: [
    {
      id: "p1",
      slug: "lupek-65",
      category: "klawiatury",
      category_name: "Klawiatury",
      name: "Łupek 65",
      from_price_gr: 59900,
      thumb: "img/produkty/k-lupek-65_grafit_01-34-400.webp",
    },
    {
      id: "p2",
      slug: "granit-tkl",
      category: "klawiatury",
      category_name: "Klawiatury",
      name: "Granit TKL",
      from_price_gr: 69900,
      thumb: null,
    },
  ],
  categories: [{ id: "klawiatury", slug: "klawiatury", name: "Klawiatury" }],
  guides: [{ slug: "przelaczniki", title: "Jak wybrać przełączniki", lead: null }],
};

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  push.mockReset();
  window.dataLayer = [];
  fetchMock = vi.fn(() => ok(RESPONSE));
  vi.stubGlobal("fetch", fetchMock);
});

async function openSearch() {
  const user = userEvent.setup();
  render(<SearchBox />);
  await user.click(screen.getByRole("link", { name: "Szukaj" }));
  const input = await screen.findByRole("combobox", { name: "Szukaj w sklepie" });
  return { user, input };
}

describe("suggest (czyste funkcje)", () => {
  it("podswietlenie z normalizacja: lupek -> Łupek", () => {
    expect(highlightParts("Łupek 65", "lupek")).toEqual([
      { text: "Łupek", match: true },
      { text: " 65", match: false },
    ]);
    expect(highlightParts("Pustułka", "tulk")).toEqual([
      { text: "Pus", match: false },
      { text: "tułk", match: true },
      { text: "a", match: false },
    ]);
    expect(highlightParts("Granit TKL", "zzz")).toEqual([{ text: "Granit TKL", match: false }]);
  });

  it("opcje: produkty, kategorie, poradniki z adresami z docs/05 i cena od", () => {
    const o = buildOptions(RESPONSE);
    expect(o.map((x) => x.href)).toEqual([
      "/klawiatury/lupek-65",
      "/klawiatury/granit-tkl",
      "/klawiatury",
      "/poradnik/przelaczniki",
    ]);
    expect(o[0]?.hint).toMatch(/^od 599,00\s?zł$/);
  });
});

describe("SearchBox (F-005)", () => {
  it("odnosnik Szukaj ma adres /szukaj i podpowiedz skrotu /", () => {
    render(<SearchBox />);
    const link = screen.getByRole("link", { name: "Szukaj" });
    expect(link).toHaveAttribute("href", "/szukaj");
    expect(link.querySelector("kbd")).toHaveTextContent("/");
  });

  it("po otwarciu fokus jest w polu z role=combobox, a okno nie ma bledow a11y", async () => {
    const { input } = await openSearch();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(await axe(await screen.findByRole("dialog"))).toHaveNoViolations();
  });

  it("jeden znak nie pyta API; dwa znaki po debounce pytaja raz z q po normalizacji po stronie API", async () => {
    const { user, input } = await openSearch();
    await user.type(input, "l");
    await new Promise((r) => setTimeout(r, 350));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(input, "upek");
    expect(fetchMock).not.toHaveBeenCalled(); // debounce: nic przed uplywem czasu
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/search?q=lupek");
  });

  it("listbox z grupami, podswietleniem i strzalkami (aria-activedescendant), Enter wybiera opcje", async () => {
    const { user, input } = await openSearch();
    await user.type(input, "lupek");
    const list = await screen.findByRole("listbox", { name: "Podpowiedzi" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", list.id);
    expect(screen.getByRole("group", { name: "Produkty" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Kategorie" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Poradniki" })).toBeInTheDocument();
    expect(list.querySelector("mark")).toHaveTextContent("Łupek");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[0]?.id);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[2]?.id);
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}"); // zawijanie do ostatniej
    expect(input).toHaveAttribute("aria-activedescendant", options[3]?.id);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/klawiatury/lupek-65");
    expect(window.dataLayer).toContainEqual({ event: "search", search_term: "lupek" });
  });

  it("produkt ma miniature z /media/ i podpis rodzaju; brak zdjecia = sam podpis", async () => {
    const opts = buildOptions(RESPONSE).filter((o) => o.group === "products");
    expect(opts[0]).toMatchObject({
      thumb: "img/produkty/k-lupek-65_grafit_01-34-400.webp",
      kind: "Klawiatury",
    });
    expect(opts[1]).toMatchObject({ thumb: null, kind: "Klawiatury" });
  });

  it("Enter bez wyboru przechodzi na /szukaj?q= i wysyla search", async () => {
    const { user, input } = await openSearch();
    await user.type(input, "tkl{Enter}");
    expect(push).toHaveBeenCalledWith("/szukaj?q=tkl");
    expect(window.dataLayer).toContainEqual({ event: "search", search_term: "tkl" });
  });

  it("Esc zamyka okno i oddaje fokus odnosnikowi", async () => {
    const { user } = await openSearch();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: "Szukaj" })).toHaveFocus();
  });

  it("brak wynikow: komunikat i odnosniki do kategorii", async () => {
    fetchMock.mockImplementation(() => ok({ products: [], categories: [], guides: [] }));
    const { user, input } = await openSearch();
    await user.type(input, "zzzz");
    expect(await screen.findByText(/Brak wyników dla „zzzz”/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Myszki" })).toHaveAttribute("href", "/myszki");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("wyjatek sieci: komunikat bez wywrocenia, Enter nadal prowadzi do wynikow", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("Failed to fetch")));
    const { user, input } = await openSearch();
    await user.type(input, "lod");
    expect(await screen.findByText(/Nie udało się pobrać podpowiedzi/)).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/szukaj?q=lod");
  });

  it("kolejne wpisanie anuluje poprzednie zapytanie (AbortController)", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>(() => {}); // wisi, dopoki go nie przerwiemy
    });
    const { user, input } = await openSearch();
    await user.type(input, "lu");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.type(input, "p");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it("A-18: szkielet pojawia sie dopiero po 300 ms ladowania", async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    const { user, input } = await openSearch();
    await user.type(input, "lu");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId("szukaj-szkielet")).toBeNull();
    expect(await screen.findByTestId("szukaj-szkielet", {}, { timeout: 1000 })).toBeInTheDocument();
  });
});
