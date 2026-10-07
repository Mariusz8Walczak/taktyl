// F-104, F-100 (TAKTYL-79, docs/03 §3, §9): uklad telefonu - wyniki jako zwijana linia (button + aria-expanded),
// pasek dolny ze stala rezerwacja miejsca. Geometria (<= 30dvh, >= 50% okna na tresc) jest sprawdzana w e2e S9/S12 @mobile.
import { ToastProvider } from "@taktyl/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Builder } from "../src/components/builder/builder";
import { builderData } from "./builder-fixtures";

const data = builderData();
const WARN = "profil=fps&k=K-MRM100-GRF-SLZ&m=M-JRZ-GRF&p=P-SZR-XL-GRF&krok=podsumowanie";

function renderBuilder(search: string) {
  window.history.replaceState(null, "", `/zbuduj-set?${search}`);
  return render(
    <ToastProvider>
      <Builder data={data} initialSearch={search} />
    </ToastProvider>,
  );
}

describe("Kreator: uklad telefonu (TAKTYL-79)", () => {
  it("wyniki sa domyslnie zwiniete, a przelacznik ma aria-expanded i aria-controls", async () => {
    const user = userEvent.setup();
    const { container } = renderBuilder(WARN);
    const toggle = screen.getByRole("button", { name: /^Wyniki:.*uwag/ });
    const section = container.querySelector(".wyniki");
    const list = container.querySelector("#wyniki-lista");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "wyniki-lista");
    expect(list).toBeInTheDocument();
    expect(section).not.toHaveClass("is-rozwiniete");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(section).toHaveClass("is-rozwiniete");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(section).not.toHaveClass("is-rozwiniete");
  });

  it("bez wyboru przelacznik opisuje stan, a naglowek aria-live zostaje w DOM", () => {
    const { container } = renderBuilder("");
    expect(screen.getByRole("button", { name: /^Wyniki: po wyborze setu/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(container.querySelector(".wyniki__naglowek[aria-live]")).toBeInTheDocument();
  });

  it("pasek dolny (stala wysokosc w CSS) zawiera cene i przycisk glowny", () => {
    renderBuilder(WARN);
    const bar = screen.getByTestId("pasek-dolny");
    expect(bar).toHaveClass("kreator__pasek");
    expect(bar).toHaveTextContent(/Razem/);
    expect(bar.querySelector("button")).toHaveTextContent("Dodaj set do koszyka");
  });
});
