"use client";
// F-242 (docs/10 §4): `view_cart` przy otwarciu strony koszyka i szuflady, raz na otwarcie, gdy wycena jest gotowa.
import { useEffect, useRef } from "react";
import { trackViewCart } from "../../lib/cart/tracking";
import type { Quote } from "../../lib/cart/types";

export function useViewCartOnce(active: boolean, quote: Quote | null, status: string): void {
  const sent = useRef(false);
  useEffect(() => {
    if (!active) {
      sent.current = false;
      return;
    }
    if (sent.current || status !== "ready" || !quote || quote.lines.length === 0) return;
    sent.current = true;
    trackViewCart(quote);
  }, [active, quote, status]);
}
