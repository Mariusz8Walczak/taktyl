import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  Dialog,
  Drawer,
  Menu,
  MenuButton,
  MenuLink,
  Overlay,
  TOAST_MAX,
  TOAST_MS,
  ToastProvider,
  useToast,
} from "../src/index.js";

function Harness({
  kind = "drawer",
  closeOnBackdrop = true,
  keepMounted = false,
  onClose,
}: {
  kind?: "drawer" | "dialog";
  closeOnBackdrop?: boolean;
  keepMounted?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Otwórz koszyk</button>
      <Overlay
        kind={kind}
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        title="Koszyk"
        closeOnBackdrop={closeOnBackdrop}
        keepMounted={keepMounted}
      >
        <button>Pierwszy</button>
        <a href="/zamowienie">Do kasy</a>
      </Overlay>
    </>
  );
}

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.className = "";
});

describe("Overlay: szuflada i okno (A-12)", () => {
  it("zamknieta nie istnieje w drzewie, otwarta ma role dialog, aria-modal i nazwe z tytulu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const dialog = screen.getByRole("dialog", { name: "Koszyk" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.closest(".tk-overlay")).toHaveClass("tk-overlay--szuflada");
  });

  it("okno ma wariant tk-overlay--okno", async () => {
    const user = userEvent.setup();
    render(<Harness kind="dialog" />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    expect(screen.getByRole("dialog").closest(".tk-overlay")).toHaveClass("tk-overlay--okno");
  });

  it("po otwarciu fokus trafia do panelu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Zamknij" }),
    ).toHaveFocus();
  });

  it("pulapka fokusu: Tab i Shift+Tab kraza w panelu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    const zamknij = screen.getByRole("button", { name: "Zamknij" });
    const pierwszy = screen.getByRole("button", { name: "Pierwszy" });
    const link = screen.getByRole("link", { name: "Do kasy" });
    expect(zamknij).toHaveFocus();
    await user.tab();
    expect(pierwszy).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(zamknij).toHaveFocus();
    await user.tab({ shift: true });
    expect(link).toHaveFocus();
  });

  it("fokus uciekajacy poza panel wraca do panelu", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Otwórz koszyk" });
    await user.click(trigger);
    act(() => trigger.focus());
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Zamknij" }),
    ).toHaveFocus();
  });

  it("Esc zamyka i oddaje fokus wywolujacemu", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByRole("button", { name: "Otwórz koszyk" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("przycisk Zamknij zamyka i oddaje fokus", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Otwórz koszyk" });
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("klikniecie w tlo zamyka, klikniecie w tresc nie", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    await user.click(screen.getByRole("button", { name: "Pierwszy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByTestId("tk-tlo"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closeOnBackdrop=false nie zamyka na tlo", async () => {
    const user = userEvent.setup();
    render(<Harness closeOnBackdrop={false} />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    await user.click(screen.getByTestId("tk-tlo"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("blokuje przewijanie strony na czas otwarcia", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(document.documentElement).not.toHaveClass("tk-scroll-lock");
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    expect(document.documentElement).toHaveClass("tk-scroll-lock");
    await user.keyboard("{Escape}");
    expect(document.documentElement).not.toHaveClass("tk-scroll-lock");
  });

  it("keepMounted: zamknieta nakladka ma atrybut hidden", async () => {
    const user = userEvent.setup();
    render(<Harness keepMounted />);
    const root = document.querySelector(".tk-overlay");
    expect(root).toHaveAttribute("hidden");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    expect(root).not.toHaveAttribute("hidden");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("zagniezdzone: Esc zamyka tylko gorna nakladke, fokus wraca do nizszej", async () => {
    const user = userEvent.setup();
    function Nested() {
      const [a, setA] = useState(true);
      const [b, setB] = useState(false);
      return (
        <>
          <Drawer open={a} onClose={() => setA(false)} title="Szuflada">
            <button onClick={() => setB(true)}>Szczegóły</button>
          </Drawer>
          <Dialog open={b} onClose={() => setB(false)} title="Okno">
            <p>Treść okna</p>
          </Dialog>
        </>
      );
    }
    render(<Nested />);
    const szczegoly = await screen.findByRole("button", { name: "Szczegóły" });
    await user.click(szczegoly);
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Szuflada" })).toBeInTheDocument();
    expect(szczegoly).toHaveFocus();
    expect(document.documentElement).toHaveClass("tk-scroll-lock");
  });

  it("animacja wyjscia: gdy CSS ma animacje, element znika po animationend wlasnego panelu", async () => {
    const user = userEvent.setup();
    const original = window.getComputedStyle;
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const cs = original(el, pseudo);
      return new Proxy(cs, {
        get: (t, p) => (p === "animationName" ? "tk-szuflada-prawa-wy" : Reflect.get(t, p)),
      });
    });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Otwórz koszyk" }));
    await user.keyboard("{Escape}");
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest(".tk-overlay")).toHaveAttribute("data-stan", "zamykanie");
    // zdarzenie z potomka nie zamyka (docs/11 pkt 30)
    fireEvent.animationEnd(within(dialog).getByRole("button", { name: "Pierwszy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.animationEnd(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    spy.mockRestore();
  });

  it("axe: szuflada i okno bez naruszen", async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <>
        <Harness />
        <Harness kind="dialog" />
      </>,
    );
    await user.click(screen.getAllByRole("button", { name: "Otwórz koszyk" })[0]!);
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});

describe("Menu (A-12)", () => {
  function MenuHarness() {
    return (
      <>
        <button>Poza menu</button>
        <Menu label="Katalog" panelLabel="Kategorie">
          <MenuLink href="/klawiatury">Klawiatury</MenuLink>
          <MenuLink href="/myszki">Myszki</MenuLink>
          <MenuButton>Wyczyść</MenuButton>
        </Menu>
      </>
    );
  }

  it("zamkniete ma hidden i aria-expanded=false; otwiera sie przyciskiem", async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    const trigger = screen.getByRole("button", { name: "Katalog" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    const panel = document.querySelector(".tk-menu__panel");
    expect(panel).toHaveAttribute("hidden");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", panel?.id);
    expect(panel).not.toHaveAttribute("hidden");
    expect(screen.getByRole("link", { name: "Klawiatury" })).toHaveFocus();
  });

  it("Esc zamyka i oddaje fokus przyciskowi", async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    const trigger = screen.getByRole("button", { name: "Katalog" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("strzalki przechodza po pozycjach", async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    await user.click(screen.getByRole("button", { name: "Katalog" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("link", { name: "Myszki" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("button", { name: "Wyczyść" })).toHaveFocus();
  });

  it("klikniecie poza menu zamyka bez kradzenia fokusu", async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    await user.click(screen.getByRole("button", { name: "Katalog" }));
    const poza = screen.getByRole("button", { name: "Poza menu" });
    await user.click(poza);
    expect(screen.getByRole("button", { name: "Katalog" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(poza).toHaveFocus();
  });

  it("wybor pozycji zamyka menu i oddaje fokus", async () => {
    const user = userEvent.setup();
    render(<MenuHarness />);
    await user.click(screen.getByRole("button", { name: "Katalog" }));
    await user.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(screen.getByRole("button", { name: "Katalog" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: "Katalog" })).toHaveFocus();
  });

  it("axe: otwarte menu bez naruszen", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuHarness />);
    await user.click(screen.getByRole("button", { name: "Katalog" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Toast (A-15)", () => {
  function Wyzwalacz({ liczba = 1, cofnij }: { liczba?: number; cofnij?: () => void }) {
    const { toast } = useToast();
    return (
      <button
        onClick={() => {
          for (let i = 1; i <= liczba; i++) {
            toast(
              cofnij
                ? { message: `Dodano ${i}`, actionLabel: "Cofnij", onAction: cofnij }
                : { message: `Dodano ${i}` },
            );
          }
        }}
      >
        Dodaj
      </button>
    );
  }

  function setup(props: { liczba?: number; cofnij?: () => void } = {}) {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Wyzwalacz {...props} />
      </ToastProvider>,
    );
    return () => act(() => void fireEvent.click(screen.getByRole("button", { name: "Dodaj" })));
  }

  it("region role=status istnieje przed pierwsza trescia", () => {
    setup();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("toast pojawia sie w regionie i znika po 4 s", () => {
    const dodaj = setup();
    dodaj();
    expect(within(screen.getByRole("status")).getByText("Dodano 1")).toBeInTheDocument();
    expect(TOAST_MS).toBe(4000);
    act(() => void vi.advanceTimersByTime(TOAST_MS - 100));
    expect(screen.getByText("Dodano 1")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByText("Dodano 1")).toBeNull();
  });

  it("maksymalnie 3 toasty naraz, najstarszy znika", () => {
    const dodaj = setup({ liczba: 4 });
    dodaj();
    expect(TOAST_MAX).toBe(3);
    expect(screen.queryByText("Dodano 1")).toBeNull();
    expect(screen.getByText("Dodano 2")).toBeInTheDocument();
    expect(screen.getByText("Dodano 3")).toBeInTheDocument();
    expect(screen.getByText("Dodano 4")).toBeInTheDocument();
  });

  it("pauza na najechanie: czas stoi, po zjechaniu dokancza sie reszta", () => {
    const dodaj = setup();
    dodaj();
    const toast = screen.getByText("Dodano 1").closest(".tk-toast") as HTMLElement;
    act(() => void vi.advanceTimersByTime(3000));
    fireEvent.mouseEnter(toast);
    act(() => void vi.advanceTimersByTime(10000));
    expect(screen.getByText("Dodano 1")).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => void vi.advanceTimersByTime(900));
    expect(screen.getByText("Dodano 1")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByText("Dodano 1")).toBeNull();
  });

  it("pauza na fokus w toascie", () => {
    const dodaj = setup({ cofnij: () => undefined });
    dodaj();
    const przycisk = screen.getAllByRole("button", { name: "Cofnij" })[0]!;
    act(() => przycisk.focus());
    act(() => void vi.advanceTimersByTime(10000));
    expect(screen.getByText("Dodano 1")).toBeInTheDocument();
    act(() => przycisk.blur());
    act(() => void vi.advanceTimersByTime(TOAST_MS + 100));
    expect(screen.queryByText("Dodano 1")).toBeNull();
  });

  it("Cofnij wywoluje akcje i zamyka toast", () => {
    const cofnij = vi.fn();
    const dodaj = setup({ cofnij });
    dodaj();
    fireEvent.click(screen.getAllByRole("button", { name: "Cofnij" })[0]!);
    expect(cofnij).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Dodano 1")).toBeNull();
  });

  it("toast nie ma przycisku Cofnij, gdy nie podano akcji", () => {
    const dodaj = setup();
    dodaj();
    expect(screen.queryByRole("button", { name: "Cofnij" })).toBeNull();
  });

  it("axe: region z toastem bez naruszen", async () => {
    const dodaj = setup({ cofnij: () => undefined });
    dodaj();
    vi.useRealTimers();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it("useToast poza dostawca zglasza blad", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Wyzwalacz />)).toThrow("ToastProvider");
    spy.mockRestore();
  });
});

describe("reguly docs/11", () => {
  function pliki(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? pliki(join(dir, e.name)) : [join(dir, e.name)],
    );
  }
  const src = pliki(join(__dirname, "..", "src")).filter((f) => /\.tsx?$/.test(f));
  const css = pliki(join(__dirname, "..", "css")).filter((f) => f.endsWith(".css"));

  it("pkt 11: brak alert(), confirm(), prompt() w kodzie biblioteki", () => {
    for (const f of src) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
    }
  });

  it("pkt 27, 28, 29: 100dvh zamiast 100vh, z-index tylko z --z-*, brak !important", () => {
    for (const f of css) {
      const tekst = readFileSync(f, "utf8");
      expect(tekst, f).not.toMatch(/100vh/);
      expect(tekst, f).not.toMatch(/z-index:\s*(?!var\(--z-)\S/);
      expect(tekst, f).not.toMatch(/!important/);
    }
  });

  it("A-12 i A-15: nakladki animuja tylko transform i opacity", () => {
    const tekst = readFileSync(join(__dirname, "..", "css", "nakladki.css"), "utf8");
    const keyframes = tekst.match(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})+\s*\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(5);
    for (const kf of keyframes) {
      const props = [...kf.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      for (const p of props) expect(["transform", "opacity"], kf).toContain(p);
    }
  });

  it("ruch wylaczony przy prefers-reduced-motion", () => {
    const tekst = readFileSync(join(__dirname, "..", "css", "nakladki.css"), "utf8");
    expect(tekst).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });
});
