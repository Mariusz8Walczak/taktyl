"use client";
// F-132, F-045 (wzorzec: siatka kart `product-style-0X` + lista zyczen `wishlist`, docs/08 §6): /ulubione. Siatka kart zapisanych
// SKU (zdjecie wariantu, nazwa, wariant, cena), "Dodaj do koszyka" (adapter; pozycja przechodzi z ulubionych do koszyka)
// i "Usun z ulubionych". Pusty stan z zaproszeniem. SKU, ktorego nie ma juz w katalogu, jest zgloszone i do usuniecia.
import { PRODUCT_FORMS, formatCount, formatPLN } from "@taktyl/domain";
import { Button, ProductImage, useToast, VisuallyHidden } from "@taktyl/ui";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { hydratedSnapshot } from "../../lib/account/persisted-store";
import { addToCart } from "../../lib/cart-adapter";
import { toManifestEntry, MEDIA_BASE_URL } from "../../lib/catalog/images";
import type { LiteProduct, LiteVariant } from "../../lib/compare/lite";
import { track } from "../../lib/track";
import { buildItem, grToZl } from "../../lib/track-items";
import { useWishlistSkus, wishlist } from "../../lib/wishlist/store";

interface Entry {
  product: LiteProduct;
  variant: LiteVariant;
}

export function WishlistPage({ catalog }: { catalog: readonly LiteProduct[] }) {
  const skus = useWishlistSkus();
  const hydrated = useSyncExternalStore(
    hydratedSnapshot.subscribe,
    hydratedSnapshot.client,
    hydratedSnapshot.server,
  );
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  if (!hydrated) {
    return (
      <p className="porownaj__stan" role="status">
        Wczytuję ulubione…
      </p>
    );
  }

  const found: Entry[] = [];
  const missing: string[] = [];
  for (const sku of skus) {
    let hit: Entry | null = null;
    for (const product of catalog) {
      const variant = product.variants.find((v) => v.sku === sku);
      if (variant) {
        hit = { product, variant };
        break;
      }
    }
    if (hit) found.push(hit);
    else missing.push(sku);
  }

  if (skus.length === 0) {
    return (
      <div className="pusty-stan">
        <p className="pusty-stan__tekst">
          Nie masz jeszcze ulubionych produktów. Użyj przycisku „Dodaj do ulubionych” na liście albo
          na karcie produktu, a wrócisz do nich tutaj.
        </p>
        <div className="pusty-stan__akcje">
          <Link href="/klawiatury" className="tk-btn tk-btn--glowny">
            Zobacz klawiatury
          </Link>
          <Link href="/zbuduj-set" className="tk-btn tk-btn--poboczny">
            Zbuduj set
          </Link>
        </div>
      </div>
    );
  }

  const move = async ({ product, variant }: Entry) => {
    if (busy) return;
    setBusy(variant.sku);
    try {
      const res = await addToCart({ sku: variant.sku, qty: 1 });
      if (!res.ok) {
        toast({ message: "Nie udało się dodać do koszyka. Spróbuj ponownie." });
        return;
      }
      wishlist.remove([variant.sku]);
      toast({ message: "Przeniesiono do koszyka" });
      track("add_to_cart", {
        items: [
          buildItem({
            sku: variant.sku,
            name: product.name,
            category: product.category,
            variant: variant.label,
            priceGr: variant.priceGr,
            listId: "ulubione",
            listName: "Ulubione",
          }),
        ],
        currency: "PLN",
        value: grToZl(variant.priceGr),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ulubione">
      <p className="porownaj__licznik" role="status">
        Zapisane: {formatCount(found.length, PRODUCT_FORMS)}.
      </p>
      {missing.length > 0 ? (
        <div className="ulubione__brak" role="status">
          <p>
            {missing.length === 1
              ? "Jeden zapisany produkt nie jest już w katalogu."
              : `${missing.length} zapisane produkty nie są już w katalogu.`}
          </p>
          <Button variant="secondary" onClick={() => wishlist.remove(missing)}>
            Usuń z listy
          </Button>
        </div>
      ) : null}
      <ul className="lista ulubione__siatka">
        {found.map((e) => (
          <li key={e.variant.sku} className="karta ulubione__karta">
            <div className="karta__zdjecie">
              {e.variant.image ? (
                <ProductImage
                  entry={toManifestEntry(e.variant.image)}
                  baseUrl={MEDIA_BASE_URL}
                  productName={e.product.name}
                  colorName={e.variant.colorName}
                  sizes="(min-width: 992px) 25vw, 50vw"
                  className="karta__obraz"
                />
              ) : null}
            </div>
            <div className="karta__tresc">
              <h2 className="karta__nazwa">
                <Link href={`${e.product.href}?sku=${e.variant.sku}`} className="ulubione__link">
                  {e.product.name}
                </Link>
              </h2>
              <p className="ulubione__wariant">{e.variant.label}</p>
              <p className="karta__cena">
                <span className="karta__kwota">{formatPLN(e.variant.priceGr)}</span>
              </p>
              {!e.variant.buyable ? (
                <p className="ulubione__niedostepny">Ten wariant jest teraz niedostępny.</p>
              ) : null}
              <div className="karta__akcje">
                <Button
                  disabled={!e.variant.buyable}
                  loading={busy === e.variant.sku}
                  onClick={() => void move(e)}
                >
                  Dodaj do koszyka<VisuallyHidden>: {e.product.name}</VisuallyHidden>
                </Button>
                <Button variant="secondary" onClick={() => wishlist.remove([e.variant.sku])}>
                  Usuń z ulubionych<VisuallyHidden>: {e.product.name}</VisuallyHidden>
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
