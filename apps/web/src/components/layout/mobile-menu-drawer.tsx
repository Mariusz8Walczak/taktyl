"use client";
// F-004, wzorzec: menu mobilne = szuflada z lewej (docs/08), modul nakladek @taktyl/ui (A-12): pulapka fokusu,
// Esc, tlo, powrot fokusu na przycisk menu, 100dvh. TAKTYL-77: laduje sie leniwie z mobile-menu.tsx
// (pierwsze najechanie, fokus albo dotkniecie przycisku "Menu"), wiec Drawer nie wchodzi do bazy JS strony.
import { Drawer } from "@taktyl/ui";
import type { RefObject } from "react";
import { ACCOUNT_LINK, COMPARE_LINK, NAV_MAIN, SEARCH_LINK, WISHLIST_LINK } from "../../lib/nav";
import { CATEGORY_SHORTCUTS } from "../../lib/category-shortcuts";
import { NavLink } from "./nav-link";

export interface MobileMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

export default function MobileMenuDrawer({ open, onClose, returnFocusRef }: MobileMenuDrawerProps) {
  return (
    <Drawer side="left" open={open} onClose={onClose} title="Menu" returnFocusRef={returnFocusRef}>
      <nav aria-label="Menu główne">
        <ul className="lista">
          {NAV_MAIN.map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className="menu-mobilne__link" onClick={onClose}>
                {item.label}
              </NavLink>
              {/* F-003: skroty filtrow kategorii tez w szufladzie telefonu */}
              {CATEGORY_SHORTCUTS[item.href] ? (
                <ul className="lista menu-mobilne__skroty" aria-label={`Skróty: ${item.label}`}>
                  {(CATEGORY_SHORTCUTS[item.href] ?? []).map((s) => (
                    <li key={s.href}>
                      <NavLink href={s.href} className="menu-mobilne__link" onClick={onClose}>
                        {s.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Narzędzia" className="menu-mobilne__dodatkowe">
        <ul className="lista">
          {[SEARCH_LINK, WISHLIST_LINK, COMPARE_LINK, ACCOUNT_LINK].map((item) => (
            <li key={item.href}>
              <NavLink href={item.href} className="menu-mobilne__link" onClick={onClose}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </Drawer>
  );
}
