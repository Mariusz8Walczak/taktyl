// F-040, F-041, F-044, A-09 (TAKTYL-27): karta produktu na listingu - jeden odnosnik, parametry, cena z Omnibusem,
// plakietki, probki kolorow z nazwa, zdjecie z manifestu (placeholder), przycisk "Szybko dodaj" (TAKTYL-59, szczegoly w quick-add.test.tsx).
import { ToastProvider } from "@taktyl/ui";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ProductCard } from "../src/components/listing/product-card";
import { buildCardView, cardTrackSource } from "../src/lib/catalog/card-view";
import { cardFixture, COLORS, productFixture, SWITCHES } from "./catalog-fixtures";

function renderCard(
  slug: string,
  matched: string | null = null,
  status: "brak" | "gotowe" = "brak",
) {
  const p = productFixture(slug, status);
  const view = buildCardView(cardFixture(p, matched), p, { colors: COLORS, switches: SWITCHES });
  // ToastProvider: przyciski ulubionych i porownania na karcie (F-130, F-132) pokazuja toast
  return render(
    <ToastProvider>
      <ul>
        <ProductCard view={view} track={cardTrackSource(view, "Klawiatury", 0)} />
      </ul>
    </ToastProvider>,
  );
}

describe("ProductCard", () => {
  it("cala karta ma jeden odnosnik, na nazwie, z pseudoelementem (F-040)", () => {
    const { container } = renderCard("bazalt-75");
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Bazalt 75");
    expect(links[0]).toHaveAttribute("href", "/klawiatury/bazalt-75");
    expect(links[0]).toHaveClass("karta__link");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("3 parametry kluczowe z atrybutow, bez przymiotnikow (F-041)", () => {
    renderCard("bazalt-75");
    const dl = screen.getByText("Rozmiar").closest("dl")!;
    expect(within(dl).getAllByRole("term")).toHaveLength(3);
    expect(within(dl).getByText("75%")).toBeInTheDocument();
    expect(within(dl).getByText("Ślizg, Próg, Trzask, Szept")).toBeInTheDocument();
  });

  it("promocja: 'od' + cena aktualna, przekreslona najnizsza z 30 dni, plakietka i zdanie Omnibus (S5)", () => {
    const { container } = renderCard("granit-tkl");
    expect(screen.getByText("−14%")).toBeInTheDocument();
    const del = container.querySelector("del")!;
    expect(del).toHaveTextContent("699,00");
    expect(container.querySelector(".karta__kwota--promocja")).toHaveTextContent("599,00");
    expect(screen.getByText(/Najniższa cena z 30 dni przed obniżką: 699,00/)).toBeInTheDocument();
    expect(container.textContent).not.toContain("749"); // regular_price nie wystepuje
  });

  it("bez promocji nie ma przekreslenia ani zdania Omnibus", () => {
    const { container } = renderCard("bazalt-75");
    expect(container.querySelector("del")).toBeNull();
    expect(screen.queryByText(/Najniższa cena z 30 dni/)).toBeNull();
  });

  it("probki kolorow z nazwa (kolor nie jest jedynym nosnikiem)", () => {
    renderCard("bazalt-75");
    const list = screen.getByRole("list", { name: "Dostępne kolory" });
    expect(within(list).getByText("Grafit")).toBeInTheDocument();
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });

  it("filtr wariantowy: odnosnik z ?sku= dopasowanego wariantu", () => {
    renderCard("bazalt-75", "K-BZL75-KOB-PRG");
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/klawiatury/bazalt-75?sku=K-BZL75-KOB-PRG",
    );
  });

  it("zdjecie 1:1 przez ProductImage: placeholder o tych samych wymiarach, gdy manifest ma status brak (docs/09)", () => {
    const { container } = renderCard("bazalt-75");
    const ph = container.querySelector(".tk-obraz--placeholder");
    expect(ph).not.toBeNull();
    expect(ph?.getAttribute("role")).toBe("img");
    expect(ph?.getAttribute("aria-label")).toMatch(
      /Bazalt 75 w kolorze Grafit.*zdjęcie w przygotowaniu/,
    );
    // A-09: bez gotowego drugiego ujecia nie ma drugiego obrazu
    expect(container.querySelector(".karta__obraz--drugie")).toBeNull();
  });

  it("zdjecie gotowe: img z width, height i srcset; drugie ujecie tylko gdy gotowe (A-09)", () => {
    const { container } = renderCard("bazalt-75", null, "gotowe");
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(2);
    for (const img of imgs) {
      expect(img.getAttribute("width")).toBeTruthy();
      expect(img.getAttribute("height")).toBeTruthy();
      expect(img.getAttribute("srcset")).toBeTruthy();
    }
    expect(container.querySelector(".karta__obraz--drugie")).not.toBeNull();
    expect(imgs[0]?.getAttribute("src")).toContain("/media/img/produkty/");
  });

  it("dostepnosc: 'Szybko dodaj' jest zwyklym przyciskiem bez najechania (F-042, pulapka 13)", () => {
    renderCard("bazalt-75");
    const btn = screen.getByRole("button", { name: "Szybko dodaj: Bazalt 75" });
    expect(btn).toBeVisible();
    expect(btn).not.toHaveAttribute("tabindex", "-1");
  });

  it("ma atrybut pomiaru z items[] i unikalna nazwe przejscia (A-14)", () => {
    const { container } = renderCard("bazalt-75");
    const li = container.querySelector("li.karta") as HTMLElement;
    const item = JSON.parse(li.getAttribute("data-track-item")!);
    expect(item).toMatchObject({
      item_id: "K-BZL75-GRF-SLZ",
      item_name: "Bazalt 75",
      item_brand: "Taktyl",
      item_category: "klawiatury",
      item_list_id: "klawiatury",
      index: 0,
    });
    expect(li.style.getPropertyValue("--vt")).toBe("karta-k-bazalt-75");
  });

  it("dostepnosc: bez bledow axe", async () => {
    const { container } = renderCard("granit-tkl");
    expect(await axe(container)).toHaveNoViolations();
  });
});
