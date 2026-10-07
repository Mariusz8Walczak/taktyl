"use client";
// F-043, A-18 (wzorzec: okno "Quick Add" szablonu, docs/08 §3): panel wyboru wariantu (kolor, przelacznik albo rozmiar)
// w nakladce @taktyl/ui (pulapka fokusu, Esc, powrot fokusu na przycisk karty). Niedostepne wartosci sa nieaktywne
// i opisane "Brak"; kombinacja bez stanu jest wybieralna, ale "Dodaj do koszyka" jest wtedy nieaktywny z wyjasnieniem.
// Dane wariantow: akcja serwerowa (`quick-add-action.ts`); gdy odpowiedz trwa > 300 ms, szkielet z polyskiem (A-18).
// Dodanie: `addToCart` z cart-adapter (SKU + ilosc 1, ceny liczy POST /cart/quote), toast "Dodano do koszyka" i
// `add_to_cart` (docs/10 §4) z lista z karty (data-track-item) - zdarzenie TYLKO po potwierdzonym zapisie.
import { formatPLN, formatWithUnit } from "@taktyl/domain";
import { Button, ChoiceTile, Dialog, Swatch, useToast } from "@taktyl/ui";
import { useEffect, useId, useMemo, useState, type ReactNode, type RefObject } from "react";
import { addToCart } from "../../lib/cart-adapter";
import { padSizeDescription } from "../../lib/catalog/attributes";
import { stockView } from "../../lib/catalog/price";
import {
  dimValues,
  isBuyable,
  optionStatus,
  resolveVariant,
  selectionOf,
  type Dim,
  type Selection,
} from "../../lib/catalog/variants";
import { track } from "../../lib/track";
import { buildItem, grToZl } from "../../lib/track-items";
import { variantLabelOf } from "../product/product-context";
import type { QuickAddTarget } from "./quick-add-host";
import { loadQuickAddData, type QuickAddData } from "./quick-add-action";

/** A-18: szkielet dopiero, gdy ladowanie trwa dluzej niz 300 ms (docs/07). */
export const QUICK_ADD_SKELETON_MS = 300;

type Status = "loading" | "ready" | "error";

const cache = new Map<string, QuickAddData>();

export interface QuickAddPanelProps {
  target: QuickAddTarget;
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}

function SkeletonRows() {
  return (
    <div className="szybko__szkielet" aria-hidden="true" data-testid="szybko-szkielet">
      <span className="szybko__wiersz-szkieletu" />
      <span className="szybko__wiersz-szkieletu" />
      <span className="szybko__wiersz-szkieletu" />
    </div>
  );
}

function listOf(trigger: HTMLElement): { listId?: string; listName?: string; index?: number } {
  try {
    const raw = trigger.closest("[data-track-item]")?.getAttribute("data-track-item");
    const item = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: { listId?: string; listName?: string; index?: number } = {};
    if (typeof item.item_list_id === "string") out.listId = item.item_list_id;
    if (typeof item.item_list_name === "string") out.listName = item.item_list_name;
    if (typeof item.index === "number") out.index = item.index;
    return out;
  } catch {
    return {};
  }
}

