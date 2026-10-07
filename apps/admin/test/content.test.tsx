// B-300..B-310 (TAKTYL-62): ekrany tresci - strony i poradniki (If-Match, 412, flaga demo, walidator), FAQ (kolejnosc
// przyciskami), opisy (licznik slow, ostrzezenia, podswietlenie), opinie (etykieta, ocena 3-5), zgloszenia (maskowanie, status).
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import { ContentEditor } from "../src/components/tresci/content-editor";
import { ContentList } from "../src/components/tresci/content-list";
import { DescriptionEditor } from "../src/components/tresci/description-editor";
import { FaqEditor } from "../src/components/tresci/faq-editor";
import { ReviewsEditor, ReviewsList } from "../src/components/tresci/reviews";
import { MessagesView } from "../src/components/zgloszenia/messages-view";
import { render } from "@testing-library/react";
import { MarkdownPreview, parseBlocks } from "../src/lib/markdown-preview";
import { wrobel } from "./fixtures";
import { json, mockApi, nav, problem, renderWithProviders, session } from "./helpers";

const NOW = "2026-10-07T12:00:00+02:00";

function contentItem(over: Record<string, unknown> = {}) {
  return {
    id: "pg0000000001",
    slug: "regulamin",
    type: "page",
    title: "Regulamin",
    lead: null,
    body_md: "## 1. Postanowienia\n\nTaktyl to sklep demonstracyjny.",
    status: "published",
    demo_notice: true,
    guide_profile: null,
    published_at: NOW,
    version: 4,
    updated_at: NOW,
    ...over,
  };
}

const guideBody = Array.from({ length: 640 }, () => "słowo").join(" ");

describe("B-305, B-306 strony informacyjne i prawne", () => {
  it("lista: tytul, status i data, licznik z odmiana", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/content": json({
        items: [
          contentItem(),
          contentItem({ id: "pg0000000002", slug: "cookies", title: "Cookies" }),
        ],
      }),
    });
    const { container } = renderWithProviders(<ContentList type="page" />);
    const table = await screen.findByRole("table", { name: "Strony informacyjne i prawne" });
    expect(screen.getByText("2 strony")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Regulamin" })).toHaveAttribute(
      "href",
      "/tresci/strony/regulamin",
    );
    expect(within(table).getAllByText("Zatwierdzony").length).toBe(2);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("edycja: flaga demo niezdejmowalna, podglad z banerem, PATCH z If-Match, komunikat o skutku w sklepie", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/content": json({ items: [contentItem()] }),
      "PATCH /v1/admin/content/pg0000000001": json(
        { ...contentItem({ title: "Regulamin sklepu", version: 5 }), warnings: [] },
        { etag: 5 },
      ),
    });
    const { container } = renderWithProviders(<ContentEditor type="page" slug="regulamin" />);
    const flag = await screen.findByRole("checkbox", { name: /flaga demo/ });
    expect(flag).toBeChecked();
    expect(flag).toBeDisabled();
    expect(
      screen.getAllByText("Wzór treści dla sklepu demonstracyjnego Taktyl. Nie stanowi oferty.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Podgląd w sklepie" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    const user = userEvent.setup();
    const title = screen.getByLabelText("Tytuł");
    await user.clear(title);
    await user.type(title, "Regulamin sklepu");
    await user.click(screen.getByRole("button", { name: "Zatwierdź" }));
    await screen.findByText(/Sklep odświeży stronę w kilka sekund/);
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.headers["If-Match"]).toBe('"4"');
    expect(patch?.body).toEqual({ title: "Regulamin sklepu" });
    expect(screen.getByRole("link", { name: "Zobacz w sklepie" })).toBeInTheDocument();
    expect(
      screen.getByText("Zmiana pojawi się w sklepie w ciągu kilku sekund."),
    ).toBeInTheDocument();
  });

  it("412: komunikat o konflikcie i 'Wczytaj zmiany' odswieza dane", async () => {
    let list = contentItem();
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/content": () => json({ items: [list] }),
      "PATCH /v1/admin/content/pg0000000001": problem(412, "conflict"),
    });
    renderWithProviders(<ContentEditor type="page" slug="regulamin" />);
    const user = userEvent.setup();
    const title = await screen.findByLabelText("Tytuł");
    await user.type(title, " 2");
    await user.click(screen.getByRole("button", { name: "Zapisz szkic" }));
    expect(await screen.findByText(/Ktoś zmienił tę treść/)).toBeInTheDocument();
    list = contentItem({ title: "Regulamin od kogoś", version: 5 });
    await user.click(screen.getByRole("button", { name: "Wczytaj zmiany" }));
    await waitFor(() => expect(screen.getByLabelText("Tytuł")).toHaveValue("Regulamin od kogoś"));
  });

  it("422 z walidatora prawnego: komunikaty ze wskazaniem linii pod edytorem", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/content": json({ items: [contentItem()] }),
      "PATCH /v1/admin/content/pg0000000001": problem(422, "validation_failed", {
        errors: [
          {
            path: "body_md",
            code: "forbidden_identifier",
            message: "Usun numer NIP, wpisz „— (sklep fikcyjny)” (linia 3)",
          },
          {
            path: "body_md",
            code: "invalid_domain",
            message: "Uzyj adresu w domenie taktyl.example (linia 5)",
          },
        ],
      }),
    });
    renderWithProviders(<ContentEditor type="page" slug="regulamin" />);
    const user = userEvent.setup();
    const body = await screen.findByLabelText(/Treść \(Markdown/);
    await user.type(body, " NIP 1234567890");
    await user.click(screen.getByRole("button", { name: "Zatwierdź" }));
    expect((await screen.findAllByText(/linia 3/)).length).toBeGreaterThan(0);
    expect(screen.getByText(/linia 5/)).toBeInTheDocument();
    expect(body).toHaveAttribute("aria-invalid", "true");
    expect(body.getAttribute("aria-describedby")).toContain("blad");
  });

  it("viewer: pola i przyciski nieaktywne z powodem", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/content": json({ items: [contentItem()] }),
    });
    renderWithProviders(<ContentEditor type="page" slug="regulamin" />);
    const title = await screen.findByLabelText("Tytuł");
    await waitFor(() => expect(title).toBeDisabled());
    expect(screen.getByRole("button", { name: "Zatwierdź" })).toBeDisabled();
    expect(
      screen.getByText("Konto viewer jest tylko do odczytu. Nic nie zmienisz."),
    ).toBeInTheDocument();
  });
});

