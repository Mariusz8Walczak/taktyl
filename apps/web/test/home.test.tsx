// F-001..F-009, F-067, F-106, F-111, A-02 (hak), F-242 (TAKTYL-37): strona glowna - pierwszy ekran, kafle kategorii,
// "Jak dziala set" (liczby wyliczone z danych), gotowe sety (4 sety kontrolne), polecane, pomiar list, dostepnosc.
import type { Category } from "@taktyl/contracts";
import { formatPLN } from "@taktyl/domain";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "@taktyl/ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

const getListing = vi.fn();
const getProduct = vi.fn();
vi.mock("../src/lib/api", async () => {
  const fx = await import("./catalog-fixtures");
  return {
    getColors: async () => fx.COLORS,
    getSwitches: async () => fx.SWITCHES,
    getListing: (...a: unknown[]) => getListing(...a),
    getProduct: (...a: unknown[]) => getProduct(...a),
  };
});

import { CategoryTiles } from "../src/components/home/category-tiles";
import { Featured } from "../src/components/home/featured";
import { Hero } from "../src/components/home/hero";
import { SCENE_CLASS, SCENE_SESSION_KEY } from "../src/components/home/hero-desk";
import { HowItWorks } from "../src/components/home/how-it-works";
import { PresetCards } from "../src/components/home/preset-cards";
import { createModel, type BuilderData } from "../src/lib/builder/catalog";
import {
  BUILDER_HERO_HREF,
  FEATURED_PER_CATEGORY,
  buildCategoryTiles,
  buildHeroDesk,
  buildPresetCards,
  buildSetExample,
  exampleSentences,
  presetHref,
} from "../src/lib/home/view";
import { homeJsonLd } from "../src/lib/home/json-ld";
import { builderData, expectedSetPrice, model, RAW_PRESETS } from "./builder-fixtures";
import { cardFixture, productFixture } from "./catalog-fixtures";
import { SHOP_SETTINGS } from "./fixtures";

// ---- IntersectionObserver: reczne wyzwalanie widocznosci ----
type IoCallback = (entries: { isIntersecting: boolean }[]) => void;
const observers: { cb: IoCallback; disconnected: boolean }[] = [];
class FakeIo {
  entry: { cb: IoCallback; disconnected: boolean };
  constructor(cb: IoCallback) {
    this.entry = { cb, disconnected: false };
    observers.push(this.entry);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.entry.disconnected = true;
  }
}
function reveal() {
  act(() => {
    for (const o of observers) if (!o.disconnected) o.cb([{ isIntersecting: true }]);
  });
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeIo);
  window.dataLayer = [];
});

function categories(): Category[] {
  const ids = ["klawiatury", "myszki", "podkladki"] as const;
  return ids.map((id, position) => {
    const list = model.products.filter((p) => p.category === id);
    const prices = list.flatMap((p) =>
      p.variants.filter((v) => v.stock > 0).map((v) => v.price_gr),
    );
    return {
      id,
      slug: id,
      name: { klawiatury: "Klawiatury", myszki: "Myszki", podkladki: "Podkładki" }[id],
      h1: id,
      intro: id,
      position,
      model_count: list.length,
      from_price_gr: Math.min(...prices),
    };
  });
}

