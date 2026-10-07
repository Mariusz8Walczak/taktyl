// Wycena setu i koszyka w groszach (ADR-0002, docs/03 par. 6-7, docs/04 par. 5).
// F-107 podsumowanie ceny setu, F-110 set jako grupa, F-152 darmowa dostawa,
// F-153 kody rabatowe, F-154 grupa setu w koszyku, F-155 podsumowanie koszyka.
import type { SkuIndex } from "./catalog.js";
import type { Grosze } from "./money.js";
import type { ShopConfig } from "./shop.js";

export interface SetDiscountRule {
  percent: number;
  requiresCategories: readonly string[];
}

export interface SetItem {
  sku: string;
  category: string;
  /** Cena AKTUALNA wariantu (z promocja), nie regular_price (pulapka 21). */
  price: Grosze;
}

export interface SetPriceLine {
  sku: string;
  price: Grosze;
  /** Czesc rabatu setu przypadajaca na pozycje. */
  discount: Grosze;
  net: Grosze;
}

export interface SetPrice {
  sum: Grosze;
  discount: Grosze;
  total: Grosze;
  /** "Oszczedzasz X zl" = rabat. */
  savings: Grosze;
  /** Czy komplet kategorii wymaganych przez shop.json uprawnia do rabatu. */
  complete: boolean;
  lines: SetPriceLine[];
}

/** F-107: rabat = Math.round(suma * procent / 100); polowki w gore (shop.json -> rounding). */
export function setDiscountAmount(sum: Grosze, percent: number): Grosze {
  return Math.round((sum * percent) / 100);
}

/**
 * F-107: rozbicie rabatu na pozycje: floor(cena_i * rabat / suma), reszta groszy
 * na ostatnia pozycje. Suma rozbicia = rabat (test).
 */
export function allocateDiscount(prices: readonly Grosze[], discount: Grosze): Grosze[] {
  const sum = prices.reduce((a, b) => a + b, 0);
  if (prices.length === 0) return [];
  if (sum <= 0 || discount <= 0) return prices.map(() => 0);
  const parts = prices.map((p) => Math.floor((p * discount) / sum));
  const allocated = parts.reduce((a, b) => a + b, 0);
  const lastIndex = parts.length - 1;
  parts[lastIndex] = (parts[lastIndex] ?? 0) + (discount - allocated);
  return parts;
}

/** Czy kategorie pokrywaja wszystkie wymagane do rabatu setu. */
export function hasRequiredCategories(
  categories: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((c) => categories.includes(c));
}

/** F-107, F-110: cena setu (suma, rabat, razem) i rozbicie rabatu na pozycje. */
export function priceSet(items: readonly SetItem[], rule: SetDiscountRule): SetPrice {
  const sum = items.reduce((a, i) => a + i.price, 0);
  const complete = hasRequiredCategories(
    items.map((i) => i.category),
    rule.requiresCategories,
  );
  const discount = complete ? setDiscountAmount(sum, rule.percent) : 0;
  const parts = allocateDiscount(
    items.map((i) => i.price),
    discount,
  );
  return {
    sum,
    discount,
    total: sum - discount,
    savings: discount,
    complete,
    lines: items.map((i, idx) => {
      const part = parts[idx] ?? 0;
      return { sku: i.sku, price: i.price, discount: part, net: i.price - part };
    }),
  };
}

// ---------------------------------------------------------------------------
// Koszyk (docs/03 par. 7): ceny nie sa zapisywane, liczone przy kazdej wycenie.
// ---------------------------------------------------------------------------

export type CartEntry =
  | { type: "set"; id: string; qty: number; items: readonly { sku: string }[] }
  | { type: "item"; sku: string; qty: number };

export type CodeStatus = "none" | "unknown" | "sets-only" | "applied";

export type CartIssueKind = "unknown-sku" | "out-of-stock" | "quantity-over-stock";

export interface CartIssue {
  sku: string;
  kind: CartIssueKind;
}

export interface QuoteLine {
  type: "set" | "item";
  /** id grupy (set) albo sku (pozycja) */
  key: string;
  qty: number;
  /** Wartosc produktow w linii (cena aktualna x ilosc). */
  value: Grosze;
  setDiscount: Grosze;
  codeDiscount: Grosze;
  total: Grosze;
  /** Pozycje jednostkowe (dla setu: trzy). Rabaty za JEDNA sztuke grupy. */
  items: SetPriceLine[];
  /** Czy set ma komplet kategorii (bez kompletu nie ma rabatu). */
  setComplete: boolean;
}

