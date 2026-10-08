"use client";
// F-150 (szuflada koszyka), F-042/F-043 (Szybko dodaj), F-010 (skroty), F-130 (pasek porownania); TAKTYL-84.
// Wzorzec: wlasne punkty montowania (docs/08 par. 6). Ladowane leniwie z providers.tsx po hydracji.
import { CartDrawerHost } from "./cart/cart-drawer-host";
import { CompareBarHost } from "./compare/compare-bar-host";
import { QuickAddHost } from "./listing/quick-add-host";
import { ShortcutsHost } from "./shortcuts/shortcuts-host";

export default function GlobalHosts() {
  return (
    <>
      <CartDrawerHost />
      <QuickAddHost />
      <ShortcutsHost />
      <CompareBarHost />
    </>
  );
}