describe("B-304 poradnik", () => {
  it("licznik slow 600-900, wymagany profil kreatora przy zatwierdzeniu", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/content": json({
        items: [
          contentItem({
            id: "gd0000000001",
            slug: "jaka-podkladka",
            type: "guide",
            title: "Jaka podkładka",
            body_md: guideBody,
            demo_notice: false,
            status: "draft",
          }),
        ],
      }),
      "PATCH /v1/admin/content/gd0000000001": json(
        {
          ...contentItem({
            id: "gd0000000001",
            slug: "jaka-podkladka",
            type: "guide",
            guide_profile: "biuro",
          }),
          warnings: [],
        },
        { etag: 5 },
      ),
    });
    renderWithProviders(<ContentEditor type="guide" slug="jaka-podkladka" />);
    expect(
      await screen.findByText(/Liczba słów: 640 słów\. W zakresie 600–900\./),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zatwierdź" }));
    expect(
      await screen.findByText("Wybierz profil kreatora dla odnośnika na końcu artykułu."),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    await user.selectOptions(screen.getByLabelText("Profil kreatora"), "biuro");
    await user.click(screen.getByRole("button", { name: "Zatwierdź" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
      guide_profile: "biuro",
      status: "published",
    });
  });
});

describe("B-307 FAQ", () => {
  const faq = {
    items: [
      {
        id: "fq1",
        question: "Jak zwrócić towar?",
        answer_md: "Napisz do nas w ciągu 14 dni.",
        position: 1,
        status: "published",
      },
      {
        id: "fq2",
        question: "Ile trwa dostawa?",
        answer_md: "Zwykle jeden dzień roboczy.",
        position: 2,
        status: "published",
      },
      {
        id: "fq3",
        question: "Czy sklep jest prawdziwy?",
        answer_md: "To sklep demonstracyjny.",
        position: 3,
        status: "published",
      },
    ],
    warnings: [],
  };

  it("zmiana kolejnosci samymi przyciskami, PUT w nowej kolejnosci, brak przeciagania", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/faq": json(faq),
      "PUT /v1/admin/faq": json({ ...faq, items: [faq.items[1], faq.items[0], faq.items[2]] }),
    });
    const { container } = renderWithProviders(<FaqEditor />);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Przesuń w dół: pytanie 1" });
    expect(screen.getByRole("button", { name: "Przesuń w górę: pytanie 1" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Przesuń w dół: pytanie 1" }));
    expect(await screen.findByText("Pytanie przesunięte na pozycję 2 z 3.")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Pytanie")[0]).toHaveValue("Ile trwa dostawa?");
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole("button", { name: "Zapisz listę" }));
    await screen.findByText(/Sklep odświeży stronę w kilka sekund/);
    const put = calls.find((c) => c.method === "PUT");
    expect((put?.body as { items: { id: string }[] }).items.map((i) => i.id)).toEqual([
      "fq2",
      "fq1",
      "fq3",
    ]);
  });

  it("usuniecie z 'Cofnij' w toascie przywraca pytanie", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/faq": json(faq),
    });
    renderWithProviders(<FaqEditor />);
    const user = userEvent.setup();
    await screen.findByRole("button", { name: "Usuń pytanie 2" });
    await user.click(screen.getByRole("button", { name: "Usuń pytanie 2" }));
    expect(screen.queryByDisplayValue("Ile trwa dostawa?")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Cofnij" }));
    expect(await screen.findByDisplayValue("Ile trwa dostawa?")).toBeInTheDocument();
  });

  it("viewer: wszystkie kontrolki nieaktywne", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/faq": json(faq),
    });
    renderWithProviders(<FaqEditor />);
    const save = await screen.findByRole("button", { name: "Zapisz listę" });
    await waitFor(() => expect(save).toBeDisabled());
    expect(screen.getByRole("button", { name: "Przesuń w dół: pytanie 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dodaj pytanie" })).toBeDisabled();
  });
});

