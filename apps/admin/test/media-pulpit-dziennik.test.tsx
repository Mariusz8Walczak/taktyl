// B-500..B-508 (media), B-011, B-012 (dziennik) - TAKTYL-63, TAKTYL-64. Pulpit (B-610..B-627): pulpit.test.tsx.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { AuditView } from "../src/components/dziennik/audit-view";
import { MediaView } from "../src/components/media/media-view";
import { diffAudit } from "../src/lib/audit-labels";
import { warsawIso } from "../src/lib/warsaw";
import { json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

const NOW = "2026-10-07T12:00:00+02:00";

const slot = (s: string, w: number, h: number, name: string, present = false) => ({
  slot: s,
  file_name: name,
  path: `img/top/${name}`,
  width: w,
  height: h,
  present,
  url: present ? `http://taktyl.localhost/media/img/top/${name}` : null,
});

function entry(over: Record<string, unknown> = {}) {
  return {
    key: "k-kwarc-60_grafit_top",
    product_id: "k-kwarc-60",
    product_slug: "kwarc-60",
    product_name: "Kwarc 60",
    color: "grafit",
    kind: "topdown",
    shot: null,
    description: "wycinek z góry",
    priority: "P0",
    status: "brak",
    dims_mm: { w: 327, d: 140 },
    pixels: { "1x": [327, 140], "2x": [654, 280] },
    slots: [
      slot("1x", 327, 140, "k-kwarc-60_grafit_top@1x.webp"),
      slot("2x", 654, 280, "k-kwarc-60_grafit_top@2x.webp"),
    ],
    updated_at: NOW,
    ...over,
  };
}
const progress = { p0_ready: 12, p0_total: 76, total_ready: 12, total: 190 };
const mediaList = (items: unknown[]) =>
  json({ items, page: 1, per_page: 50, total: items.length, progress });
const productsList = json({ items: [], page: 1, per_page: 100, total: 0 });

describe("B-500, B-501 lista zdjec", () => {
  it("licznik P0 z danych, wymiary i nazwa pliku w wierszu, status tekstem, filtry w adresie, axe", async () => {
    nav({ pathname: "/media", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([
        entry(),
        entry({
          key: "p-tafla_grafit_tekstura",
          kind: "texture",
          status: "gotowe",
          priority: "P1",
        }),
      ]),
    });
    const { container } = renderWithProviders(<MediaView />);
    const table = await screen.findByRole("table", { name: "Manifest zdjęć" });
    expect(screen.getByText(/Gotowe 12 z 76 \(P0\)/)).toBeInTheDocument();
    expect(
      within(table).getAllByText(/1x: 327 x 140 px, k-kwarc-60_grafit_top@1x\.webp \(brak\)/)
        .length,
    ).toBeGreaterThan(0);
    expect(within(table).getAllByText(/2x: 654 x 280 px/).length).toBeGreaterThan(0);
    expect(within(table).getByText("Gotowe")).toBeInTheDocument();
    expect(within(table).getByText("Brak")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "P0" }));
    expect(nav().replace).toHaveBeenCalledWith("/media?priority=P0", { scroll: false });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("filtry z adresu trafiaja do zapytania", async () => {
    nav({
      pathname: "/media",
      search: "status=brak&kind=topdown&priority=P0&product_id=k-kwarc-60",
    });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([entry()]),
    });
    renderWithProviders(<MediaView />);
    await screen.findByRole("table", { name: "Manifest zdjęć" });
    const q = new URLSearchParams(
      calls.find((c) => c.url.startsWith("/v1/admin/media"))?.url.split("?")[1],
    );
    expect(Object.fromEntries(q)).toEqual({
      page: "1",
      per_page: "50",
      status: "brak",
      kind: "topdown",
      priority: "P0",
      product_id: "k-kwarc-60",
    });
  });

  it("viewer: 'Wgraj plik' nieaktywny z powodem", async () => {
    nav({ pathname: "/media", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([entry()]),
    });
    renderWithProviders(<MediaView />);
    const btn = await screen.findByRole("button", { name: "Wgraj plik: k-kwarc-60_grafit_top" });
    await waitFor(() => expect(btn).toBeDisabled());
    expect(
      screen.getByText("Konto viewer jest tylko do odczytu. Nic nie zmienisz."),
    ).toBeInTheDocument();
  });

  it("pusty manifest: komunikat z docs/15", async () => {
    nav({ pathname: "/media", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("owner")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([]),
    });
    renderWithProviders(<MediaView />);
    expect(await screen.findByText("Manifest jest pusty. Uruchom seed.")).toBeInTheDocument();
  });
});

