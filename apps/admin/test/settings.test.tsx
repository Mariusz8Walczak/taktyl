// B-400..B-408 (TAKTYL-53): ustawienia sklepu - zapis tylko owner (If-Match, grosze), viewer i editor nieaktywni z
// wyjasnieniem, walidacja zakresow przy polu, 412, bledy 422 przy polach, usuwanie z "Cofnij", podglad terminu wysylki.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { SettingsView } from "../src/components/ustawienia/settings-view";
import { warsawInstant } from "../src/components/ustawienia/settings-tabs";
import { settings } from "./fixtures";
import { json, mockApi, problem, renderWithProviders, session } from "./helpers";

type Role = "owner" | "editor" | "viewer";

async function renderSettings(
  role: Role = "owner",
  extra: Parameters<typeof mockApi>[0] = {},
  data = settings(),
) {
  const calls = mockApi({
    "GET /v1/admin/auth/me": json(session(role)),
    "GET /v1/admin/settings": json(data, { etag: data.version as number }),
    ...extra,
  });
  const view = renderWithProviders(<SettingsView />);
  await screen.findByRole("tab", { name: "Dostawa" });
  if (role === "owner")
    await waitFor(() => expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled());
  return { calls, user: userEvent.setup(), ...view };
}

const saved = (over: Record<string, unknown> = {}) =>
  json(settings({ version: 5, ...over }), { etag: 5 });

