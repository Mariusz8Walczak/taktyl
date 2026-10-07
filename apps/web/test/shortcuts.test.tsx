// F-010, A-17 (TAKTYL-59): skroty klawiszowe - "/" otwiera wyszukiwarke, "?" liste skrotow, Esc (pomiar), brak dzialania
// w polach tekstowych, przelacznik "Wyłącz skróty" zapamietany w taktyl.prefs.v1 (WCAG 2.1.4), shortcut_use w pomiarze.
import { ToastProvider } from "@taktyl/ui";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { ShortcutsHost } from "../src/components/shortcuts/shortcuts-host";
import { OPEN_SEARCH_EVENT } from "../src/lib/shortcuts/events";
import { isEditableTarget, matchShortcut } from "../src/lib/shortcuts/keys";
import { PREFS_KEY, readPrefs, writePrefs } from "../src/lib/shortcuts/prefs";

const uses = () =>
  (window.dataLayer ?? [])
    .filter((e) => e.event === "shortcut_use")
    .map((e) => (e as { key: string }).key);

function Page() {
  return (
    <ToastProvider>
      <a href="/szukaj">
        Szukaj <kbd className="tk-kbd">/</kbd>
      </a>
      <input aria-label="Pole tekstowe" />
      <textarea aria-label="Wiadomość" />
      <select aria-label="Lista">
        <option>a</option>
      </select>
      <div contentEditable suppressContentEditableWarning role="textbox" aria-label="Edytowalny">
        x
      </div>
      <button type="button">Zwykły przycisk</button>
      <button type="button" data-otworz-skroty="">
        Skróty klawiszowe
      </button>
      <ShortcutsHost />
    </ToastProvider>
  );
}

beforeEach(() => {
  window.dataLayer = [];
});

describe("logika klawiszy", () => {
  it("rozpoznaje '/' i '?', ignoruje modyfikatory i skladanie znakow", () => {
    const base = { ctrlKey: false, metaKey: false, altKey: false };
    expect(matchShortcut({ key: "/", ...base })).toBe("/");
    expect(matchShortcut({ key: "?", ...base })).toBe("?");
    expect(matchShortcut({ key: "a", ...base })).toBeNull();
    expect(matchShortcut({ key: "/", ...base, ctrlKey: true })).toBeNull();
    expect(matchShortcut({ key: "/", ...base, metaKey: true })).toBeNull();
    expect(matchShortcut({ key: "?", ...base, altKey: true })).toBeNull();
    expect(matchShortcut({ key: "/", ...base, isComposing: true })).toBeNull();
  });
});

describe("'/' (F-010)", () => {
  it("otwiera wyszukiwarke przez zdarzenie, wciska <kbd> (A-17) i wysyla shortcut_use", () => {
    const heard = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, heard);
    render(<Page />);
    screen.getByRole("button", { name: "Zwykły przycisk" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "/" });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(uses()).toEqual(["/"]);
    expect(document.querySelector("kbd")).toHaveClass("is-wcisniety");
    window.removeEventListener(OPEN_SEARCH_EVENT, heard);
  });

  it("nie dziala w input, textarea, select i contenteditable", () => {
    const heard = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, heard);
    render(<Page />);
    for (const name of ["Pole tekstowe", "Wiadomość", "Lista", "Edytowalny"]) {
      const el = screen.getByLabelText(name);
      fireEvent.keyDown(el, { key: "/" });
      fireEvent.keyDown(el, { key: "?" });
    }
    expect(heard).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(uses()).toEqual([]);
    window.removeEventListener(OPEN_SEARCH_EVENT, heard);
  });

  it("nie dziala z Ctrl/Meta/Alt", () => {
    const heard = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, heard);
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "/", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "/", metaKey: true });
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener(OPEN_SEARCH_EVENT, heard);
  });
});