async function openUpload(user: ReturnType<typeof userEvent.setup>) {
  const name = "Wgraj plik: k-kwarc-60_grafit_top";
  await screen.findByRole("button", { name });
  // po wczytaniu sesji kolumny tabeli sa budowane od nowa, wiec przycisk szukamy ponownie
  await waitFor(() => expect(screen.getByRole("button", { name })).toBeEnabled());
  await user.click(screen.getByRole("button", { name }));
}

describe("B-502, B-503, B-508 wgrywanie", () => {
  const wrongSize = new File(["x"], "moj-plik.webp", { type: "image/webp" });

  it("zle wymiary: komunikat z wymiarami, plik nie jest przyjety; pole pliku ma etykiete z wymiarem i nazwa", async () => {
    nav({ pathname: "/media", search: "" });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([entry()]),
      "POST /v1/admin/media/k-kwarc-60_grafit_top": problem(422, "validation_failed", {
        errors: [
          {
            path: "1x",
            code: "dimensions_mismatch",
            message: "Plik ma 400 x 140 px, a ten wpis wymaga 327 x 140 px",
          },
        ],
      }),
    });
    renderWithProviders(<MediaView />);
    const user = userEvent.setup();
    await openUpload(user);
    const dialog = await screen.findByRole("dialog", { name: /Wgraj pliki/ });
    const input = within(dialog).getByLabelText("Plik 1x: 327 x 140 px");
    expect(input).toHaveAttribute("accept", "image/webp");
    expect(
      within(dialog).getByText(/Nazwa w sklepie: k-kwarc-60_grafit_top@1x\.webp/),
    ).toBeInTheDocument();
    await user.upload(input, wrongSize);
    await user.click(within(dialog).getByRole("button", { name: "Wgraj" }));
    expect(
      await within(dialog).findByText("Plik ma 400 x 140 px, a ten wpis wymaga 327 x 140 px"),
    ).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST" && c.url.includes("/media/"));
    expect(post?.headers["X-CSRF-Token"]).toBeTruthy();
    expect(post?.headers["Content-Type"]).toBeUndefined();
    expect(post?.body).toEqual({ form: [["1x", "moj-plik.webp"]] });
  });

  it("zly typ: 'Wgraj plik WebP.'; brak pliku: komunikat bez zapytania", async () => {
    nav({ pathname: "/media", search: "" });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([entry()]),
      "POST /v1/admin/media/k-kwarc-60_grafit_top": problem(415, "validation_failed"),
    });
    renderWithProviders(<MediaView />);
    const user = userEvent.setup();
    await openUpload(user);
    const dialog = await screen.findByRole("dialog", { name: /Wgraj pliki/ });
    await user.click(within(dialog).getByRole("button", { name: "Wgraj" }));
    expect(
      await within(dialog).findByText("Wybierz co najmniej jeden plik WebP."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.url.includes("/media/"))).toBe(false);
    await user.upload(within(dialog).getByLabelText("Plik 1x: 327 x 140 px"), wrongSize);
    await user.click(within(dialog).getByRole("button", { name: "Wgraj" }));
    expect(await within(dialog).findByText("Wgraj plik WebP.")).toBeInTheDocument();
  });

  it("sukces: lista wgranych miejsc, brakujace, miniatura z alt='', zdanie o sklepie", async () => {
    nav({ pathname: "/media", search: "" });
    const done = entry({
      status: "brak",
      slots: [
        slot("1x", 327, 140, "k-kwarc-60_grafit_top@1x.webp", true),
        slot("2x", 654, 280, "k-kwarc-60_grafit_top@2x.webp"),
      ],
    });
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products": productsList,
      "GET /v1/admin/media": mediaList([entry()]),
      "POST /v1/admin/media/k-kwarc-60_grafit_top": json({
        entry: done,
        uploaded: ["1x"],
        missing: ["2x"],
        warnings: [{ code: "no_alpha", slot: "1x", message: "Plik nie ma przezroczystego tła." }],
        progress,
      }),
    });
    renderWithProviders(<MediaView />);
    const user = userEvent.setup();
    await openUpload(user);
    const dialog = await screen.findByRole("dialog", { name: /Wgraj pliki/ });
    await user.upload(
      within(dialog).getByLabelText("Plik 1x: 327 x 140 px"),
      new File(["x"], "a.webp", { type: "image/webp" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Wgraj" }));
    expect(await within(dialog).findByText(/Wgrano: 1x\./)).toBeInTheDocument();
    expect(within(dialog).getByText(/Brakuje jeszcze: 2x/)).toBeInTheDocument();
    expect(within(dialog).getByText("Plik nie ma przezroczystego tła.")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Zmiana pojawi się w sklepie w ciągu kilku sekund/),
    ).toBeInTheDocument();
    const img = dialog.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
    expect(within(dialog).getByRole("link", { name: "Podgląd w sklepie" })).toHaveAttribute(
      "href",
      expect.stringContaining("/klawiatury/kwarc-60"),
    );
  });
});

