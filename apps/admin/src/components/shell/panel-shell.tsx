"use client";
// B-001, B-009, B-607, B-624..B-627 (docs/25 par. 3): powloka panelu. Menu boczne w grupach (zwijane na komputerze,
// szuflada na telefonie), pasek gorny: zakres dat i porownanie (pulpit, ruch), wyszukiwarka globalna (/ i Ctrl+K),
// znacznik "Dane demonstracyjne", przelacznik motywu, uzytkownik i wylogowanie. Landmarki: banner, navigation, main.
import { Button, Drawer } from "@taktyl/ui";
import { LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../../lib/auth/session";
import { useTheme } from "../../lib/theme";
import { MAIN_ID } from "../skip-link";
import { Skeleton } from "../ui/skeleton";
import { CommandPalette } from "./command-palette";
import { NavList } from "./nav-list";
import { RangePicker } from "./range-picker";

export const ROLE_LABEL = {
  owner: "Właściciel",
  editor: "Edytor",
  viewer: "Viewer (tylko odczyt)",
} as const;

const COLLAPSE_KEY = "taktyl.admin.menu.v1";
/** Ekrany z zakresem dat w pasku gornym. */
const RANGE_PATHS = new Set(["/", "/ruch"]);

const isTyping = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

export function PanelShell({ children }: { children: ReactNode }) {
  const { session, loading, logout } = useAuth();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "zwiniete");
    } catch {
      // brak pamieci przegladarki: menu rozwiniete
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "rozwiniete" : "zwiniete");
      } catch {
        // jw.
      }
      return !c;
    });
  };

  // B-626: "/" poza polem tekstowym i Ctrl+K / Cmd+K otwieraja palete polecen (docs/15 par. 2: nie w polach tekstowych).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ThemeIcon = theme === "ciemny" ? Sun : Moon;
  return (
    <div className="adm-powloka" data-menu={collapsed ? "zwiniete" : undefined}>
      <nav className="adm-boczna sekcja--mod" aria-label="Główna">
        <div className="adm-boczna__gora">
          <Link href="/" className="adm-logo" aria-label="Backpanel Taktyl, pulpit">
            <span className="adm-logo__znak" aria-hidden="true">
              t
            </span>
            <span className="adm-logo__nazwa">taktyl admin</span>
          </Link>
        </div>
        <NavList collapsed={collapsed} counters={Boolean(session)} />
        <div className="adm-boczna__dol">
          <button
            type="button"
            className="adm-ikona-przycisk adm-ikona-przycisk--menu"
            aria-pressed={collapsed}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="adm-ikona" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="adm-ikona" />
            )}
            <span className="adm-nawigacja__etykieta">
              {collapsed ? "Rozwiń menu" : "Zwiń menu"}
            </span>
          </button>
        </div>
      </nav>
      <Drawer
        open={menu}
        onClose={() => setMenu(false)}
        title="Menu"
        side="left"
        className="sekcja--mod adm-szuflada"
      >
        <nav aria-label="Główna (menu)" className="adm-szuflada-nawigacja">
          <NavList onNavigate={() => setMenu(false)} counters={Boolean(session)} />
        </nav>
      </Drawer>

      <div className="adm-kolumna">
        <header className="adm-naglowek">
          <button
            type="button"
            className="adm-ikona-przycisk adm-menu-przycisk"
            aria-haspopup="dialog"
            onClick={() => setMenu(true)}
          >
            <Menu aria-hidden="true" className="adm-ikona" />
            <span className="tk-sr-only">Menu</span>
          </button>
          <button
            type="button"
            className="adm-szukaj"
            aria-haspopup="dialog"
            aria-keyshortcuts="/ Control+K"
            onClick={() => setPalette(true)}
          >
            <Search aria-hidden="true" className="adm-ikona" />
            <span className="adm-szukaj__tekst">
              Szukaj<span className="tk-sr-only"> produktu, SKU albo zamówienia</span>
            </span>
            <kbd className="adm-szukaj__klawisz" aria-hidden="true">
              /
            </kbd>
          </button>
          {RANGE_PATHS.has(pathname) ? <RangePicker /> : null}
          <span className="adm-naglowek__przestrzen" />
          <span
            className="adm-znacznik-demo"
            title="Zamówienia i ruch z generatora danych demonstracyjnych"
          >
            Dane demonstracyjne
          </span>
          <button
            type="button"
            className="adm-ikona-przycisk"
            onClick={toggle}
            aria-label={theme === "ciemny" ? "Włącz motyw jasny" : "Włącz motyw ciemny"}
            title={theme === "ciemny" ? "Motyw jasny" : "Motyw ciemny"}
          >
            <ThemeIcon aria-hidden="true" className="adm-ikona" />
          </button>
          {session ? (
            <>
              <p className="adm-naglowek__uzytkownik">
                <strong>{session.user.email}</strong>
                <span>Rola: {ROLE_LABEL[session.user.role]}</span>
              </p>
              <Button
                variant="secondary"
                loading={leaving}
                className="adm-wyloguj"
                onClick={async () => {
                  setLeaving(true);
                  await logout();
                }}
              >
                <LogOut aria-hidden="true" className="adm-ikona" />
                <span className="adm-wyloguj__tekst">Wyloguj</span>
              </Button>
            </>
          ) : null}
        </header>
        <main id={MAIN_ID} tabIndex={-1} className="adm-tresc tresc">
          {loading ? (
            <Skeleton label="Wczytywanie panelu" />
          ) : session ? (
            children
          ) : (
            <p>Przekierowanie do logowania…</p>
          )}
        </main>
      </div>
      {session ? (
        <CommandPalette open={palette} onClose={() => setPalette(false)} onToggleTheme={toggle} />
      ) : null}
    </div>
  );
}