describe("B-400 dostawa i prog darmowej dostawy", () => {
  it("zakladki z nazwami z docs/15 i pola z wartosciami w zlotych", async () => {
    await renderSettings();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs).toEqual([
      "Dostawa",
      "Płatności",
      "Rabaty i kody",
      "Punkty odbioru",
      "Wysyłka",
      "Firma i etykiety",
    ]);
    expect(screen.getByLabelText("Próg darmowej dostawy (zł)")).toHaveValue("300,00");
    expect(
      screen.getByRole("heading", { level: 1, name: "Ustawienia sklepu" }),
    ).toBeInTheDocument();
  });

  it("owner zapisuje prog: zl z przecinkiem -> grosze, If-Match z wersja ustawien, komunikat o skutku w sklepie", async () => {
    const { calls, user } = await renderSettings("owner", {
      "PATCH /v1/admin/settings": saved({ free_shipping_threshold_gr: 35000 }),
    });
    const field = screen.getByLabelText("Próg darmowej dostawy (zł)");
    await user.clear(field);
    await user.type(field, "350,00");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    const patch = await waitFor(() => {
      const c = calls.find((x) => x.method === "PATCH");
      if (!c) throw new Error("brak PATCH");
      return c;
    });
    expect((patch.body as { free_shipping_threshold_gr: number }).free_shipping_threshold_gr).toBe(
      35000,
    );
    expect(patch.headers["If-Match"]).toBe('"4"');
    expect(patch.headers["X-CSRF-Token"]).toBeTruthy();
    expect(
      await screen.findByText(/Zapisano\. Sklep odświeży stronę w kilka sekund\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz w sklepie" })).toBeInTheDocument();
  });

  it("zla kwota progu: komunikat pod polem, bez zapytania", async () => {
    const { calls, user } = await renderSettings();
    const field = screen.getByLabelText("Próg darmowej dostawy (zł)");
    await user.clear(field);
    await user.type(field, "abc");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Wpisz kwotę w złotych, np. 299,00.")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(/Wpisz kwotę w złotych/);
    await waitFor(() => expect(field).toHaveFocus());
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("422 z API: komunikat przypisany do pola metody dostawy", async () => {
    const { user } = await renderSettings("owner", {
      "PATCH /v1/admin/settings": problem(422, "validation_failed", {
        errors: [
          {
            path: "shipping_methods[1].fields",
            code: "address_required",
            message: "Kurier wymaga imienia, ulicy, kodu i miasta.",
          },
        ],
      }),
    });
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(
      await screen.findByText("Kurier wymaga imienia, ulicy, kodu i miasta."),
    ).toBeInTheDocument();
    expect(screen.getByText("Popraw zaznaczone pola i zapisz ponownie.")).toBeInTheDocument();
  });

  it("412: komunikat o zmianie ustawien przez kogos i 'Wczytaj zmiany' pobiera nowa wersje", async () => {
    let gets = 0;
    const { calls, user } = await renderSettings("owner", {
      "PATCH /v1/admin/settings": problem(412, "conflict"),
    });
    void gets;
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(
      await screen.findByText(/Ktoś zmienił ustawienia sklepu\. Odśwież i spróbuj ponownie\./),
    ).toBeInTheDocument();
    gets = calls.filter((c) => c.method === "GET" && c.url === "/v1/admin/settings").length;
    await user.click(screen.getByRole("button", { name: "Wczytaj zmiany" }));
    await waitFor(() =>
      expect(
        calls.filter((c) => c.method === "GET" && c.url === "/v1/admin/settings").length,
      ).toBeGreaterThan(gets),
    );
    await waitFor(() => expect(screen.queryByText(/Ktoś zmienił/)).toBeNull());
  });
});

describe("role: tylko owner zapisuje", () => {
  it.each<Role>(["editor", "viewer"])(
    "%s: pola nieaktywne, wyjasnienie, Zapisz nieaktywny z powodem, brak zapytan zapisu",
    async (role) => {
      const { calls } = await renderSettings(role);
      await waitFor(() => expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled());
      expect(
        screen.getAllByText("Tylko właściciel zmienia ustawienia sklepu.").length,
      ).toBeGreaterThan(0);
      expect(screen.getByLabelText("Próg darmowej dostawy (zł)")).toBeDisabled();
      expect(screen.getAllByLabelText("Nazwa (opisowa, bez nazw handlowych)")[0]).toBeDisabled();
      expect(screen.getByRole("button", { name: "Zapisz" })).toHaveAccessibleDescription(
        "Tylko właściciel zmienia ustawienia sklepu.",
      );
      expect(calls.some((c) => c.method !== "GET")).toBe(false);
    },
  );
});

describe("B-401, B-404 rabaty i kody", () => {
  it("rabat setu poza 0-50: komunikat 'Wpisz liczbę od 0 do 50.' przy polu", async () => {
    const { calls, user } = await renderSettings();
    await user.click(screen.getByRole("tab", { name: "Rabaty i kody" }));
    const percent = await screen.findByLabelText("Rabat setu (%)");
    expect(percent).toHaveValue(10);
    await user.clear(percent);
    await user.type(percent, "60");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Wpisz liczbę od 0 do 50.")).toBeInTheDocument();
    expect(percent).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("zapis rabatu: set_discount z kategoriami i lista kodow w body", async () => {
    const { calls, user } = await renderSettings("owner", { "PATCH /v1/admin/settings": saved() });
    await user.click(screen.getByRole("tab", { name: "Rabaty i kody" }));
    const percent = await screen.findByLabelText("Rabat setu (%)");
    await user.clear(percent);
    await user.type(percent, "15");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    const patch = await waitFor(() => {
      const c = calls.find((x) => x.method === "PATCH");
      if (!c) throw new Error("brak PATCH");
      return c;
    });
    const body = patch.body as {
      set_discount: { percent: number; categories: string[] };
      discount_codes: { code: string; value: number | null }[];
    };
    expect(body.set_discount).toEqual({
      percent: 15,
      categories: ["klawiatury", "myszki", "podkladki"],
    });
    expect(body.discount_codes[0]).toMatchObject({
      code: "TAKTYL10",
      value: 10,
      type: "percent",
      active: true,
    });
  });

  it("kod za krotki: komunikat z docs/15; usuniecie kodu daje toast z 'Cofnij'", async () => {
    const { user } = await renderSettings();
    await user.click(screen.getByRole("tab", { name: "Rabaty i kody" }));
    const code = await screen.findByLabelText("Kod");
    await user.clear(code);
    await user.type(code, "AB");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(
      await screen.findByText("Kod ma 4-20 znaków: wielkie litery i cyfry."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Usuń kod 1" }));
    expect(screen.queryByLabelText("Kod")).toBeNull();
    const undo = await screen.findByRole("button", { name: "Cofnij" });
    await user.click(undo);
    expect(await screen.findByLabelText("Kod")).toBeInTheDocument();
  });
});

describe("B-405 punkty odbioru", () => {
  it("lista z wyszukiwaniem po miescie", async () => {
    const { user } = await renderSettings();
    await user.click(screen.getByRole("tab", { name: "Punkty odbioru" }));
    await screen.findByText("Pokazano 2 z 2.");
    await user.type(screen.getByLabelText("Szukaj punktu"), "krak");
    await screen.findByText("Pokazano 1 z 2.");
    const visible = screen
      .getAllByRole("group")
      .filter((g) => !g.hasAttribute("hidden") && g.tagName === "FIELDSET");
    expect(visible.some((g) => within(g).queryByDisplayValue("Kraków"))).toBe(true);
    expect(visible.some((g) => within(g).queryByDisplayValue("Warszawa"))).toBe(false);
  });
});

describe("B-406 etykieta demo", () => {
  it("nie moze byc pusta: komunikat i brak zapytania", async () => {
    const { calls, user } = await renderSettings();
    await user.click(screen.getByRole("tab", { name: "Firma i etykiety" }));
    const label = await screen.findByLabelText("Tekst paska demo");
    await user.clear(label);
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Etykieta demo nie może być pusta.")).toBeInTheDocument();
    expect(label).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });
});

describe("B-407 godziny wysylki", () => {
  it("podglad: sroda 7.10.2026 13:00 -> 'Wysyłka dziś', dostawa kurierem w czwartek", async () => {
    const { user } = await renderSettings();
    await user.click(screen.getByRole("tab", { name: "Wysyłka" }));
    const out = await screen.findByTestId("podglad-terminu");
    expect(out).toHaveTextContent("Wysyłka dziś. Dostawa: czwartek, 8 października.");
    const hour = screen.getByLabelText("Godzina zamówienia");
    await user.clear(hour);
    await user.type(hour, "15");
    expect(out).toHaveTextContent("Wysyłka jutro");
  });

  it("warsawInstant ustawia czas scienny Europe/Warsaw (lato i zima)", () => {
    const summer = warsawInstant("2026-10-07", 13) as Date;
    expect(summer.toISOString()).toBe("2026-10-07T11:00:00.000Z");
    const winter = warsawInstant("2026-12-09", 13) as Date;
    expect(winter.toISOString()).toBe("2026-12-09T12:00:00.000Z");
    expect(warsawInstant("zla", 1)).toBeNull();
  });
});

describe("a11y", () => {
  it("zakladka Dostawa bez naruszen axe (owner i viewer)", async () => {
    const owner = await renderSettings("owner");
    expect(await axe(owner.container)).toHaveNoViolations();
    owner.unmount();
    const viewer = await renderSettings("viewer");
    expect(await axe(viewer.container)).toHaveNoViolations();
  });
});
