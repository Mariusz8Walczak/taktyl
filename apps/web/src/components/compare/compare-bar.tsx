"use client";
// F-130 (wzorzec: przyklejony pasek akcji, `product-detail` docs/08 §3): pasek "Porownaj (2)" na dole ekranu, gdy w
// porownaniu jest >= 1 produkt. Nie zaslania fokusu ani stopki (docs/11 pulapka 26): dopoki jest widoczny, <html> ma klase
// `ma-pasek-porownaj` (padding-bottom body i scroll-padding-bottom = wysokosc paska). Na /porownaj pasek jest zbedny.
import { Button } from "@taktyl/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { hydratedSnapshot } from "../../lib/account/persisted-store";
import { COMPARE_MAX, compare, useCompareState } from "../../lib/compare/store";

const HTML_CLASS = "ma-pasek-porownaj";

export function CompareBar() {
  const { ids } = useCompareState();
  const hydrated = useSyncExternalStore(
    hydratedSnapshot.subscribe,
    hydratedSnapshot.client,
    hydratedSnapshot.server,
  );
  const pathname = usePathname();
  const visible = hydrated && ids.length >= 1 && pathname !== "/porownaj";

  useEffect(() => {
    document.documentElement.classList.toggle(HTML_CLASS, visible);
    return () => document.documentElement.classList.remove(HTML_CLASS);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="pasek-porownaj" role="region" aria-label="Porównanie produktów">
      <p className="pasek-porownaj__opis">
        Wybrano {ids.length} z {COMPARE_MAX}
      </p>
      <Button
        variant="secondary"
        className="pasek-porownaj__wyczysc"
        onClick={() => compare.clear()}
      >
        Wyczyść
      </Button>
      <Link href="/porownaj" className="tk-btn tk-btn--glowny pasek-porownaj__przejdz">
        Porównaj ({ids.length})
      </Link>
    </div>
  );
}
