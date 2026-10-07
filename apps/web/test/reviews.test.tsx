// F-076 (TAKTYL-58): opinie demo - srednia z liczba i odmiana, etykieta, ocena tekstem, brak danych strukturalnych.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ReviewsView } from "../src/components/reviews/reviews-section";
import { productJsonLd } from "../src/lib/catalog/product-view";
import { ratingText, reviewDate, reviewSummary, starChars } from "../src/lib/reviews/format";
import { productFixture } from "./catalog-fixtures";

const LABEL = "Opinie przykładowe — sklep demonstracyjny";
const DATA = {
  label: LABEL,
  avg: 4.6,
  count: 5,
  items: [
    {
      author: "Ola K.",
      date: "2026-09-14",
      rating: 5,
      variant_label: "Grafit · Próg",
      text: "Cichy.",
    },
    {
      author: "Piotr W.",
      date: "2026-08-02",
      rating: 4,
      variant_label: "Mgła · Szept",
      text: "Ok.",
    },
  ],
};

describe("format opinii (F-076, regula 7)", () => {
  it("podsumowanie to srednia z przecinkiem i liczba z odmiana", () => {
    expect(reviewSummary(4.6, 5).replace(/\s/g, " ")).toBe("4,6 · 5 opinii");
    expect(reviewSummary(5, 1).replace(/\s/g, " ")).toBe("5,0 · 1 opinia");
    expect(reviewSummary(4.5, 3).replace(/\s/g, " ")).toBe("4,5 · 3 opinie");
    expect(reviewSummary(4.2, 22).replace(/\s/g, " ")).toBe("4,2 · 22 opinie");
    expect(reviewSummary(null, 0)).toBe("Brak opinii");
  });
  it("data po polsku w strefie Europe/Warsaw, ocena tekstem, gwiazdki jako znaki", () => {
    expect(reviewDate("2026-09-14")).toBe("14 września 2026");
    expect(ratingText(4)).toBe("Ocena: 4 z 5");
    expect(starChars(4)).toBe("★★★★☆");
  });
});

describe("ReviewsView (F-076)", () => {
  it("ma kotwice #opinie, stala etykiete, podsumowanie i opinie z ocena tekstem", async () => {
    const { container } = render(<ReviewsView data={DATA} />);
    expect(container.querySelector("section#opinie")).not.toBeNull();
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(screen.getByText(/4,6\s·\s5\sopinii/)).toBeInTheDocument();
    expect(screen.getByText("Ocena: 5 z 5")).toBeInTheDocument();
    expect(screen.getByText("Ola K.")).toBeInTheDocument();
    expect(screen.getByText("14 września 2026")).toHaveAttribute("datetime", "2026-09-14");
    expect(screen.getByText("Wariant: Grafit · Próg")).toBeInTheDocument();
    // gwiazdki to dekoracja ukryta przed czytnikiem
    for (const el of container.querySelectorAll(".opinie__gwiazdki")) {
      expect(el).toHaveAttribute("aria-hidden", "true");
    }
    expect(await axe(container)).toHaveNoViolations();
  });

  it("bez opinii pokazuje komunikat, a etykieta nadal jest widoczna", () => {
    render(<ReviewsView data={{ label: LABEL, avg: null, count: 0, items: [] }} />);
    expect(screen.getByText(LABEL)).toBeInTheDocument();
    expect(screen.getByText("Brak opinii")).toBeInTheDocument();
  });

  it("nie dokleja danych strukturalnych, a JSON-LD karty nie ma aggregateRating ani review", () => {
    const { container } = render(<ReviewsView data={DATA} />);
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
    const product = productFixture("bazalt-75");
    const variant = product.variants[0];
    if (!variant) throw new Error("brak wariantu w fixture");
    const json = JSON.stringify(productJsonLd(product, variant));
    expect(json).not.toMatch(/aggregateRating|"review"/);
  });
});
