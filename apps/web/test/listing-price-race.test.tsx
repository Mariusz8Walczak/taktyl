// F-021, F-022 (TAKTYL-81, docs/04 §6): szybkie wpisanie "Od" i "Do" nie gubi drugiej wartosci. Stan listingu wraca
// z "serwera" (push -> nowe props), tak jak w przegladarce; pola nie moga byc przemontowane ani nadpisane adresem.
import type { FacetsResponse } from "@taktyl/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListingShell } from "../src/components/listing/listing-shell";
import { facetDefs } from "../src/lib/catalog/listing-query";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/klawiatury",
  useRouter: () => ({ push: nav.push, replace: () => {}, back: () => {}, prefetch: () => {} }),
}));
vi.mock("../src/components/listing/load-more-action", () => ({ loadMoreCards: vi.fn() }));

const FACETS: FacetsResponse["facets"] = [
  { id: "cena", label: "Cena", type: "range", min_gr: 29900, max_gr: 74900 },
];

function parseCena(url: string): { min: number | null; max: number | null } | null {
  const raw = new URL(url, "http://x").searchParams.get("cena");
  if (!raw) return null;
  const [a = "", b = ""] = raw.split("-");
  return { min: a ? Number(a) * 100 : null, max: b ? Number(b) * 100 : null };
}

/** Odtwarza serwer: po push stan przychodzi z adresu jako nowe props. */
function Harness() {
  const [cena, setCena] = useState<{ min: number | null; max: number | null } | null>(null);
  nav.push.mockImplementation((url: string) => setCena(parseCena(url)));
  return (
    <ListingShell
      category={{ id: "klawiatury", name: "Klawiatury" }}
      facets={FACETS}
      defs={facetDefs(FACETS)}
      state={cena ? { cena } : {}}
      sort="polecane"
      total={4}
      queryKey={JSON.stringify(cena)}
      swatches={{}}
      cards={[]}
      initialCount={0}
      nextCursor={null}
      initialPage={1}
      empty={<p>Brak</p>}
      trackItems={[]}
    />
  );
}

beforeEach(() => {
  nav.push.mockReset();
  window.history.replaceState(null, "", "/klawiatury");
  window.dataLayer = [];
});

const aside = () => screen.getByRole("complementary", { name: "Filtry", hidden: true });
const last = () => nav.push.mock.calls.at(-1)?.[0];

describe("TAKTYL-81: zakres ceny - wpisywanie pod rzad", () => {
  it.each(Array.from({ length: 12 }, (_, i) => i))(
    "Od=300 i Do=700 bez opoznien (proba %i): adres cena=300-700, pola bez zmian",
    async () => {
      const user = userEvent.setup({ delay: null });
      render(<Harness />);
      const from = within(aside()).getByLabelText("Od (zł)");
      const to = within(aside()).getByLabelText("Do (zł)");
      await user.clear(from);
      await user.type(from, "300");
      await user.clear(to); // Tab/klik: blur "Od" zatwierdza 300-, "Do" jest edytowane bez przerwy
      await user.type(to, "700");
      await user.tab();
      await act(async () => {});
      expect(last()).toBe("/klawiatury?cena=300-700");
      expect(within(aside()).getByLabelText("Od (zł)")).toHaveValue(300);
      expect(within(aside()).getByLabelText("Do (zł)")).toHaveValue(700);
      expect(within(aside()).getByLabelText("Od (zł)")).toBe(from); // brak przemontowania
    },
  );

  it("Enter w polu 'Do' zatwierdza caly zakres z aktualnych wartosci obu pol", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    const from = within(aside()).getByLabelText("Od (zł)");
    const to = within(aside()).getByLabelText("Do (zł)");
    await user.clear(from);
    await user.type(from, "300");
    await user.clear(to);
    await user.type(to, "700{Enter}");
    await act(async () => {});
    expect(last()).toBe("/klawiatury?cena=300-700");
  });

  it("zmiana zdarzeniami bez przerwy (fireEvent): obie wartosci zachowane", async () => {
    render(<Harness />);
    const from = within(aside()).getByLabelText("Od (zł)");
    const to = within(aside()).getByLabelText("Do (zł)");
    fireEvent.change(from, { target: { value: "300" } });
    fireEvent.blur(from);
    fireEvent.change(to, { target: { value: "700" } });
    fireEvent.blur(to);
    await act(async () => {});
    expect(last()).toBe("/klawiatury?cena=300-700");
    expect(to).toHaveValue(700);
  });

  it("zewnetrzna zmiana adresu (np. Wstecz) odswieza pola, gdy nikt ich nie edytuje", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness />);
    const from = within(aside()).getByLabelText("Od (zł)");
    await user.clear(from);
    await user.type(from, "400");
    await user.tab();
    await act(async () => {});
    expect(last()).toBe("/klawiatury?cena=400-");
    expect(within(aside()).getByLabelText("Od (zł)")).toHaveValue(400);
  });
});
