"use client";
// F-150, F-151 (audyt P1-4): opisy pozycji koszyka z `/api/cart/details` (miniatura, wariant po ludzku, czesci
// konfiguracji). Pamiec podreczna na strone: SKU raz pobrane nie wracaja do serwera. Brak odpowiedzi = koszyk
// dziala jak dotad (nazwa z wyceny), bez komunikatu bledu - opis to dodatek.
import { useEffect, useState } from "react";
import type { CartSkuDetails } from "./details";

const known = new Map<string, CartSkuDetails | null>();

async function fetchMissing(skus: readonly string[]): Promise<void> {
  const missing = skus.filter((s) => !known.has(s));
  if (missing.length === 0) return;
  try {
    const res = await fetch(`/api/cart/details?skus=${missing.map(encodeURIComponent).join(",")}`);
    if (!res.ok) return;
    const data = (await res.json()) as Record<string, CartSkuDetails>;
    for (const s of missing) known.set(s, data[s] ?? null);
  } catch {
    /* opis pozycji jest dodatkiem */
  }
}

function snapshot(skus: readonly string[]): Record<string, CartSkuDetails> {
  const out: Record<string, CartSkuDetails> = {};
  for (const s of skus) {
    const d = known.get(s);
    if (d) out[s] = d;
  }
  return out;
}

export function useCartDetails(skus: readonly string[]): Record<string, CartSkuDetails> {
  const key = [...new Set(skus)].sort().join(",");
  const [details, setDetails] = useState<Record<string, CartSkuDetails>>(() =>
    snapshot(key ? key.split(",") : []),
  );
  useEffect(() => {
    const list = key ? key.split(",") : [];
    let live = true;
    setDetails(snapshot(list));
    void fetchMissing(list).then(() => {
      if (live) setDetails(snapshot(list));
    });
    return () => {
      live = false;
    };
  }, [key]);
  return details;
}

/** Tylko do testow: czysci pamiec podreczna miedzy przypadkami. */
export function resetCartDetailsCache(): void {
  known.clear();
}
