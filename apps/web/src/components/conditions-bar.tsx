// F-067 (docs/01 §2.2, docs/06 §5 "Pasek warunkow"; wzorzec: pasek "ikona + tekst" z docs/08 §3): cztery pozycje
// z danych sklepu - rabat za komplet, prog darmowej dostawy, dni na zwrot, termin wysylki. Same etykiety tekstowe
// (D-010: font ikon szablonu nie jest w repo), kolor `--tekst`. Liczby z ustawien API, nic wpisanego na stale poza
// "Wysylka w 24 h" (docs/01 §2.2).
import type { PublicShopSettings } from "@taktyl/contracts";
import { formatPLNShort } from "../lib/format";

export function conditionItems(settings: PublicShopSettings): string[] {
  return [
    `−${settings.set_discount.percent}% za komplet`,
    `Darmowa dostawa od ${formatPLNShort(settings.free_shipping_threshold_gr)}`,
    `${settings.returns_days} dni na zwrot`,
    "Wysyłka w 24 h",
  ];
}

export function ConditionsBar({ settings }: { settings: PublicShopSettings }) {
  return (
    <ul className="lista pasek-warunkow" aria-label="Warunki zakupu">
      {conditionItems(settings).map((text) => (
        <li key={text} className="pasek-warunkow__pozycja">
          {text}
        </li>
      ))}
    </ul>
  );
}
