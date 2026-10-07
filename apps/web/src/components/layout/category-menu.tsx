// F-003 (wzorzec: menu rozwijane z naglowka szablonu, docs/08 §6): pozycja kategorii z panelem skrotow filtrow
// ("60–65%", "Bezprzewodowe", "Ciche", "Do 60 g", "Maty na biurko"). Komponent serwerowy, bez JS: panel pokazuje
// CSS (:hover, :focus-within), wiec dziala z klawiatury (Tab wchodzi w panel). Odnosnik kategorii zostaje zwyklym
// odnosnikiem (dziala bez JS i na dotyku: tap prowadzi na listing, skroty sa tez w szufladzie). Esc zamyka panel
// bez przenoszenia fokusu (WCAG 1.4.13) - obsluguje to ShortcutsHost przez atrybut `data-zamkniete`.
import Link from "next/link";
import type { NavItem } from "../../lib/nav";
import "../../styles/menu-kategorii.css";
import { NavLink } from "./nav-link";

export function CategoryMenuItem({
  item,
  shortcuts,
}: {
  item: NavItem;
  shortcuts: readonly NavItem[];
}) {
  return (
    <div className="menu-kat__pozycja">
      <NavLink href={item.href} className="naglowek__link menu-kat__link">
        {item.label}
      </NavLink>
      <ul className="lista menu-kat__panel" aria-label={`Skróty: ${item.label}`}>
        {shortcuts.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="menu-kat__skrot">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