describe("'?' i okno skrotow (F-010)", () => {
  it("'?' otwiera liste skrotow z przelacznikiem 'Wyłącz skróty'; Esc zamyka i jest mierzony", async () => {
    const user = userEvent.setup();
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "?" });
    const dialog = await screen.findByRole("dialog", { name: "Skróty klawiszowe" });
    const terms = within(dialog)
      .getAllByRole("term")
      .map((t) => t.textContent);
    expect(terms).toEqual(["/", "Esc", "?"]);
    expect(within(dialog).getByRole("checkbox", { name: "Wyłącz skróty" })).not.toBeChecked();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(uses()).toEqual(["?", "esc"]);
  });

  it("przelacznik zapisuje wylaczenie w taktyl.prefs.v1 i wylacza '/' oraz '?'", async () => {
    const user = userEvent.setup();
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "?" });
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox", { name: "Wyłącz skróty" }));
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}")).toMatchObject({
      shortcuts: false,
    });
    await user.keyboard("{Escape}");

    const heard = vi.fn();
    window.addEventListener(OPEN_SEARCH_EVENT, heard);
    fireEvent.keyDown(document.body, { key: "/" });
    fireEvent.keyDown(document.body, { key: "?" });
    expect(heard).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    window.removeEventListener(OPEN_SEARCH_EVENT, heard);
  });

  it("wylaczenie przetrwa ponowne zamontowanie, a przycisk w stopce nadal otwiera liste i pozwala wlaczyc", async () => {
    const user = userEvent.setup();
    writePrefs({ shortcuts: false });
    const { unmount } = render(<Page />);
    unmount();
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "?" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Skróty klawiszowe" }));
    const dialog = await screen.findByRole("dialog");
    const toggle = within(dialog).getByRole("checkbox", { name: "Wyłącz skróty" });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(readPrefs().shortcuts).toBe(true);
  });

  it("axe: okno skrotow bez naruszen", async () => {
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "?" });
    const dialog = await screen.findByRole("dialog");
    expect(await axe(dialog)).toHaveNoViolations();
  });
});

describe("Esc (F-010)", () => {
  it("bez otwartej nakladki nie jest mierzony", () => {
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(uses()).toEqual([]);
  });

  it("zamyka menu kategorii bez zabierania fokusu z pozycji", () => {
    render(
      <>
        <div className="menu-kat__pozycja">
          <a className="menu-kat__link" href="/klawiatury">
            Klawiatury
          </a>
          <ul className="menu-kat__panel">
            <li>
              <a href="/klawiatury?rozmiar=60,65">60–65%</a>
            </li>
          </ul>
        </div>
        <ShortcutsHost />
      </>,
    );
    const inner = screen.getByRole("link", { name: "60–65%" });
    inner.focus();
    fireEvent.keyDown(inner, { key: "Escape" });
    const item = document.querySelector(".menu-kat__pozycja")!;
    expect(item).toHaveAttribute("data-zamkniete");
    expect(screen.getByRole("link", { name: "Klawiatury" })).toHaveFocus();
    act(() => screen.getByRole("link", { name: "Klawiatury" }).blur());
  });
});

describe("preferencje w try/catch (docs/11 pulapka 10)", () => {
  it("zepsuty JSON i wyjatek storage nie wysypuja odczytu; domyslnie skroty wlaczone", () => {
    window.localStorage.setItem(PREFS_KEY, "{nie json");
    expect(readPrefs()).toEqual({ shortcuts: true });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("zablokowane");
    });
    expect(readPrefs()).toEqual({ shortcuts: true });
  });

  it("zapis zachowuje obce klucze obiektu", () => {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ inne: 1 }));
    writePrefs({ shortcuts: false });
    expect(JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}")).toEqual({
      inne: 1,
      shortcuts: false,
    });
  });
});

describe("isEditableTarget", () => {
  it("pole tekstowe i jego dziecko tak, zwykly przycisk nie", () => {
    document.body.innerHTML =
      '<input id="i"><button id="b">x</button><div contenteditable="true"><span id="s">y</span></div>';
    expect(isEditableTarget(document.getElementById("i"))).toBe(true);
    expect(isEditableTarget(document.getElementById("b"))).toBe(false);
    expect(isEditableTarget(document.getElementById("s"))).toBe(true);
    expect(isEditableTarget(null)).toBe(false);
  });
});