describe("pierwszy ekran (F-001, F-067, F-106)", () => {
  const desk = buildHeroDesk(model);

  it("ma jeden H1, podtytul z rabatem z ustawien i dwa przyciski", () => {
    render(<Hero settings={SHOP_SETTINGS} desk={desk?.data ?? null} />);
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]?.textContent?.replace(/\u00A0/g, " ")).toBe(
      "Złóż set, który pasuje do biurka i dłoni.",
    );
    expect(screen.getByText(/za komplet odejmiemy 10%/)).toBeInTheDocument();
    const main = screen.getByRole("link", { name: "Zbuduj set" });
    expect(main).toHaveAttribute("href", BUILDER_HERO_HREF);
    expect(BUILDER_HERO_HREF).toContain("wejscie=hero");
    expect(main).toHaveClass("tk-btn--glowny");
    const second = screen.getByRole("link", { name: "Gotowe sety" });
    expect(second).toHaveAttribute("href", "#gotowe-sety");
    expect(second).toHaveClass("tk-btn--poboczny");
  });

  it("pasek warunkow: 4 pozycje tekstem, prog dostawy z ustawien, bez ikon", () => {
    const { container } = render(<Hero settings={SHOP_SETTINGS} desk={null} />);
    const bar = screen.getByRole("list", { name: "Warunki zakupu" });
    const items = within(bar).getAllByRole("listitem");
    expect(items.map((i) => i.textContent?.replace(/\u00A0/g, " "))).toEqual([
      "−10% za komplet",
      "Darmowa dostawa od 299 zł",
      "30 dni na zwrot",
      "Wysyłka w 24 h",
    ]);
    expect(container.querySelector("svg, i[class*=icon], img")).toBeNull();
  });

  it("DeskStage pokazuje gotowy set Programista z wynikiem 'Pasuje · zapas' (S9)", () => {
    expect(desk?.presetId).toBe("programista");
    render(<Hero settings={SHOP_SETTINGS} desk={desk?.data ?? null} />);
    const scene = screen.getByRole("img", { name: /Podgląd:/ });
    expect(scene).toHaveAccessibleName(/Zapas 28,3\s+cm/);
    expect(screen.getByText(/Pasuje · zapas 28,3\s+cm/)).toBeInTheDocument();
  });

  it("A-02 (hak): klasa scena-start dodawana raz na sesje, po zgloszeniu widocznosci", () => {
    const { unmount } = render(<Hero settings={SHOP_SETTINGS} desk={desk?.data ?? null} />);
    const frame = screen.getByTestId("hero-scena");
    // przed zgloszeniem widocznosci elementy sceny sa normalnie widoczne (brak klasy, brak ukrywania)
    expect(frame).not.toHaveClass(SCENE_CLASS);
    reveal();
    expect(frame).toHaveClass(SCENE_CLASS);
    expect(window.sessionStorage.getItem(SCENE_SESSION_KEY)).toBe("1");
    unmount();

    // ta sama sesja: drugie wejscie nie animuje
    render(<Hero settings={SHOP_SETTINGS} desk={desk?.data ?? null} />);
    reveal();
    expect(screen.getByTestId("hero-scena")).not.toHaveClass(SCENE_CLASS);
  });

  it("A-02: sessionStorage rzucajacy wyjatek nie psuje strony", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("zablokowane");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("zablokowane");
    });
    render(<Hero settings={SHOP_SETTINGS} desk={desk?.data ?? null} />);
    expect(() => reveal()).not.toThrow();
    expect(screen.getByTestId("hero-scena")).toHaveClass(SCENE_CLASS);
  });

  it("bez danych setu pierwszy ekran nadal ma H1 i przyciski (bez sceny)", () => {
    render(<Hero settings={SHOP_SETTINGS} desk={null} />);
    expect(screen.queryByTestId("hero-scena")).toBeNull();
    expect(screen.getByRole("link", { name: "Zbuduj set" })).toBeInTheDocument();
  });
});

describe("kafle kategorii (F-020)", () => {
  it("3 kafle: 'N modeli · od X zł' z danych, jeden odnosnik na kafel", () => {
    const tiles = buildCategoryTiles(categories(), model);
    render(<CategoryTiles tiles={tiles} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/klawiatury",
      "/myszki",
      "/podkladki",
    ]);
    const summaries = tiles.map((t) => t.summary);
    for (const s of summaries) expect(s).toMatch(/^\d+ modeli · od \d/);
    // od X zl = najtanszy dostepny wariant kategorii
    const cheapestPads = Math.min(
      ...model.products
        .filter((p) => p.category === "podkladki")
        .flatMap((p) => p.variants.filter((v) => v.stock > 0).map((v) => v.price_gr)),
    );
    expect(summaries[2]).toContain(formatPLN(cheapestPads));
  });

  it("liczebnik modeli przez Intl.PluralRules (1 model, 2 modele, 5 modeli)", () => {
    const base = categories();
    const one = { ...(base[0] as Category), model_count: 1 };
    const two = { ...(base[1] as Category), model_count: 2 };
    const five = { ...(base[2] as Category), model_count: 5 };
    const t = buildCategoryTiles([one, two, five], model).map((x) => x.summary.split(" · ")[0]);
    expect(t).toEqual(["1 model", "2 modele", "5 modeli"]);
  });
});

