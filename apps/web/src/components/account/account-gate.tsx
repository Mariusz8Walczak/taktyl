"use client";
// F-200, F-201 (docs/05 §1 `/konto`; wzorzec: ekran logowania i menu konta szablonu, docs/08 §6): konto demonstracyjne.
// Jeden przycisk "Zaloguj jako uzytkownika demo" - bez hasla, bez pol na dane (regula 10, F-200). "Sesja" to flaga w
// przegladarce (lib/account/demo.ts). Po zalogowaniu: nawigacja po koncie i "Wyloguj" (zostawia dane w przegladarce).
import { Button } from "@taktyl/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { demoSession, useDemoSession } from "../../lib/account/demo";
import { useHydrated } from "../../lib/account/hooks";

export type AccountSection = "przeglad" | "zamowienia" | "sety";

const NAV: readonly { id: AccountSection; label: string; href: string }[] = [
  { id: "przeglad", label: "Przegląd", href: "/konto" },
  { id: "zamowienia", label: "Zamówienia", href: "/konto/zamowienia" },
  { id: "sety", label: "Zapisane sety", href: "/konto/sety" },
];

export function AccountGate({
  current,
  children,
}: {
  current: AccountSection;
  children: ReactNode;
}) {
  const hydrated = useHydrated();
  const demo = useDemoSession();

  if (!hydrated) {
    return (
      <p className="konto__stan" role="status">
        Wczytuję konto…
      </p>
    );
  }

  if (!demo) {
    return (
      <section className="konto-logowanie" aria-labelledby="konto-logowanie-tytul">
        <h2 id="konto-logowanie-tytul" className="konto-logowanie__tytul">
          Konto demonstracyjne
        </h2>
        <p className="konto-logowanie__tekst">
          Taktyl to sklep demonstracyjny, więc nie ma tu haseł ani prawdziwych kont. Jeden przycisk
          loguje do konta demo, które pokazuje zamówienia, zapisane sety i ulubione z tej
          przeglądarki.
        </p>
        <Button onClick={() => demoSession.login()}>Zaloguj jako użytkownika demo</Button>
      </section>
    );
  }

  return (
    <div className="konto">
      <nav className="konto__nawigacja" aria-label="Konto">
        <ul className="lista konto__lista">
          {NAV.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className="konto__link"
                aria-current={n.id === current ? "page" : undefined}
              >
                {n.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/ulubione" className="konto__link">
              Ulubione
            </Link>
          </li>
        </ul>
        <Button variant="secondary" onClick={() => demoSession.logout()}>
          Wyloguj
        </Button>
      </nav>
      <div className="konto__tresc">{children}</div>
    </div>
  );
}
