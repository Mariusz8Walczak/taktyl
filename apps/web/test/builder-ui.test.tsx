// F-100...F-113 (TAKTYL-34, TAKTYL-35): kreator setu w przegladarce testowej - S9, S10, S11, S21, przeplyw krokow z
// klawiatury, stan URL <-> wybor, taktyl.set.v1, nieznany SKU, kopiowanie linku z zapasem, dodanie setu do koszyka,
// dostepnosc (fieldset/legend, aria-current, fokus, axe). Dane z data/*.json (builder-fixtures).
import { ToastProvider } from "@taktyl/ui";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Builder } from "../src/components/builder/builder";
import { CART_STORAGE_KEY } from "../src/lib/cart/count";
import { RAW_PRESETS, builderData } from "./builder-fixtures";

const data = builderData();
const plain = (t: string | null | undefined) => (t ?? "").replaceAll(" ", " ");

function renderBuilder(search = "") {
  window.history.replaceState(null, "", `/zbuduj-set${search ? `?${search}` : ""}`);
  return render(
    <ToastProvider>
      <Builder data={data} initialSearch={search} />
    </ToastProvider>,
  );
}

const events = (name: string) => (window.dataLayer ?? []).filter((e) => e.event === name);
const aside = () => screen.getByRole("complementary", { name: "Podsumowanie setu" });

beforeEach(() => {
  window.dataLayer = [];
});

describe("S9: gotowy set Programista", () => {
  it("Razem 1203,30 zl, Oszczedzasz 133,70 zl, Pasuje, Zapas 28,3 cm", () => {
    const preset = RAW_PRESETS.find((p) => p.id === "programista")!;
    renderBuilder("preset=programista");
    const ceny = within(screen.getByTestId("ceny-setu"));
    expect(plain(ceny.getAllByText(/1203,30/)[0]?.textContent)).toBe("1203,30 zł");
    expect(preset.total).toBe(1203.3);
    expect(plain(screen.getByText(/Oszczędzasz/).textContent)).toBe("Oszczędzasz 133,70 zł");
    expect(within(aside()).getByRole("status", { name: "" })).toHaveTextContent("Pasuje");
    expect(plain(aside().textContent)).toContain("Zapas: 28,3 cm");
    expect(plain(aside().textContent)).toContain("Pasuje · zapas 28,3 cm");
    // wejscie z gotowego setu: krok Podsumowanie
    expect(screen.getByRole("link", { current: "step" })).toHaveTextContent("Podsumowanie");
  });

  it("set_builder_start z entry_point preset - raz w sesji", () => {
    const first = renderBuilder("preset=programista");
    expect(events("set_builder_start")).toEqual([
      expect.objectContaining({ entry_point: "preset" }),
    ]);
    first.unmount();
    renderBuilder("preset=programista");
    expect(events("set_builder_start")).toHaveLength(1);
  });
});

describe("S10: profil FPS i Tafla M", () => {
  const search = "profil=fps&k=K-BZL75-GRF-SLZ&m=M-PST-GRF&p=P-TFL-M-GRF&krok=podsumowanie";

  it("Pasuje z 1 uwaga, propozycja z pelna trescia, po kliknieciu Pasuje", async () => {
    const user = userEvent.setup();
    renderBuilder(search);
    expect(within(aside()).getByRole("status", { name: "" })).toHaveTextContent("Pasuje z 1 uwagą");
    const btn = within(aside()).getByRole("button", { name: /Zmień na Tafla L/ });
    expect(plain(btn.textContent)).toBe("Zmień na Tafla L (+30,00 zł)");
    expect(within(aside()).getByText("Uwaga")).toBeInTheDocument(); // etykieta tekstowa zamiast ikony
    await user.click(btn);
    expect(within(aside()).getByRole("status", { name: "" })).toHaveTextContent("Pasuje");
    expect(within(aside()).getByRole("status", { name: "" })).not.toHaveTextContent("uwag");
    const ev = events("set_suggestion_apply")[0];
    expect(ev).toMatchObject({
      rule: "pad-width-mouse",
      from_item_id: "P-TFL-M-GRF",
      to_item_id: "P-TFL-L-GRF",
      value_delta: 30,
    });
    expect(new URLSearchParams(window.location.search).get("p")).toBe("P-TFL-L-GRF");
  });

  it("aria-live polite tylko na naglowku wynikow, miejsce na liste zarezerwowane", () => {
    const { container } = renderBuilder(search);
    const live = [
      ...(container.querySelector(".kreator")?.querySelectorAll("[aria-live]") ?? []),
    ].filter((el) => !el.hasAttribute("data-kwota-live"));
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveClass("wyniki__naglowek");
    expect(container.querySelector(".wyniki__lista")).toBeInTheDocument();
  });
});