describe("Jak dziala set (docs/01 §2.3): liczby wyliczone", () => {
  it("przyklad: Marmur 100 44 cm, strefa 40 cm, wymagane 91 cm, mata XL 90 cm, propozycja XXL", () => {
    const ex = buildSetExample(model);
    expect(ex).not.toBeNull();
    const text = exampleSentences(ex!)
      .join(" ")
      .replace(/\u00A0/g, " ");
    expect(text).toContain("Marmur 100 ma 44 cm szerokości.");
    expect(text).toContain("potrzebuje około 40 cm");
    expect(text).toContain("Z odstępami to 91 cm, a mata XL ma 90 cm.");
    expect(text).toContain("zaproponuje XXL");
  });

  it("zmiana danych zmienia liczby (nic nie jest wpisane na sztywno)", () => {
    const data: BuilderData = builderData();
    const wider = {
      ...data,
      products: data.products.map((p) =>
        p.slug === "marmur-100"
          ? ({
              ...p,
              attributes: { ...p.attributes, dims_mm: { w: 460, d: 135, h: 38 } },
            } as typeof p)
          : p,
      ),
    };
    const ex = buildSetExample(createModel(wider));
    const text = exampleSentences(ex!)
      .join(" ")
      .replace(/\u00A0/g, " ");
    expect(text).toContain("ma 46 cm szerokości");
    expect(text).toContain("to 93 cm");
    expect(text).not.toContain("91 cm");
  });

  it("gdy set sie miesci, przykladu nie ma (zero zmyslonych liczb)", () => {
    const data = builderData();
    const roomy = {
      ...data,
      products: data.products.map((p) =>
        p.slug === "marmur-100"
          ? ({
              ...p,
              attributes: { ...p.attributes, dims_mm: { w: 300, d: 135, h: 38 } },
            } as typeof p)
          : p,
      ),
    };
    expect(buildSetExample(createModel(roomy))).toBeNull();
  });

  it("sekcja ciemna: H2, 3 numerowane kroki (ol), przyklad i przycisk Zbuduj set", () => {
    const { container } = render(<HowItWorks percent={10} example={buildSetExample(model)} />);
    expect(container.querySelector("section")).toHaveClass("sekcja--mod");
    expect(screen.getByRole("heading", { level: 2, name: "Jak działa set" })).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[0]?.closest("ol")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: "Wybierz klawiaturę" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Dobierz myszkę do dłoni" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Dopasuj podkładkę do biurka" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("przyklad-setu")).toHaveTextContent(/91\s+cm/);
    expect(screen.getByRole("link", { name: "Zbuduj set" })).toHaveAttribute(
      "href",
      BUILDER_HERO_HREF,
    );
  });
});

describe("gotowe sety (F-111)", () => {
  const cards = buildPresetCards(model);

  it("4 karty z cenami wyliczonymi z domeny (kontrolne 4 sety)", () => {
    expect(cards).toHaveLength(4);
    for (const raw of RAW_PRESETS) {
      const card = cards.find((c) => c.id === raw.id);
      const expected = expectedSetPrice(raw.skus);
      expect(card?.totalText).toBe(
        `Razem ${formatPLN(expected.total)} · oszczędzasz ${formatPLN(expected.discount)}`,
      );
    }
    const programista = cards.find((c) => c.id === "programista");
    expect(programista?.totalText.replace(/\u00A0/g, " ")).toBe(
      "Razem 1203,30 zł · oszczędzasz 133,70 zł",
    );
  });

  it("karta: 3 elementy, nazwa, note, odnosnik do kreatora z presetem i wejsciem", () => {
    render(<PresetCards cards={cards} percent={10} />);
    expect(screen.getByRole("heading", { level: 2, name: "Gotowe sety" })).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 3, name: "Programista" });
    const card = heading.closest("li")!;
    expect(within(card).getAllByRole("listitem")).toHaveLength(3);
    const preset = RAW_PRESETS.find((p) => p.id === "programista")!;
    expect(within(card).getByText(preset.note)).toBeInTheDocument();
    const link = within(card).getByRole("link", { name: /Otwórz w kreatorze/ });
    expect(link).toHaveAttribute("href", "/zbuduj-set?preset=programista&wejscie=preset");
    expect(link).toHaveAttribute("href", presetHref("programista"));
    expect(screen.getAllByRole("link", { name: /Otwórz w kreatorze/ })).toHaveLength(4);
  });

  it("view_item_list raz dla listy (12 pozycji) i select_item po kliknieciu w karte", async () => {
    const user = userEvent.setup();
    render(<PresetCards cards={cards} percent={10} />);
    reveal();
    reveal(); // drugi raz nie wysyla
    const views = window.dataLayer?.filter((e) => e.event === "view_item_list") ?? [];
    expect(views).toHaveLength(1);
    const eco = views[0]?.ecommerce as { item_list_id: string; items: unknown[] };
    expect(eco.item_list_id).toBe("gotowe-sety");
    expect(eco.items).toHaveLength(12);

    const link = screen.getByRole("link", { name: /Otwórz w kreatorze: Programista/ });
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    const picked = window.dataLayer?.filter((e) => e.event === "select_item") ?? [];
    expect(picked).toHaveLength(1);
    const sel = picked[0]?.ecommerce as { items: { item_id: string }[]; item_list_name: string };
    expect(sel.item_list_name).toBe("Gotowe sety");
    expect(sel.items.map((i) => i.item_id)).toEqual(RAW_PRESETS[0]?.skus);
  });
});

