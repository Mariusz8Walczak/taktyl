// F-002, F-004, F-009 (docs/05 §1): adresy nawigacji. Etykiety po polsku, adresy bez polskich znakow.
export interface NavItem {
  label: string;
  href: string;
}

/** Glowna nawigacja: komputer w naglowku, telefon w szufladzie. */
export const NAV_MAIN: readonly NavItem[] = [
  { label: "Klawiatury", href: "/klawiatury" },
  { label: "Myszki", href: "/myszki" },
  { label: "Podkładki", href: "/podkladki" },
  { label: "Zbuduj set", href: "/zbuduj-set" },
  { label: "Poradnik", href: "/poradnik" },
];

export const SEARCH_LINK: NavItem = { label: "Szukaj", href: "/szukaj" };
export const WISHLIST_LINK: NavItem = { label: "Ulubione", href: "/ulubione" };
export const COMPARE_LINK: NavItem = { label: "Porównaj", href: "/porownaj" };
export const CART_LINK: NavItem = { label: "Koszyk", href: "/koszyk" };

export const FOOTER_SHOP: readonly NavItem[] = [
  ...NAV_MAIN,
  { label: "O sklepie", href: "/o-sklepie" },
];
export const FOOTER_HELP: readonly NavItem[] = [
  { label: "Dostawa i płatności", href: "/dostawa-i-platnosci" },
  { label: "Zwroty i reklamacje", href: "/zwroty-i-reklamacje" },
  { label: "Pytania i odpowiedzi", href: "/faq" },
  { label: "Kontakt", href: "/kontakt" },
];
export const FOOTER_LEGAL: readonly NavItem[] = [
  { label: "Regulamin", href: "/regulamin" },
  { label: "Polityka prywatności", href: "/polityka-prywatnosci" },
  { label: "Pliki cookies", href: "/cookies" },
  { label: "Zużyty sprzęt", href: "/zuzyty-sprzet" },
];

/** Czy adres jest aktywny dla biezacej sciezki (sam adres albo jego podstrona). */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
