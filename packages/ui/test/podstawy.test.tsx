import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";
import {
  Alert,
  Badge,
  Button,
  ChoiceTile,
  Field,
  FilterChip,
  Icon,
  IconButton,
  Kbd,
  Link,
  Quantity,
  SpecTable,
  Swatch,
  TextButton,
} from "../src/index.js";

describe("Button (A-01)", () => {
  it("renderuje wariant glowny i poboczny", () => {
    render(
      <>
        <Button>Dalej</Button>
        <Button variant="secondary">Wstecz</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Dalej" })).toHaveClass("tk-btn", "tk-btn--glowny");
    expect(screen.getByRole("button", { name: "Wstecz" })).toHaveClass("tk-btn--poboczny");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Spacja", " "],
  ])("dodaje is-wcisniety po %s i zdejmuje po chwili", async (_nazwa, klawisz) => {
    const user = userEvent.setup();
    render(<Button>Dodaj do koszyka</Button>);
    const btn = screen.getByRole("button");
    await user.tab();
    expect(btn).toHaveFocus();
    await user.keyboard(klawisz);
    expect(btn).toHaveClass("is-wcisniety");
    await waitFor(() => expect(btn).not.toHaveClass("is-wcisniety"));
  });

  it("nie reaguje klawiszem, gdy nieaktywny", () => {
    render(<Button disabled>Dalej</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("w stanie ladowania ma aria-busy, zachowuje etykiete i blokuje klikniecie", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button loading onClick={onClick}>
        Zamawiam i płacę
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Zamawiam i płacę" });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toHaveClass("is-ladowanie");
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("wywoluje onClick i ma type=button domyslnie", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Dalej</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("IconButton", () => {
  it("ma aria-label, ikone aria-hidden i aria-pressed dla przelacznika", () => {
    render(<IconButton icon="heart" aria-label="Dodaj do ulubionych" pressed={false} />);
    const btn = screen.getByRole("button", { name: "Dodaj do ulubionych" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(btn.querySelector(".tk-icon--heart")).toHaveAttribute("aria-hidden", "true");
  });

  it("bez pressed nie renderuje aria-pressed", () => {
    render(<IconButton icon="search" aria-label="Szukaj" />);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });

  it("wymaga aria-label w typie", () => {
    // @ts-expect-error brak aria-label musi byc bledem typu
    const el = <IconButton icon="search" />;
    expect(el).toBeTruthy();
  });

  it("A-01: Enter dodaje is-wcisniety", async () => {
    const user = userEvent.setup();
    render(<IconButton icon="menu" aria-label="Menu" />);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button")).toHaveClass("is-wcisniety");
  });
});

describe("Icon", () => {
  it("renderuje span z klasami i aria-hidden, bez SVG", () => {
    const { container } = render(<Icon name="search" />);
    const span = container.firstElementChild as HTMLElement;
    expect(span.tagName).toBe("SPAN");
    expect(span).toHaveClass("tk-icon", "tk-icon--search");
    expect(span).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("Link i TextButton", () => {
  it("renderuja odnosnik i przycisk tekstowy", () => {
    render(
      <>
        <Link href="/regulamin">Regulamin</Link>
        <TextButton>Wyczyść filtry</TextButton>
      </>,
    );
    expect(screen.getByRole("link", { name: "Regulamin" })).toHaveClass("tk-link");
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).toHaveClass("tk-link--przycisk");
  });
});

describe("Swatch", () => {
  it("pokazuje nazwe, przekazuje kolor jako zmienna i oznacza wybrana", async () => {
    const user = userEvent.setup();
    render(
      <fieldset>
        <legend>Kolor</legend>
        <Swatch name="kolor" value="grafit" label="Grafit" swatch="var(--tekst)" />
        <Swatch name="kolor" value="mgla" label="Mgła" swatch="var(--tlo-alt)" />
      </fieldset>,
    );
    const grafit = screen.getByRole("radio", { name: "Grafit" });
    await user.click(grafit);
    expect(grafit).toBeChecked();
    const kolo = grafit.parentElement?.querySelector<HTMLElement>(".tk-probka__kolo");
    expect(kolo?.style.getPropertyValue("--tk-swatch")).toBe("var(--tekst)");
  });

  it("brak: radio nieaktywne i widoczne slowo Brak", () => {
    render(
      <Swatch name="kolor" value="kobalt" label="Kobalt" swatch="var(--akcent)" unavailable />,
    );
    expect(screen.getByRole("radio")).toBeDisabled();
    expect(screen.getByText("Brak")).toBeVisible();
  });
});

describe("ChoiceTile (A-05)", () => {
  it("jest radiem z tytulem i znacznikiem", async () => {
    const user = userEvent.setup();
    render(
      <fieldset>
        <legend>Rozmiar</legend>
        <ChoiceTile name="r" value="60" title="60%" description="Kompaktowa" />
        <ChoiceTile name="r" value="75" title="75%" />
      </fieldset>,
    );
    const radio = screen.getByRole("radio", { name: /60%/ });
    await user.click(radio);
    expect(radio).toBeChecked();
    expect(radio.closest("label")?.querySelector(".tk-kafel__znacznik")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("brak: nieaktywny z tekstem Brak", () => {
    render(<ChoiceTile name="r" value="x" title="TKL" unavailable />);
    expect(screen.getByRole("radio")).toBeDisabled();
    expect(screen.getByText("Brak")).toBeInTheDocument();
  });
});

describe("FilterChip", () => {
  it("aktywny ma aria-pressed i ikone zamkniecia", async () => {
    const onClick = vi.fn();
    render(
      <FilterChip active onClick={onClick}>
        Bezprzewodowe
      </FilterChip>,
    );
    const chip = screen.getByRole("button", { name: "Bezprzewodowe" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip.querySelector(".tk-icon--close")).not.toBeNull();
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalled();
  });

  it("nieaktywny nie ma ikony", () => {
    render(<FilterChip>Bezprzewodowe</FilterChip>);
    const chip = screen.getByRole("button");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip.querySelector(".tk-icon")).toBeNull();
  });
});

describe("Badge", () => {
  it.each([
    ["nowosc", "Nowość"],
    ["bestseller", "Bestseller"],
    ["promocja", "Promocja"],
    ["ostatnie-sztuki", "Ostatnie sztuki"],
    ["brak", "Brak"],
  ] as const)("wariant %s ma tekst %s", (variant, tekst) => {
    render(<Badge variant={variant} />);
    expect(screen.getByText(tekst)).toHaveClass(`tk-plakietka--${variant}`);
  });
});

describe("Field", () => {
  it("etykieta nad polem, podpowiedz w aria-describedby", () => {
    render(<Field label="E-mail" hint="Użyjemy go do potwierdzenia" type="email" />);
    const input = screen.getByLabelText("E-mail");
    const hint = screen.getByText("Użyjemy go do potwierdzenia");
    expect(input).toHaveAttribute("aria-describedby", hint.id);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("blad: aria-invalid i aria-describedby wskazuje komunikat", () => {
    render(<Field label="Kod pocztowy" hint="Format 00-000" error="Podaj kod w formacie 00-000" />);
    const input = screen.getByLabelText("Kod pocztowy");
    const err = screen.getByText("Podaj kod w formacie 00-000").closest("p");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(err?.id ?? "brak");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByText("Format 00-000").id);
  });

  it("obsluguje textarea i select", () => {
    render(
      <>
        <Field as="textarea" label="Uwagi" />
        <Field as="select" label="Kraj">
          <option>Polska</option>
        </Field>
      </>,
    );
    expect(screen.getByLabelText("Uwagi").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Kraj").tagName).toBe("SELECT");
  });
});

describe("Alert", () => {
  it.each([
    ["sukces", "status"],
    ["info", "status"],
    ["uwaga", "alert"],
    ["blad", "alert"],
  ] as const)("wariant %s ma role %s, ikone i tekst", (variant, role) => {
    const { container } = render(<Alert variant={variant}>Treść komunikatu</Alert>);
    expect(screen.getByRole(role)).toHaveTextContent("Treść komunikatu");
    expect(container.querySelector(".tk-icon")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("SpecTable", () => {
  it("ma naglowki wierszy th scope=row i podpis", () => {
    render(
      <SpecTable
        caption="Dane techniczne"
        rows={[
          { label: "Układ", value: "75%" },
          { label: "Waga", value: "820 g" },
        ]}
      />,
    );
    expect(screen.getByRole("table", { name: "Dane techniczne" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Układ" })).toHaveAttribute("scope", "row");
    expect(screen.getByRole("cell", { name: "820 g" })).toBeInTheDocument();
  });
});

describe("Quantity", () => {
  it("zmienia wartosc i blokuje przyciski na granicach", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Quantity value={1} min={1} max={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Zmniejsz ilość" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Zwiększ ilość" }));
    expect(onChange).toHaveBeenCalledWith(2);
    rerender(<Quantity value={3} min={1} max={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Zwiększ ilość" })).toBeDisabled();
    expect(screen.getByRole("group", { name: "Ilość" })).toBeInTheDocument();
  });
});

describe("Kbd", () => {
  it("renderuje element kbd i stan pressed", () => {
    render(<Kbd pressed>/</Kbd>);
    const el = screen.getByText("/");
    expect(el.tagName).toBe("KBD");
    expect(el).toHaveClass("is-wcisniety");
  });
});

describe("axe: 0 naruszen", () => {
  it("wszystkie komponenty podstawowe w jednym drzewie", async () => {
    const { container } = render(
      <main>
        <h1>Komponenty</h1>
        <Button>Dalej</Button>
        <Button variant="secondary" disabled>
          Wstecz
        </Button>
        <Button loading>Zapisz</Button>
        <Link href="/regulamin">Regulamin</Link>
        <TextButton>Wyczyść</TextButton>
        <IconButton icon="heart" aria-label="Ulubione" pressed />
        <fieldset>
          <legend>Kolor</legend>
          <Swatch name="k" value="a" label="Grafit" swatch="var(--tekst)" />
          <Swatch name="k" value="b" label="Kobalt" swatch="var(--akcent)" unavailable />
        </fieldset>
        <fieldset>
          <legend>Układ</legend>
          <ChoiceTile name="u" value="60" title="60%" description="Kompaktowa" />
          <ChoiceTile name="u" value="75" title="75%" unavailable />
        </fieldset>
        <FilterChip active>Bezprzewodowe</FilterChip>
        <Badge variant="promocja" />
        <Field label="E-mail" hint="Podpowiedź" type="email" />
        <Field label="Kod" error="Błędny kod" />
        <Alert variant="blad">Nie udało się zapisać</Alert>
        <Alert variant="sukces">Zapisano</Alert>
        <SpecTable caption="Dane" rows={[{ label: "Waga", value: "820 g" }]} />
        <Quantity value={2} onChange={() => undefined} />
        <p>
          Skrót <Kbd>/</Kbd>
        </p>
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