describe("polecane (F-040)", () => {
  beforeEach(() => {
    const bySlug = (cat: string, n: number) =>
      model.products.filter((p) => p.category === cat).slice(0, n);
    getListing.mockImplementation(
      async ({ category, limit }: { category: string; limit: number }) => ({
        items: bySlug(category, limit).map((p) => cardFixture(productFixture(p.slug))),
        total: 6,
        next_cursor: null,
      }),
    );
    getProduct.mockImplementation(async (slug: string) => productFixture(slug));
  });

  it("8 kart: 3 klawiatury, 3 myszki, 2 podkladki, sortowanie Polecane", async () => {
    render(<ToastProvider>{await Featured()}</ToastProvider>);
    expect(getListing).toHaveBeenCalledWith(expect.objectContaining({ sort: "polecane" }));
    expect(screen.getByRole("heading", { level: 2, name: "Polecane" })).toBeInTheDocument();
    const items = screen.getAllByRole("heading", { level: 3 });
    expect(items).toHaveLength(8);
    expect(FEATURED_PER_CATEGORY).toEqual({ klawiatury: 3, myszki: 3, podkladki: 2 });
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.filter((h) => h.startsWith("/klawiatury/"))).toHaveLength(3);
    expect(hrefs.filter((h) => h.startsWith("/myszki/"))).toHaveLength(3);
    expect(hrefs.filter((h) => h.startsWith("/podkladki/"))).toHaveLength(2);
  });

  it("view_item_list z lista 'polecane' i select_item po kliknieciu karty", async () => {
    const user = userEvent.setup();
    render(<ToastProvider>{await Featured()}</ToastProvider>);
    reveal();
    const list = window.dataLayer?.find((e) => e.event === "view_item_list")?.ecommerce as {
      item_list_id: string;
      items: unknown[];
    };
    expect(list.item_list_id).toBe("polecane");
    expect(list.items).toHaveLength(8);
    const first = screen.getAllByRole("link")[0] as HTMLElement;
    first.addEventListener("click", (e) => e.preventDefault());
    await user.click(first);
    const sel = window.dataLayer?.find((e) => e.event === "select_item")?.ecommerce as {
      item_list_id: string;
      items: { index: number }[];
    };
    expect(sel.item_list_id).toBe("polecane");
    expect(sel.items[0]?.index).toBe(0);
  });
});

describe("dane strukturalne i tresc", () => {
  it("Organization i WebSite z nazwa; bez aggregateRating i review", () => {
    const ld = homeJsonLd();
    expect(ld.map((x) => x["@type"])).toEqual(["Organization", "WebSite"]);
    const text = JSON.stringify(ld);
    expect(text).not.toMatch(/aggregateRating|review/i);
    expect(text).toContain('"name":"Taktyl"');
  });

  it("sekcje bez karuzeli, opinii, logotypow i obcych domen", async () => {
    const { container } = render(
      <>
        <Hero settings={SHOP_SETTINGS} desk={buildHeroDesk(model)?.data ?? null} />
        <CategoryTiles tiles={buildCategoryTiles(categories(), model)} />
        <HowItWorks percent={10} example={buildSetExample(model)} />
        <PresetCards cards={buildPresetCards(model)} percent={10} />
      </>,
    );
    const html = container.innerHTML;
    expect(html).not.toMatch(/carousel|swiper|opinie|Ecomus|lorem|\$\s?\d|https?:\/\//i);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("dostepnosc (axe)", () => {
  it("pierwszy ekran, kategorie, jak dziala set i sety bez naruszen", async () => {
    const { container } = render(
      <main>
        <Hero settings={SHOP_SETTINGS} desk={buildHeroDesk(model)?.data ?? null} />
        <CategoryTiles tiles={buildCategoryTiles(categories(), model)} />
        <HowItWorks percent={10} example={buildSetExample(model)} />
        <PresetCards cards={buildPresetCards(model)} percent={10} />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