const auditEntry = (over: Record<string, unknown> = {}) => ({
  id: "41",
  at: NOW,
  actor_id: "u1",
  actor_role: "editor",
  action: "variant.price.set",
  entity: "variant",
  entity_id: "M-WRB-GRF",
  before: { price_gr: 13900, regular_price_gr: null, contact: "j***@taktyl.example" },
  after: { price_gr: 11900, regular_price_gr: null, contact: "j***@taktyl.example" },
  request_id: "req-1",
  ...over,
});

describe("B-011, B-012 dziennik zmian", () => {
  it("tabela, licznik z odmiana, szczegoly z roznica tylko zmienionych pol", async () => {
    nav({ pathname: "/dziennik", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/audit": json({ items: [auditEntry()], page: 1, per_page: 25, total: 22 }),
    });
    const { container } = renderWithProviders(<AuditView />);
    const table = await screen.findByRole("table", { name: "Dziennik zmian" });
    expect(screen.getByText("22 wpisy")).toBeInTheDocument();
    expect(within(table).getByText("Zmiana ceny wariantu")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Szczegóły wpisu 41" }));
    const dialog = await screen.findByRole("dialog", { name: /Wpis 41/ });
    const diff = within(dialog).getByRole("table", { name: /Zmienione pola/ });
    expect(within(diff).getAllByRole("row")).toHaveLength(2);
    expect(within(diff).getByRole("rowheader", { name: "price_gr" })).toBeInTheDocument();
    expect(within(diff).getByText("13 900")).toBeInTheDocument();
    expect(within(diff).getByText("11 900")).toBeInTheDocument();
    expect(within(diff).queryByText("contact")).not.toBeInTheDocument();
  });

  it("filtry z adresu: encja, uzytkownik, zakres dat w Europe/Warsaw (z przesunieciem) i strona", async () => {
    nav({
      pathname: "/dziennik",
      search: "entity=order&actor_id=u7&from=2026-10-07&to=2026-10-07&page=2",
    });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/audit": json({ items: [auditEntry()], page: 2, per_page: 25, total: 40 }),
    });
    renderWithProviders(<AuditView />);
    await screen.findByRole("table", { name: "Dziennik zmian" });
    const q = new URLSearchParams(
      calls.find((c) => c.url.startsWith("/v1/admin/audit"))?.url.split("?")[1],
    );
    expect(Object.fromEntries(q)).toEqual({
      page: "2",
      per_page: "25",
      entity: "order",
      actor_id: "u7",
      from: "2026-10-07T00:00:00+02:00",
      to: "2026-10-07T23:59:59+02:00",
    });
    expect(screen.getByText("Strona 2 z 2")).toBeInTheDocument();
  });

  it("brak wynikow filtra: komunikat i 'Wyczysc filtry'", async () => {
    nav({ pathname: "/dziennik", search: "entity=media" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/audit": json({ items: [], page: 1, per_page: 25, total: 0 }),
    });
    renderWithProviders(<AuditView />);
    expect(await screen.findByText("Nic tu nie pasuje do filtrów.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(nav().replace).toHaveBeenCalledWith("/dziennik", { scroll: false });
  });
});

describe("pomocnicze", () => {
  it("diffAudit pokazuje tylko zmienione pola, takze zagniezdzone i dodane/usuniete", () => {
    expect(
      diffAudit({ a: 1, b: { c: "x", d: true }, e: 5 }, { a: 1, b: { c: "y", d: true }, f: null }),
    ).toEqual([
      { path: "b.c", before: "x", after: "y" },
      { path: "e", before: "5", after: "brak" },
    ]);
    expect(diffAudit(null, { a: 1 })).toEqual([{ path: "a", before: "brak", after: "1" }]);
  });

  it("warsawIso: przesuniecie letnie i zimowe oraz dzien zmiany czasu", () => {
    expect(warsawIso("2026-07-01", "00:00:00")).toBe("2026-07-01T00:00:00+02:00");
    expect(warsawIso("2026-12-01", "23:59:59")).toBe("2026-12-01T23:59:59+01:00");
    expect(warsawIso("2026-10-25", "00:00:00")).toBe("2026-10-25T00:00:00+02:00");
    expect(warsawIso("2026-10-25", "23:59:59")).toBe("2026-10-25T23:59:59+01:00");
  });
});
