// B-607, docs/15 §4: pozycje nawigacji. Ekrany z przyszlych zadan sa wylaczone z etykieta "wkrotce" (nie ma martwych odnosnikow).
export interface NavItem {
  href: string;
  label: string;
  /** true = ekran powstaje w kolejnym zadaniu (pozycja wylaczona z etykieta "wkrotce"). */
  soon?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Pulpit" },
  { href: "/produkty", label: "Katalog" },
  { href: "/zamowienia", label: "Zamówienia" },
  { href: "/ustawienia", label: "Ustawienia" },
  { href: "/tresci", label: "Treści" },
  { href: "/zgloszenia", label: "Zgłoszenia" },
  { href: "/media", label: "Zdjęcia" },
  { href: "/dziennik", label: "Dziennik zmian" },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
