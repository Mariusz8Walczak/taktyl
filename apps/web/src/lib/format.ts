// Regula 7 (docs/11 pulapki 6-7): kwoty i teksty wylacznie przez Intl; logika liczbowa zostaje w @taktyl/domain.
import { formatPLN } from "@taktyl/domain";

const plnWhole = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "299 zł" dla pelnych zlotych (pasek warunkow), inaczej zwykle "299,50 zł". Grosze to liczby calkowite. */
export function formatPLNShort(gr: number): string {
  return gr % 100 === 0 ? plnWhole.format(gr / 100) : formatPLN(gr);
}
