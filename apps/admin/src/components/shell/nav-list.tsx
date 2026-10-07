"use client";
// B-607: lista nawigacji (stala boczna i szuflada). Pozycje "wkrotce" to tekst z aria-disabled, nie odnosnik.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, NAV_ITEMS } from "../../lib/nav";

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="adm-nawigacja">
      {NAV_ITEMS.map((item) => (
        <li key={item.href}>
          {item.soon ? (
            <span className="adm-nawigacja__wylaczone" aria-disabled="true">
              {item.label}
              <span className="adm-nawigacja__wkrotce">wkrótce</span>
            </span>
          ) : (
            <Link
              href={item.href}
              className="adm-nawigacja__link"
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
