"use client";
// F-150...F-157 (ADR-0007): wycena koszyka. Przegladarka pyta ten sam host (`/api/cart/quote` -> `POST /v1/cart/quote`,
// bez cache), bo nie woluje API wprost (WEB-002). Ceny nie sa zapisywane: kazda zmiana koszyka = nowa wycena.
// A-18: szkielet dopiero, gdy ladowanie trwa dluzej niz 300 ms. Blad sieci = komunikat, koszyk zostaje zapisany.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartState, Quote } from "./types";

export interface QuoteRequestBody {
  items: (
    | { type: "item"; sku: string; qty: number }
    | { type: "set"; id: string; qty: number; profile: string | null; skus: string[] }
  )[];
  coupon: string | null;
  shipping_method: string | null;
}

/** Koszyk -> zadanie wyceny (docs/16 §6.1): SKU, ilosci, sety i kod; nigdy cen. Pusty koszyk = null. */
export function buildQuoteRequest(
  state: CartState,
  shippingMethod: string | null = null,
): QuoteRequestBody | null {
  if (state.lines.length === 0) return null;
  return {
    items: state.lines.map((l) =>
      l.type === "item"
        ? { type: "item", sku: l.sku, qty: l.qty }
        : {
            type: "set",
            id: l.id,
            qty: l.qty,
            profile: l.profile,
            skus: l.items.map((i) => i.sku),
          },
    ),
    coupon: state.code,
    shipping_method: shippingMethod,
  };
}

export type QuoteErrorKind = "network" | "rate_limited" | "server" | "invalid";
export class QuoteError extends Error {
  override readonly name = "QuoteError";
  constructor(
    readonly kind: QuoteErrorKind,
    message: string,
  ) {
    super(message);
  }
}

export const QUOTE_ERROR_TEXT: Record<QuoteErrorKind, string> = {
  network: "Nie udało się sprawdzić cen i dostępności. Twój koszyk jest zachowany.",
  rate_limited:
    "Zbyt wiele zapytań naraz. Poczekaj chwilę i spróbuj ponownie. Twój koszyk jest zachowany.",
  server: "Nie udało się sprawdzić cen i dostępności. Twój koszyk jest zachowany.",
  invalid:
    "Nie możemy wycenić tego koszyka. Usuń pozycję, która jest niedostępna, i spróbuj ponownie.",
};

function isQuote(x: unknown): x is Quote {
  const q = x as Quote | null;
  return Boolean(q && Array.isArray(q.lines) && q.summary && Array.isArray(q.problems));
}

export async function fetchQuote(body: QuoteRequestBody, signal?: AbortSignal): Promise<Quote> {
  let res: Response;
  try {
    res = await fetch("/api/cart/quote", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new QuoteError("network", "Brak połączenia.");
  }
  if (res.status === 429) throw new QuoteError("rate_limited", "429");
  if (res.status === 400 || res.status === 422) throw new QuoteError("invalid", String(res.status));
  if (!res.ok) throw new QuoteError("server", String(res.status));
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new QuoteError("server", "json");
  }
  if (!isQuote(json)) throw new QuoteError("server", "kontrakt");
  return json;
}

/** Czas, po jakim pokazujemy szkielet (A-18). */
export const SKELETON_DELAY_MS = 300;
const DEBOUNCE_MS = 120;

export interface UseQuote {
  /** Ostatnia znana wycena (zostaje widoczna podczas odswiezania). */
  quote: Quote | null;
  status: "idle" | "loading" | "ready" | "error";
  /** true, gdy ladowanie trwa > 300 ms: pokaz szkielet (A-18). */
  slow: boolean;
  error: QuoteError | null;
  reload: () => void;
}

export function useCartQuote(
  state: CartState,
  {
    shippingMethod = null,
    enabled = true,
  }: { shippingMethod?: string | null; enabled?: boolean } = {},
): UseQuote {
  const body = useMemo(() => buildQuoteRequest(state, shippingMethod), [state, shippingMethod]);
  const key = body ? JSON.stringify(body) : "";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<UseQuote["status"]>("idle");
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<QuoteError | null>(null);
  const [nonce, setNonce] = useState(0);
  const bodyRef = useRef(body);
  bodyRef.current = body;

  useEffect(() => {
    const current = bodyRef.current;
    if (!enabled) return undefined;
    if (!current) {
      setQuote(null);
      setStatus("idle");
      setSlow(false);
      setError(null);
      return undefined;
    }
    const ctrl = new AbortController();
    setStatus("loading");
    const slowTimer = setTimeout(() => setSlow(true), SKELETON_DELAY_MS);
    const start = setTimeout(() => {
      fetchQuote(current, ctrl.signal)
        .then((q) => {
          setQuote(q);
          setError(null);
          setStatus("ready");
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return;
          setError(e instanceof QuoteError ? e : new QuoteError("server", "?"));
          setStatus("error");
        })
        .finally(() => {
          clearTimeout(slowTimer);
          if (!ctrl.signal.aborted) setSlow(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(start);
      clearTimeout(slowTimer);
      setSlow(false);
    };
  }, [key, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { quote, status, slow, error, reload };
}

/** Wygodne odczyty z wyceny. */
export function quoteIndex(quote: Quote | null) {
  const items = new Map<string, Extract<Quote["lines"][number], { type: "item" }>>();
  const sets = new Map<string, Extract<Quote["lines"][number], { type: "set" }>>();
  for (const l of quote?.lines ?? []) {
    if (l.type === "item") items.set(l.sku, l);
    else sets.set(l.id, l);
  }
  const problems = new Map<string, Quote["problems"][number]>();
  for (const p of quote?.problems ?? [])
    if (!problems.has(p.sku) || p.code === "out_of_stock") problems.set(p.sku, p);
  return { items, sets, problems };
}

/** F-157: czy sa pozycje, ktorych nie da sie kupic (brak stanu, nieznany SKU): blokuje przejscie dalej. */
export function hasBlockingProblems(quote: Quote | null): boolean {
  return Boolean(
    quote?.problems.some((p) => p.code === "out_of_stock" || p.code === "unknown_sku"),
  );
}
