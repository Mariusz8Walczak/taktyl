// B-001, B-002, B-004, B-007 (TAKTYL-50): logowanie - komunikat bez enumeracji, tryb demo, limit prob, walidacja, a11y.
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { LoginForm } from "../src/components/logowanie/login-form";
import { CSRF, json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

const noSession = () =>
  problem(401, "unauthorized", {
    errors: [{ path: "", code: "no_session", message: "Brak sesji." }],
  });

function setup(demoMode = false, extra: Parameters<typeof mockApi>[0] = {}) {
  nav({ pathname: "/logowanie", search: "" });
  const calls = mockApi({ "GET /v1/admin/auth/me": noSession, ...extra });
  const view = renderWithProviders(<LoginForm demoMode={demoMode} />);
  return { calls, ...view };
}

describe("B-001 logowanie", () => {
  it("bledne dane: jeden komunikat bez wskazania pola, fokus na komunikacie", async () => {
    const { calls } = setup(false, {
      "POST /v1/admin/auth/login": problem(401, "unauthorized", {
        detail: "Nieprawidłowy e-mail lub hasło.",
      }),
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "ktos@taktyl.example");
    await user.type(screen.getByLabelText("Hasło"), "zle-haslo-123");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));

    const alert = await screen.findByText("Nieprawidłowy e-mail lub hasło.");
    expect(alert).toBeInTheDocument();
    await waitFor(() => expect(alert.closest("[tabindex='-1']")).toHaveFocus());
    // bez enumeracji: pola nie sa oznaczone jako bledne
    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Hasło")).not.toHaveAttribute("aria-invalid");
    const login = calls.find((c) => c.url === "/v1/admin/auth/login");
    expect(login?.body).toEqual({ email: "ktos@taktyl.example", password: "zle-haslo-123" });
  });

  it("walidacja: puste pola daja komunikaty pod polami z aria-describedby", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    const email = screen.getByLabelText("E-mail");
    const pass = screen.getByLabelText("Hasło");
    expect(await screen.findByText("Wpisz adres e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Wpisz hasło.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toBeTruthy();
    expect(pass).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(email).toHaveFocus()); // fokus na pierwszy blad
  });

  it("poprawne logowanie: sesja trafia do cache, przekierowanie na adres z ?next", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": noSession,
      "POST /v1/admin/auth/login": json(session("owner")),
    });
    nav({ pathname: "/logowanie", search: "next=%2Fzamowienia" });
    renderWithProviders(<LoginForm demoMode={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "owner@taktyl.example");
    await user.type(screen.getByLabelText("Hasło"), "haslo-testowe-1");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    await waitFor(() => expect(nav().replace).toHaveBeenCalledWith("/zamowienia"));
    expect(calls.some((c) => c.url === "/v1/admin/auth/login")).toBe(true);
  });

  it("adres powrotu spoza serwisu jest ignorowany", async () => {
    mockApi({ "GET /v1/admin/auth/me": noSession, "POST /v1/admin/auth/login": json(session()) });
    nav({ pathname: "/logowanie", search: "next=https%3A%2F%2Fobcy.example" });
    renderWithProviders(<LoginForm demoMode={false} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "owner@taktyl.example");
    await user.type(screen.getByLabelText("Hasło"), "haslo-testowe-1");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    await waitFor(() => expect(nav().replace).toHaveBeenCalledWith("/"));
  });

  it("B-004: limit prob - komunikat z minutami, przycisk nieaktywny z powodem", async () => {
    setup(false, {
      "POST /v1/admin/auth/login": problem(429, "rate_limited", {
        headers: { "Retry-After": "900" },
      }),
    });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("E-mail"), "ktos@taktyl.example");
    await user.type(screen.getByLabelText("Hasło"), "cokolwiek-123");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    expect(await screen.findByText("Za dużo prób. Spróbuj za 15 minut.")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Zaloguj się" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(/limit prób/);
  });

  it("B-002: powrot po wygasnieciu sesji pokazuje komunikat", () => {
    mockApi({ "GET /v1/admin/auth/me": noSession });
    nav({ pathname: "/logowanie", search: "powod=wygasla" });
    renderWithProviders(<LoginForm demoMode={false} />);
    expect(screen.getByText("Sesja wygasła. Zaloguj się ponownie.")).toBeInTheDocument();
  });

  it("brak naruszen axe", async () => {
    const { container } = setup(true);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("B-007 tryb demo", () => {
  it("przycisk 'Wejdz jako viewer' tylko gdy demoMode", () => {
    setup(false);
    expect(screen.queryByRole("button", { name: "Wejdź jako viewer" })).toBeNull();
  });

  it("w trybie demo jest przycisk i zdanie o odczycie; klik tworzy sesje viewer", async () => {
    const calls = setup(true, { "POST /v1/admin/auth/demo-viewer": json(session("viewer")) }).calls;
    expect(screen.getByText("Tylko do odczytu. Nic nie zmienisz.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Wejdź jako viewer" }));
    await waitFor(() => expect(nav().replace).toHaveBeenCalledWith("/"));
    expect(calls.some((c) => c.method === "POST" && c.url === "/v1/admin/auth/demo-viewer")).toBe(
      true,
    );
  });

  it("kolejnosc Tab: e-mail, haslo, Zaloguj sie, Wejdz jako viewer", async () => {
    setup(true);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("E-mail"));
    await user.tab();
    expect(screen.getByLabelText("Hasło")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Zaloguj się" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Wejdź jako viewer" })).toHaveFocus();
  });

  it("token CSRF z sesji nie trafia do storage", async () => {
    setup(true, { "POST /v1/admin/auth/demo-viewer": json(session("viewer")) });
    await userEvent.setup().click(screen.getByRole("button", { name: "Wejdź jako viewer" }));
    await waitFor(() => expect(nav().replace).toHaveBeenCalled());
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(CSRF);
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain(CSRF);
  });
});
