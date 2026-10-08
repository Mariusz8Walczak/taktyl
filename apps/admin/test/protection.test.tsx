// B-002, B-009 (TAKTYL-50): ochrona tras (redirect bez sesji), wygasniecie sesji w trakcie pracy, wylogowanie, proxy.ts.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextRequest } from "next/server";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { PanelShell } from "../src/components/shell/panel-shell";
import { proxy } from "../src/proxy";
import { apiRequest, getCsrfToken } from "../src/lib/api/client";
import { CSRF, json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

describe("B-002 ochrona tras", () => {
  it("bez sesji (401 no_session) przekierowuje na /logowanie z adresem powrotu i nie renderuje tresci", async () => {
    mockApi({
      "GET /v1/admin/auth/me": problem(401, "unauthorized", {
        errors: [{ path: "", code: "no_session", message: "" }],
      }),
    });
    nav({ pathname: "/zamowienia" });
    renderWithProviders(
      <PanelShell>
        <p>Tajne dane</p>
      </PanelShell>,
    );
    await waitFor(() =>
      expect(nav().replace).toHaveBeenCalledWith("/logowanie?next=%2Fzamowienia"),
    );
    expect(screen.queryByText("Tajne dane")).toBeNull();
  });

  it("sesja wygasla w trakcie pracy: komunikat przez ?powod=wygasla i powrot na ta sama strone", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/orders": problem(401, "unauthorized", {
        errors: [{ path: "", code: "session_expired", message: "Sesja wygasła." }],
      }),
    });
    nav({ pathname: "/zamowienia" });
    renderWithProviders(
      <PanelShell>
        <p>Treść panelu</p>
      </PanelShell>,
    );
    expect(await screen.findByText("Treść panelu")).toBeInTheDocument();
    await expect(apiRequest({ path: "/v1/admin/orders", schema: null })).rejects.toMatchObject({
      status: 401,
    });
    await waitFor(() =>
      expect(nav().replace).toHaveBeenCalledWith(expect.stringContaining("powod=wygasla")),
    );
    expect(nav().replace).toHaveBeenCalledWith(expect.stringContaining("next="));
  });

  it("wylogowanie: POST z tokenem CSRF, czyszczenie tokenu i powrot na logowanie", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("owner")),
      "POST /v1/admin/auth/logout": new Response(null, { status: 204 }),
    });
    renderWithProviders(
      <PanelShell>
        <p>Treść</p>
      </PanelShell>,
    );
    await screen.findByText("Treść");
    expect(getCsrfToken()).toBe(CSRF);
    await userEvent.setup().click(screen.getByRole("button", { name: "Wyloguj" }));
    await waitFor(() => expect(nav().replace).toHaveBeenCalledWith("/logowanie?powod=wylogowano"));
    const out = calls.find((c) => c.url === "/v1/admin/auth/logout");
    expect(out?.headers["X-CSRF-Token"]).toBe(CSRF);
    expect(getCsrfToken()).toBeNull();
  });
});

describe("proxy.ts (redirect przed renderem)", () => {
  const req = (path: string, cookie?: string) =>
    new NextRequest(`http://admin.taktyl.localhost${path}`, { headers: cookie ? { cookie } : {} });

  it("bez ciasteczka sesji: 307 na /logowanie z ?next", () => {
    const res = proxy(req("/produkty?q=lupek"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://admin.taktyl.localhost/logowanie?next=%2Fprodukty%3Fq%3Dlupek",
    );
  });

  it("pulpit bez sesji: /logowanie bez ?next", () => {
    expect(proxy(req("/")).headers.get("location")).toBe("http://admin.taktyl.localhost/logowanie");
  });

  it("z ciasteczkiem sesji przepuszcza", () => {
    const res = proxy(req("/produkty", "taktyl_session=abc"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});

describe("powloka panelu", () => {
  it("landmarki, skip link do tresci, pozycje 'wkrotce' wylaczone, brak naruszen axe", async () => {
    mockApi({ "GET /v1/admin/auth/me": json(session("viewer")) });
    const { container } = renderWithProviders(
      <PanelShell>
        <h1>Pulpit</h1>
      </PanelShell>,
    );
    await screen.findByRole("heading", { name: "Pulpit" });
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "tresc-glowna");
    expect(screen.getByRole("navigation", { name: "Główna" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Katalog" })).toHaveAttribute("href", "/produkty");
    expect(screen.getByRole("link", { name: "Zamówienia" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ustawienia" })).toBeInTheDocument();
    // przyszle ekrany: tekst z etykieta "wkrotce", nie odnosnik
    expect(screen.getAllByRole("link", { name: /Treści/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Zgłoszenia/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Dziennik zmian/ }).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("wkrótce").length).toBe(0);
    expect(screen.getByText(/Rola: Viewer/)).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("TAKTYL-70 safeNext (otwarte przekierowanie)", () => {
  it("przepuszcza tylko sciezki wewnetrzne", async () => {
    const { safeNext } = await import("../src/lib/auth/session");
    expect(safeNext("/zamowienia?strona=2")).toBe("/zamowienia?strona=2");
    const bad = [
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/ /evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/logowanie",
      "",
      null,
    ];
    for (const b of bad) expect(safeNext(b)).toBe("/");
  });
});
