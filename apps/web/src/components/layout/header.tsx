// F-002, wzorzec: naglowek `home-setup-gear.html` (logotyp, nawigacja, akcje), przyklejony. Wordmark `taktyl`
// zlozony fontem (docs/06 §5.1), bez grafiki. Akcje jako widoczne etykiety tekstowe (docs/09 §2).
import Link from "next/link";
import { CATEGORY_SHORTCUTS } from "../../lib/category-shortcuts";
import { ACCOUNT_LINK, COMPARE_LINK, NAV_MAIN, WISHLIST_LINK } from "../../lib/nav";
import { SearchBox } from "../search/search-box";
import { CartLink } from "./cart-link";
import { MobileMenu } from "./mobile-menu";
import { CategoryMenuItem } from "./category-menu";
import { NavLink } from "./nav-link";

export function Header() {
  return (
    <header className="naglowek">
      <div className="kontener naglowek__wnetrze">
        <MobileMenu />
        <Link href="/" className="wordmark" aria-label="Taktyl, strona główna">
          taktyl
        </Link>
        <nav className="naglowek__nawigacja" aria-label="Główna">
          <ul className="lista lista--rzad">
            {NAV_MAIN.map((item) => (
              <li key={item.href}>
                {CATEGORY_SHORTCUTS[item.href] ? (
                  <CategoryMenuItem item={item} shortcuts={CATEGORY_SHORTCUTS[item.href] ?? []} />
                ) : (
                  <NavLink href={item.href} className="naglowek__link">
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="naglowek__akcje">
          <SearchBox />
          <NavLink href={WISHLIST_LINK.href} className="naglowek__link naglowek__link--dodatkowy">
            {WISHLIST_LINK.label}
          </NavLink>
          <NavLink href={COMPARE_LINK.href} className="naglowek__link naglowek__link--dodatkowy">
            {COMPARE_LINK.label}
          </NavLink>
          <NavLink href={ACCOUNT_LINK.href} className="naglowek__link naglowek__link--dodatkowy">
            {ACCOUNT_LINK.label}
          </NavLink>
          <CartLink />
        </div>
      </div>
    </header>
  );
}