describe("B-300, B-301 opis produktu", () => {
  const words = (n: number, extra = "") =>
    `${Array.from({ length: n }, () => "krok").join(" ")} ${extra}`.trim();

  it("licznik slow i akapitow, zakazane slowa podswietlone, ostrzezenia z API nie blokuja zapisu, If-Match", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products/m-wrobel": json(wrobel({ description: null, version: 7 })),
      "PUT /v1/admin/products/m-wrobel/description": json(
        {
          product_id: "m-wrobel",
          description: "To idealny opis.",
          version: 8,
          stats: { words: 3, paragraphs: 1 },
          warnings: [
            { code: "description_length", message: "Opis ma 3 slow; zalecane 60-120." },
            { code: "description_forbidden_words", message: "x", details: ["idealny"] },
          ],
        },
        { etag: 8 },
      ),
    });
    const { container } = renderWithProviders(<DescriptionEditor id="m-wrobel" />);
    const user = userEvent.setup();
    const field = await screen.findByRole("textbox", { name: "Opis produktu" });
    await user.click(field);
    await user.paste("To idealny opis.");
    expect(screen.getByText(/3 słowa \(zalecane 60–120\)\. 1 akapit/)).toBeInTheDocument();
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toContain("idealny");
    expect(mark?.textContent).toContain("Zakazane słowo");
    await user.click(screen.getByRole("button", { name: "Zapisz opis" }));
    expect(await screen.findByText(/Zakazane słowa: idealny/)).toBeInTheDocument();
    expect(screen.getByText(/Opis ma 3 slow/)).toBeInTheDocument();
    expect(screen.getByText(/Sklep odświeży stronę w kilka sekund/)).toBeInTheDocument();
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.headers["If-Match"]).toBe('"7"');
    expect(put?.body).toEqual({ description: "To idealny opis." });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("w zakresie 60-120 slow licznik pokazuje zakres; 412 daje 'Wczytaj zmiany'", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/products/m-wrobel": json(
        wrobel({ description: `${words(70)}\n\n${words(10)}` }),
      ),
      "PUT /v1/admin/products/m-wrobel/description": problem(412, "conflict"),
    });
    renderWithProviders(<DescriptionEditor id="m-wrobel" />);
    expect(
      await screen.findByText(/80 słów \(w zakresie 60–120\)\. 2 akapity \(w zakresie 2–3\)/),
    ).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Opis produktu" }), " dodatek");
    await user.click(screen.getByRole("button", { name: "Zapisz opis" }));
    expect(await screen.findByText(/Ktoś zmienił ten produkt/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wczytaj zmiany" })).toBeInTheDocument();
  });

  it("marka spoza Taktyl (422) trafia pod pole; viewer nie zapisuje", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/products/m-wrobel": json(wrobel({ description: "Krótki opis." })),
    });
    renderWithProviders(<DescriptionEditor id="m-wrobel" />);
    const field = await screen.findByRole("textbox", { name: "Opis produktu" });
    await waitFor(() => expect(field).toBeDisabled());
    expect(screen.getByRole("button", { name: "Zapisz opis" })).toBeDisabled();
  });
});

