"use client";
// B-001, B-009, B-607 (TAKTYL-50): powloka panelu - naglowek (uzytkownik, rola, wyloguj), nawigacja boczna / szuflada,
// landmarki (banner, navigation, main). Ochrona tras: bez sesji tresc nie jest renderowana (AuthProvider przekierowuje).
import { Button, Drawer } from "@taktyl/ui";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth } from "../../lib/auth/session";
import { MAIN_ID } from "../skip-link";
import { Skeleton } from "../ui/skeleton";
import { NavList } from "./nav-list";

export const ROLE_LABEL = {
  owner: "Właściciel",
  editor: "Edytor",
  viewer: "Viewer (tylko odczyt)",
} as const;

export function PanelShell({ children }: { children: ReactNode }) {
  const { session, loading, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="adm-powloka">
      <header className="adm-naglowek sekcja--mod">
        <Button
          variant="secondary"
          className="adm-menu-przycisk"
          aria-haspopup="dialog"
          onClick={() => setMenu(true)}
        >
          Menu
        </Button>
        <Link href="/" className="adm-naglowek__logo" aria-label="Backpanel Taktyl, pulpit">
          taktyl admin
        </Link>
        <span className="adm-naglowek__przestrzen" />
        {session ? (
          <>
            <p className="adm-naglowek__uzytkownik">
              <strong>{session.user.email}</strong>
              <span>Rola: {ROLE_LABEL[session.user.role]}</span>
            </p>
            <Button
              variant="secondary"
              loading={leaving}
              onClick={async () => {
                setLeaving(true);
                await logout();
              }}
            >
              Wyloguj
            </Button>
          </>
        ) : null}
      </header>
      <nav className="adm-boczna" aria-label="Główna">
        <NavList />
      </nav>
      <Drawer open={menu} onClose={() => setMenu(false)} title="Menu" side="left">
        <nav aria-label="Główna (menu)" className="adm-szuflada-nawigacja">
          <NavList onNavigate={() => setMenu(false)} />
        </nav>
      </Drawer>
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
  );
}
