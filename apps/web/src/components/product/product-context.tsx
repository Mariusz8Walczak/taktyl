"use client";
// F-062, F-064, F-065, F-066, F-068 (wzorzec: `product-detail` z docs/08 §3): stan wybranego wariantu karty produktu.
// Jeden dostawca dla galerii, kolumny zakupu, paska zakupu na telefonie i wiersza specyfikacji zaleznego od wariantu.
// Wybor zmienia SKU, cene, stan, zdjecia i adres `?sku=` (history.replaceState, adres kanoniczny bez parametru).
import type { Variant } from "@taktyl/contracts";
import { buildItem, grToZl } from "../../lib/track-items";
import { useToast } from "@taktyl/ui";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addToCart } from "../../lib/cart-adapter";
import type { SwitchLike } from "../../lib/catalog/attributes";
import type { ClientProduct } from "../../lib/catalog/product-view";
import {
  selectionOf,
  resolveVariant,
  skuParam,
  type Dim,
  type Selection,
} from "../../lib/catalog/variants";
import { track } from "../../lib/track";

export interface ColorInfo {
  id: string;
  label: string;
  swatch: string;
}
export interface SwitchInfo extends SwitchLike {
  name: string;
}

export interface ProductContextValue {
  product: ClientProduct;
  variant: Variant;
  selection: Selection;
  colors: readonly ColorInfo[];
  switches: readonly SwitchInfo[];
  colorLabel: string;
  /** Opis wariantu do pomiaru i paska zakupu: "Grafit / Próg", "XL / Grafit". */
  variantLabel: string;
  qty: number;
  setQty: (n: number) => void;
  select: (dim: Dim, value: string) => void;
  /** Dodanie do koszyka przez adapter; toast i `add_to_cart` tylko po potwierdzeniu. */
  add: () => Promise<void>;
  busy: boolean;
  listName: string;
}

const Ctx = createContext<ProductContextValue | null>(null);

export function useProduct(): ProductContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProduct wymaga ProductProvider");
  return v;
}

export interface ProductProviderProps {
  product: ClientProduct;
  colors: readonly ColorInfo[];
  switches: readonly SwitchInfo[];
  /** SKU z adresu (`?sku=`), jesli poprawny. */
  initialSku: string | null;
  categoryName: string;
  children: ReactNode;
}

export function variantLabelOf(
  product: ClientProduct,
  variant: Variant,
  colors: readonly ColorInfo[],
  switches: readonly SwitchInfo[],
): string {
  const color = colors.find((c) => c.id === variant.color)?.label ?? variant.color;
  const parts: string[] = [];
  if (variant.size !== null) parts.push(product.padSizes?.[variant.size]?.label ?? variant.size);
  parts.push(color);
  if (variant.switch !== null)
    parts.push(switches.find((s) => s.id === variant.switch)?.name ?? variant.switch);
  return parts.join(" / ");
}

export function ProductProvider({
  product,
  colors,
  switches,
  initialSku,
  categoryName,
  children,
}: ProductProviderProps) {
  const start =
    product.variants.find((v) => v.sku === initialSku) ??
    product.variants.find((v) => v.sku === product.defaultSku) ??
    (product.variants[0] as Variant);
  const [sku, setSku] = useState(start.sku);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const variant = product.variants.find((v) => v.sku === sku) ?? start;
  const colorLabel = colors.find((c) => c.id === variant.color)?.label ?? variant.color;
  const variantLabel = variantLabelOf(product, variant, colors, switches);

  const select = useCallback(
    (dim: Dim, value: string) => {
      const next = resolveVariant(product.variants, selectionOf(variant), dim, value);
      if (!next) return;
      setSku(next.sku);
      try {
        const url = new URL(window.location.href);
        const param = skuParam(next.sku, product.defaultSku);
        if (param) url.searchParams.set("sku", param);
        else url.searchParams.delete("sku");
        window.history.replaceState(window.history.state, "", url);
      } catch {
        /* adres jest dodatkiem, wybor dziala bez niego */
      }
    },
    [product.variants, product.defaultSku, variant],
  );

  // view_item: wejscie na karte i zmiana wariantu (docs/10 §4)
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (viewed.current === variant.sku) return;
    viewed.current = variant.sku;
    track("view_item", {
      items: [
        buildItem({
          sku: variant.sku,
          name: product.name,
          category: product.category,
          variant: variantLabel,
          priceGr: variant.price_gr,
        }),
      ],
      currency: "PLN",
      value: grToZl(variant.price_gr),
    });
  }, [variant.sku, variant.price_gr, product.name, product.category, variantLabel]);

  const add = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await addToCart({ sku: variant.sku, qty });
      if (result.ok) {
        toast({ message: "Dodano do koszyka" });
        track("add_to_cart", {
          items: [
            buildItem({
              sku: variant.sku,
              name: product.name,
              category: product.category,
              variant: variantLabel,
              priceGr: variant.price_gr,
              quantity: qty,
              listId: product.category,
              listName: categoryName,
            }),
          ],
          currency: "PLN",
          value: grToZl(variant.price_gr * qty),
        });
      } else {
        toast({ message: "Nie udało się dodać do koszyka. Spróbuj ponownie." });
      }
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    variant.sku,
    variant.price_gr,
    qty,
    product.name,
    product.category,
    variantLabel,
    categoryName,
    toast,
  ]);

  const value = useMemo<ProductContextValue>(
    () => ({
      product,
      variant,
      selection: selectionOf(variant),
      colors,
      switches,
      colorLabel,
      variantLabel,
      qty,
      setQty,
      select,
      add,
      busy,
      listName: categoryName,
    }),
    [
      product,
      variant,
      colors,
      switches,
      colorLabel,
      variantLabel,
      qty,
      select,
      add,
      busy,
      categoryName,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