describe("B-302, B-303 opinie przykladowe", () => {
  const review = (over: Record<string, unknown> = {}) => ({
    author: "Ola K.",
    date: "2026-09-20",
    rating: 5,
    variant_label: "Grafit",
    text: "Lekka i wygodna.",
    demo: true,
    ...over,
  });
  const group = {
    product_id: "m-wrobel",
    slug: "wrobel",
    name: "Wróbel",
    avg: 4.5,
    count: 4,
    items: [
      review(),
      review({ author: "Adam B.", rating: 4 }),
      review({ author: "Ewa C.", rating: 5 }),
      review({ author: "Jan D.", rating: 4 }),
    ],
  };
  const reviews = { label: "Opinie przykładowe — sklep demonstracyjny", items: [group] };

  it("lista: etykieta i srednia z liczbowa odmiana", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/reviews": json(reviews),
    });
    renderWithProviders(<ReviewsList />);
    expect(await screen.findByText("4,5 · 4 opinie")).toBeInTheDocument();
    expect(screen.getByText(/Opinie przykładowe — sklep demonstracyjny/)).toBeInTheDocument();
  });

  it("edycja: ocena 3-5, brak kontrolki demo, etykieta w podgladzie, PUT z demo: true", async () => {
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/reviews": json(reviews),
      "GET /v1/admin/products/m-wrobel": json(wrobel()),
      "PUT /v1/admin/products/m-wrobel/reviews": json({
        ...group,
        items: group.items.map((i) => ({ ...i, text: "Zmieniony tekst." })),
      }),
    });
    const { container } = renderWithProviders(<ReviewsEditor id="m-wrobel" />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Opinia 1" });
    const rating = screen.getAllByLabelText("Ocena")[0] as HTMLSelectElement;
    expect([...rating.options].map((o) => o.value)).toEqual(["5", "4", "3"]);
    expect(screen.queryByRole("checkbox", { name: /demo/i })).not.toBeInTheDocument();
    expect(screen.getByText("Opinie przykładowe — sklep demonstracyjny")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń opinię 1" })).toBeEnabled();
    expect(await axe(container)).toHaveNoViolations();
    const text = screen.getAllByLabelText("Tekst (1–4 zdania)")[0] as HTMLElement;
    await user.clear(text);
    await user.type(text, "Zmieniony tekst.");
    await user.click(screen.getByRole("button", { name: "Zapisz zestaw" }));
    await screen.findByText(/Sklep odświeży stronę w kilka sekund/);
    const put = calls.find((c) => c.method === "PUT");
    const items = (put?.body as { items: { demo: boolean; text: string }[] }).items;
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.demo === true)).toBe(true);
    expect(items[0]?.text).toBe("Zmieniony tekst.");
  });

  it("422 z API wskazuje pole konkretnej opinii", async () => {
    mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/reviews": json(reviews),
      "GET /v1/admin/products/m-wrobel": json(wrobel()),
      "PUT /v1/admin/products/m-wrobel/reviews": problem(422, "validation_failed", {
        errors: [
          {
            path: "items[1].author",
            code: "invalid_author",
            message: "Autor to imie i inicjal, np. „Ola K.”.",
          },
        ],
      }),
    });
    renderWithProviders(<ReviewsEditor id="m-wrobel" />);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Opinia 2" });
    await user.click(screen.getByRole("button", { name: "Zapisz zestaw" }));
    const author = (await screen.findAllByLabelText("Autor (imię i inicjał)"))[1] as HTMLElement;
    await waitFor(() => expect(author).toHaveAttribute("aria-invalid", "true"));
  });
});