describe("S11: Marmur 100 + Jerzyk + Szron XL, FPS", () => {
  it("uwaga o 91 cm i propozycja Tafla XXL", () => {
    renderBuilder("profil=fps&k=K-MRM100-GRF-SLZ&m=M-JRZ-GRF&p=P-SZR-XL-GRF&krok=podsumowanie");
    expect(plain(aside().textContent)).toMatch(/potrzebuje 91 cm/);
    expect(within(aside()).getByRole("button", { name: /Zmień na Tafla XXL/ })).toBeInTheDocument();
    expect(events("set_fit_warning")).toHaveLength(0); // wczytanie adresu nie jest zmiana wyniku
  });
});

describe("S21: link do setu", () => {
  const search = "profil=fps&k=K-KWR60-GRF-SLZ&m=M-JRZ-GRF&p=P-LEN-XL-GRF&krok=podsumowanie";

  it("kopiuje link ze schowka i wysyla set_share clipboard", async () => {
    const user = userEvent.setup();
    renderBuilder(search);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Kopiuj link do setu" }));
    expect(writeText).toHaveBeenCalledOnce();
    const link = new URL(writeText.mock.calls[0]?.[0] as string);
    expect(link.pathname).toBe("/zbuduj-set");
    expect(link.search).toBe(`?${search.replace("&krok=podsumowanie", "")}&krok=podsumowanie`);
    expect(await screen.findByText("Link skopiowany")).toBeInTheDocument();
    expect(events("set_share")).toEqual([expect.objectContaining({ method: "clipboard" })]);
  });

  it("nowa karta z tym linkiem odtwarza ten sam set, profil i krok", () => {
    renderBuilder(search);
    expect(screen.getByRole("link", { current: "step" })).toHaveTextContent("Podsumowanie");
    expect(plain(aside().textContent)).toContain("Kwarc 60");
    expect(plain(aside().textContent)).toContain("Jerzyk");
    expect(plain(aside().textContent)).toContain("Len");
    expect(within(aside()).getByText("Ruch myszki: 40 cm")).toBeInTheDocument();
  });

  it("bez schowka pokazuje pole z zaznaczonym linkiem", async () => {
    const user = userEvent.setup();
    renderBuilder(search);
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await user.click(screen.getByRole("button", { name: "Kopiuj link do setu" }));
    const field = await screen.findByLabelText("Link do setu");
    expect((field as HTMLInputElement).value).toContain("krok=podsumowanie");
    expect(field).toHaveFocus();
    expect(events("set_share")).toEqual([expect.objectContaining({ method: "fallback" })]);
  });
});