export interface CartQuote {
  lines: QuoteLine[];
  productsValue: Grosze;
  setDiscount: Grosze;
  codeDiscount: Grosze;
  codeStatus: CodeStatus;
  /** Wartosc po rabatach: baza progu darmowej dostawy (F-152). */
  afterDiscounts: Grosze;
  /** Ile brakuje do darmowej dostawy (0 = darmowa). */
  freeShippingRemaining: Grosze;
  shippingFree: boolean;
  /** Cena wybranej metody (po darmowej dostawie), null gdy metoda nie wybrana. */
  shipping: Grosze | null;
  total: Grosze;
  issues: CartIssue[];
}

export interface QuoteCartInput {
  entries: readonly CartEntry[];
  index: SkuIndex;
  config: ShopConfig;
  code?: string | null;
  shippingMethodId?: string | null;
}

/**
 * F-152, F-153, F-154, F-155: wycena koszyka w groszach.
 * - rabat setu od cen aktualnych, tylko dla kompletu kategorii;
 * - kod procentowy (TAKTYL10) nie obejmuje pozycji w setach; rabat liczony raz od sumy pozycji spoza setow;
 * - prog darmowej dostawy liczony PO rabatach (>= prog = darmowa).
 */
export function quoteCart(input: QuoteCartInput): CartQuote {
  const { entries, index, config } = input;
  const issues: CartIssue[] = [];
  const lines: QuoteLine[] = [];

  for (const entry of entries) {
    const skus = entry.type === "set" ? entry.items.map((i) => i.sku) : [entry.sku];
    const setItems: SetItem[] = [];
    for (const sku of skus) {
      const found = index.get(sku);
      if (!found) {
        issues.push({ sku, kind: "unknown-sku" });
        continue;
      }
      if (found.variant.stock <= 0) {
        issues.push({ sku, kind: "out-of-stock" });
      } else if (entry.qty > found.variant.stock) {
        issues.push({ sku, kind: "quantity-over-stock" });
      }
      setItems.push({ sku, category: found.product.category, price: found.variant.price });
    }
    if (setItems.length === 0) continue;

    if (entry.type === "set") {
      const price = priceSet(setItems, config.setDiscount);
      lines.push({
        type: "set",
        key: entry.id,
        qty: entry.qty,
        value: price.sum * entry.qty,
        setDiscount: price.discount * entry.qty,
        codeDiscount: 0,
        total: price.total * entry.qty,
        items: price.lines,
        setComplete: price.complete,
      });
    } else {
      const item = setItems[0] as SetItem;
      lines.push({
        type: "item",
        key: entry.sku,
        qty: entry.qty,
        value: item.price * entry.qty,
        setDiscount: 0,
        codeDiscount: 0,
        total: item.price * entry.qty,
        items: [{ sku: item.sku, price: item.price, discount: 0, net: item.price }],
        setComplete: false,
      });
    }
  }

  // Kod rabatowy (F-153).
  const normalizedCode = (input.code ?? "").trim().toUpperCase();
  const code =
    normalizedCode === "" ? undefined : config.codes.find((c) => c.code === normalizedCode);
  let codeStatus: CodeStatus = normalizedCode === "" ? "none" : code ? "applied" : "unknown";
  let freeShippingByCode = false;

  if (code?.type === "percent") {
    const eligible = lines.filter((l) => l.type === "item");
    if (eligible.length === 0) {
      codeStatus = "sets-only";
    } else {
      const eligibleSum = eligible.reduce((a, l) => a + l.total, 0);
      const codeDiscount = setDiscountAmount(eligibleSum, code.value);
      const parts = allocateDiscount(
        eligible.map((l) => l.total),
        codeDiscount,
      );
      eligible.forEach((l, i) => {
        const part = parts[i] ?? 0;
        l.codeDiscount = part;
        l.total -= part;
      });
    }
  } else if (code?.type === "free_shipping") {
    freeShippingByCode = true;
  }

  const productsValue = lines.reduce((a, l) => a + l.value, 0);
  const setDiscount = lines.reduce((a, l) => a + l.setDiscount, 0);
  const codeDiscount = lines.reduce((a, l) => a + l.codeDiscount, 0);
  const afterDiscounts = productsValue - setDiscount - codeDiscount;

  // Dostawa (F-152): prog po rabatach.
  const shippingFree = freeShippingByCode || afterDiscounts >= config.freeShippingThreshold;
  const freeShippingRemaining = shippingFree ? 0 : config.freeShippingThreshold - afterDiscounts;
  const method = config.shippingMethods.find((m) => m.id === input.shippingMethodId);
  const shipping = method ? (shippingFree ? 0 : method.price) : null;

  return {
    lines,
    productsValue,
    setDiscount,
    codeDiscount,
    codeStatus,
    afterDiscounts,
    freeShippingRemaining,
    shippingFree,
    shipping,
    total: afterDiscounts + (shipping ?? 0),
    issues,
  };
}