describe("B-308, B-309 zgloszenia", () => {
  const msg = (over: Record<string, unknown> = {}) => ({
    id: "ms0000000001",
    kind: "contact",
    email: "jan@taktyl.example",
    subject: "Pytanie o dostawę",
    body: "Kiedy wyślecie paczkę?",
    created_at: NOW,
    handled: false,
    ...over,
  });
  const page = (items: unknown[]) => json({ items, page: 1, per_page: 25, total: items.length });

  it("lista, filtr rodzaju w adresie, oznaczenie jako obsluzone (PATCH)", async () => {
    nav({ pathname: "/zgloszenia", search: "" });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("editor")),
      "GET /v1/admin/messages": page([
        msg(),
        msg({ id: "ms0000000002", kind: "newsletter", subject: null, body: null, handled: null }),
      ]),
      "PATCH /v1/admin/messages/ms0000000001": new Response(null, { status: 204 }),
    });
    const { container } = renderWithProviders(<MessagesView />);
    const table = await screen.findByRole("table", { name: "Zgłoszenia z formularzy" });
    expect(screen.getByText("2 zgłoszenia")).toBeInTheDocument();
    expect(within(table).getByText("Nowe")).toBeInTheDocument();
    expect(within(table).getByText("Bez statusu")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Kontakt" }));
    expect(nav().replace).toHaveBeenCalledWith("/zgloszenia?kind=contact", { scroll: false });
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /Oznacz jako obsłużone/ })[0]).toBeEnabled(),
    );
    await act(async () => {
      await user.click(
        screen.getAllByRole("button", { name: /Oznacz jako obsłużone/ })[0] as HTMLElement,
      );
    });
    await screen.findByText("Zgłoszenie oznaczone jako obsłużone.");
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ handled: true });
    expect(patch?.headers["X-CSRF-Token"]).toBeTruthy();
  });

  it("viewer: dane zamaskowane z API, przyciski nieaktywne", async () => {
    nav({ pathname: "/zgloszenia", search: "" });
    mockApi({
      "GET /v1/admin/auth/me": json(session("viewer")),
      "GET /v1/admin/messages": page([msg({ email: "j***@taktyl.example", body: "[ukryte]" })]),
    });
    renderWithProviders(<MessagesView />);
    expect(await screen.findByText("j***@taktyl.example")).toBeInTheDocument();
    expect(screen.getByText("[ukryte]")).toBeInTheDocument();
    expect(screen.getByText(/Konto viewer widzi dane zamaskowane/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Oznacz jako obsłużone/ })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: /Usuń zgłoszenie/ })).toBeDisabled();
  });

  it("owner usuwa zgloszenie w oknie dialogowym (bez confirm)", async () => {
    nav({ pathname: "/zgloszenia", search: "" });
    const calls = mockApi({
      "GET /v1/admin/auth/me": json(session("owner")),
      "GET /v1/admin/messages": page([msg()]),
      "DELETE /v1/admin/messages/ms0000000001": new Response(null, { status: 204 }),
    });
    renderWithProviders(<MessagesView />);
    const user = userEvent.setup();
    await waitFor(async () =>
      expect(await screen.findByRole("button", { name: /Usuń zgłoszenie z/ })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /Usuń zgłoszenie z/ }));
    const dialog = await screen.findByRole("dialog", { name: "Usunąć zgłoszenie?" });
    await user.click(within(dialog).getByRole("button", { name: "Usuń zgłoszenie" }));
    await screen.findByText("Zgłoszenie usunięte.");
    expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  });
});

describe("podglad Markdownu (B-310)", () => {
  it("parsuje bloki i nie przepuszcza HTML ani niebezpiecznych adresow", () => {
    const blocks = parseBlocks("## Tytuł\n\nAkapit z **mocnym** tekstem.\n\n- a\n- b\n\n1. x");
    expect(blocks.map((b) => b.kind)).toEqual(["h", "p", "ul", "ol"]);
  });
  it("renderuje elementy React: javascript: bez odnosnika, bezpieczny odnosnik zostaje, HTML jako tekst", () => {
    const { container } = render(
      <MarkdownPreview
        label="Podgląd"
        markdown={
          "[zły](javascript:alert(1)) [dobry](/faq) <script>alert(1)</script> ![obraz](x.png)"
        }
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("/faq");
    expect(container.textContent).toContain("<script>");
  });
});
