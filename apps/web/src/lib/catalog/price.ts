// F-064, F-044, F-063 (docs/04 §5): cena, promocja z Omnibusem i dostepnosc. Arytmetyka i progi z @taktyl/domain.
// Przekreslona jest `lowest_30d`, NIGDY regular_price (pulapka 22); plakietka -N% liczona od `lowest_30d`.
import {
  formatPLN,
  maxOrderQuantity,
  pluralize,
  promotionBadgePercent,
  stockLevel,
  type StockLevel,
} from "@taktyl/domain";

export interface PriceInput {
  price_gr: number;
  lowest_30d_gr: number | null;
}

export interface PriceView {
  priceGr: number;
  /** Przekreslona najnizsza cena z 30 dni; null poza promocja. */
  omnibusGr: number | null;
  /** Procent plakietki (14 dla "-14%"); null poza promocja. */
  percent: number | null;
}

export function priceView(v: PriceInput): PriceView {
  const percent = promotionBadgePercent({
    sku: "",
    color: "",
    price: v.price_gr,
    regularPrice: null,
    lowest30d: v.lowest_30d_gr,
    stock: 0,
  });
  return { priceGr: v.price_gr, omnibusGr: v.lowest_30d_gr, percent };
}

/** Plakietka promocji: "−14%" (znak minus U+2212). */
export function promoBadgeText(percent: number): string {
  return `−${percent}%`;
}

/** F-064: zdanie obowiazkowe przy kazdej obnizce. */
export function omnibusSentence(lowestGr: number): string {
  return `Najniższa cena z 30 dni przed obniżką: ${formatPLN(lowestGr)}`;
}

export interface StockView {
  level: StockLevel;
  label: string;
  /** Maks. ilosc do dodania: min(stan, 10); 0 = nie mozna kupic. */
  maxQty: number;
}

/** docs/04 §5.3: Brak / Ostatnie sztuki (zostaly N szt.) / Dostepny. Nic spoza danych. */
export function stockView(stock: number, active = true): StockView {
  const level = active ? stockLevel(stock) : "brak";
  const maxQty = active ? maxOrderQuantity(stock) : 0;
  if (level === "brak") return { level, label: "Brak", maxQty };
  if (level === "ostatnie") {
    const verb = pluralize(stock, { one: "została", few: "zostały", many: "zostało" });
    return { level, label: `Ostatnie sztuki (${verb} ${stock}\u00A0szt.)`, maxQty };
  }
  return { level, label: "Dostępny", maxQty };
}

/** F-063: wyjasnienie przy niedostepnym wariancie. */
export const UNAVAILABLE_MESSAGE = "Brak w tym kolorze";
