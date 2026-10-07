// F-003 (TAKTYL-59): skroty filtrow menu kategorii. Osobny plik, bo nav.ts trafia do paczki klienta (NavLink),
// a skroty uzywaja tylko naglowek (serwer) i leniwa szuflada telefonu.
import type { NavItem } from "./nav";

/**
 * F-003: skroty filtrow w menu kategorii. Adres = kategoria + filtr w URL (F-022), wartosci z data/facets.json
 * (test `category-menu.test.tsx` sprawdza, ze parser listingu odczytuje je jako ustawiony filtr).
 */
export const CATEGORY_SHORTCUTS: Readonly<Record<string, readonly NavItem[]>> = {
  "/klawiatury": [
    { label: "60–65%", href: "/klawiatury?rozmiar=60,65" },
    { label: "Bezprzewodowe", href: "/klawiatury?lacznosc=2.4ghz,bt" },
    { label: "Ciche", href: "/klawiatury?przelacznik=cichy" },
  ],
  "/myszki": [{ label: "Do 60 g", href: "/myszki?waga=do-60" }],
  "/podkladki": [{ label: "Maty na biurko", href: "/podkladki?typ=biurko" }],
};
