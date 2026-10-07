// F-004: menu mobilne = szuflada z lewej (pulapka fokusu, Esc, powrot fokusu).
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { MobileMenu } from "../src/components/layout/mobile-menu";

async function open() {
  const user = userEvent.setup();
  render(<MobileMenu />);
  const button = screen.getByRole("button", { name: "Menu" });
  await user.click(button);
  return { user, button, dialog: await screen.findByRole("dialog", { name: "Menu" }) };
}

describe("MobileMenu (F-004)", () => {
  it("otwiera szuflade z nawigacja i oznacza przycisk aria-expanded", async () => {
    const { button, dialog } = await open();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const nav = within(dialog).getByRole("navigation", { name: "Menu główne" });
    expect(
      within(nav)
        .getAllByRole("link")
        .filter((l) => !l.closest(".menu-mobilne__skroty"))
        .map((l) => l.textContent),
    ).toEqual(["Klawiatury", "Myszki", "Podkładki", "Zbuduj set", "Poradnik"]);
    // F-003: skroty filtrow kategorii tez w szufladzie
    expect(within(nav).getByRole("link", { name: "Ciche" })).toHaveAttribute(
      "href",
      "/klawiatury?przelacznik=cichy",
    );
    expect(within(dialog).getByRole("link", { name: "Ulubione" })).toBeInTheDocument();
  });

  it("fokus jest wewnatrz szuflady i nie ucieka przy Tab oraz Shift+Tab (pulapka)", async () => {
    const { user, dialog } = await open();
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 15; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 15; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it("Esc zamyka i oddaje fokus przyciskowi Menu", async () => {
    const { user, button } = await open();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("przycisk Zamknij i klikniecie w tlo zamykaja szuflade, fokus wraca", async () => {
    const first = await open();
    await first.user.click(within(first.dialog).getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(first.button).toHaveFocus();

    await first.user.click(first.button);
    await screen.findByRole("dialog");
    await first.user.click(screen.getByTestId("tk-tlo"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(first.button).toHaveFocus();
  });

  it("wybor odnosnika zamyka szuflade", async () => {
    const { user, dialog } = await open();
    document.addEventListener("click", (e) => e.preventDefault(), { once: true }); // jsdom nie nawiguje
    await user.click(within(dialog).getByRole("link", { name: "Myszki" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("nie ma bledow axe po otwarciu", async () => {
    const { dialog } = await open();
    expect(await axe(dialog)).toHaveNoViolations();
  });
});