describe("kroki: klawiatura, fokus, adres", () => {
  it("krok = fieldset z legenda, pasek <ol> z aria-current", () => {
    const { container } = renderBuilder();
    expect(container.querySelector("ol.kroki__lista")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { current: "step" })).toHaveLength(1);
    const fieldset = container.querySelector("fieldset.krok");
    expect(fieldset?.querySelector("legend h2")).toHaveTextContent("Do czego?");
    expect(screen.getAllByRole("radio", { name: /Gry FPS/ })).toHaveLength(1);
  });

  it("przeplyw z klawiatury: profil, Dalej, fokus na naglowku kroku, Wstecz cofa krok", async () => {
    const user = userEvent.setup();
    const push = vi.spyOn(window.history, "pushState");
    renderBuilder();
    const radio = screen.getByRole("radio", { name: /Programowanie/ });
    radio.focus();
    await user.keyboard("[Space]");
    expect(radio).toBeChecked();
    expect(new URLSearchParams(window.location.search).get("profil")).toBe("programowanie");
    expect(events("set_profile_select")[0]).toMatchObject({
      profile: "programowanie",
      hand_cm: null,
    });

    const next = screen.getByRole("button", { name: "Dalej: klawiatura" });
    next.focus();
    await user.keyboard("[Enter]");
    const heading = await screen.findByRole("heading", { name: /Krok 1 z 4: Klawiatura/ });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(push).toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).get("krok")).toBe("klawiatura");

    act(() => window.history.back());
    await waitFor(() =>
      expect(screen.getByRole("link", { current: "step" })).toHaveTextContent("Do czego?"),
    );
  });

  it("Pomin przechodzi do kroku 1 bez profilu (no_profile)", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await user.click(screen.getByRole("button", { name: "Pomiń" }));
    expect(await screen.findByRole("heading", { name: /Krok 1 z 4/ })).toBeInTheDocument();
    expect(plain(aside().textContent)).toContain("Przyjęliśmy 26 cm na ruch myszki");
    expect(events("set_profile_select")).toHaveLength(0);
  });

  it("dlon: pole 12-25 cm krok 0,5, blad poza zakresem", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=fps&krok=do-czego");
    const field = screen.getByLabelText(/Długość dłoni/);
    expect(field).toHaveAttribute("step", "0.5");
    expect(field).toHaveAttribute("min", "12");
    expect(field).toHaveAttribute("max", "25");
    await user.type(field, "19.5");
    expect(new URLSearchParams(window.location.search).get("dlon")).toBe("19.5");
    await user.clear(field);
    await user.type(field, "40");
    expect(screen.getByText(/Podaj długość dłoni od 12 do 25 cm/)).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has("dlon")).toBe(false);
  });

  it("wybor klawiatury: przelacznik domyslny profilu, set_step_complete, Dalej aktywny", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=programowanie");
    const next = screen.getByRole("button", { name: "Dalej: myszka" });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Bazalt 75/ }));
    const sw = screen.getByRole("radio", { name: /Próg/ });
    expect(sw).toBeChecked();
    expect(screen.getByRole("group", { name: /Wariant: Bazalt 75/ })).toBeInTheDocument();
    expect(next).toBeEnabled();
    expect(events("set_step_complete")[0]).toMatchObject({
      step: "klawiatura",
      item_name: "Bazalt 75",
    });
    expect(new URLSearchParams(window.location.search).get("k")).toMatch(/^K-BZL75-/);
  });

  it("kafle sortowane wg fit profilu i cena rosnaco, zetony filtruja", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=fps&krok=klawiatura");
    const names = () =>
      screen
        .getAllByRole("radio")
        .filter((r) => r.getAttribute("name") === "produkt-k")
        .map((r) => r.closest("label")?.querySelector(".tk-kafel__tytul")?.textContent);
    expect(names()[0]).toBe("Kwarc 60"); // fit.fps = 3
    await user.click(screen.getByRole("button", { name: "Bezprzewodowe" }));
    expect(screen.getByRole("button", { name: "Bezprzewodowe" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(names().length).toBeGreaterThan(0);
    expect(names().length).toBeLessThan(6);
    await user.click(screen.getByRole("button", { name: "Bezprzewodowe" })); // zdejmuje zeton
    const wszystkie = names().length;
    await user.click(screen.getByRole("button", { name: "Ciche" }));
    expect(screen.getByRole("button", { name: "Ciche" })).toHaveAttribute("aria-pressed", "true");
    // TAKTYL-67: "Ciche" = fit.cisza >= 2 (4 z 6 klawiatur), wiec zeton naprawde zaweza liste
    expect(names().length).toBeGreaterThan(0);
    expect(names().length).toBeLessThan(wszystkie);
  });

  it("krok podkladki: wynik reguly szerokosci na kaflu przed wyborem", () => {
    renderBuilder("profil=fps&k=K-MRM100-GRF-SLZ&m=M-JRZ-GRF&krok=podkladka");
    const szron = screen.getByRole("radio", { name: /Szron/ }).closest("label");
    expect(plain(szron?.textContent)).toContain("XL: za wąska o 1 cm");
    expect(screen.getByRole("radio", { name: /Na całe biurko/ })).toBeChecked();
  });
});

