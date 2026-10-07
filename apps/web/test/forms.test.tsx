// F-221, F-223, docs/10 (TAKTYL-58): formularz kontaktowy i newsletter - walidacja, 201, 429, 422, `generate_lead`
// raz po sukcesie, brak danych osobowych w pomiarze, fokus na pierwszy blad.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ContactForm } from "../src/components/forms/contact-form";
import { Newsletter } from "../src/components/forms/newsletter";
import { NewsletterEnhancer } from "../src/components/forms/newsletter-enhancer";
import { validateContact, validateEmail, validateNewsletter } from "../src/lib/forms/validate";

const DEMO = "W sklepie demonstracyjnym nie wysyłamy e-maili.";

function leads(): Record<string, unknown>[] {
  return (window.dataLayer ?? []).filter((e) => e.event === "generate_lead");
}
function mockFetch(status: number, body: unknown = {}) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  window.dataLayer = [];
  vi.unstubAllGlobals();
});

describe("walidacja (docs/01 §4)", () => {
  it("e-mail i pola kontaktu mowia, co poprawic", () => {
    expect(validateEmail("")).toBe("Wpisz adres e-mail.");
    expect(validateEmail("ola@")).toMatch(/Sprawdź adres e-mail/);
    expect(validateEmail("ola@taktyl.example")).toBeNull();
    const errors = validateContact({ email: "x", subject: "a", message: "abc" });
    expect(Object.keys(errors)).toEqual(["email", "subject", "message"]);
    expect(validateNewsletter("ola@taktyl.example", false).consent).toMatch(/Zaznacz zgodę/);
    expect(validateNewsletter("ola@taktyl.example", true)).toEqual({});
  });
});

describe("ContactForm (F-221)", () => {
  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/E-mail/), "ola@taktyl.example");
    await user.type(screen.getByLabelText(/Temat/), "Pytanie o set");
    await user.type(screen.getByLabelText(/Wiadomość/), "Czy Bazalt 75 ma wersję cichą?");
  }

  it("ma tylko trzy pola, bez zgody i bez pola ukrytego; axe czysto", async () => {
    const { container } = render(<ContactForm />);
    expect(container.querySelectorAll("input, textarea")).toHaveLength(3);
    expect(container.querySelector('input[type="checkbox"], input[type="hidden"]')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("walidacja po opuszczeniu pola: komunikat pod polem z aria-describedby", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    const email = screen.getByLabelText(/E-mail/);
    await user.click(email);
    await user.tab();
    expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = email.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent("Wpisz adres e-mail.");
  });

  it("przy wysylce z bledami nie wola API i ustawia fokus na pierwszy blad", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(201);
    render(<ContactForm />);
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/E-mail/)).toHaveFocus();
    expect(leads()).toHaveLength(0);
  });

  it("201: komunikat z API, jedno generate_lead (kontakt, 0 PLN) bez danych osobowych, formularz wyczyszczony", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(201, { status: "accepted", demo: true, message: DEMO });
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));
    expect(await screen.findByText(DEMO)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("/api/forms/contact");
    expect(JSON.parse(String(call[1].body))).toEqual({
      email: "ola@taktyl.example",
      subject: "Pytanie o set",
      message: "Czy Bazalt 75 ma wersję cichą?",
    });
    expect(leads()).toEqual([
      { event: "generate_lead", form_id: "kontakt", value: 0, currency: "PLN" },
    ]);
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/taktyl\.example|Pytanie|Bazalt/);
    expect(screen.getByLabelText(/E-mail/)).toHaveValue("");
  });

  it("429: komunikat o odczekaniu, bez generate_lead, dane zostaja w formularzu", async () => {
    const user = userEvent.setup();
    mockFetch(429, { code: "rate_limited" });
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));
    expect(await screen.findByText(/Zbyt wiele prób/)).toBeInTheDocument();
    expect(leads()).toHaveLength(0);
    expect(screen.getByLabelText(/Temat/)).toHaveValue("Pytanie o set");
  });

  it("422: komunikat bledu, bez generate_lead", async () => {
    const user = userEvent.setup();
    mockFetch(422, { code: "validation_failed", errors: [{ path: "subject" }] });
    render(<ContactForm />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Wyślij wiadomość" }));
    expect(await screen.findByText(/Serwer nie przyjął formularza/)).toBeInTheDocument();
    expect(leads()).toHaveLength(0);
  });
});

describe("Newsletter (F-223)", () => {
  function setup() {
    const view = render(<Newsletter />);
    return view;
  }
  async function enhance(user: ReturnType<typeof userEvent.setup>) {
    // pierwsza interakcja dociaga logike (jak w przegladarce)
    await user.click(screen.getByLabelText("E-mail"));
    await new Promise((r) => setTimeout(r, 30));
  }

  it("ma jedno pole e-mail, zgode NIEZAZNACZONA z gory i przycisk Zapisz sie; axe czysto", async () => {
    const { container } = setup();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Zapisz się" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("bez zgody pokazuje blad i nie wola API", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(201);
    setup();
    await enhance(user);
    await user.type(screen.getByLabelText("E-mail"), "ola@taktyl.example");
    await user.click(screen.getByRole("button", { name: "Zapisz się" }));
    expect(await screen.findByText(/Zaznacz zgodę/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(leads()).toHaveLength(0);
  });

  it("201: komunikat demo i jedno generate_lead (newsletter)", async () => {
    const user = userEvent.setup();
    mockFetch(201, { status: "accepted", demo: true, message: DEMO });
    setup();
    await enhance(user);
    await user.type(screen.getByLabelText("E-mail"), "ola@taktyl.example");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Zapisz się" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(DEMO));
    expect(leads()).toEqual([
      { event: "generate_lead", form_id: "newsletter", value: 0, currency: "PLN" },
    ]);
    expect(JSON.stringify(window.dataLayer)).not.toMatch(/taktyl\.example/);
  });

  it("429 i 422 pokazuja komunikat i nie wysylaja generate_lead", async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(429, { code: "rate_limited" });
    setup();
    await enhance(user);
    await user.type(screen.getByLabelText("E-mail"), "ola@taktyl.example");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Zapisz się" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Zbyt wiele prób/));
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ errors: [] }), { status: 422 }),
    );
    await user.click(screen.getByRole("button", { name: "Zapisz się" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Serwer nie przyjął formularza/),
    );
    expect(leads()).toHaveLength(0);
  });

  it("formularz wysyla metoda POST (e-mail nigdy nie trafia do adresu strony)", () => {
    const { container } = render(
      <>
        <Newsletter />
        <NewsletterEnhancer formId="newsletter-form" />
      </>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(form.method).toBe("post");
  });
});