export default function QuickAddPanel({
  target,
  open,
  onClose,
  returnFocusRef,
}: QuickAddPanelProps) {
  const { toast } = useToast();
  const hintId = useId();
  const key = `${target.category}/${target.slug}`;
  const [data, setData] = useState<QuickAddData | null>(cache.get(key) ?? null);
  const [status, setStatus] = useState<Status>(cache.has(key) ? "ready" : "loading");
  const [slow, setSlow] = useState(false);
  const [sku, setSku] = useState(target.sku);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSku(target.sku);
    const hit = cache.get(key);
    if (hit) {
      setData(hit);
      setStatus("ready");
      return;
    }
    let alive = true;
    setStatus("loading");
    setSlow(false);
    const timer = setTimeout(() => alive && setSlow(true), QUICK_ADD_SKELETON_MS);
    loadQuickAddData(target.slug, target.category)
      .then((res) => {
        if (!alive) return;
        if (!res) {
          setStatus("error");
          return;
        }
        cache.set(key, res);
        setData(res);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"))
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, target.slug, target.category, target.sku]);

  const product = data?.product;
  const variant = product?.variants.find((v) => v.sku === sku) ?? product?.variants[0];
  const selection = useMemo(() => (variant ? selectionOf(variant) : null), [variant]);

  const select = (dim: Dim, value: string) => {
    if (!product || !selection) return;
    const next = resolveVariant(product.variants, selection, dim, value);
    if (next) setSku(next.sku);
  };

  const add = async () => {
    if (!product || !variant || !data || busy || !isBuyable(variant)) return;
    setBusy(true);
    try {
      const result = await addToCart({ sku: variant.sku, qty: 1 });
      if (!result.ok) {
        toast({ message: "Nie udało się dodać do koszyka. Spróbuj ponownie." });
        return;
      }
      toast({ message: "Dodano do koszyka" });
      track("add_to_cart", {
        items: [
          buildItem({
            sku: variant.sku,
            name: product.name,
            category: product.category,
            variant: variantLabelOf(product, variant, data.colors, data.switches),
            priceGr: variant.price_gr,
            quantity: 1,
            ...listOf(target.trigger),
          }),
        ],
        currency: "PLN",
        value: grToZl(variant.price_gr),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const stock = variant ? stockView(variant.stock, variant.status === "active") : null;
  const buyable = isBuyable(variant);
  const footer: ReactNode =
    variant && data && stock ? (
      <div className="szybko__stopka">
        <div>
          <p className="szybko__cena">{formatPLN(variant.price_gr)}</p>
          <p className="szybko__stan" id={hintId}>
            {buyable
              ? stock.label
              : `${variantLabelOf(data.product, variant, data.colors, data.switches)}: ${stock.label}`}
          </p>
        </div>
        <Button
          disabled={!buyable}
          loading={busy}
          onClick={() => void add()}
          aria-describedby={hintId}
        >
          Dodaj do koszyka
        </Button>
      </div>
    ) : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Szybko dodaj: ${product?.name ?? target.slug}`}
      returnFocusRef={returnFocusRef}
      className="szybko"
      footer={footer}
    >
      <div aria-live="polite" aria-busy={status === "loading"}>
        {status === "loading" ? (
          slow ? (
            <SkeletonRows />
          ) : (
            <p className="szybko__stan">Ładowanie…</p>
          )
        ) : null}
        {status === "error" ? (
          <p role="alert">
            Nie udało się wczytać wariantów. Otwórz stronę produktu, aby wybrać wariant.
          </p>
        ) : null}
      </div>
      {status === "ready" && data && selection ? (
        <Picker data={data} selection={selection} onSelect={select} />
      ) : null}
    </Dialog>
  );
}

function Picker({
  data,
  selection,
  onSelect,
}: {
  data: QuickAddData;
  selection: Selection;
  onSelect: (dim: Dim, value: string) => void;
}) {
  const { product, colors, switches } = data;
  const { variants } = product;
  const colorIds = dimValues(variants, "color");
  const switchIds = dimValues(variants, "switch");
  const sizeIds = dimValues(variants, "size");
  const status = (dim: Dim, value: string) => optionStatus(variants, selection, dim, value);
  // "Brak" jest tekstem (kolor nie jest jedynym nosnikiem), takze przy kombinacji bez stanu
  const withBrak = (st: string, text?: string): ReactNode =>
    st === "ok" ? (
      text
    ) : (
      <>
        {text ? (
          <>
            {text}
            <br />
          </>
        ) : null}
        <span className="szybko__brak">Brak</span>
      </>
    );

  return (
    <div className="szybko__warianty">
      {colorIds.length > 0 ? (
        <fieldset className="szybko__grupa">
          <legend className="szybko__nazwa">Kolor</legend>
          <div className="szybko__probki">
            {colorIds.map((id) => {
              const c = colors.find((x) => x.id === id);
              const st = status("color", id);
              return (
                <Swatch
                  key={id}
                  name={`szybko-kolor-${product.id}`}
                  value={id}
                  label={c?.label ?? id}
                  swatch={c?.swatch ?? ""}
                  checked={selection.color === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak" : undefined}
                  onChange={() => onSelect("color", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {switchIds.length > 0 ? (
        <fieldset className="szybko__grupa">
          <legend className="szybko__nazwa">Przełącznik</legend>
          <div className="szybko__kafle">
            {switchIds.map((id) => {
              const sw = switches.find((x) => x.id === id);
              const st = status("switch", id);
              return (
                <ChoiceTile
                  key={id}
                  name={`szybko-przelacznik-${product.id}`}
                  value={id}
                  title={sw?.name ?? id}
                  description={withBrak(
                    st,
                    sw ? `${sw.type_label}, ${formatWithUnit(sw.force_g, "g")}` : undefined,
                  )}
                  checked={selection.switch === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak is-wybieralny" : undefined}
                  onChange={() => onSelect("switch", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
      {sizeIds.length > 0 ? (
        <fieldset className="szybko__grupa">
          <legend className="szybko__nazwa">Rozmiar</legend>
          <div className="szybko__kafle">
            {sizeIds.map((id) => {
              const size = product.padSizes?.[id];
              const st = status("size", id);
              return (
                <ChoiceTile
                  key={id}
                  name={`szybko-rozmiar-${product.id}`}
                  value={id}
                  title={size?.label ?? id.toUpperCase()}
                  description={withBrak(st, size ? padSizeDescription(size.w, size.d) : undefined)}
                  checked={selection.size === id}
                  unavailable={st === "niedostepny"}
                  className={st === "brak" ? "is-brak is-wybieralny" : undefined}
                  onChange={() => onSelect("size", id)}
                />
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}