describe("set kompletny (A-16 hak), koszyk i pomiar", () => {
  it("2 -> 3 kategorie: set_complete raz, klasa is-komplet", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=programowanie&k=K-BZL75-GRF-PRG&m=M-PST-GRF&krok=podkladka");
    expect(aside()).not.toHaveClass("is-komplet");
    await user.click(screen.getByRole("radio", { name: /Szron/ }));
    expect(events("set_complete")).toHaveLength(1);
    expect(events("set_complete")[0]).toMatchObject({ profile: "programowanie", warnings: 0 });
    expect(aside()).toHaveClass("is-komplet");
    await user.click(screen.getByRole("radio", { name: /Tafla/ }));
    expect(events("set_complete")).toHaveLength(1); // zmiana trzeciego elementu to nie 2 -> 3
  });

  it("Dodaj set do koszyka: grupa z trzema SKU, add_to_cart z rabatem rozbitym, set_add_to_cart", async () => {
    const user = userEvent.setup();
    renderBuilder("preset=programista");
    await user.click(within(aside()).getByRole("button", { name: "Dodaj set do koszyka" }));
    await waitFor(() => expect(events("set_add_to_cart")).toHaveLength(1));
    const cart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "{}") as {
      lines: {
        type: string;
        preset_id: string | null;
        profile: string;
        items: { sku: string }[];
      }[];
    };
    const set = cart.lines.find((l) => l.type === "set");
    expect(set?.items.map((i) => i.sku)).toEqual(["K-BZL75-GRF-PRG", "M-PST-GRF", "P-SZR-XL-GRF"]);
    expect(set).toMatchObject({ preset_id: "programista", profile: "programowanie" });
    const add = events("add_to_cart")[0]?.ecommerce as {
      value: number;
      items: { discount: number }[];
    };
    expect(add.value).toBe(1203.3);
    expect(Math.round(add.items.reduce((s, i) => s + i.discount, 0) * 100)).toBe(13370);
    expect(events("set_add_to_cart")[0]).toMatchObject({
      value: 1203.3,
      discount: 133.7,
      profile: "programowanie",
      preset_id: "programista",
      warnings: 0,
    });
  });

  it("niepelny set: przycisk nieaktywny z wyjasnieniem i zdaniem o rabacie", () => {
    renderBuilder("profil=fps&k=K-MRM100-GRF-SLZ&m=M-JRZ-GRF&krok=podsumowanie");
    const btn = within(aside()).getByRole("button", { name: "Dodaj set do koszyka" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription(/Wybierz klawiaturę, myszkę i podkładkę/);
    expect(plain(aside().textContent)).toMatch(/Dodaj podkładkę, a rabat 10% obejmie cały set \(−/);
  });

  it("wariant bez stanu: oznaczony, dodanie nieaktywne z wyjasnieniem", () => {
    const { unmount } = renderBuilder(
      "k=K-BZL75-KOB-SZP&m=M-PST-MGL&p=P-SZR-XL-KOB&krok=podsumowanie",
    );
    expect(within(aside()).getAllByText("Brak — wybierz inny wariant").length).toBeGreaterThan(0);
    const buttons = within(aside()).getAllByRole("button", { name: "Dodaj set do koszyka" });
    for (const b of buttons) expect(b).toBeDisabled();
    expect(plain(aside().textContent)).toContain("Wybrany wariant jest niedostępny");
    unmount();
  });
});

describe("stan: adres, taktyl.set.v1, nieznany SKU", () => {
  it("nieznany SKU jest pomijany z komunikatem", () => {
    renderBuilder("k=K-NIE-ISTNIEJE&m=M-PST-GRF");
    expect(
      screen.getByText("Część setu jest już niedostępna: klawiatura. Wybierz zamiennik."),
    ).toBeInTheDocument();
    expect(plain(aside().textContent)).toContain("Pustułka");
  });

  it("zapisany set bez parametrow adresu jest przywracany", async () => {
    window.localStorage.setItem(
      "taktyl.set.v1",
      JSON.stringify({
        profile: "gry",
        hand_cm: null,
        k: "K-LPK65-KOB-SLZ",
        m: null,
        p: null,
        switch_set_by_user: false,
        step: "myszka",
        updated_at: "2026-10-01T10:00:00.000Z",
      }),
    );
    renderBuilder();
    await waitFor(() =>
      expect(screen.getByRole("link", { current: "step" })).toHaveTextContent("Myszka"),
    );
    expect(plain(aside().textContent)).toContain("Łupek 65");
  });

  it("adres z innym setem wygrywa, stary mozna wczytac przyciskiem w tresci", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      "taktyl.set.v1",
      JSON.stringify({
        profile: "gry",
        hand_cm: null,
        k: "K-LPK65-KOB-SLZ",
        m: null,
        p: null,
        switch_set_by_user: false,
        step: "myszka",
        updated_at: "2026-10-01T10:00:00.000Z",
      }),
    );
    renderBuilder("preset=programista");
    expect(plain(aside().textContent)).toContain("Bazalt 75");
    expect(
      await screen.findByText(/Masz niedokończony set z 1 października 2026\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wczytaj go" }));
    expect(plain(aside().textContent)).toContain("Łupek 65");
    expect(plain(aside().textContent)).not.toContain("Bazalt 75");
    expect(screen.queryByText(/Masz niedokończony set/)).not.toBeInTheDocument();
  });

  it("localStorage rzuca wyjatek: kreator dziala, wybor zostaje w pamieci", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const user = userEvent.setup();
    renderBuilder("profil=programowanie&krok=klawiatura");
    await user.click(screen.getByRole("radio", { name: /Bazalt 75/ }));
    expect(screen.getByRole("radio", { name: /Bazalt 75/ })).toBeChecked();
  });

  it("zmiana profilu zachowuje przelacznik wybrany przez klienta (switch_set_by_user)", async () => {
    const user = userEvent.setup();
    renderBuilder("profil=programowanie&k=K-BZL75-GRF-PRG&krok=klawiatura");
    // klient sam wybiera Trzask
    await user.click(screen.getByRole("radio", { name: /Trzask/ }));
    expect(new URLSearchParams(window.location.search).get("k")).toBe("K-BZL75-GRF-TRZ");
    // wracamy do kroku 0 i zmieniamy profil
    await user.click(screen.getByRole("link", { name: /Do czego/ }));
    await user.click(await screen.findByRole("radio", { name: /Gry FPS/ }));
    expect(new URLSearchParams(window.location.search).get("k")).toBe("K-BZL75-GRF-TRZ");
  });
});

