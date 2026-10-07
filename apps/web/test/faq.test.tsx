// F-221 (TAKTYL-58): FAQ - harmonijka z button + aria-expanded, unikalne id, panele ukryte do rozwiniecia.
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { FaqAccordion } from "../src/components/faq/faq-accordion";

const ITEMS = [
  { key: "a", question: "Czy mogę tu kupić?", answer: <p>Nie, to demo.</p> },
  { key: "b", question: "Jak wygląda płatność?", answer: <p>Symulacja.</p> },
];

describe("FaqAccordion (F-221)", () => {
  it("pytania to przyciski z aria-expanded=false i panelami powiazanymi aria-controls", async () => {
    const { container } = render(<FaqAccordion items={ITEMS} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b).toHaveAttribute("aria-expanded", "false");
      const panel = document.getElementById(b.getAttribute("aria-controls") ?? "");
      expect(panel).not.toBeNull();
      expect(panel).toHaveAttribute("hidden");
    }
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("klawiatura: Enter rozwija, ponowny zwija; niezalezne pozycje", async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={ITEMS} />);
    const first = screen.getByRole("button", { name: /Czy mogę/ });
    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Nie, to demo.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Jak wygląda/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.keyboard(" ");
    expect(first).toHaveAttribute("aria-expanded", "false");
  });
});
