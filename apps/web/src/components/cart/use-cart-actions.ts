"use client";
// F-151, F-154 (docs/03 §7, docs/11 pulapka 11): operacje koszyka z komunikatem "Cofnij" (5 s) zamiast confirm().
// Zdarzenie `remove_from_cart` po zapisaniu zmiany (docs/10 §1 zasada 2); dane pozycji z biezacej wyceny.
import { useToast } from "@taktyl/ui";
import { useCallback, useMemo } from "react";
import { SET_SPLIT_TEXT, setPercentOf } from "../../lib/cart/messages";
import { quoteIndex } from "../../lib/cart/quote";
import { cartStore } from "../../lib/cart/store";
import { itemLineItem, setLineItems, trackRemoveItems } from "../../lib/cart/tracking";
import { lineKey, type CartLine, type CartSetLine, type Quote } from "../../lib/cart/types";

/** Czas "Cofnij" w komunikacie (F-151). */
export const UNDO_MS = 5000;

export function useCartActions(quote: Quote | null) {
  const { toast } = useToast();
  const idx = useMemo(() => quoteIndex(quote), [quote]);

  const removeLine = useCallback(
    (line: CartLine) => {
      const removed = cartStore.remove(lineKey(line));
      if (!removed) return;
      let message = "Usunięto pozycję z koszyka.";
      if (line.type === "item") {
        const q = idx.items.get(line.sku);
        if (q) {
          trackRemoveItems([itemLineItem(q)]);
          message = `Usunięto z koszyka: ${q.name}.`;
        }
      } else {
        const q = idx.sets.get(line.id);
        if (q) trackRemoveItems(setLineItems(q));
        message = "Usunięto set z koszyka.";
      }
      toast({
        message,
        actionLabel: "Cofnij",
        onAction: () => cartStore.restore(removed),
        duration: UNDO_MS,
      });
    },
    [idx, toast],
  );

  /** F-154: usuniecie elementu rozbija grupe, rabat znika; "Cofnij" przywraca grupe i rabat. */
  const removeFromSet = useCallback(
    (group: CartSetLine, sku: string) => {
      const q = idx.sets.get(group.id);
      const percent = q ? setPercentOf(q) : 0;
      const record = cartStore.removeFromSet(group.id, sku);
      if (!record) return;
      if (q) {
        const item = setLineItems(q).find((i) => i.item_id === sku);
        if (item) trackRemoveItems([item]);
      }
      toast({
        message: SET_SPLIT_TEXT(percent),
        actionLabel: "Cofnij",
        onAction: () => cartStore.undoSplit(record),
        duration: UNDO_MS,
      });
    },
    [idx, toast],
  );

  const setQty = useCallback((line: CartLine, qty: number) => {
    cartStore.setQty(lineKey(line), qty);
  }, []);

  return { removeLine, removeFromSet, setQty, index: idx };
}