describe("gotowe sety (F-111)", () => {
  it("wczytanie zastepuje wybor dopiero po potwierdzeniu w tresci strony", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    renderBuilder("profil=gry&k=K-LPK65-KOB-SLZ&krok=do-czego");
    await user.click(screen.getByRole("button", { name: "Wczytaj set FPS na niskim sensie" }));
    expect(screen.getByText(/zastąpi Twój obecny wybór/)).toBeInTheDocument();
    expect(plain(aside().textContent)).toContain("Łupek 65");
    await user.click(screen.getByRole("button", { name: "Zastąp i wczytaj set" }));
    expect(plain(aside().textContent)).toContain("Kwarc 60");
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});

describe("dostepnosc (axe)", () => {
  it.each([
    ["krok 0", ""],
    ["krok 1 z wyborem", "profil=programowanie&k=K-BZL75-GRF-PRG&krok=klawiatura"],
    ["krok 3", "profil=fps&k=K-MRM100-GRF-SLZ&m=M-JRZ-GRF&krok=podkladka"],
    [
      "podsumowanie z uwaga",
      "profil=fps&k=K-MRM100-GRF-SLZ&m=M-JRZ-GRF&p=P-SZR-XL-GRF&krok=podsumowanie",
    ],
  ])(
    "%s",
    async (_n, search) => {
      const { container } = renderBuilder(search);
      expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
    },
    30000,
  );
});
